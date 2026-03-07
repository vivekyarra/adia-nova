"""Report agent that normalizes final output for API responses."""

from __future__ import annotations

from agents.utils import dedupe_keep_order


class ReportAgent:
    """Builds the final structured decision report with citations and fatal flaws."""

    def run(self, reasoning: dict, analysis: dict, include_reasoning: bool = False) -> dict:
        viability_score = reasoning.get("viability_score", 50.0)
        try:
            viability_score = float(viability_score)
        except (TypeError, ValueError):
            viability_score = 50.0
        viability_score = max(0.0, min(100.0, viability_score))

        confidence_score = reasoning.get("confidence_score", 60.0)
        try:
            confidence_score = float(confidence_score)
        except (TypeError, ValueError):
            confidence_score = 60.0
        confidence_score = max(0.0, min(100.0, confidence_score))

        # ── Merge cited risks from reasoning + analysis ──
        risks = self._merge_cited_items(
            reasoning.get("risks", []),
            analysis.get("risks", []),
            limit=6,
        )
        opportunities = self._merge_cited_items(
            reasoning.get("opportunities", []),
            analysis.get("opportunities", []),
            limit=6,
        )

        # ── Fatal flaws from tool use ──
        fatal_flaws = reasoning.get("fatal_flaws", [])

        report = {
            "viability_score": viability_score,
            "confidence_score": confidence_score,
            "risks": risks,
            "opportunities": opportunities,
            "fatal_flaws": fatal_flaws,
            "recommended_strategy": reasoning.get(
                "recommended_strategy",
                "Run low-cost pilots to validate demand before committing full resources.",
            ),
            "summary": reasoning.get("summary", "Decision analysis completed."),
        }
        if include_reasoning:
            report["reasoning_steps"] = dedupe_keep_order(reasoning.get("reasoning_steps", []), limit=6)
        return report

    @staticmethod
    def _merge_cited_items(primary: list, secondary: list, limit: int = 6) -> list[dict]:
        """Merge two lists of cited items ({text, citation} dicts or strings), deduplicating."""
        merged: list[dict] = []
        seen: set[str] = set()

        for item_list in [primary, secondary]:
            for item in item_list:
                if isinstance(item, dict):
                    text = str(item.get("text", "")).strip()
                    citation = str(item.get("citation", "model inference")).strip()
                elif isinstance(item, str):
                    text = item.strip()
                    citation = "model inference"
                else:
                    continue

                if not text:
                    continue
                key = text.lower()
                if key in seen:
                    continue
                seen.add(key)
                merged.append({"text": text, "citation": citation})
                if len(merged) >= limit:
                    return merged
        return merged
