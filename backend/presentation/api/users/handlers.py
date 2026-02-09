from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, Query

from presentation.api.users.schemas import (
    UserCreate,
    UserUpdate,
    UserResponse,
    UserPublicResponse,
    RandomFactAdd,
    SearchTagsUpdate,
    SearchRequest,
    SearchResult,
    SearchCardResult,
    SearchCardContactInfo,
    SearchSuggestionsResponse,
    QRCodeResponse,
    QRCodeType,
    SavedContactCreate,
    ManualContactCreate,
    SavedContactUpdate,
    SavedContactResponse,
    ContactImportRequest,
    ImportResult,
    GeneratedBioResponse,
    TagInfo,
    ContactInfo,
    UserContactAdd,
    UserContactUpdate,
    UserContactDelete,
    ProfileVisibilityUpdate,
    EmailUpdate,
    EmailVerificationRequest,
    EmailVerificationConfirm,
    EmailVerificationResponse,
    SuggestedTagResponse,
    TagSuggestionsResponse,
    ApplyTagsRequest,
    GenerateContactTagsRequest,
    GenerateContactTagsResponse,
    ContactSyncRequest,
    ContactSyncResponse,
    AvatarUploadResponse,
)
from domain.enums.contact import ContactType
from infrastructure.dependencies import (
    get_user_service,
    get_contact_service,
    get_search_service,
    get_qrcode_service,
    get_import_service,
    get_contact_sync_service,
    get_ai_tags_service,
    get_gigachat_tags_service,
    get_cloudinary_service,
    get_business_card_service,
    get_card_title_generator,
    get_email_verification_service,
    get_company_member_repository,
    get_business_card_repository,
)
from domain.repositories.company import CompanyMemberRepositoryInterface
from domain.repositories.business_card import BusinessCardRepositoryInterface
from application.services.email_verification import EmailVerificationError
from application.services.contact_sync import HashedContact
from infrastructure.storage import CloudinaryService
from infrastructure.storage.cloudinary_service import CloudinaryError, InvalidFileError


router = APIRouter()


# ============ Contact Tags Generation (before parameterized routes) ============


@router.post("/contacts/generate-tags", response_model=GenerateContactTagsResponse)
async def generate_contact_tags(
    data: GenerateContactTagsRequest,
    gigachat_service=Depends(get_gigachat_tags_service),
):
    """
    Сгенерировать теги для контакта из заметок с помощью AI.

    Используется при добавлении контакта вручную.
    AI анализирует заметки и предлагает теги для облака поиска.
    """
    try:
        tags = await gigachat_service.generate_tags_from_notes(data.notes)
        return GenerateContactTagsResponse(tags=tags)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка генерации тегов: {str(e)}",
        )


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
    card_service=Depends(get_business_card_service),
    title_generator=Depends(get_card_title_generator),
):
    """Обновить профиль пользователя (ФИО, фото, самопрезентация).

    При первом обновлении профиля (онбординг) автоматически создаёт
    визитную карточку с AI-сгенерированным названием.
    """
    # Проверяем, есть ли у пользователя карточки (до обновления)
    existing_cards = await card_service.get_user_cards(user_id)
    is_onboarding = len(existing_cards) == 0

    # Обновляем профиль
    user = await user_service.update_profile(
        user_id=user_id,
        first_name=data.first_name,
        last_name=data.last_name,
        avatar_url=data.avatar_url,
        bio=data.bio,
    )

    # Если это онбординг - создаём первую карточку автоматически
    if is_onboarding:
        # Генерируем название карточки на основе информации пользователя
        card_title = await title_generator.generate_title(
            first_name=user.first_name,
            last_name=user.last_name,
            bio=user.bio,
            location=user.location,
        )

        # Создаём основную карточку
        await card_service.create_card(
            owner_id=user_id,
            title=card_title,
            display_name=f"{user.first_name} {user.last_name}".strip(),
            is_primary=True,
            bio=user.bio,
            avatar_url=user.avatar_url,
            contacts=user.contacts,
        )
    else:
        # Синхронизируем аватар с существующими карточками, если он был передан
        if data.avatar_url is not None:
            await card_service.update_avatar_for_owner(user_id, user.avatar_url)

    return _user_to_response(user)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: UUID,
    user_service=Depends(get_user_service),
):
    """Удалить пользователя."""
    await user_service.delete_user(user_id)


@router.patch("/{user_id}/visibility", response_model=UserResponse)
async def update_profile_visibility(
    user_id: UUID,
    data: ProfileVisibilityUpdate,
    user_service=Depends(get_user_service),
    card_service=Depends(get_business_card_service),
):
    """
    Изменить видимость профиля.

    - is_public=True: публичный профиль, виден всем при поиске
    - is_public=False: приватный профиль, виден только внутри компании
    """
    # Обновляем видимость пользователя
    user = await user_service.update_visibility(user_id, data.is_public)

    # Синхронизируем видимость всех карточек
    await card_service.update_visibility_for_owner(user_id, data.is_public)

    return _user_to_response(user)


@router.post("/{user_id}/email/send-code", response_model=EmailVerificationResponse)
async def send_email_verification_code(
    user_id: UUID,
    data: EmailVerificationRequest,
    verification_service=Depends(get_email_verification_service),
):
    """
    Отправить код подтверждения на email.

    Генерирует 6-значный код и отправляет его на указанный email.
    Код действителен 15 минут.
    """
    from application.tasks.email_tasks import (
        send_email_verification_code as send_code_task,
    )

    # Создаём код верификации
    code = await verification_service.send_verification_code(user_id, data.email)

    # Отправляем email с кодом через task
    await send_code_task.kiq(data.email, code)

    return EmailVerificationResponse(
        message=f"Код подтверждения отправлен на {data.email}"
    )


@router.post("/{user_id}/email/verify", response_model=EmailVerificationResponse)
async def verify_email_code(
    user_id: UUID,
    data: EmailVerificationConfirm,
    verification_service=Depends(get_email_verification_service),
):
    """
    Подтвердить email с помощью кода.

    Проверяет 6-значный код и обновляет email пользователя.
    """
    try:
        email = await verification_service.verify_code(user_id, data.code)
        return EmailVerificationResponse(
            message="Email успешно подтверждён",
            email=email,
        )
    except EmailVerificationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


# ============ User Profile Contacts ============


@router.post("/{user_id}/profile-contacts", response_model=UserResponse)
async def add_user_contact(
    user_id: UUID,
    data: UserContactAdd,
    user_service=Depends(get_user_service),
    card_service=Depends(get_business_card_service),
):
    """
    Добавить контакт в профиль пользователя.
    Контакт также автоматически добавляется в основную визитную карточку.

    Доступные типы: telegram, whatsapp, vk, messenger, email, phone,
    linkedin, github, instagram, tiktok, slack
    """
    try:
        user = await user_service.add_contact(
            user_id=user_id,
            contact_type=data.type,
            value=data.value,
            is_primary=data.is_primary,
            is_visible=data.is_visible,
        )

        # Синхронизируем с основной визитной карточкой
        primary_card = await card_service.get_primary_card(user_id)
        if primary_card:
            try:
                await card_service.add_contact(
                    card_id=primary_card.id,
                    owner_id=user_id,
                    contact_type=data.type,
                    value=data.value,
                    is_primary=data.is_primary,
                    is_visible=data.is_visible,
                )
            except Exception:
                # Игнорируем ошибки синхронизации (например, если контакт уже есть)
                pass

        return _user_to_response(user)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/{user_id}/profile-contacts", response_model=UserResponse)
async def update_user_contact_visibility(
    user_id: UUID,
    contact_type: str,
    value: str,
    data: UserContactUpdate,
    user_service=Depends(get_user_service),
):
    """Обновить видимость контакта в профиле."""
    try:
        user = await user_service.update_contact_visibility(
            user_id=user_id,
            contact_type=contact_type,
            value=value,
            is_visible=data.is_visible,
        )
        return _user_to_response(user)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{user_id}/profile-contacts", response_model=UserResponse)
async def delete_user_contact(
    user_id: UUID,
    contact_type: str = Query(..., description="Тип контакта"),
    value: str = Query(..., description="Значение контакта"),
    user_service=Depends(get_user_service),
    card_service=Depends(get_business_card_service),
):
    """Удалить контакт из профиля. Также удаляет из основной визитной карточки."""
    try:
        user = await user_service.remove_contact(
            user_id=user_id,
            contact_type=contact_type,
            value=value,
        )

        # Синхронизируем удаление с основной визитной карточкой
        primary_card = await card_service.get_primary_card(user_id)
        if primary_card:
            try:
                await card_service.remove_contact(
                    card_id=primary_card.id,
                    owner_id=user_id,
                    contact_type=contact_type,
                    value=value,
                )
            except Exception:
                # Игнорируем ошибки синхронизации
                pass

        return _user_to_response(user)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{user_id}/sync-contacts")
async def sync_profile_to_primary_card(
    user_id: UUID,
    user_service=Depends(get_user_service),
    card_service=Depends(get_business_card_service),
):
    """
    Синхронизировать контакты из профиля пользователя в основную визитную карточку.

    Полезно для миграции контактов у существующих пользователей.
    """
    user = await user_service.get_user(user_id)
    primary_card = await card_service.get_primary_card(user_id)

    if not primary_card:
        raise HTTPException(status_code=404, detail="Primary card not found")

    synced_count = 0
    for contact in user.contacts:
        try:
            await card_service.add_contact(
                card_id=primary_card.id,
                owner_id=user_id,
                contact_type=(
                    contact.type.value
                    if hasattr(contact.type, "value")
                    else contact.type
                ),
                value=contact.value,
                is_primary=contact.is_primary,
                is_visible=contact.is_visible,
            )
            synced_count += 1
        except Exception:
            # Контакт уже существует или другая ошибка
            pass

    return {"synced_count": synced_count, "total_contacts": len(user.contacts)}


# ============ Avatar Upload ============


@router.post("/{user_id}/avatar", response_model=AvatarUploadResponse)
async def upload_avatar(
    user_id: UUID,
    file: UploadFile = File(...),
    user_service=Depends(get_user_service),
    card_service=Depends(get_business_card_service),
    cloudinary_service: CloudinaryService = Depends(get_cloudinary_service),
):
    """
    Загрузить аватарку пользователя.

    - Поддерживаемые форматы: jpg, jpeg, png, webp
    - Максимальный размер: 5MB
    - Изображение автоматически масштабируется до 400x400
    """
    try:
        # Read file content
        content = await file.read()

        # Upload to Cloudinary
        result = await cloudinary_service.upload_avatar(
            user_id=user_id,
            file_content=content,
            filename=file.filename or "avatar.jpg",
        )

        # Update user profile with new avatar URL
        await user_service.update_profile(
            user_id=user_id,
            avatar_url=result.url,
        )

        # Sync avatar to all user's business cards
        await card_service.update_avatar_for_owner(user_id, result.url)

        return AvatarUploadResponse(avatar_url=result.url)

    except InvalidFileError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except CloudinaryError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка загрузки: {str(e)}",
        )


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
    user_service=Depends(get_user_service),
    company_member_repo: CompanyMemberRepositoryInterface = Depends(
        get_company_member_repository
    ),
    card_repo: BusinessCardRepositoryInterface = Depends(get_business_card_repository),
):
    """
    Ассоциативный поиск экспертов и контактов.
    Можно искать по тегам, ассоциациям, именам.

    При указании company_ids ищет только среди членов указанных компаний.

    Примеры запросов:
    - "бэкенд эксперт" → найдёт Python, Java, Node.js разработчиков
    - "фронтенд" → найдёт React, Vue, Angular специалистов
    - "питон" → найдёт Python разработчиков (синоним)
    """
    try:
        # Собираем card_ids из выбранных компаний
        company_card_ids = None
        if data.company_ids:
            company_card_ids = []
            for company_id in data.company_ids:
                members = await company_member_repo.get_by_company(company_id)
                for member in members:
                    if member.selected_card_id:
                        # Если у члена выбрана конкретная карточка, используем её
                        company_card_ids.append(member.selected_card_id)
                    else:
                        # Если карточка не выбрана, берём все карточки этого пользователя
                        user_cards = await card_repo.get_by_owner(member.user_id)
                        for card in user_cards:
                            if card.is_active:
                                company_card_ids.append(card.id)
            # Убираем дубликаты
            company_card_ids = list(set(company_card_ids))

        result = await search_service.search(
            query=data.query,
            owner_id=owner_id,
            limit=data.limit,
            include_users=data.include_users,
            include_contacts=data.include_contacts,
            company_card_ids=company_card_ids,
        )

        # Получаем данные владельцев карточек для имён
        owner_ids = list(set(c.owner_id for c in result.cards))
        owners_map = {}
        for oid in owner_ids:
            try:
                user = await user_service.get_user(oid)
                owners_map[oid] = user
            except Exception:
                pass

        def build_card_result(c):
            owner = owners_map.get(c.owner_id)
            return SearchCardResult(
                id=c.id,
                owner_id=c.owner_id,
                display_name=c.display_name,
                owner_first_name=owner.first_name if owner else "",
                owner_last_name=owner.last_name if owner else "",
                avatar_url=c.avatar_url or (owner.avatar_url if owner else None),
                bio=c.bio,
                ai_generated_bio=c.ai_generated_bio,
                search_tags=c.search_tags,
                contacts=[
                    SearchCardContactInfo(
                        type=contact.type.value,
                        value=contact.value,
                        is_primary=contact.is_primary,
                    )
                    for contact in c.contacts
                    if contact.is_visible
                ],
                completeness=c.completeness,
            )

        return SearchResult(
            users=[_user_to_public_response(u) for u in result.users],
            cards=[build_card_result(c) for c in result.cards],
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
    """Сохранить контакт другого пользователя или его визитную карточку."""
    contact = await contact_service.save_user_contact(
        owner_id=user_id,
        user_id=data.user_id,
        card_id=data.card_id,
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
        first_name=data.first_name,
        last_name=data.last_name,
        search_tags=data.search_tags,
        phone=data.phone,
        email=data.email,
        notes=data.notes,
        messenger_type=data.messenger_type,
        messenger_value=data.messenger_value,
        name=data.name,  # Legacy
    )
    return _contact_to_response(contact)


@router.get("/{user_id}/contacts", response_model=list[SavedContactResponse])
async def get_user_contacts(
    user_id: UUID,
    skip: int = 0,
    limit: int = 100,
    contact_service=Depends(get_contact_service),
    user_service=Depends(get_user_service),
    card_service=Depends(get_business_card_service),
):
    """Получить все сохраненные контакты пользователя."""
    contacts = await contact_service.get_user_contacts(user_id, skip, limit)

    # Обогащаем контакты без avatar_url
    for contact in contacts:
        if contact.avatar_url:
            continue
        # Пробуем получить аватарку из карточки или пользователя
        try:
            if contact.saved_card_id:
                card = await card_service.get_card(contact.saved_card_id)
                if card and card.avatar_url:
                    contact.avatar_url = card.avatar_url
                    continue
            if contact.saved_user_id:
                user = await user_service.get_user(contact.saved_user_id)
                if user and user.avatar_url:
                    contact.avatar_url = user.avatar_url
        except Exception:
            pass

    return [_contact_to_response(c) for c in contacts]


@router.patch("/contacts/{contact_id}", response_model=SavedContactResponse)
async def update_contact(
    contact_id: UUID,
    data: SavedContactUpdate,
    contact_service=Depends(get_contact_service),
):
    """Обновить контакт (имя, email, мессенджер, теги, заметки)."""
    contact = await contact_service.get_contact(contact_id)
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    contact = await contact_service.update_contact(
        contact_id=contact_id,
        first_name=data.first_name,
        last_name=data.last_name,
        phone=data.phone,
        email=data.email,
        messenger_type=data.messenger_type,
        messenger_value=data.messenger_value,
        notes=data.notes,
        search_tags=data.search_tags,
    )
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


# ============ Contact Sync (Enterprise/Privacy-First) ============


@router.post("/{user_id}/contacts/sync", response_model=ContactSyncResponse)
async def sync_contacts(
    user_id: UUID,
    data: ContactSyncRequest,
    sync_service=Depends(get_contact_sync_service),
):
    """
    Синхронизация контактов по хешам телефонов (Privacy-First).

    Клиент хеширует номера телефонов (SHA-256) перед отправкой.
    Сервер НИКОГДА не видит реальные номера — только их хеши.

    Возвращает:
    - found: список найденных пользователей
    - found_count: количество найденных
    - pending_count: количество номеров, ожидающих регистрации
    """
    try:
        hashed_contacts = [
            HashedContact(name=c.name, hash=c.hash) for c in data.hashed_contacts
        ]

        result = await sync_service.sync_contacts(user_id, hashed_contacts)

        return ContactSyncResponse(
            found=[
                {
                    "hash": c.hash,
                    "original_name": c.original_name,
                    "user": {
                        "id": c.user.id,
                        "name": c.user.name,
                        "avatar_url": c.user.avatar_url,
                    },
                }
                for c in result.found
            ],
            found_count=result.found_count,
            pending_count=result.pending_count,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка синхронизации: {str(e)}",
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
                is_visible=c.is_visible,
            )
            for c in user.contacts
        ],
        random_facts=user.random_facts,
        profile_completeness=user.profile_completeness,
        is_public=user.is_public,
    )


def _user_to_public_response(user) -> UserPublicResponse:
    """Преобразовать User в UserPublicResponse."""
    # Только публичные контакты (is_visible=True)
    visible_contacts = [c for c in user.contacts if c.is_visible]

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
        contacts=[
            ContactInfo(
                type=c.type.value,
                value=c.value,
                is_primary=c.is_primary,
                is_visible=c.is_visible,
            )
            for c in visible_contacts
        ],
        profile_completeness=user.profile_completeness,
    )


def _contact_to_response(contact) -> SavedContactResponse:
    """Преобразовать SavedContact в SavedContactResponse."""
    return SavedContactResponse(
        id=contact.id,
        owner_id=contact.owner_id,
        saved_user_id=contact.saved_user_id,
        saved_card_id=contact.saved_card_id,
        name=contact.full_name,  # Legacy: использует full_name property
        first_name=contact.first_name,
        last_name=contact.last_name,
        phone=contact.phone,
        email=contact.email,
        avatar_url=contact.avatar_url,
        contacts=[
            ContactInfo(
                type=c.type.value if hasattr(c.type, "value") else c.type,
                value=c.value,
                is_primary=c.is_primary,
                is_visible=c.is_visible if hasattr(c, "is_visible") else True,
            )
            for c in (contact.contacts or [])
        ],
        messenger_type=contact.messenger_type,
        messenger_value=contact.messenger_value,
        notes=contact.notes,
        search_tags=contact.search_tags,
        source=contact.source,
        created_at=contact.created_at,
        updated_at=contact.updated_at,
    )
