"""Report agent that normalizes final output for API responses."""

from __future__ import annotations

from agents.utils import dedupe_keep_order


class ReportAgent:
    """Builds the final structured decision report."""

    def run(self, reasoning: dict, analysis: dict, include_reasoning: bool = False) -> dict:
        viability_score = reasoning.get("viability_score", 50.0)
        try:
            viability_score = float(viability_score)
        except (TypeError, ValueError):
            viability_score = 50.0
        viability_score = max(0.0, min(100.0, viability_score))

        risks = dedupe_keep_order(
            list(reasoning.get("risks", [])) + list(analysis.get("risks", [])),
            limit=6,
        )
        opportunities = dedupe_keep_order(
            list(reasoning.get("opportunities", [])) + list(analysis.get("opportunities", [])),
            limit=6,
        )

        report = {
            "viability_score": viability_score,
            "risks": risks,
            "opportunities": opportunities,
            "recommended_strategy": reasoning.get(
                "recommended_strategy",
                "Run low-cost pilots to validate demand before committing full resources.",
            ),
            "summary": reasoning.get("summary", "Decision analysis completed."),
        }
        if include_reasoning:
            report["reasoning_steps"] = dedupe_keep_order(reasoning.get("reasoning_steps", []), limit=6)
        return report
