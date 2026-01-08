"""
API обработчики для корпоративных карточек.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from application.services.company_card import (
    CardAlreadyExistsError,
    CompanyCardNotFoundError,
    CompanyCardService,
    CompanyTagSettingsService,
    InvalidTagValueError,
)
from application.services.permission_checker import PermissionChecker
from application.services import AuthService, InvalidTokenError
from domain.entities.company_card import MissingRequiredTagError
from domain.entities.tag import Tag
from domain.enums.contact import ContactType
from domain.enums.permission import Permission
from domain.values.contact import Contact
from infrastructure.dependencies import (
    get_auth_service,
    get_company_card_service,
    get_company_tag_settings_service,
    get_permission_checker,
)
from presentation.api.companies.card_schemas import (
    AddContactRequest,
    AddCustomTagRequest,
    AddTagRequest,
    CompanyCardListResponse,
    CompanyCardListSchema,
    CompanyCardSchema,
    CompanyTagSettingsSchema,
    ContactSchema,
    CreateCompanyCardRequest,
    SearchCardsRequest,
    SetVisibilityRequest,
    TagFieldSettingsSchema,
    TagSchema,
    UpdateCompanyCardRequest,
    UpdateCustomTagRequest,
    UpdateTagSettingsRequest,
)


router = APIRouter(prefix="/companies/{company_id}", tags=["Company Cards"])
security = HTTPBearer()


# === Auth Helper ===

async def get_current_user_from_token(
    credentials: HTTPAuthorizationCredentials,
    auth_service: AuthService,
):
    """Получить текущего пользователя из токена."""
    try:
        return await auth_service.get_current_user(credentials.credentials)
    except InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Невалидный или истёкший токен",
            headers={"WWW-Authenticate": "Bearer"},
        )


# === Helpers ===

def _card_to_schema(card) -> CompanyCardSchema:
    """Преобразовать карточку в схему."""
    return CompanyCardSchema(
        id=card.id,
        company_id=card.company_id,
        member_id=card.member_id,
        user_id=card.user_id,
        company_name=card.company_name,
        position=card.position,
        department=card.department,
        display_name=card.display_name,
        avatar_url=card.avatar_url,
        bio=card.bio,
        ai_generated_bio=card.ai_generated_bio,
        contacts=[
            ContactSchema(
                type=c.type.value,
                value=c.value,
                label=c.label,
                is_primary=c.is_primary,
            )
            for c in card.contacts
        ],
        tags=[
            TagSchema(id=t.id, name=t.name, category=t.category)
            for t in card.tags
        ],
        custom_tag_values=card.custom_tag_values,
        is_active=card.is_active,
        is_public=card.is_public,
        completeness=card.completeness,
        created_at=card.created_at,
        updated_at=card.updated_at,
    )


def _card_to_list_schema(card) -> CompanyCardListSchema:
    """Преобразовать карточку в краткую схему для списка."""
    return CompanyCardListSchema(
        id=card.id,
        user_id=card.user_id,
        display_name=card.display_name,
        avatar_url=card.avatar_url,
        position=card.position,
        department=card.department,
        completeness=card.completeness,
        is_active=card.is_active,
    )


def _settings_to_schema(settings) -> CompanyTagSettingsSchema:
    """Преобразовать настройки в схему."""
    return CompanyTagSettingsSchema(
        id=settings.id,
        company_id=settings.company_id,
        company_tag=TagFieldSettingsSchema(
            is_required=settings.company_tag.is_required,
            is_enabled=settings.company_tag.is_enabled,
            display_name=settings.company_tag.display_name,
            placeholder=settings.company_tag.placeholder,
            options=settings.company_tag.options,
            restrict_to_options=settings.company_tag.restrict_to_options,
        ),
        position_tag=TagFieldSettingsSchema(
            is_required=settings.position_tag.is_required,
            is_enabled=settings.position_tag.is_enabled,
            display_name=settings.position_tag.display_name,
            placeholder=settings.position_tag.placeholder,
            options=settings.position_tag.options,
            restrict_to_options=settings.position_tag.restrict_to_options,
        ),
        department_tag=TagFieldSettingsSchema(
            is_required=settings.department_tag.is_required,
            is_enabled=settings.department_tag.is_enabled,
            display_name=settings.department_tag.display_name,
            placeholder=settings.department_tag.placeholder,
            options=settings.department_tag.options,
            restrict_to_options=settings.department_tag.restrict_to_options,
        ),
        custom_tags={
            tag_id: TagFieldSettingsSchema(
                is_required=tag.is_required,
                is_enabled=tag.is_enabled,
                display_name=tag.display_name,
                placeholder=tag.placeholder,
                options=tag.options,
                restrict_to_options=tag.restrict_to_options,
            )
            for tag_id, tag in settings.custom_tags.items()
        },
        created_at=settings.created_at,
        updated_at=settings.updated_at,
    )


# === Tag Settings Endpoints (Owner only) ===

@router.get("/tag-settings", response_model=CompanyTagSettingsSchema)
async def get_tag_settings(
    company_id: UUID,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    auth_service: AuthService = Depends(get_auth_service),
    permission_checker: PermissionChecker = Depends(get_permission_checker),
    settings_service: CompanyTagSettingsService = Depends(get_company_tag_settings_service),
):
    """
    Получить настройки тегов компании.
    
    Требуется: VIEW_TAGS или быть сотрудником компании.
    """
    user = await get_current_user_from_token(credentials, auth_service)
    
    await permission_checker.require_permission(
        user.id, company_id, Permission.VIEW_TAGS
    )
    
    settings = await settings_service.get_or_create_settings(company_id)
    return _settings_to_schema(settings)


@router.put("/tag-settings", response_model=CompanyTagSettingsSchema)
async def update_tag_settings(
    company_id: UUID,
    request: UpdateTagSettingsRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    auth_service: AuthService = Depends(get_auth_service),
    permission_checker: PermissionChecker = Depends(get_permission_checker),
    settings_service: CompanyTagSettingsService = Depends(get_company_tag_settings_service),
):
    """
    Обновить настройки тегов компании.
    
    Требуется: MANAGE_TAGS (только владелец/админ).
    """
    user = await get_current_user_from_token(credentials, auth_service)
    
    await permission_checker.require_permission(
        user.id, company_id, Permission.MANAGE_TAGS
    )

    # Обновляем настройки
    kwargs = {}
    
    if request.company_tag:
        if request.company_tag.is_required is not None:
            kwargs["company_tag_required"] = request.company_tag.is_required
    
    if request.position_tag:
        if request.position_tag.is_required is not None:
            kwargs["position_tag_required"] = request.position_tag.is_required
        if request.position_tag.options is not None:
            kwargs["position_tag_options"] = request.position_tag.options
        if request.position_tag.restrict_to_options is not None:
            kwargs["position_restrict_to_options"] = request.position_tag.restrict_to_options
    
    if request.department_tag:
        if request.department_tag.is_required is not None:
            kwargs["department_tag_required"] = request.department_tag.is_required
        if request.department_tag.options is not None:
            kwargs["department_tag_options"] = request.department_tag.options
        if request.department_tag.restrict_to_options is not None:
            kwargs["department_restrict_to_options"] = request.department_tag.restrict_to_options

    settings = await settings_service.update_settings(company_id, **kwargs)
    return _settings_to_schema(settings)


@router.post("/tag-settings/custom-tags", response_model=CompanyTagSettingsSchema)
async def add_custom_tag(
    company_id: UUID,
    request: AddCustomTagRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    auth_service: AuthService = Depends(get_auth_service),
    permission_checker: PermissionChecker = Depends(get_permission_checker),
    settings_service: CompanyTagSettingsService = Depends(get_company_tag_settings_service),
):
    """
    Добавить кастомный тег.
    
    Требуется: MANAGE_TAGS (только владелец/админ).
    """
    user = await get_current_user_from_token(credentials, auth_service)
    
    await permission_checker.require_permission(
        user.id, company_id, Permission.MANAGE_TAGS
    )

    settings = await settings_service.add_custom_tag(
        company_id=company_id,
        tag_id=request.tag_id,
        display_name=request.display_name,
        is_required=request.is_required,
        placeholder=request.placeholder,
        options=request.options,
        restrict_to_options=request.restrict_to_options,
    )
    return _settings_to_schema(settings)


@router.put("/tag-settings/custom-tags/{tag_id}", response_model=CompanyTagSettingsSchema)
async def update_custom_tag(
    company_id: UUID,
    tag_id: str,
    request: UpdateCustomTagRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    auth_service: AuthService = Depends(get_auth_service),
    permission_checker: PermissionChecker = Depends(get_permission_checker),
    settings_service: CompanyTagSettingsService = Depends(get_company_tag_settings_service),
):
    """
    Обновить кастомный тег.
    
    Требуется: MANAGE_TAGS.
    """
    user = await get_current_user_from_token(credentials, auth_service)
    
    await permission_checker.require_permission(
        user.id, company_id, Permission.MANAGE_TAGS
    )

    try:
        settings = await settings_service.update_custom_tag(
            company_id=company_id,
            tag_id=tag_id,
            display_name=request.display_name,
            is_required=request.is_required,
            placeholder=request.placeholder,
            options=request.options,
            restrict_to_options=request.restrict_to_options,
        )
        return _settings_to_schema(settings)
    except KeyError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Кастомный тег '{tag_id}' не найден"
        )


@router.delete("/tag-settings/custom-tags/{tag_id}", response_model=CompanyTagSettingsSchema)
async def remove_custom_tag(
    company_id: UUID,
    tag_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    auth_service: AuthService = Depends(get_auth_service),
    permission_checker: PermissionChecker = Depends(get_permission_checker),
    settings_service: CompanyTagSettingsService = Depends(get_company_tag_settings_service),
):
    """
    Удалить кастомный тег.
    
    Требуется: MANAGE_TAGS.
    """
    user = await get_current_user_from_token(credentials, auth_service)
    
    await permission_checker.require_permission(
        user.id, company_id, Permission.MANAGE_TAGS
    )

    settings = await settings_service.remove_custom_tag(company_id, tag_id)
    return _settings_to_schema(settings)


# === Company Cards Endpoints ===

@router.get("/cards", response_model=CompanyCardListResponse)
async def list_company_cards(
    company_id: UUID,
    limit: int = 100,
    offset: int = 0,
    include_inactive: bool = False,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    auth_service: AuthService = Depends(get_auth_service),
    permission_checker: PermissionChecker = Depends(get_permission_checker),
    card_service: CompanyCardService = Depends(get_company_card_service),
):
    """
    Получить список карточек компании.
    
    Требуется: VIEW_MEMBERS.
    """
    user = await get_current_user_from_token(credentials, auth_service)
    
    await permission_checker.require_permission(
        user.id, company_id, Permission.VIEW_MEMBERS
    )

    cards = await card_service.get_company_cards(
        company_id, include_inactive, limit, offset
    )
    total = await card_service._card_repo.count_by_company(
        company_id, include_inactive
    )

    return CompanyCardListResponse(
        cards=[_card_to_list_schema(c) for c in cards],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post("/cards/search", response_model=CompanyCardListResponse)
async def search_company_cards(
    company_id: UUID,
    request: SearchCardsRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    auth_service: AuthService = Depends(get_auth_service),
    permission_checker: PermissionChecker = Depends(get_permission_checker),
    card_service: CompanyCardService = Depends(get_company_card_service),
):
    """
    Поиск карточек в компании.
    
    Требуется: VIEW_MEMBERS.
    """
    user = await get_current_user_from_token(credentials, auth_service)
    
    await permission_checker.require_permission(
        user.id, company_id, Permission.VIEW_MEMBERS
    )

    cards = await card_service.search_cards(
        company_id=company_id,
        query=request.query,
        tags=request.tags,
        position=request.position,
        department=request.department,
        limit=request.limit,
    )

    return CompanyCardListResponse(
        cards=[_card_to_list_schema(c) for c in cards],
        total=len(cards),
        limit=request.limit,
        offset=0,
    )


@router.get("/cards/my", response_model=CompanyCardSchema | None)
async def get_my_card(
    company_id: UUID,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    auth_service: AuthService = Depends(get_auth_service),
    card_service: CompanyCardService = Depends(get_company_card_service),
):
    """
    Получить свою карточку в компании.
    
    Не требует специальных разрешений.
    """
    user = await get_current_user_from_token(credentials, auth_service)
    
    card = await card_service.get_user_card_in_company(company_id, user.id)
    if card:
        return _card_to_schema(card)
    return None


@router.get("/cards/{card_id}", response_model=CompanyCardSchema)
async def get_company_card(
    company_id: UUID,
    card_id: UUID,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    auth_service: AuthService = Depends(get_auth_service),
    permission_checker: PermissionChecker = Depends(get_permission_checker),
    card_service: CompanyCardService = Depends(get_company_card_service),
):
    """
    Получить карточку по ID.
    
    Требуется: VIEW_MEMBERS или это своя карточка.
    """
    user = await get_current_user_from_token(credentials, auth_service)
    
    try:
        card = await card_service.get_card(card_id)
    except CompanyCardNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Карточка не найдена"
        )

    # Проверяем, что карточка принадлежит компании
    if card.company_id != company_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Карточка не найдена в этой компании"
        )

    # Своя карточка — доступ разрешён
    if card.user_id != user.id:
        await permission_checker.require_permission(
            user.id, company_id, Permission.VIEW_MEMBERS
        )

    return _card_to_schema(card)


@router.put("/cards/{card_id}", response_model=CompanyCardSchema)
async def update_company_card(
    company_id: UUID,
    card_id: UUID,
    request: UpdateCompanyCardRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    auth_service: AuthService = Depends(get_auth_service),
    permission_checker: PermissionChecker = Depends(get_permission_checker),
    card_service: CompanyCardService = Depends(get_company_card_service),
):
    """
    Обновить карточку.
    
    Требуется: EDIT_OWN_CARD (своя) или EDIT_MEMBER_CARDS (чужая).
    """
    user = await get_current_user_from_token(credentials, auth_service)
    
    try:
        card = await card_service.get_card(card_id)
    except CompanyCardNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Карточка не найдена"
        )

    if card.company_id != company_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Карточка не найдена в этой компании"
        )

    # Проверяем права
    if card.user_id == user.id:
        await permission_checker.require_permission(
            user.id, company_id, Permission.EDIT_OWN_CARD
        )
    else:
        await permission_checker.require_permission(
            user.id, company_id, Permission.EDIT_MEMBER_CARDS
        )

    try:
        updated = await card_service.update_card(
            card_id=card_id,
            display_name=request.display_name,
            position=request.position,
            department=request.department,
            avatar_url=request.avatar_url,
            bio=request.bio,
            custom_tag_values=request.custom_tag_values,
        )
        return _card_to_schema(updated)
    except MissingRequiredTagError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except InvalidTagValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/cards/{card_id}/tags", response_model=CompanyCardSchema)
async def add_tag_to_card(
    company_id: UUID,
    card_id: UUID,
    request: AddTagRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    auth_service: AuthService = Depends(get_auth_service),
    permission_checker: PermissionChecker = Depends(get_permission_checker),
    card_service: CompanyCardService = Depends(get_company_card_service),
):
    """
    Добавить тег навыка к карточке.
    
    Требуется: EDIT_OWN_CARD или EDIT_MEMBER_CARDS.
    """
    user = await get_current_user_from_token(credentials, auth_service)
    
    try:
        card = await card_service.get_card(card_id)
    except CompanyCardNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Карточка не найдена"
        )

    if card.company_id != company_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Карточка не найдена"
        )

    # Проверяем права
    if card.user_id == user.id:
        await permission_checker.require_permission(
            user.id, company_id, Permission.EDIT_OWN_CARD
        )
    else:
        await permission_checker.require_permission(
            user.id, company_id, Permission.EDIT_MEMBER_CARDS
        )

    tag = Tag(name=request.name, category=request.category)
    updated = await card_service.add_tag(card_id, tag)
    return _card_to_schema(updated)


@router.delete("/cards/{card_id}/tags/{tag_name}", response_model=CompanyCardSchema)
async def remove_tag_from_card(
    company_id: UUID,
    card_id: UUID,
    tag_name: str,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    auth_service: AuthService = Depends(get_auth_service),
    permission_checker: PermissionChecker = Depends(get_permission_checker),
    card_service: CompanyCardService = Depends(get_company_card_service),
):
    """
    Удалить тег навыка с карточки.
    """
    user = await get_current_user_from_token(credentials, auth_service)
    
    try:
        card = await card_service.get_card(card_id)
    except CompanyCardNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Карточка не найдена"
        )

    if card.company_id != company_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Карточка не найдена"
        )

    # Проверяем права
    if card.user_id == user.id:
        await permission_checker.require_permission(
            user.id, company_id, Permission.EDIT_OWN_CARD
        )
    else:
        await permission_checker.require_permission(
            user.id, company_id, Permission.EDIT_MEMBER_CARDS
        )

    updated = await card_service.remove_tag(card_id, tag_name)
    return _card_to_schema(updated)


@router.post("/cards/{card_id}/contacts", response_model=CompanyCardSchema)
async def add_contact_to_card(
    company_id: UUID,
    card_id: UUID,
    request: AddContactRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    auth_service: AuthService = Depends(get_auth_service),
    permission_checker: PermissionChecker = Depends(get_permission_checker),
    card_service: CompanyCardService = Depends(get_company_card_service),
):
    """
    Добавить контакт к карточке.
    """
    user = await get_current_user_from_token(credentials, auth_service)
    
    try:
        card = await card_service.get_card(card_id)
    except CompanyCardNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Карточка не найдена"
        )

    if card.company_id != company_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Карточка не найдена"
        )

    # Проверяем права
    if card.user_id == user.id:
        await permission_checker.require_permission(
            user.id, company_id, Permission.EDIT_OWN_CARD
        )
    else:
        await permission_checker.require_permission(
            user.id, company_id, Permission.EDIT_MEMBER_CARDS
        )

    try:
        contact_type = ContactType(request.type)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Неизвестный тип контакта: {request.type}"
        )

    contact = Contact(
        type=contact_type,
        value=request.value,
        label=request.label,
        is_primary=request.is_primary,
    )
    updated = await card_service.add_contact(card_id, contact)
    return _card_to_schema(updated)


@router.put("/cards/{card_id}/visibility", response_model=CompanyCardSchema)
async def set_card_visibility(
    company_id: UUID,
    card_id: UUID,
    request: SetVisibilityRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    auth_service: AuthService = Depends(get_auth_service),
    permission_checker: PermissionChecker = Depends(get_permission_checker),
    card_service: CompanyCardService = Depends(get_company_card_service),
):
    """
    Установить видимость карточки вне компании.
    """
    user = await get_current_user_from_token(credentials, auth_service)
    
    try:
        card = await card_service.get_card(card_id)
    except CompanyCardNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Карточка не найдена"
        )

    if card.company_id != company_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Карточка не найдена"
        )

    # Только владелец карточки или админ может менять видимость
    if card.user_id == user.id:
        await permission_checker.require_permission(
            user.id, company_id, Permission.EDIT_OWN_CARD
        )
    else:
        await permission_checker.require_permission(
            user.id, company_id, Permission.EDIT_MEMBER_CARDS
        )

    updated = await card_service.set_visibility(card_id, request.is_public)
    return _card_to_schema(updated)


@router.delete("/cards/{card_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_company_card(
    company_id: UUID,
    card_id: UUID,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    auth_service: AuthService = Depends(get_auth_service),
    permission_checker: PermissionChecker = Depends(get_permission_checker),
    card_service: CompanyCardService = Depends(get_company_card_service),
):
    """
    Удалить карточку.
    
    Требуется: REMOVE_MEMBERS (только админ/владелец может удалять карточки).
    """
    user = await get_current_user_from_token(credentials, auth_service)
    
    try:
        card = await card_service.get_card(card_id)
    except CompanyCardNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Карточка не найдена"
        )

    if card.company_id != company_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Карточка не найдена"
        )

    # Удаление карточки — только с REMOVE_MEMBERS
    await permission_checker.require_permission(
        user.id, company_id, Permission.REMOVE_MEMBERS
    )

    await card_service.delete_card(card_id)
