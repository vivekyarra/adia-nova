"""Latency-optimized orchestration for ADIA venture verdicts."""

from __future__ import annotations

import concurrent.futures
import json
from typing import Sequence

from fastapi import UploadFile

from agents.utils import dedupe_keep_order, parse_json_object
from services.document_parser import DocumentParser, InvalidUploadError, ParsedInputs
from services.nova_client import ImageInput, NovaCallBudget, NovaClient


ANALYSIS_FALLBACK = {
    "traction_metrics": ["Limited live analysis available."],
    "revenue_signal": "Revenue signal unavailable.",
    "team_strength": "Team strength could not be verified live.",
    "market_size": "Market size estimate unavailable.",
    "multimodal_evidence": ["No image-specific evidence was processed."],
    "top_risks": [
        "Live Bedrock analysis is unavailable.",
        "The verdict is using a safe fallback path.",
        "Retry for a fresh decision when Nova is reachable.",
    ],
    "top_assets": [
        "The input was parsed successfully.",
        "The workflow stayed available under failure.",
        "Structured output was preserved for the UI.",
    ],
    "analysis_status": "fallback",
}

VERDICT_FALLBACK = {
    "decision": "CONDITIONAL",
    "conviction_score": 58,
    "fatal_flaw": "Live Nova analysis is temporarily unavailable.",
    "asymmetric_upside": "The decision workflow still returns structured output.",
    "next_action": "Retry the analysis after Bedrock reconnects.",
    "verdict_status": "fallback",
}


class ADIAOrchestrator:
    """Runs a two-call Bedrock pipeline tuned for low latency."""

    def __init__(self, nova_client: NovaClient) -> None:
        self.nova_client = nova_client
        self.document_parser = DocumentParser()

    async def analyze(
        self,
        problem: str,
        files: Sequence[UploadFile] | None = None,
        include_reasoning: bool = False,
    ) -> dict:
        parsed_inputs = await self.document_parser.parse_files(files or [], problem)

        if files and parsed_inputs.valid_file_count == 0:
            raise InvalidUploadError(
                "No valid files were uploaded. Accepted: PDF, TXT, MD, CSV, JSON, PNG, JPG, JPEG, WEBP."
            )

        budget = NovaCallBudget(max_calls=2)
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
            analysis_future = executor.submit(self._safe_analysis_call, problem, parsed_inputs, budget)
            verdict_future = executor.submit(self._safe_verdict_call, analysis_future, budget)
            analysis_result = analysis_future.result()
            verdict_result = verdict_future.result()

        return self._build_response(
            analysis_result=analysis_result,
            verdict_result=verdict_result,
            parsed_inputs=parsed_inputs,
            include_reasoning=include_reasoning,
            budget=budget,
        )

    def warmup(self) -> None:
        budget = NovaCallBudget(max_calls=1)
        self.nova_client.ask_nova(
            "Hello",
            budget=budget,
            system_prompt="Reply with ok.",
            max_tokens=20,
            temperature=0.1,
        )

    def _safe_analysis_call(
        self,
        problem: str,
        parsed_inputs: ParsedInputs,
        budget: NovaCallBudget,
    ) -> dict:
        try:
            return self._run_analysis_call(problem, parsed_inputs, budget)
        except Exception:
            return ANALYSIS_FALLBACK.copy()

    def _safe_verdict_call(
        self,
        analysis_future: concurrent.futures.Future,
        budget: NovaCallBudget,
    ) -> dict:
        try:
            analysis_result = analysis_future.result()
            if analysis_result.get("analysis_status") == "fallback":
                return VERDICT_FALLBACK.copy()
            return self._run_verdict_call(analysis_result, budget)
        except Exception:
            return VERDICT_FALLBACK.copy()

    def _run_analysis_call(
        self,
        problem: str,
        parsed_inputs: ParsedInputs,
        budget: NovaCallBudget,
    ) -> dict:
        system_prompt = (
            "You are a research and analysis agent for venture decisions. "
            "Return one JSON object with traction_metrics, revenue_signal, team_strength, "
            "market_size, multimodal_evidence, top_risks, and top_assets. "
            "Use short evidence-backed phrases only."
        )
        prompt = self._build_analysis_prompt(problem, parsed_inputs)
        images = [
            ImageInput(name=image.name, image_format=image.image_format, data=image.data)
            for image in parsed_inputs.images
        ]

        raw = self.nova_client.ask_nova(
            prompt,
            budget=budget,
            system_prompt=system_prompt,
            images=images or None,
            max_tokens=300,
            temperature=0.3,
        )
        data = parse_json_object(raw, fallback=ANALYSIS_FALLBACK)
        return {
            "traction_metrics": self._normalize_items(
                data.get("traction_metrics"),
                fallback=ANALYSIS_FALLBACK["traction_metrics"],
            ),
            "revenue_signal": self._normalize_sentence(
                data.get("revenue_signal"),
                ANALYSIS_FALLBACK["revenue_signal"],
            ),
            "team_strength": self._normalize_sentence(
                data.get("team_strength"),
                ANALYSIS_FALLBACK["team_strength"],
            ),
            "market_size": self._normalize_sentence(
                data.get("market_size"),
                ANALYSIS_FALLBACK["market_size"],
            ),
            "multimodal_evidence": self._normalize_items(
                data.get("multimodal_evidence"),
                fallback=ANALYSIS_FALLBACK["multimodal_evidence"],
            ),
            "top_risks": self._normalize_items(
                data.get("top_risks"),
                fallback=ANALYSIS_FALLBACK["top_risks"],
            ),
            "top_assets": self._normalize_items(
                data.get("top_assets"),
                fallback=ANALYSIS_FALLBACK["top_assets"],
            ),
            "analysis_status": "live",
        }

    def _run_verdict_call(self, analysis_result: dict, budget: NovaCallBudget) -> dict:
        system_prompt = (
            "You are a reasoning and verdict agent. Return one JSON object with "
            "decision, conviction_score, fatal_flaw, asymmetric_upside, and next_action. "
            "decision must be GO, NO-GO, or CONDITIONAL. Keep each value short."
        )
        prompt = self._build_verdict_prompt(analysis_result)

        raw = self.nova_client.ask_nova(
            prompt,
            budget=budget,
            system_prompt=system_prompt,
            max_tokens=300,
            temperature=0.3,
        )
        data = parse_json_object(raw, fallback=VERDICT_FALLBACK)
        return {
            "decision": self._normalize_decision(data.get("decision")),
            "conviction_score": self._normalize_score(data.get("conviction_score"), 58),
            "fatal_flaw": self._normalize_sentence(
                data.get("fatal_flaw"),
                VERDICT_FALLBACK["fatal_flaw"],
            ),
            "asymmetric_upside": self._normalize_sentence(
                data.get("asymmetric_upside"),
                VERDICT_FALLBACK["asymmetric_upside"],
            ),
            "next_action": self._normalize_sentence(
                data.get("next_action"),
                VERDICT_FALLBACK["next_action"],
            ),
            "verdict_status": "live",
        }

    def _build_response(
        self,
        *,
        analysis_result: dict,
        verdict_result: dict,
        parsed_inputs: ParsedInputs,
        include_reasoning: bool,
        budget: NovaCallBudget,
    ) -> dict:
        key_risks = self._normalize_items(
            analysis_result.get("top_risks"),
            fallback=ANALYSIS_FALLBACK["top_risks"],
        )
        key_assets = self._normalize_items(
            analysis_result.get("top_assets"),
            fallback=ANALYSIS_FALLBACK["top_assets"],
        )
        summary = self._build_summary(analysis_result, verdict_result)
        response = {
            "verdict": verdict_result["decision"],
            "conviction_score": verdict_result["conviction_score"],
            "fatal_flaw": verdict_result["fatal_flaw"],
            "asymmetric_upside": verdict_result["asymmetric_upside"],
            "executive_summary": summary,
            "key_risks": key_risks,
            "key_assets": key_assets,
            "recommended_action": verdict_result["next_action"],
            "metadata": {
                "analysis_mode": "two_call_fast_path",
                "latency_mode": "optimized",
                "nova_calls_used": budget.calls_used,
                "max_nova_calls": budget.max_calls,
                "files_processed": parsed_inputs.valid_file_count,
                "warnings": parsed_inputs.warnings,
                "invalid_files": parsed_inputs.invalid_files,
                "analysis_status": analysis_result.get("analysis_status", "unknown"),
                "verdict_status": verdict_result.get("verdict_status", "unknown"),
            },
        }
        if include_reasoning:
            response["reasoning_steps"] = self._build_reasoning_steps(
                parsed_inputs,
                analysis_result,
                verdict_result,
            )
        return response

    def _build_analysis_prompt(self, problem: str, parsed_inputs: ParsedInputs) -> str:
        problem_text = self._trim_words(problem, 80)
        evidence_text = self._trim_words(parsed_inputs.text_context(), 85)
        prompt = (
            "Problem: "
            f"{problem_text}\n"
            "Evidence: "
            f"{evidence_text}\n"
            "Extract traction, revenue, team, market, top 3 risks, top 3 assets, and multimodal evidence. "
            "Return JSON keys traction_metrics, revenue_signal, team_strength, market_size, multimodal_evidence, top_risks, top_assets."
        )
        return self._trim_words(prompt, 190)

    def _build_verdict_prompt(self, analysis_result: dict) -> str:
        prompt = (
            "Analysis summary: "
            f"traction={'; '.join(self._normalize_items(analysis_result.get('traction_metrics'), fallback=[]))}; "
            f"revenue={self._normalize_sentence(analysis_result.get('revenue_signal'), 'Unknown')}; "
            f"team={self._normalize_sentence(analysis_result.get('team_strength'), 'Unknown')}; "
            f"market={self._normalize_sentence(analysis_result.get('market_size'), 'Unknown')}; "
            f"assets={'; '.join(self._normalize_items(analysis_result.get('top_assets'), fallback=[]))}; "
            f"risks={'; '.join(self._normalize_items(analysis_result.get('top_risks'), fallback=[]))}; "
            f"multimodal={'; '.join(self._normalize_items(analysis_result.get('multimodal_evidence'), fallback=[]))}."
        )
        return self._trim_words(prompt, 190)

    def _build_summary(self, analysis_result: dict, verdict_result: dict) -> str:
        summary = (
            f"{verdict_result['decision']} verdict at {verdict_result['conviction_score']} conviction. "
            f"Revenue signal: {analysis_result['revenue_signal']} "
            f"Team signal: {analysis_result['team_strength']} "
            f"Market signal: {analysis_result['market_size']}"
        )
        return self._trim_words(summary, 45)

    def _build_reasoning_steps(
        self,
        parsed_inputs: ParsedInputs,
        analysis_result: dict,
        verdict_result: dict,
    ) -> list[str]:
        steps = [
            "Market, revenue, team, and demand signals were condensed into one fast analysis pass.",
            "Uploaded files and image evidence were folded into the same Bedrock call.",
            f"Top risks reviewed: {'; '.join(self._normalize_items(analysis_result.get('top_risks'), fallback=[])) or 'none'}.",
            f"Final verdict generated: {verdict_result['decision']} at {verdict_result['conviction_score']} conviction.",
        ]
        if parsed_inputs.images:
            steps[1] = "Uploaded files, extracted text, and image evidence were folded into the same Bedrock call."
        return steps

    @staticmethod
    def _trim_words(text: str, max_words: int) -> str:
        words = str(text or "").replace("\n", " ").split()
        if len(words) <= max_words:
            return " ".join(words)
        return " ".join(words[:max_words])

    @staticmethod
    def _normalize_sentence(value: object, fallback: str) -> str:
        text = str(value or "").strip()
        return text or fallback

    @staticmethod
    def _normalize_items(value: object, fallback: list[str], limit: int = 3) -> list[str]:
        if isinstance(value, str):
            items = [value]
        elif isinstance(value, list):
            items = [str(item).strip() for item in value]
        else:
            items = []

        normalized = dedupe_keep_order(items, limit=limit)
        if normalized:
            return normalized
        return fallback[:limit]

    @staticmethod
    def _normalize_decision(value: object) -> str:
        decision = str(value or "").strip().upper()
        if decision in {"GO", "NO-GO", "CONDITIONAL"}:
            return decision
        return VERDICT_FALLBACK["decision"]

    @staticmethod
    def _normalize_score(value: object, fallback: int) -> int:
        try:
            score = int(float(value))
        except (TypeError, ValueError):
            return fallback
        return max(0, min(100, score))
