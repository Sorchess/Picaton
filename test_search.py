"""
Тестовый скрипт для проверки ассоциативного поиска
"""

import re
import sys
import os

# Добавляем путь к backend в sys.path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))

from application.services.search import ASSOCIATIVE_MAP, SYNONYMS


def extract_tags(query: str) -> list[str]:
    """Извлечь теги из поискового запроса с нормализацией синонимов."""
    query_lower = query.lower().strip()
    tags = []
    matched_phrases = set()

    # Сортируем фразы по длине (от длинных к коротким) для правильного приоритета
    sorted_phrases = sorted(ASSOCIATIVE_MAP.keys(), key=len, reverse=True)

    # Проверяем полные фразы из ассоциативной карты
    for phrase in sorted_phrases:
        # Используем регулярное выражение для поиска фразы как целого слова/фразы
        # \b - граница слова
        pattern = r"\b" + re.escape(phrase) + r"\b"
        if re.search(pattern, query_lower):
            if phrase not in matched_phrases:
                tags.append(phrase)
                matched_phrases.add(phrase)

    # Затем разбиваем на отдельные слова
    words = re.split(r"[\s,#]+", query_lower)
    for word in words:
        word = word.strip()
        if word and len(word) >= 2:
            # Нормализуем синонимы
            normalized = SYNONYMS.get(word, word)
            if normalized not in tags and normalized not in matched_phrases:
                tags.append(normalized)

    return tags


def expand_tags_associatively(tags: list[str]) -> list[str]:
    """
    Расширить теги ассоциативно.

    Например: ["бэкенд", "эксперт"] → ["бэкенд", "эксперт", "python", "java", "senior", ...]
    """
    expanded = set(tags)  # Сохраняем оригинальные теги

    for tag in tags:
        # Ищем прямые ассоциации
        if tag in ASSOCIATIVE_MAP:
            for associated in ASSOCIATIVE_MAP[tag]:
                expanded.add(associated.lower())

        # Ищем частичные совпадения (например, "бэкенд" в "бэкенд разработчик")
        for key, associations in ASSOCIATIVE_MAP.items():
            if tag in key or key in tag:
                for associated in associations:
                    expanded.add(associated.lower())

    return list(expanded)


def test_search(query: str):
    """Тестировать поиск для данного запроса"""
    print(f"\n{'='*80}")
    print(f"ЗАПРОС: '{query}'")
    print(f"{'='*80}")

    # Извлекаем базовые теги
    raw_tags = extract_tags(query)
    print(f"\nИзвлеченные теги ({len(raw_tags)}):")
    for tag in raw_tags:
        print(f"  - {tag}")

    # Расширяем ассоциативно
    expanded = expand_tags_associatively(raw_tags)
    print(f"\nРасширенные теги ({len(expanded)}):")
    for tag in sorted(expanded):
        print(f"  - {tag}")


if __name__ == "__main__":
    # Тестовые запросы
    test_queries = [
        "сделать сайт",
        "нужен сайт",
        "сайт",
        "веб разработчик",
        "верстальщик",
        "фронтенд",
        "react",
        "создать веб-приложение",
    ]

    for query in test_queries:
        test_search(query)

    print(f"\n{'='*80}")
    print("ТЕСТЫ ЗАВЕРШЕНЫ")
    print(f"{'='*80}\n")
