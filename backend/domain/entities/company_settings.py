"""Доменные сущности для настроек компании."""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from uuid import UUID

from domain.entities.base import Entity


@dataclass
class TagFieldSettings:
    """
    Настройки поля тега.
    
    Определяет, как конкретный тег должен быть заполнен
    на корпоративной карточке сотрудника.
    """
    
    # Является ли поле обязательным для заполнения
    is_required: bool = field(default=False)
    
    # Отображаемое название поля (для UI)
    display_name: str = field(default="")
    
    # Подсказка для заполнения
    placeholder: str = field(default="")
    
    # Доступные варианты (если пустой - свободный ввод)
    # Например для отдела: ["Engineering", "Sales", "Marketing"]
    options: list[str] = field(default_factory=list)
    
    # Разрешить только выбор из options (если options не пустой)
    restrict_to_options: bool = field(default=False)


@dataclass
class CompanyTagSettings(Entity):
    """
    Настройки тегов для компании.
    
    Владелец может настроить:
    - Какие теги обязательные (company, position, department)
    - Какие опции доступны для выбора
    - Кастомные поля тегов
    """

    # Связь с компанией
    company_id: UUID = field(default=None)

    # === Стандартные корпоративные теги ===
    
    # Тег с названием компании
    # Автоматически проставляется из company.name
    company_tag: TagFieldSettings = field(
        default_factory=lambda: TagFieldSettings(
            is_required=True,
            display_name="Компания",
            placeholder="Название компании",
        )
    )
    
    # Тег должности
    position_tag: TagFieldSettings = field(
        default_factory=lambda: TagFieldSettings(
            is_required=False,
            display_name="Должность",
            placeholder="Например: Senior Developer",
            options=[],
        )
    )
    
    # Тег отдела/подразделения
    department_tag: TagFieldSettings = field(
        default_factory=lambda: TagFieldSettings(
            is_required=False,
            display_name="Отдел",
            placeholder="Например: Engineering",
            options=[],
        )
    )

    # === Кастомные теги компании ===
    # Владелец может добавить дополнительные теги
    # Ключ - идентификатор тега, значение - настройки
    custom_tags: dict[str, TagFieldSettings] = field(default_factory=dict)

    # === Настройки поведения ===
    
    # Автоматически добавлять тег компании к карточке
    auto_add_company_tag: bool = field(default=True)
    
    # Разрешить сотрудникам добавлять свои теги (помимо обязательных)
    allow_custom_employee_tags: bool = field(default=True)
    
    # Максимальное количество кастомных тегов на карточке
    max_custom_tags: int = field(default=20)

    # Timestamps
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def update_company_tag(self, settings: TagFieldSettings) -> None:
        """Обновить настройки тега компании."""
        self.company_tag = settings
        self.updated_at = datetime.now(timezone.utc)

    def update_position_tag(self, settings: TagFieldSettings) -> None:
        """Обновить настройки тега должности."""
        self.position_tag = settings
        self.updated_at = datetime.now(timezone.utc)

    def update_department_tag(self, settings: TagFieldSettings) -> None:
        """Обновить настройки тега отдела."""
        self.department_tag = settings
        self.updated_at = datetime.now(timezone.utc)

    def add_custom_tag(self, tag_id: str, settings: TagFieldSettings) -> None:
        """Добавить кастомный тег."""
        self.custom_tags[tag_id] = settings
        self.updated_at = datetime.now(timezone.utc)

    def remove_custom_tag(self, tag_id: str) -> bool:
        """Удалить кастомный тег."""
        if tag_id in self.custom_tags:
            del self.custom_tags[tag_id]
            self.updated_at = datetime.now(timezone.utc)
            return True
        return False

    def get_required_tags(self) -> list[str]:
        """Получить список обязательных тегов."""
        required = []
        if self.company_tag.is_required:
            required.append("company")
        if self.position_tag.is_required:
            required.append("position")
        if self.department_tag.is_required:
            required.append("department")
        for tag_id, settings in self.custom_tags.items():
            if settings.is_required:
                required.append(tag_id)
        return required

    def validate_card_tags(
        self,
        company_name: str | None,
        position: str | None,
        department: str | None,
        custom_tag_values: dict[str, str] | None = None,
    ) -> list[str]:
        """
        Проверить, заполнены ли все обязательные теги.
        
        Returns:
            Список названий незаполненных обязательных полей
        """
        missing = []
        
        if self.company_tag.is_required and not company_name:
            missing.append(self.company_tag.display_name or "Компания")
        
        if self.position_tag.is_required and not position:
            missing.append(self.position_tag.display_name or "Должность")
        
        if self.department_tag.is_required and not department:
            missing.append(self.department_tag.display_name or "Отдел")
        
        # Проверка кастомных обязательных тегов
        custom_values = custom_tag_values or {}
        for tag_id, settings in self.custom_tags.items():
            if settings.is_required and not custom_values.get(tag_id):
                missing.append(settings.display_name or tag_id)
        
        return missing

    def validate_option(self, tag_type: str, value: str) -> bool:
        """
        Проверить, что значение соответствует доступным опциям.
        
        Args:
            tag_type: "position", "department" или ID кастомного тега
            value: Значение для проверки
            
        Returns:
            True если значение допустимо
        """
        if tag_type == "position":
            settings = self.position_tag
        elif tag_type == "department":
            settings = self.department_tag
        else:
            settings = self.custom_tags.get(tag_type)
        
        if not settings:
            return True
        
        # Если нет ограничения по опциям - любое значение допустимо
        if not settings.restrict_to_options or not settings.options:
            return True
        
        return value in settings.options

    @classmethod
    def create_default(cls, company_id: UUID) -> "CompanyTagSettings":
        """Создать настройки по умолчанию для компании."""
        return cls(
            company_id=company_id,
            company_tag=TagFieldSettings(
                is_required=True,
                display_name="Компания",
            ),
            position_tag=TagFieldSettings(
                is_required=False,
                display_name="Должность",
                placeholder="Введите вашу должность",
            ),
            department_tag=TagFieldSettings(
                is_required=False,
                display_name="Отдел",
                placeholder="Выберите или введите отдел",
            ),
        )
