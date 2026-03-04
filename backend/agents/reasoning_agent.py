"""Reasoning agent that fuses research and evidence into a decision."""

from __future__ import annotations

import json

from agents.utils import dedupe_keep_order, parse_json_object
from services.nova_client import NovaCallBudget, NovaClient


class ReasoningAgent:
    """Generates a structured viability assessment."""

    SYSTEM_PROMPT = (
        "You are an investment committee analyst. Provide a balanced viability decision "
        "for startup ideas using the provided research and evidence."
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
            "- reasoning_steps: list of 3 to 6 concise steps explaining your analysis sequence\n"
            "- risks: list of up to 6 concise risks\n"
            "- opportunities: list of up to 6 concise opportunities\n"
            "- recommended_strategy: max 70 words\n"
            "- summary: max 90 words\n\n"
            f"Inputs: {json.dumps(payload, ensure_ascii=True)}"
        )

        raw = self.nova_client.ask_nova(
            prompt,
            budget=budget,
            system_prompt=self.SYSTEM_PROMPT,
            max_tokens=800,
        )

        fallback = {
            "viability_score": 50,
            "reasoning_steps": [
                "Reviewed strategic context from the problem statement.",
                "Synthesized uploaded evidence and extracted key signals.",
                "Balanced downside risks against growth opportunities.",
            ],
            "risks": ["Limited evidence provided for a confident decision."],
            "opportunities": ["Potential market fit if validated with pilots."],
            "recommended_strategy": "Run a constrained pilot and validate unit economics before full launch.",
            "summary": "Decision generated with limited context.",
        }
        data = parse_json_object(raw, fallback=fallback)

        try:
            viability_score = float(data.get("viability_score", fallback["viability_score"]))
        except (TypeError, ValueError):
            viability_score = float(fallback["viability_score"])
        viability_score = max(0.0, min(100.0, viability_score))

        return {
            "viability_score": viability_score,
            "reasoning_steps": dedupe_keep_order(
                data.get("reasoning_steps", fallback["reasoning_steps"]),
                limit=6,
            ),
            "risks": dedupe_keep_order(data.get("risks", fallback["risks"]), limit=6),
            "opportunities": dedupe_keep_order(data.get("opportunities", fallback["opportunities"]), limit=6),
            "recommended_strategy": str(data.get("recommended_strategy", fallback["recommended_strategy"])).strip(),
            "summary": str(data.get("summary", fallback["summary"])).strip(),
        }
