"""
AI Bio Generator using ONNX Runtime + all-MiniLM-L6-v2.

Легковесная реализация (~50MB ONNX Runtime + ~25MB модель int8).
Работает локально без GPU и без внешних API.
"""

import random
from pathlib import Path
from typing import Optional
import numpy as np

from domain.entities.user import User
from .ai_bio import AIBioGeneratorInterface, GeneratedBio


# Путь для хранения модели
MODEL_DIR = Path("/tmp/minilm_onnx")
MODEL_URL = "https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/resolve/main/onnx/model_quantized.onnx"
TOKENIZER_URL = "https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/resolve/main/tokenizer.json"


class ONNXEmbedder:
    """Легковесный эмбеддер на ONNX Runtime."""

    _instance: Optional["ONNXEmbedder"] = None

    def __init__(self):
        self._session = None
        self._tokenizer = None
        self._model_ready = False

    @classmethod
    def get_instance(cls) -> "ONNXEmbedder":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    async def _download_file(self, url: str, path: Path):
        """Скачать файл."""
        import httpx

        path.parent.mkdir(parents=True, exist_ok=True)

        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.get(url, follow_redirects=True)
            response.raise_for_status()
            path.write_bytes(response.content)

    async def _ensure_model(self):
        """Убедиться что модель загружена."""
        if self._model_ready:
            return

        model_path = MODEL_DIR / "model.onnx"
        tokenizer_path = MODEL_DIR / "tokenizer.json"

        # Скачиваем если нет
        if not model_path.exists():
            print("Downloading ONNX model (first time only, ~25MB)...")
            await self._download_file(MODEL_URL, model_path)

        if not tokenizer_path.exists():
            print("Downloading tokenizer...")
            await self._download_file(TOKENIZER_URL, tokenizer_path)

        # Загружаем ONNX сессию
        import onnxruntime as ort

        sess_options = ort.SessionOptions()
        sess_options.graph_optimization_level = (
            ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        )
        sess_options.intra_op_num_threads = 4

        self._session = ort.InferenceSession(
            str(model_path), sess_options, providers=["CPUExecutionProvider"]
        )

        # Загружаем токенизатор
        from tokenizers import Tokenizer

        self._tokenizer = Tokenizer.from_file(str(tokenizer_path))
        self._tokenizer.enable_padding(pad_id=0, pad_token="[PAD]", length=128)
        self._tokenizer.enable_truncation(max_length=128)

        self._model_ready = True
        print("ONNX model loaded!")

    def _mean_pooling(
        self, embeddings: np.ndarray, attention_mask: np.ndarray
    ) -> np.ndarray:
        """Mean pooling с учётом attention mask."""
        mask_expanded = np.expand_dims(attention_mask, -1).astype(np.float32)
        sum_embeddings = np.sum(embeddings * mask_expanded, axis=1)
        sum_mask = np.clip(mask_expanded.sum(axis=1), a_min=1e-9, a_max=None)
        return sum_embeddings / sum_mask

    def _normalize(self, embeddings: np.ndarray) -> np.ndarray:
        """L2 нормализация."""
        norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
        return embeddings / np.clip(norms, a_min=1e-9, a_max=None)

    async def encode(self, texts: list[str]) -> np.ndarray:
        """Получить эмбеддинги для текстов."""
        await self._ensure_model()

        # Токенизация
        encoded = self._tokenizer.encode_batch(texts)

        input_ids = np.array([e.ids for e in encoded], dtype=np.int64)
        attention_mask = np.array([e.attention_mask for e in encoded], dtype=np.int64)
        token_type_ids = np.zeros_like(input_ids, dtype=np.int64)

        # Инференс
        outputs = self._session.run(
            None,
            {
                "input_ids": input_ids,
                "attention_mask": attention_mask,
                "token_type_ids": token_type_ids,
            },
        )

        # Pooling + нормализация
        embeddings = self._mean_pooling(outputs[0], attention_mask)
        return self._normalize(embeddings)


class AIBioGenerator(AIBioGeneratorInterface):
    """
    Генератор био на ONNX + all-MiniLM-L6-v2 (int8).

    - Полностью локальный, без внешних API
    - ~50MB ONNX Runtime + ~25MB модель
    - Быстрый: ~10ms на запрос
    """

    # Роли для semantic matching
    ROLES = {
        "backend": "Backend developer, server programming, APIs, databases, Python, Java, Go, Node.js",
        "frontend": "Frontend developer, UI, React, Vue, Angular, TypeScript, JavaScript, CSS",
        "fullstack": "Fullstack developer, frontend and backend, full-stack, web applications",
        "devops": "DevOps, CI/CD, Docker, Kubernetes, AWS, cloud, infrastructure",
        "data": "Data scientist, machine learning, ML, AI, analytics, pandas, TensorFlow",
        "mobile": "Mobile developer, iOS, Android, Swift, Kotlin, Flutter, React Native",
        "designer": "UI/UX designer, Figma, interface design, user experience",
        "manager": "Project manager, team lead, Scrum, Agile, leadership",
    }

    ROLE_TEMPLATES = {
        "backend": [
            "{name} — backend-разработчик с опытом в {skills}. Создаёт надёжные серверные решения.",
            "{name} — серверный разработчик, эксперт в {skills}. Строит масштабируемые системы.",
        ],
        "frontend": [
            "{name} — frontend-разработчик на {skills}. Создаёт современные интерфейсы.",
            "{name} — UI-инженер с опытом в {skills}. Фокус на UX.",
        ],
        "fullstack": [
            "{name} — fullstack-разработчик: {skills}. Ведёт проекты от идеи до продакшена.",
            "{name} — разработчик полного цикла с опытом в {skills}.",
        ],
        "devops": [
            "{name} — DevOps-инженер: {skills}. Автоматизирует и масштабирует.",
            "{name} — специалист по инфраструктуре: {skills}.",
        ],
        "data": [
            "{name} — специалист по данным: {skills}. Строит ML-модели.",
            "{name} — data-инженер с опытом в {skills}.",
        ],
        "mobile": [
            "{name} — мобильный разработчик: {skills}. Нативные и кросс-платформенные приложения.",
            "{name} — специалист по мобильной разработке: {skills}.",
        ],
        "designer": [
            "{name} — дизайнер: {skills}. Создаёт интуитивные интерфейсы.",
            "{name} — UI/UX специалист с опытом в {skills}.",
        ],
        "manager": [
            "{name} — менеджер проектов: {skills}. Ведёт команды к успеху.",
            "{name} — руководитель с экспертизой в {skills}.",
        ],
    }

    SKILLS = [
        "Python",
        "JavaScript",
        "TypeScript",
        "React",
        "Vue.js",
        "Angular",
        "Node.js",
        "Django",
        "FastAPI",
        "PostgreSQL",
        "MongoDB",
        "Redis",
        "Docker",
        "Kubernetes",
        "AWS",
        "Figma",
        "Swift",
        "Kotlin",
        "Flutter",
        "TensorFlow",
        "PyTorch",
        "Agile",
        "Scrum",
        "CI/CD",
        "GraphQL",
        "Git",
    ]

    ENDINGS = [
        " Открыт к проектам.",
        " Готов к новым задачам.",
        " Открыт к сотрудничеству.",
    ]

    # Кэш эмбеддингов
    _role_embeddings: Optional[np.ndarray] = None
    _skill_embeddings: Optional[np.ndarray] = None

    def __init__(self):
        self._embedder = ONNXEmbedder.get_instance()

    async def _ensure_cache(self):
        """Предвычислить эмбеддинги ролей и навыков."""
        if AIBioGenerator._role_embeddings is None:
            role_texts = list(self.ROLES.values())
            AIBioGenerator._role_embeddings = await self._embedder.encode(role_texts)
            AIBioGenerator._skill_embeddings = await self._embedder.encode(self.SKILLS)

    async def _detect_role(self, text: str) -> str:
        """Определить роль через semantic similarity."""
        await self._ensure_cache()

        text_emb = await self._embedder.encode([text])
        similarities = np.dot(AIBioGenerator._role_embeddings, text_emb[0])

        best_idx = int(np.argmax(similarities))
        role_names = list(self.ROLES.keys())

        return role_names[best_idx] if similarities[best_idx] > 0.3 else "backend"

    async def _extract_skills(self, text: str, top_k: int = 4) -> list[str]:
        """Извлечь релевантные навыки."""
        await self._ensure_cache()

        text_emb = await self._embedder.encode([text])
        similarities = np.dot(AIBioGenerator._skill_embeddings, text_emb[0])

        indices = np.argsort(similarities)[::-1][:top_k]
        return [self.SKILLS[i] for i in indices if similarities[i] > 0.25] or [
            "современные технологии"
        ]

    def _generate_bio(self, name: str, role: str, skills: list[str]) -> str:
        """Сгенерировать bio."""
        templates = self.ROLE_TEMPLATES.get(role, self.ROLE_TEMPLATES["backend"])
        template = random.choice(templates)

        skills_text = ", ".join(skills[:4])
        bio = template.format(name=name, skills=skills_text)
        bio += random.choice(self.ENDINGS)

        return bio

    async def generate_bio(self, user: User) -> GeneratedBio:
        """Сгенерировать bio на основе данных пользователя."""
        bio_text = user.bio or ""
        name = user.first_name or (
            user.full_name.split()[0] if user.full_name else "Специалист"
        )

        if not bio_text.strip():
            if user.random_facts:
                return await self.generate_from_facts(user.random_facts, name)
            return GeneratedBio(
                bio=f"{name} — профессионал, открытый к новым проектам."
            )

        role = await self._detect_role(bio_text)
        skills = await self._extract_skills(bio_text)
        generated = self._generate_bio(name, role, skills)

        return GeneratedBio(bio=generated)

    async def generate_from_facts(self, facts: list[str], name: str) -> GeneratedBio:
        """Сгенерировать bio из фактов."""
        if not facts:
            return GeneratedBio(
                bio=f"{name} — профессионал, открытый к новым проектам."
            )

        combined = " ".join(facts)
        role = await self._detect_role(combined)
        skills = await self._extract_skills(combined)
        generated = self._generate_bio(name, role, skills)

        return GeneratedBio(bio=generated)
