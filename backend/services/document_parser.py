"""Document ingestion and local FAISS retrieval utilities."""

from __future__ import annotations

from dataclasses import dataclass, field
from io import BytesIO
import re
from typing import Sequence

try:
    import faiss
except ImportError:  # pragma: no cover - fallback only when faiss is unavailable.
    faiss = None

import numpy as np
from PyPDF2 import PdfReader
from fastapi import UploadFile


SUPPORTED_TEXT_EXTENSIONS = {".txt", ".md", ".csv", ".json"}
SUPPORTED_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}
SUPPORTED_PDF_EXTENSIONS = {".pdf"}
MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024
MAX_FILES_PER_REQUEST = 8


class InvalidUploadError(ValueError):
    """Raised when uploaded files are not processable."""


@dataclass
class ParsedDocument:
    name: str
    text: str
    source_type: str


@dataclass
class ParsedImage:
    name: str
    image_format: str
    mime_type: str
    data: bytes


@dataclass
class ParsedInputs:
    documents: list[ParsedDocument] = field(default_factory=list)
    images: list[ParsedImage] = field(default_factory=list)
    image_captions: list[str] = field(default_factory=list)
    retrieved_context: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    invalid_files: list[str] = field(default_factory=list)

    @property
    def valid_file_count(self) -> int:
        return len(self.documents) + len(self.images)

    def text_context(self) -> str:
        chunks: list[str] = []
        if self.retrieved_context:
            chunks.extend(self.retrieved_context)
        if self.image_captions:
            chunks.extend(self.image_captions)

        if not chunks:
            return "No extracted text context."
        return "\n".join(f"- {chunk}" for chunk in chunks)


class DocumentParser:
    """Parses uploaded files, chunks text, and retrieves relevant snippets via FAISS."""

    async def parse_files(self, files: Sequence[UploadFile], problem: str) -> ParsedInputs:
        parsed = ParsedInputs()
        if not files:
            return parsed

        usable_files = list(files[:MAX_FILES_PER_REQUEST])
        if len(files) > MAX_FILES_PER_REQUEST:
            parsed.warnings.append(
                f"Only the first {MAX_FILES_PER_REQUEST} files were processed."
            )

        all_chunks: list[str] = []
        for file in usable_files:
            raw = await file.read()
            name = file.filename or "uploaded_file"
            ext = self._get_extension(name)

            if len(raw) > MAX_FILE_SIZE_BYTES:
                parsed.invalid_files.append(name)
                parsed.warnings.append(f"{name} skipped: file exceeds 5 MB limit.")
                continue

            if ext in SUPPORTED_PDF_EXTENSIONS:
                try:
                    text = self._extract_pdf_text(raw)
                except InvalidUploadError as exc:
                    parsed.invalid_files.append(name)
                    raise exc
                if text.strip():
                    parsed.documents.append(ParsedDocument(name=name, text=text, source_type="pdf"))
                    all_chunks.extend(self._chunk_text(text))
                else:
                    parsed.warnings.append(f"{name} has no machine-readable text.")
                continue

            if ext in SUPPORTED_TEXT_EXTENSIONS:
                text = raw.decode("utf-8", errors="ignore")
                if text.strip():
                    parsed.documents.append(ParsedDocument(name=name, text=text, source_type="text"))
                    all_chunks.extend(self._chunk_text(text))
                else:
                    parsed.warnings.append(f"{name} has no readable text content.")
                continue

            if ext in SUPPORTED_IMAGE_EXTENSIONS:
                image_format = ext.lstrip(".")
                if image_format == "jpg":
                    image_format = "jpeg"
                parsed.images.append(
                    ParsedImage(
                        name=name,
                        image_format=image_format,
                        mime_type=file.content_type or "application/octet-stream",
                        data=raw,
                    )
                )
                parsed.image_captions.append(self._build_image_caption(name))
                continue

            parsed.invalid_files.append(name)
            parsed.warnings.append(f"{name} skipped: unsupported file type {ext}.")

        if all_chunks:
            parsed.retrieved_context = self._retrieve_relevant_chunks(problem=problem, chunks=all_chunks, k=5)

        return parsed

    @staticmethod
    def _extract_pdf_text(raw: bytes) -> str:
        try:
            reader = PdfReader(BytesIO(raw))
            pages: list[str] = []
            for page in reader.pages:
                pages.append(page.extract_text() or "")
            text = "\n".join(pages).strip()
        except Exception as exc:  # pragma: no cover - defensive against bad PDFs
            raise InvalidUploadError(
                "Could not extract text from this PDF. Please upload a text-based PDF (not a scanned image)."
            ) from exc

        if len(text) < 50:
            raise InvalidUploadError(
                "Could not extract text from this PDF. Please upload a text-based PDF (not a scanned image)."
            )

        return text

    @staticmethod
    def _chunk_text(text: str, chunk_size: int = 800, overlap: int = 120) -> list[str]:
        normalized = re.sub(r"\s+", " ", text).strip()
        if not normalized:
            return []

        chunks: list[str] = []
        start = 0
        while start < len(normalized):
            end = min(len(normalized), start + chunk_size)
            chunks.append(normalized[start:end])
            if end == len(normalized):
                break
            start = max(0, end - overlap)
        return chunks

    def _retrieve_relevant_chunks(self, problem: str, chunks: list[str], k: int) -> list[str]:
        if not chunks:
            return []
        if faiss is None:
            return self._fallback_keyword_chunks(problem=problem, chunks=chunks, k=k)

        vectors = np.vstack([self._embed_text(chunk) for chunk in chunks]).astype("float32")
        query = self._embed_text(problem).reshape(1, -1).astype("float32")

        index = faiss.IndexFlatIP(vectors.shape[1])
        index.add(vectors)
        _, indices = index.search(query, min(k, len(chunks)))

        chosen: list[str] = []
        seen: set[int] = set()
        for idx in indices[0]:
            if idx < 0 or idx in seen:
                continue
            seen.add(int(idx))
            chosen.append(chunks[int(idx)])
        return chosen

    @staticmethod
    def _fallback_keyword_chunks(problem: str, chunks: list[str], k: int) -> list[str]:
        terms = set(re.findall(r"[a-zA-Z0-9]+", problem.lower()))
        scored = []
        for chunk in chunks:
            tokens = set(re.findall(r"[a-zA-Z0-9]+", chunk.lower()))
            score = len(terms.intersection(tokens))
            scored.append((score, chunk))
        scored.sort(key=lambda item: item[0], reverse=True)
        return [chunk for _, chunk in scored[:k]]

    @staticmethod
    def _embed_text(text: str, dim: int = 256) -> np.ndarray:
        tokens = re.findall(r"[a-zA-Z0-9]+", text.lower())
        vector = np.zeros(dim, dtype=np.float32)
        if not tokens:
            return vector

        for token in tokens:
            token_hash = hash(token)
            index = abs(token_hash) % dim
            sign = -1.0 if token_hash % 2 else 1.0
            vector[index] += sign

        norm = np.linalg.norm(vector)
        if norm > 0:
            vector /= norm
        return vector

    @staticmethod
    def _get_extension(filename: str) -> str:
        filename = filename.lower()
        if "." not in filename:
            return ""
        return "." + filename.split(".")[-1]

    @staticmethod
    def _build_image_caption(filename: str) -> str:
        stem = filename.rsplit(".", 1)[0]
        normalized = re.sub(r"[_\-]+", " ", stem)
        normalized = re.sub(r"\s+", " ", normalized).strip().lower()
        if not normalized:
            normalized = "uploaded image"
        return f"Image context from filename: {normalized}"
