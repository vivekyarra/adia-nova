"""Orchestrates all ADIA agents for each analysis request."""

from __future__ import annotations

from typing import Sequence

from fastapi import UploadFile

from agents.analysis_agent import AnalysisAgent
from agents.reasoning_agent import ReasoningAgent
from agents.report_agent import ReportAgent
from agents.research_agent import ResearchAgent
from services.document_parser import DocumentParser, InvalidUploadError
from services.nova_client import NovaCallBudget, NovaClient


class ADIAOrchestrator:
    """Coordinates agents and enforces a max of 3 Nova calls per request."""

    def __init__(self, nova_client: NovaClient) -> None:
        self.nova_client = nova_client
        self.document_parser = DocumentParser()
        self.research_agent = ResearchAgent(nova_client)
        self.analysis_agent = AnalysisAgent(nova_client)
        self.reasoning_agent = ReasoningAgent(nova_client)
        self.report_agent = ReportAgent()

    async def analyze(
        self,
        problem: str,
        files: Sequence[UploadFile] | None = None,
        include_reasoning: bool = False,
    ) -> dict:
        budget = NovaCallBudget(max_calls=3)
        parsed_inputs = await self.document_parser.parse_files(files or [], problem)

        if files and parsed_inputs.valid_file_count == 0:
            raise InvalidUploadError(
                "No valid files were uploaded. Accepted: PDF, TXT, MD, CSV, JSON, PNG, JPG, JPEG, WEBP."
            )

        research_result = self.research_agent.run(problem=problem, budget=budget)
        analysis_result = self.analysis_agent.run(problem=problem, parsed_inputs=parsed_inputs, budget=budget)
        reasoning_result = self.reasoning_agent.run(
            problem=problem,
            research=research_result,
            analysis=analysis_result,
            budget=budget,
        )
        report = self.report_agent.run(
            reasoning=reasoning_result,
            analysis=analysis_result,
            include_reasoning=include_reasoning,
        )

        report["metadata"] = {
            "nova_calls_used": budget.calls_used,
            "max_nova_calls": budget.max_calls,
            "files_processed": parsed_inputs.valid_file_count,
            "warnings": parsed_inputs.warnings,
        }
        return report
