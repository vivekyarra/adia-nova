"""Research agent for decomposing the decision problem."""

from __future__ import annotations

from agents.utils import dedupe_keep_order, parse_json_object
from services.nova_client import NovaCallBudget, NovaClient


class ResearchAgent:
    """Identifies decision factors and assumptions using Nova."""

    SYSTEM_PROMPT = "You are a strategic business analyst evaluating startup decisions."

    def __init__(self, nova_client: NovaClient) -> None:
        self.nova_client = nova_client

    def run(self, problem: str, budget: NovaCallBudget) -> dict:
        prompt = (
            "Analyze this business decision problem and return JSON only.\n"
            "Required keys:\n"
            "- key_factors: list of up to 5 evaluation factors\n"
            "- assumptions: list of up to 4 assumptions\n"
            "- summary: concise paragraph under 80 words\n\n"
            f"Problem: {problem}"
        )

        raw = self.nova_client.ask_nova(
            prompt,
            budget=budget,
            system_prompt=self.SYSTEM_PROMPT,
            max_tokens=500,
        )

        fallback = {
            "key_factors": ["market demand", "unit economics", "competitive intensity"],
            "assumptions": ["limited information from user input"],
            "summary": "Baseline research generated with minimal context.",
        }
        data = parse_json_object(raw, fallback=fallback)
        return {
            "key_factors": dedupe_keep_order(data.get("key_factors", fallback["key_factors"]), limit=5),
            "assumptions": dedupe_keep_order(data.get("assumptions", fallback["assumptions"]), limit=4),
            "summary": str(data.get("summary", fallback["summary"])).strip(),
        }

