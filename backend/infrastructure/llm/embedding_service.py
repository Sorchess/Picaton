"""Embedding service using Sentence Transformers with USER-bge-m3 model."""

import logging
from dataclasses import dataclass
from functools import lru_cache
from typing import Sequence

from settings.config import settings

logger = logging.getLogger(__name__)

# Lazy import to avoid loading model at startup
_model = None


def _get_model():
    """Lazy load the embedding model."""
    global _model
    if _model is None:
        try:
            from sentence_transformers import SentenceTransformer

            logger.info(f"Loading embedding model from {settings.embedding.model_path}")
            _model = SentenceTransformer(settings.embedding.model_path)
            logger.info("Embedding model loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load embedding model: {e}")
            raise
    return _model


@dataclass
class EmbeddingResult:
    """Result of embedding generation."""

    vector: list[float]
    dimensions: int


class EmbeddingError(Exception):
    """Embedding service error."""

    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


class EmbeddingService:
    """
    Service for generating text embeddings using USER-bge-m3 model.

    The model is optimized for Russian language and produces 1024-dimensional vectors.
    Used for semantic search and similarity matching.
    """

    def __init__(self):
        self._config = settings.embedding

    @property
    def is_configured(self) -> bool:
        """Check if embedding service is enabled."""
        return self._config.enabled

    async def embed(self, text: str) -> EmbeddingResult:
        """
        Generate embedding for a single text.

        Args:
            text: Text to embed

        Returns:
            EmbeddingResult with vector and dimensions

        Raises:
            EmbeddingError: If embedding generation fails
        """
        if not self.is_configured:
            raise EmbeddingError("Embedding service is not enabled")

        try:
            model = _get_model()

            # Encode text (sync operation, but fast enough for single texts)
            embedding = model.encode(
                text,
                normalize_embeddings=self._config.normalize,
                show_progress_bar=False,
            )

            return EmbeddingResult(
                vector=embedding.tolist(),
                dimensions=len(embedding),
            )

        except Exception as e:
            logger.error(f"Failed to generate embedding: {e}")
            raise EmbeddingError(f"Embedding generation failed: {str(e)}")

    async def embed_batch(self, texts: Sequence[str]) -> list[EmbeddingResult]:
        """
        Generate embeddings for multiple texts.

        More efficient than calling embed() multiple times.

        Args:
            texts: List of texts to embed

        Returns:
            List of EmbeddingResult objects

        Raises:
            EmbeddingError: If embedding generation fails
        """
        if not self.is_configured:
            raise EmbeddingError("Embedding service is not enabled")

        if not texts:
            return []

        try:
            model = _get_model()

            # Batch encode
            embeddings = model.encode(
                list(texts),
                normalize_embeddings=self._config.normalize,
                show_progress_bar=False,
                batch_size=32,
            )

            return [
                EmbeddingResult(
                    vector=emb.tolist(),
                    dimensions=len(emb),
                )
                for emb in embeddings
            ]

        except Exception as e:
            logger.error(f"Failed to generate batch embeddings: {e}")
            raise EmbeddingError(f"Batch embedding generation failed: {str(e)}")

    async def similarity(self, text1: str, text2: str) -> float:
        """
        Calculate cosine similarity between two texts.

        Args:
            text1: First text
            text2: Second text

        Returns:
            Similarity score between 0 and 1
        """
        import numpy as np

        emb1 = await self.embed(text1)
        emb2 = await self.embed(text2)

        vec1 = np.array(emb1.vector)
        vec2 = np.array(emb2.vector)

        # Cosine similarity (vectors are already normalized if normalize=True)
        if self._config.normalize:
            return float(np.dot(vec1, vec2))
        else:
            return float(np.dot(vec1, vec2) / (np.linalg.norm(vec1) * np.linalg.norm(vec2)))

    async def find_similar(
        self,
        query: str,
        candidates: Sequence[str],
        top_k: int = 5,
    ) -> list[tuple[int, float]]:
        """
        Find most similar texts from candidates.

        Args:
            query: Query text
            candidates: List of candidate texts
            top_k: Number of top results to return

        Returns:
            List of (index, similarity_score) tuples, sorted by similarity
        """
        import numpy as np

        if not candidates:
            return []

        query_emb = await self.embed(query)
        candidate_embs = await self.embed_batch(candidates)

        query_vec = np.array(query_emb.vector)
        candidate_vecs = np.array([e.vector for e in candidate_embs])

        # Calculate similarities
        if self._config.normalize:
            similarities = np.dot(candidate_vecs, query_vec)
        else:
            norms = np.linalg.norm(candidate_vecs, axis=1) * np.linalg.norm(query_vec)
            similarities = np.dot(candidate_vecs, query_vec) / norms

        # Get top-k indices
        top_indices = np.argsort(similarities)[::-1][:top_k]

        return [(int(idx), float(similarities[idx])) for idx in top_indices]

    def health_check(self) -> bool:
        """
        Check if embedding service is healthy.

        Returns:
            True if model is loaded and working
        """
        if not self.is_configured:
            return False

        try:
            model = _get_model()
            # Quick test embedding
            _ = model.encode("test", normalize_embeddings=True)
            return True
        except Exception:
            return False


# Singleton instance
@lru_cache(maxsize=1)
def get_embedding_service() -> EmbeddingService:
    """Get singleton embedding service instance."""
    return EmbeddingService()
