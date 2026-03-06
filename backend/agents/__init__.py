"""Agent modules for ADIA orchestration."""

from __future__ import annotations


class BlueTeamAgent:
    SIGNALS = [
        "revenue",
        "growth",
        "patent",
        "moat",
        "TAM",
        "retention",
        "ARR",
        "runway",
        "customers",
        "profit",
        "raised",
        "pilot",
        "contract",
        "signed",
        "advantage",
        "proprietary",
    ]

    def analyze(self, text: str) -> dict:
        text_lower = text.lower()
        found = [w for w in self.SIGNALS if w.lower() in text_lower]
        sentences = [
            s.strip()
            for s in text.replace("\n", ".").split(".")
            if any(w.lower() in s.lower() for w in self.SIGNALS) and len(s.strip()) > 20
        ]
        conviction = min(len(found) * 7, 90)
        return {
            "agent": "BLUE_TEAM",
            "stance": "BULLISH",
            "key_assets": sentences[:3],
            "bull_case": f"Identified {len(found)} positive investment signals across growth, moat, and team vectors.",
            "conviction": conviction,
        }


class RedTeamAgent:
    SIGNALS = [
        "burn",
        "debt",
        "competitor",
        "churn",
        "delay",
        "challenge",
        "risk",
        "lawsuit",
        "SEC",
        "anonymous",
        "no product",
        "unclear",
        "pending",
        "no revenue",
        "pre-sale",
        "token",
        "unverified",
    ]

    def analyze(self, text: str) -> dict:
        text_lower = text.lower()
        found = [w for w in self.SIGNALS if w.lower() in text_lower]
        sentences = [
            s.strip()
            for s in text.replace("\n", ".").split(".")
            if any(w.lower() in s.lower() for w in self.SIGNALS) and len(s.strip()) > 20
        ]
        concern = min(len(found) * 9, 95)
        return {
            "agent": "RED_TEAM",
            "stance": "BEARISH",
            "critical_risks": sentences[:3],
            "bear_case": f"Identified {len(found)} structural risk vectors across burn, credibility, and execution.",
            "concern_level": concern,
        }

