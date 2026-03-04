"""Analysis agent for uploaded document and image evidence."""

from __future__ import annotations

from agents.utils import dedupe_keep_order, parse_json_object
from services.document_parser import ParsedInputs
from services.nova_client import ImageInput, NovaCallBudget, NovaClient


class AnalysisAgent:
    """Extracts evidence from uploaded materials."""

    SYSTEM_PROMPT = (
        "You are a due-diligence analyst. Summarize uploaded evidence and identify "
        "risks/opportunities relevant to the business decision."
    )

    def __init__(self, nova_client: NovaClient) -> None:
        self.nova_client = nova_client

    def run(self, problem: str, parsed_inputs: ParsedInputs, budget: NovaCallBudget) -> dict:
        if parsed_inputs.valid_file_count == 0:
            return {
                "document_summary": "No files uploaded.",
                "evidence_points": [],
                "risks": [],
                "opportunities": [],
                "warnings": parsed_inputs.warnings,
            }

        context = parsed_inputs.text_context()
        prompt = (
            "Review the evidence for the decision below and return JSON only.\n"
            "Required keys:\n"
            "- document_summary: <= 90 words\n"
            "- evidence_points: list of up to 5 concrete findings\n"
            "- risks: list of up to 4 risks from uploaded evidence\n"
            "- opportunities: list of up to 4 opportunities from uploaded evidence\n\n"
            f"Problem: {problem}\n"
            f"Extracted text snippets:\n{context}"
        )

        images = [
            ImageInput(name=image.name, image_format=image.image_format, data=image.data)
            for image in parsed_inputs.images[:2]
        ]

        raw = self.nova_client.ask_nova(
            prompt,
            budget=budget,
            system_prompt=self.SYSTEM_PROMPT,
            images=images,
            max_tokens=700,
        )

        fallback = {
            "document_summary": "Evidence processed from uploaded files.",
            "evidence_points": parsed_inputs.retrieved_context[:3],
            "risks": [],
            "opportunities": [],
        }
        data = parse_json_object(raw, fallback=fallback)
        return {
            "document_summary": str(data.get("document_summary", fallback["document_summary"])).strip(),
            "evidence_points": dedupe_keep_order(
                data.get("evidence_points", fallback["evidence_points"]), limit=5
            ),
            "risks": dedupe_keep_order(data.get("risks", fallback["risks"]), limit=4),
            "opportunities": dedupe_keep_order(data.get("opportunities", fallback["opportunities"]), limit=4),
            "warnings": parsed_inputs.warnings,
        }

