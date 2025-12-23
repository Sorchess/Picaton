from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from presentation.api.users.schemas import (
    UserCreate,
    UserUpdate,
    UserResponse,
    UserPublicResponse,
    RandomFactAdd,
    SearchTagsUpdate,
    SearchRequest,
    SearchResult,
    SearchSuggestionsResponse,
    QRCodeResponse,
    QRCodeType,
    SavedContactCreate,
    ManualContactCreate,
    SavedContactUpdate,
    SavedContactResponse,
    ContactImportRequest,
    VCardImportRequest,
    ImportResult,
    GeneratedBioResponse,
    TagInfo,
    ContactInfo,
    SuggestedTagResponse,
    TagSuggestionsResponse,
    ApplyTagsRequest,
)
from infrastructure.dependencies import (
    get_user_service,
    get_contact_service,
    get_search_service,
    get_qrcode_service,
    get_import_service,
    get_ai_tags_service,
)


router = APIRouter()


# ============ User Endpoints ============


@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    data: UserCreate,
    user_service=Depends(get_user_service),
):
    """Создать нового пользователя."""
    user = await user_service.create_user(
        email=data.email,
        password=data.password,
        first_name=data.first_name,
        last_name=data.last_name,
    )
    return _user_to_response(user)


@router.get("/{user_id}", response_model=UserPublicResponse)
async def get_user(
    user_id: UUID,
    user_service=Depends(get_user_service),
):
    """Получить публичную информацию о пользователе."""
    user = await user_service.get_user(user_id)
    return _user_to_public_response(user)


@router.get("/{user_id}/full", response_model=UserResponse)
async def get_user_full(
    user_id: UUID,
    user_service=Depends(get_user_service),
):
    """Получить полную информацию о пользователе (для владельца)."""
    user = await user_service.get_user(user_id)
    return _user_to_response(user)


@router.patch("/{user_id}", response_model=UserResponse)
async def update_user_profile(
    user_id: UUID,
    data: UserUpdate,
    user_service=Depends(get_user_service),
):
    """Обновить профиль пользователя (ФИО, фото, самопрезентация)."""
    user = await user_service.update_profile(
        user_id=user_id,
        first_name=data.first_name,
        last_name=data.last_name,
        avatar_url=data.avatar_url,
        bio=data.bio,
    )
    return _user_to_response(user)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: UUID,
    user_service=Depends(get_user_service),
):
    """Удалить пользователя."""
    await user_service.delete_user(user_id)


# ============ Random Facts & AI Bio ============


@router.post("/{user_id}/facts", response_model=UserResponse)
async def add_random_fact(
    user_id: UUID,
    data: RandomFactAdd,
    user_service=Depends(get_user_service),
):
    """Добавить рандомный факт о себе."""
    user = await user_service.add_random_fact(user_id, data.fact)
    return _user_to_response(user)


@router.post("/{user_id}/generate-bio", response_model=GeneratedBioResponse)
async def generate_ai_bio(
    user_id: UUID,
    user_service=Depends(get_user_service),
):
    """Сгенерировать AI-презентацию на основе рандомных фактов."""
    user = await user_service.generate_ai_bio(user_id)
    return GeneratedBioResponse(bio=user.ai_generated_bio or "")


@router.post("/{user_id}/generate-tags", response_model=UserResponse)
async def generate_tags_from_bio(
    user_id: UUID,
    user_service=Depends(get_user_service),
):
    """
    Сгенерировать теги и навыки из bio пользователя.
    Пользователь заполняет информацию о себе, а нейросеть извлекает
    теги, навыки и другую полезную информацию.
    """
    try:
        user = await user_service.generate_tags_from_bio(user_id)
        return _user_to_response(user)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{user_id}/suggest-tags", response_model=TagSuggestionsResponse)
async def suggest_tags_from_bio(
    user_id: UUID,
    user_service=Depends(get_user_service),
    ai_tags_service=Depends(get_ai_tags_service),
):
    """
    Предложить теги на основе bio пользователя.
    Возвращает список тегов на выбор, которые пользователь может выбрать.
    """
    user = await user_service.get_user(user_id)
    bio = user.bio or ""

    if not bio.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Сначала заполните информацию о себе (bio)",
        )

    result = await ai_tags_service.generate_from_bio(bio)

    return TagSuggestionsResponse(
        suggestions=[
            SuggestedTagResponse(
                name=t.name,
                category=t.category,
                confidence=t.confidence,
                reason=t.reason,
            )
            for t in result.suggested_tags
        ],
        bio_used=bio,
    )


@router.post("/{user_id}/apply-tags", response_model=UserResponse)
async def apply_selected_tags(
    user_id: UUID,
    data: ApplyTagsRequest,
    user_service=Depends(get_user_service),
):
    """
    Применить выбранные пользователем теги.
    Пользователь выбирает теги из предложенных AI и они сохраняются.
    """
    user = await user_service.apply_selected_tags(
        user_id=user_id,
        selected_tags=data.selected_tags,
        bio=data.bio,
    )
    return _user_to_response(user)


# ============ Search Tags ============


@router.put("/{user_id}/search-tags", response_model=UserResponse)
async def update_search_tags(
    user_id: UUID,
    data: SearchTagsUpdate,
    user_service=Depends(get_user_service),
):
    """Обновить теги для поиска (облако тегов)."""
    user = await user_service.update_search_tags(user_id, data.tags)
    return _user_to_response(user)


# ============ QR Code ============


@router.get("/{user_id}/qr-code", response_model=QRCodeResponse)
async def get_qr_code(
    user_id: UUID,
    qr_type: str = "profile",
    user_service=Depends(get_user_service),
    qrcode_service=Depends(get_qrcode_service),
):
    """
    Получить QR-код для обмена контактом.
    - profile: ссылка на профиль
    - vcard: данные vCard для добавления в контакты телефона
    """
    user = await user_service.get_user(user_id)

    if qr_type == "vcard":
        qr_data = qrcode_service.generate_vcard_qr(user)
    else:
        qr_data = qrcode_service.generate_contact_qr(user)

    return QRCodeResponse(
        image_base64=qr_data.image_base64,
        image_format=qr_data.image_format,
    )


# ============ Search ============


@router.post("/search", response_model=SearchResult)
async def search_experts(
    data: SearchRequest,
    owner_id: UUID | None = None,
    search_service=Depends(get_search_service),
):
    """
    Ассоциативный поиск экспертов и контактов.
    Можно искать по тегам, ассоциациям, именам.

    Примеры запросов:
    - "бэкенд эксперт" → найдёт Python, Java, Node.js разработчиков
    - "фронтенд" → найдёт React, Vue, Angular специалистов
    - "питон" → найдёт Python разработчиков (синоним)
    """
    try:
        result = await search_service.search(
            query=data.query,
            owner_id=owner_id,
            limit=data.limit,
            include_users=data.include_users,
            include_contacts=data.include_contacts,
        )

        return SearchResult(
            users=[_user_to_public_response(u) for u in result.users],
            contacts=[_contact_to_response(c) for c in result.contacts],
            query=result.query,
            expanded_tags=result.expanded_tags,
            total_count=result.total_count,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка поиска: {str(e)}",
        )


@router.get("/search/suggestions", response_model=SearchSuggestionsResponse)
async def get_search_suggestions(
    query: str,
    limit: int = 10,
    search_service=Depends(get_search_service),
):
    """
    Получить подсказки для поиска на основе ассоциаций.

    Полезно для автодополнения в UI.
    """
    suggestions = search_service.get_search_suggestions(query, limit)
    return SearchSuggestionsResponse(
        query=query,
        suggestions=suggestions,
    )


# ============ Saved Contacts ============


@router.post("/{user_id}/contacts", response_model=SavedContactResponse)
async def save_contact(
    user_id: UUID,
    data: SavedContactCreate,
    contact_service=Depends(get_contact_service),
):
    """Сохранить контакт другого пользователя."""
    contact = await contact_service.save_user_contact(
        owner_id=user_id,
        user_id=data.user_id,
        search_tags=data.search_tags,
        notes=data.notes,
    )
    return _contact_to_response(contact)


@router.post("/{user_id}/contacts/manual", response_model=SavedContactResponse)
async def add_manual_contact(
    user_id: UUID,
    data: ManualContactCreate,
    contact_service=Depends(get_contact_service),
):
    """
    Добавить контакт вручную с облаком тегов для поиска.
    Используется для записи контактов не из приложения.
    """
    contact = await contact_service.add_manual_contact(
        owner_id=user_id,
        name=data.name,
        search_tags=data.search_tags,
        phone=data.phone,
        email=data.email,
        notes=data.notes,
    )
    return _contact_to_response(contact)


@router.get("/{user_id}/contacts", response_model=list[SavedContactResponse])
async def get_user_contacts(
    user_id: UUID,
    skip: int = 0,
    limit: int = 100,
    contact_service=Depends(get_contact_service),
):
    """Получить все сохраненные контакты пользователя."""
    contacts = await contact_service.get_user_contacts(user_id, skip, limit)
    return [_contact_to_response(c) for c in contacts]


@router.patch("/contacts/{contact_id}", response_model=SavedContactResponse)
async def update_contact(
    contact_id: UUID,
    data: SavedContactUpdate,
    contact_service=Depends(get_contact_service),
):
    """Обновить теги или заметки контакта."""
    contact = await contact_service.get_contact(contact_id)
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    if data.search_tags is not None:
        contact = await contact_service.update_contact_tags(
            contact_id, data.search_tags
        )
    if data.notes is not None:
        contact = await contact_service.update_contact_notes(contact_id, data.notes)

    return _contact_to_response(contact)


@router.delete("/contacts/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_contact(
    contact_id: UUID,
    contact_service=Depends(get_contact_service),
):
    """Удалить сохраненный контакт."""
    await contact_service.delete_contact(contact_id)


# ============ Contact Import ============


@router.post("/{user_id}/contacts/import", response_model=ImportResult)
async def import_contacts(
    user_id: UUID,
    data: ContactImportRequest,
    import_service=Depends(get_import_service),
):
    """Импорт контактов из телефонной книги."""
    from application.services.contact_import import ImportedContact

    contacts = [
        ImportedContact(
            name=c.name,
            phone=c.phone,
            email=c.email,
        )
        for c in data.contacts
    ]

    result = await import_service.import_contacts(user_id, contacts)

    return ImportResult(
        imported_count=result.imported_count,
        skipped_count=result.skipped_count,
        errors=result.errors,
    )


@router.post("/{user_id}/contacts/import-vcard", response_model=ImportResult)
async def import_vcard(
    user_id: UUID,
    data: VCardImportRequest,
    import_service=Depends(get_import_service),
):
    """Импорт контакта из vCard (например, отсканированного QR-кода)."""
    result = await import_service.import_vcard(user_id, data.vcard_data)

    return ImportResult(
        imported_count=result.imported_count,
        skipped_count=result.skipped_count,
        errors=result.errors,
    )


# ============ Helper Functions ============


def _user_to_response(user) -> UserResponse:
    """Преобразовать User в UserResponse."""
    return UserResponse(
        id=user.id,
        first_name=user.first_name,
        last_name=user.last_name,
        email=user.email,
        avatar_url=user.avatar_url,
        location=user.location,
        bio=user.bio,
        ai_generated_bio=user.ai_generated_bio,
        status=user.status.value,
        tags=[
            TagInfo(
                id=t.id,
                name=t.name,
                category=t.category,
                proficiency=t.proficiency,
            )
            for t in user.tags
        ],
        search_tags=user.search_tags,
        contacts=[
            ContactInfo(
                type=c.type.value,
                value=c.value,
                is_primary=c.is_primary,
            )
            for c in user.contacts
        ],
        random_facts=user.random_facts,
        profile_completeness=user.profile_completeness,
    )


def _user_to_public_response(user) -> UserPublicResponse:
    """Преобразовать User в UserPublicResponse."""
    return UserPublicResponse(
        id=user.id,
        first_name=user.first_name,
        last_name=user.last_name,
        avatar_url=user.avatar_url,
        bio=user.bio,
        ai_generated_bio=user.ai_generated_bio,
        location=user.location,
        tags=[
            TagInfo(
                id=t.id,
                name=t.name,
                category=t.category,
                proficiency=t.proficiency,
            )
            for t in user.tags
        ],
        search_tags=user.search_tags,
        profile_completeness=user.profile_completeness,
    )


def _contact_to_response(contact) -> SavedContactResponse:
    """Преобразовать SavedContact в SavedContactResponse."""
    return SavedContactResponse(
        id=contact.id,
        owner_id=contact.owner_id,
        saved_user_id=contact.saved_user_id,
        name=contact.name,
        phone=contact.phone,
        email=contact.email,
        notes=contact.notes,
        search_tags=contact.search_tags,
        source=contact.source,
        created_at=contact.created_at,
        updated_at=contact.updated_at,
    )
