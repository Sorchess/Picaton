"""API handlers для визитных карточек."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query

from presentation.api.cards.schemas import (
    BusinessCardCreate,
    BusinessCardUpdate,
    BusinessCardResponse,
    BusinessCardPublicResponse,
    BusinessCardListResponse,
    CardContactAdd,
    CardContactUpdate,
    CardSearchTagsUpdate,
    CardRandomFactAdd,
    CardGeneratedBioResponse,
    CardTagInfo,
    CardContactInfo,
    CardSuggestedTag,
    CardTagSuggestionsResponse,
    CardQRCodeResponse,
    TextTagGenerationRequest,
    TextTagGenerationResponse,
)
from infrastructure.dependencies import (
    get_business_card_service,
    get_groq_bio_service,
    get_ai_tags_service,
    get_qrcode_service,
    get_groq_text_tags_service,
)
from application.services.business_card import (
    BusinessCardService,
    BusinessCardNotFoundError,
    CardLimitExceededError,
    CardAccessDeniedError,
)
from application.services.qrcode import QRCodeService


router = APIRouter()


def _card_to_response(card) -> BusinessCardResponse:
    """Преобразовать карточку в ответ API."""
    return BusinessCardResponse(
        id=card.id,
        owner_id=card.owner_id,
        title=card.title,
        is_primary=card.is_primary,
        is_active=card.is_active,
        display_name=card.display_name,
        avatar_url=card.avatar_url,
        bio=card.bio,
        ai_generated_bio=card.ai_generated_bio,
        tags=[
            CardTagInfo(
                id=tag.id,
                name=tag.name,
                category=tag.category,
                proficiency=tag.proficiency,
            )
            for tag in card.tags
        ],
        search_tags=card.search_tags,
        contacts=[
            CardContactInfo(
                type=c.type.value,
                value=c.value,
                is_primary=c.is_primary,
                is_visible=c.is_visible,
            )
            for c in card.contacts
        ],
        random_facts=card.random_facts,
        completeness=card.completeness,
    )


def _card_to_public_response(card) -> BusinessCardPublicResponse:
    """Преобразовать карточку в публичный ответ API."""
    visible_contacts = [c for c in card.contacts if c.is_visible]
    return BusinessCardPublicResponse(
        id=card.id,
        owner_id=card.owner_id,
        title=card.title,
        display_name=card.display_name,
        avatar_url=card.avatar_url,
        bio=card.bio,
        ai_generated_bio=card.ai_generated_bio,
        tags=[
            CardTagInfo(
                id=tag.id,
                name=tag.name,
                category=tag.category,
                proficiency=tag.proficiency,
            )
            for tag in card.tags
        ],
        search_tags=card.search_tags,
        contacts=[
            CardContactInfo(
                type=c.type.value,
                value=c.value,
                is_primary=c.is_primary,
                is_visible=c.is_visible,
            )
            for c in visible_contacts
        ],
        completeness=card.completeness,
    )


# ============ CRUD Endpoints ============


@router.post(
    "/",
    response_model=BusinessCardResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_card(
    owner_id: UUID,
    data: BusinessCardCreate,
    card_service: BusinessCardService = Depends(get_business_card_service),
):
    """
    Создать новую визитную карточку.

    Пользователь может иметь до 5 карточек.
    Первая карточка автоматически становится основной.
    """
    try:
        card = await card_service.create_card(
            owner_id=owner_id,
            title=data.title,
            display_name=data.display_name,
            is_primary=data.is_primary,
        )
        return _card_to_response(card)
    except CardLimitExceededError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/user/{owner_id}", response_model=BusinessCardListResponse)
async def get_user_cards(
    owner_id: UUID,
    card_service: BusinessCardService = Depends(get_business_card_service),
):
    """Получить все визитные карточки пользователя."""
    cards = await card_service.get_user_cards(owner_id)
    return BusinessCardListResponse(
        cards=[_card_to_response(c) for c in cards],
        total=len(cards),
    )


@router.get("/user/{owner_id}/primary", response_model=BusinessCardPublicResponse)
async def get_primary_card(
    owner_id: UUID,
    card_service: BusinessCardService = Depends(get_business_card_service),
):
    """Получить основную визитную карточку пользователя."""
    card = await card_service.get_primary_card(owner_id)
    if not card:
        raise HTTPException(status_code=404, detail="Primary card not found")
    return _card_to_public_response(card)


@router.get("/{card_id}", response_model=BusinessCardPublicResponse)
async def get_card(
    card_id: UUID,
    card_service: BusinessCardService = Depends(get_business_card_service),
):
    """Получить публичную информацию о визитной карточке."""
    try:
        card = await card_service.get_card(card_id)
        return _card_to_public_response(card)
    except BusinessCardNotFoundError:
        raise HTTPException(status_code=404, detail="Card not found")


@router.get("/{card_id}/full", response_model=BusinessCardResponse)
async def get_card_full(
    card_id: UUID,
    card_service: BusinessCardService = Depends(get_business_card_service),
):
    """Получить полную информацию о визитной карточке (для владельца)."""
    try:
        card = await card_service.get_card(card_id)
        return _card_to_response(card)
    except BusinessCardNotFoundError:
        raise HTTPException(status_code=404, detail="Card not found")


@router.patch("/{card_id}", response_model=BusinessCardResponse)
async def update_card(
    card_id: UUID,
    owner_id: UUID,
    data: BusinessCardUpdate,
    card_service: BusinessCardService = Depends(get_business_card_service),
):
    """Обновить визитную карточку."""
    try:
        card = await card_service.update_card(
            card_id=card_id,
            owner_id=owner_id,
            title=data.title,
            display_name=data.display_name,
            avatar_url=data.avatar_url,
            bio=data.bio,
            is_active=data.is_active,
        )
        return _card_to_response(card)
    except BusinessCardNotFoundError:
        raise HTTPException(status_code=404, detail="Card not found")
    except CardAccessDeniedError:
        raise HTTPException(status_code=403, detail="Access denied")


@router.delete("/{card_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_card(
    card_id: UUID,
    owner_id: UUID,
    card_service: BusinessCardService = Depends(get_business_card_service),
):
    """Удалить визитную карточку."""
    try:
        await card_service.delete_card(card_id, owner_id)
    except BusinessCardNotFoundError:
        raise HTTPException(status_code=404, detail="Card not found")
    except CardAccessDeniedError:
        raise HTTPException(status_code=403, detail="Access denied")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{card_id}/set-primary", response_model=BusinessCardResponse)
async def set_card_primary(
    card_id: UUID,
    owner_id: UUID,
    card_service: BusinessCardService = Depends(get_business_card_service),
):
    """Установить карточку как основную."""
    try:
        await card_service.set_primary(card_id, owner_id)
        card = await card_service.get_card(card_id)
        return _card_to_response(card)
    except BusinessCardNotFoundError:
        raise HTTPException(status_code=404, detail="Card not found")
    except CardAccessDeniedError:
        raise HTTPException(status_code=403, detail="Access denied")


# ============ Contacts ============


@router.post("/{card_id}/contacts", response_model=BusinessCardResponse)
async def add_card_contact(
    card_id: UUID,
    owner_id: UUID,
    data: CardContactAdd,
    card_service: BusinessCardService = Depends(get_business_card_service),
):
    """Добавить контакт в визитную карточку."""
    try:
        card = await card_service.add_contact(
            card_id=card_id,
            owner_id=owner_id,
            contact_type=data.type,
            value=data.value,
            is_primary=data.is_primary,
            is_visible=data.is_visible,
        )
        return _card_to_response(card)
    except BusinessCardNotFoundError:
        raise HTTPException(status_code=404, detail="Card not found")
    except CardAccessDeniedError:
        raise HTTPException(status_code=403, detail="Access denied")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/{card_id}/contacts", response_model=BusinessCardResponse)
async def update_card_contact_visibility(
    card_id: UUID,
    owner_id: UUID,
    contact_type: str = Query(..., description="Тип контакта"),
    value: str = Query(..., description="Значение контакта"),
    data: CardContactUpdate = ...,
    card_service: BusinessCardService = Depends(get_business_card_service),
):
    """Обновить видимость контакта."""
    try:
        card = await card_service.update_contact_visibility(
            card_id=card_id,
            owner_id=owner_id,
            contact_type=contact_type,
            value=value,
            is_visible=data.is_visible,
        )
        return _card_to_response(card)
    except BusinessCardNotFoundError:
        raise HTTPException(status_code=404, detail="Card not found")
    except CardAccessDeniedError:
        raise HTTPException(status_code=403, detail="Access denied")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{card_id}/contacts", response_model=BusinessCardResponse)
async def delete_card_contact(
    card_id: UUID,
    owner_id: UUID,
    contact_type: str = Query(..., description="Тип контакта"),
    value: str = Query(..., description="Значение контакта"),
    card_service: BusinessCardService = Depends(get_business_card_service),
):
    """Удалить контакт из визитной карточки."""
    try:
        card = await card_service.remove_contact(
            card_id=card_id,
            owner_id=owner_id,
            contact_type=contact_type,
            value=value,
        )
        return _card_to_response(card)
    except BusinessCardNotFoundError:
        raise HTTPException(status_code=404, detail="Card not found")
    except CardAccessDeniedError:
        raise HTTPException(status_code=403, detail="Access denied")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============ Search Tags ============


@router.put("/{card_id}/search-tags", response_model=BusinessCardResponse)
async def update_card_search_tags(
    card_id: UUID,
    owner_id: UUID,
    data: CardSearchTagsUpdate,
    card_service: BusinessCardService = Depends(get_business_card_service),
):
    """Обновить теги для поиска."""
    try:
        card = await card_service.set_search_tags(
            card_id=card_id,
            owner_id=owner_id,
            tags=data.tags,
        )
        return _card_to_response(card)
    except BusinessCardNotFoundError:
        raise HTTPException(status_code=404, detail="Card not found")
    except CardAccessDeniedError:
        raise HTTPException(status_code=403, detail="Access denied")


# ============ Random Facts ============


@router.post("/{card_id}/facts", response_model=BusinessCardResponse)
async def add_card_random_fact(
    card_id: UUID,
    owner_id: UUID,
    data: CardRandomFactAdd,
    card_service: BusinessCardService = Depends(get_business_card_service),
):
    """Добавить рандомный факт в карточку."""
    try:
        card = await card_service.add_random_fact(
            card_id=card_id,
            owner_id=owner_id,
            fact=data.fact,
        )
        return _card_to_response(card)
    except BusinessCardNotFoundError:
        raise HTTPException(status_code=404, detail="Card not found")
    except CardAccessDeniedError:
        raise HTTPException(status_code=403, detail="Access denied")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============ AI Bio ============


@router.post("/{card_id}/generate-bio", response_model=CardGeneratedBioResponse)
async def generate_card_bio(
    card_id: UUID,
    owner_id: UUID,
    card_service: BusinessCardService = Depends(get_business_card_service),
    groq_service=Depends(get_groq_bio_service),
):
    """Сгенерировать AI-презентацию для карточки."""
    try:
        card = await card_service.get_card(card_id)

        if card.owner_id != owner_id:
            raise HTTPException(status_code=403, detail="Access denied")

        if not card.bio:
            raise HTTPException(
                status_code=400,
                detail="Сначала заполните информацию о себе (bio)",
            )

        # Генерируем bio с помощью AI
        generated_bio = await groq_service.generate_from_text(
            bio_text=card.bio,
            name=card.display_name,
            random_facts=card.random_facts,
            tags=[tag.name for tag in card.tags],
        )

        # Сохраняем в карточку
        await card_service.set_ai_generated_bio(card_id, owner_id, generated_bio.bio)

        return CardGeneratedBioResponse(bio=generated_bio.bio, card_id=card_id)

    except BusinessCardNotFoundError:
        raise HTTPException(status_code=404, detail="Card not found")
    except CardAccessDeniedError:
        raise HTTPException(status_code=403, detail="Access denied")


# ============ Tag Suggestions ============


@router.post("/{card_id}/suggest-tags", response_model=CardTagSuggestionsResponse)
async def suggest_tags_for_card(
    card_id: UUID,
    owner_id: UUID = Query(..., description="ID владельца"),
    card_service: BusinessCardService = Depends(get_business_card_service),
    ai_tags_service=Depends(get_ai_tags_service),
):
    """
    Предложить теги на основе bio карточки.
    Возвращает список тегов на выбор, которые пользователь может выбрать.
    """
    try:
        card = await card_service.get_card(card_id)

        if card.owner_id != owner_id:
            raise HTTPException(status_code=403, detail="Access denied")

        bio = card.bio or ""
        if not bio.strip():
            raise HTTPException(
                status_code=400,
                detail="Сначала заполните информацию о себе (bio)",
            )

        result = await ai_tags_service.generate_from_bio(bio)

        return CardTagSuggestionsResponse(
            suggestions=[
                CardSuggestedTag(
                    name=t.name,
                    category=t.category,
                    confidence=t.confidence,
                    reason=t.reason,
                )
                for t in result.suggested_tags
            ],
            bio_used=bio,
            card_id=card_id,
        )

    except BusinessCardNotFoundError:
        raise HTTPException(status_code=404, detail="Card not found")
    except CardAccessDeniedError:
        raise HTTPException(status_code=403, detail="Access denied")


@router.post("/{card_id}/generate-tags-from-text", response_model=TextTagGenerationResponse)
async def generate_tags_from_text(
    card_id: UUID,
    data: TextTagGenerationRequest,
    owner_id: UUID = Query(..., description="ID владельца"),
    card_service: BusinessCardService = Depends(get_business_card_service),
    text_tags_service=Depends(get_groq_text_tags_service),
):
    """
    Сгенерировать search_tags из произвольного текста через Groq AI.

    Используется когда пользователь хочет описать свои навыки в свободной форме
    и получить список тегов для выбора.

    Отличается от suggest-tags тем что:
    - suggest-tags генерирует теги из bio карточки
    - generate-tags-from-text генерирует теги из произвольного текста (отдельное поле)

    Пример:
    - Input: "Я занимаюсь веб-разработкой, работаю с React и Python..."
    - Output: ["веб-разработка", "react", "python", "frontend", "backend", ...]
    """
    try:
        card = await card_service.get_card(card_id)

        if card.owner_id != owner_id:
            raise HTTPException(status_code=403, detail="Access denied")

        # Генерируем теги из текста через Groq
        tags = await text_tags_service.generate_tags_from_text(data.text)

        return TextTagGenerationResponse(
            suggestions=tags,
            source_text=data.text,
        )

    except BusinessCardNotFoundError:
        raise HTTPException(status_code=404, detail="Card not found")
    except CardAccessDeniedError:
        raise HTTPException(status_code=403, detail="Access denied")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка генерации тегов: {str(e)}")


# ============ Clear Content ============


@router.post("/{card_id}/clear", response_model=BusinessCardResponse)
async def clear_card_content(
    card_id: UUID,
    owner_id: UUID = Query(..., description="ID владельца"),
    card_service: BusinessCardService = Depends(get_business_card_service),
):
    """Очистить всё содержимое карточки (bio, AI bio, теги, контакты)."""
    try:
        card = await card_service.clear_content(card_id, owner_id)
        return _card_to_response(card)
    except BusinessCardNotFoundError:
        raise HTTPException(status_code=404, detail="Card not found")
    except CardAccessDeniedError:
        raise HTTPException(status_code=403, detail="Access denied")


# ============ QR Code ============


@router.get("/{card_id}/qr-code", response_model=CardQRCodeResponse)
async def get_card_qr_code(
    card_id: UUID,
    card_service: BusinessCardService = Depends(get_business_card_service),
    qrcode_service: QRCodeService = Depends(get_qrcode_service),
):
    """Получить QR-код для визитной карточки."""
    try:
        # Проверяем что карточка существует
        card = await card_service.get_card(card_id)
        if not card:
            raise HTTPException(status_code=404, detail="Card not found")

        qr_data = qrcode_service.generate_card_qr(card_id)
        return CardQRCodeResponse(
            image_base64=qr_data.image_base64,
            card_id=card_id,
        )
    except BusinessCardNotFoundError:
        raise HTTPException(status_code=404, detail="Card not found")
