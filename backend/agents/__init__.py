"""Adversarial agent classes for ADIA decision intelligence pipeline."""

from __future__ import annotations


class BlueTeamAgent:
    """Optimist analyst — finds every reason to invest."""

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
        "recurring",
        "NPS",
        "LTV",
        "CAC",
        "traction",
        "enterprise",
        "defensible",
    ]

    def analyze(self, text: str) -> dict:
        text_lower = text.lower()
        found = [w for w in self.SIGNALS if w.lower() in text_lower]

        sentences: list[str] = []
        for sentence in text.replace("\n", ". ").split("."):
            sentence = sentence.strip()
            if len(sentence) > 25 and any(w.lower() in sentence.lower() for w in self.SIGNALS):
                sentences.append(sentence)

        conviction = min(len(found) * 6, 92)

        return {
            "agent": "BLUE_TEAM",
            "stance": "BULLISH",
            "key_assets": sentences[:3] if sentences else ["No strong bull signals detected."],
            "bull_case": (
                f"Identified {len(found)} positive investment signals across "
                "growth, moat, team, and traction vectors."
            ),
            "conviction": conviction,
        }


class RedTeamAgent:
    """Skeptic analyst — finds every reason to pass."""

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
        "token",
        "unverified",
        "negative",
        "declining",
        "departed",
        "fraud",
        "inquiry",
        "investigation",
        "no revenue",
        "pre-sale",
        "virtual",
        "no whitepaper",
        "no demo",
    ]

    def analyze(self, text: str) -> dict:
        text_lower = text.lower()
        found = [w for w in self.SIGNALS if w.lower() in text_lower]

        sentences: list[str] = []
        for sentence in text.replace("\n", ". ").split("."):
            sentence = sentence.strip()
            if len(sentence) > 25 and any(w.lower() in sentence.lower() for w in self.SIGNALS):
                sentences.append(sentence)

        concern = min(len(found) * 8, 96)

        return {
            "agent": "RED_TEAM",
            "stance": "BEARISH",
            "critical_risks": sentences[:3] if sentences else ["No critical risk signals detected."],
            "bear_case": (
                f"Identified {len(found)} structural risk vectors across "
                "burn rate, credibility, execution, and competitive exposure."
            ),
            "concern_level": concern,
        }

