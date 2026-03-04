"""Utility helpers shared across agents."""

from __future__ import annotations

import json
import re
from typing import Any, Iterable


def parse_json_object(raw_text: str, fallback: dict[str, Any]) -> dict[str, Any]:
    """Extract the first JSON object from model output."""
    if not raw_text:
        return fallback

    cleaned = raw_text.strip()
    candidates = [cleaned]

    fenced = re.findall(r"```(?:json)?\s*(\{.*?\})\s*```", cleaned, flags=re.DOTALL)
    candidates.extend(fenced)

    loose = re.findall(r"(\{.*\})", cleaned, flags=re.DOTALL)
    candidates.extend(loose)

    for candidate in candidates:
        try:
            parsed = json.loads(candidate)
        except json.JSONDecodeError:
            continue
        if isinstance(parsed, dict):
            return parsed
    return fallback


def dedupe_keep_order(items: Iterable[Any], limit: int = 6) -> list[str]:
    """De-duplicate list entries while preserving insertion order."""
    if isinstance(items, str):
        items = [items]

    seen: set[str] = set()
    output: list[str] = []
    for item in items:
        normalized = str(item).strip()
        if not normalized:
            continue
        key = normalized.lower()
        if key in seen:
            continue
        seen.add(key)
        output.append(normalized)
        if len(output) >= limit:
            break
    return output
