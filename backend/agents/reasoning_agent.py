"""Reasoning agent that fuses research and evidence into a decision."""

from __future__ import annotations

import json

from agents.utils import dedupe_keep_order, parse_json_object
from services.nova_client import NovaCallBudget, NovaClient


class ReasoningAgent:
    """Generates a structured viability assessment with tool-based fatal flaw detection."""

    SYSTEM_PROMPT = (
        "You are an investment committee analyst. Provide a balanced viability decision "
        "for startup ideas using the provided research and evidence. "
        "When you identify a fatal flaw, use the flag_fatal_flaw tool to flag it with severity and evidence."
    )

    def __init__(self, nova_client: NovaClient) -> None:
        self.nova_client = nova_client

    def run(self, problem: str, research: dict, analysis: dict, budget: NovaCallBudget) -> dict:
        payload = {
            "problem": problem,
            "research": research,
            "analysis": analysis,
        }
        prompt = (
            "Combine the inputs and return JSON only.\n"
            "Required keys:\n"
            "- viability_score: integer 0-100\n"
            "- confidence_score: integer 0-100\n"
            "- reasoning_steps: list of 3 to 6 concise steps explaining your analysis sequence\n"
            "- risks: list of up to 6 objects, each with keys: \"text\" (concise risk description), "
            "\"citation\" (source: e.g. \"Page 2\", \"uploaded document\", or \"model inference\")\n"
            "- opportunities: list of up to 6 objects, each with keys: \"text\" (concise opportunity description), "
            "\"citation\" (source: e.g. \"Page 1\", \"uploaded document\", or \"model inference\")\n"
            "- recommended_strategy: max 70 words\n"
            "- summary: max 90 words\n\n"
            "For each risk and opportunity, cite the exact source: either the uploaded document "
            "page number (e.g. 'Page 3') or note it as 'model inference'. This is critical.\n\n"
            "Return a confidence score from 0-100 representing how confident the system is in this recommendation.\n\n"
            "If you find a critical flaw that would make this a NO-GO investment, also use the "
            "flag_fatal_flaw tool to flag it.\n\n"
            f"Inputs: {json.dumps(payload, ensure_ascii=True)}"
        )

        # ── Use tool-enabled call for agentic behavior ──
        fatal_flaws: list[dict] = []
        try:
            raw, tool_results = self.nova_client.ask_nova_with_tools(
                prompt,
                budget=budget,
                system_prompt=self.SYSTEM_PROMPT,
                max_tokens=800,
            )
            # Collect any fatal flaws detected via tool use
            for tr in tool_results:
                if tr.get("tool_name") == "flag_fatal_flaw":
                    fatal_flaws.append({
                        "flaw": tr.get("flaw", "Unknown flaw"),
                        "severity": tr.get("severity", "major"),
                        "evidence": tr.get("evidence", "No evidence provided"),
                    })
        except Exception:
            # Fall back to standard call if tool use fails
            raw = self.nova_client.ask_nova(
                prompt,
                budget=budget,
                system_prompt=self.SYSTEM_PROMPT,
                max_tokens=800,
            )

        fallback = {
            "viability_score": 50,
            "confidence_score": 60,
            "reasoning_steps": [
                "Reviewed strategic context from the problem statement.",
                "Synthesized uploaded evidence and extracted key signals.",
                "Balanced downside risks against growth opportunities.",
            ],
            "risks": [{"text": "Limited evidence provided for a confident decision.", "citation": "model inference"}],
            "opportunities": [{"text": "Potential market fit if validated with pilots.", "citation": "model inference"}],
            "recommended_strategy": "Run a constrained pilot and validate unit economics before full launch.",
            "summary": "Decision generated with limited context.",
        }
        data = parse_json_object(raw, fallback=fallback)

        try:
            viability_score = float(data.get("viability_score", fallback["viability_score"]))
        except (TypeError, ValueError):
            viability_score = float(fallback["viability_score"])
        viability_score = max(0.0, min(100.0, viability_score))

        try:
            confidence_score = float(data.get("confidence_score", fallback["confidence_score"]))
        except (TypeError, ValueError):
            confidence_score = float(fallback["confidence_score"])
        confidence_score = max(0.0, min(100.0, confidence_score))

        # Normalize risks/opportunities — support both string and object formats
        raw_risks = data.get("risks", fallback["risks"])
        raw_opps = data.get("opportunities", fallback["opportunities"])

        return {
            "viability_score": viability_score,
            "confidence_score": confidence_score,
            "reasoning_steps": dedupe_keep_order(
                data.get("reasoning_steps", fallback["reasoning_steps"]),
                limit=6,
            ),
            "risks": self._normalize_cited_items(raw_risks, limit=6),
            "opportunities": self._normalize_cited_items(raw_opps, limit=6),
            "recommended_strategy": str(data.get("recommended_strategy", fallback["recommended_strategy"])).strip(),
            "summary": str(data.get("summary", fallback["summary"])).strip(),
            "fatal_flaws": fatal_flaws,
        }

    @staticmethod
    def _normalize_cited_items(items: list, limit: int = 6) -> list[dict]:
        """Convert items to {text, citation} objects, handling both string and dict input."""
        if isinstance(items, str):
            items = [items]
        result: list[dict] = []
        seen: set[str] = set()
        for item in items:
            if isinstance(item, dict):
                text = str(item.get("text", item.get("description", ""))).strip()
                citation = str(item.get("citation", item.get("source", "model inference"))).strip()
            else:
                text = str(item).strip()
                citation = "model inference"
            if not text:
                continue
            key = text.lower()
            if key in seen:
                continue
            seen.add(key)
            result.append({"text": text, "citation": citation})
            if len(result) >= limit:
                break
        return result
