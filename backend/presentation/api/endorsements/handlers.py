"""API handlers для подтверждений навыков (skill endorsements)."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query

from presentation.api.endorsements.schemas import (
    SkillEndorsementCreate,
    SkillEndorsementResponse,
    SkillWithEndorsementsResponse,
    CardSkillsWithEndorsementsResponse,
    ToggleEndorsementResponse,
    MyEndorsementsResponse,
    ContactEndorsersResponse,
    EndorserInfo,
)
from infrastructure.dependencies import get_skill_endorsement_service
from application.services.skill_endorsement import (
    SkillEndorsementService,
    CannotEndorseOwnSkillError,
    AlreadyEndorsedError,
    CardNotFoundError,
    TagNotFoundError,
    EndorsementNotFoundError,
)


router = APIRouter()


def _endorsement_to_response(e) -> SkillEndorsementResponse:
    """Преобразовать подтверждение в ответ API."""
    return SkillEndorsementResponse(
        id=e.id,
        endorser_id=e.endorser_id,
        card_id=e.card_id,
        tag_id=e.tag_id,
        tag_name=e.tag_name,
        tag_category=e.tag_category,
        card_owner_id=e.card_owner_id,
        created_at=e.created_at,
        endorser_name=e.endorser_name,
        endorser_avatar_url=e.endorser_avatar_url,
    )


@router.post(
    "/",
    response_model=SkillEndorsementResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Подтвердить навык",
    description="Поставить лайк на навык пользователя. Нельзя подтверждать свои навыки.",
)
async def endorse_skill(
    endorser_id: UUID = Query(..., description="ID пользователя, который подтверждает"),
    data: SkillEndorsementCreate = ...,
    service: SkillEndorsementService = Depends(get_skill_endorsement_service),
):
    """Подтвердить навык пользователя."""
    try:
        endorsement = await service.endorse_skill(
            endorser_id=endorser_id,
            card_id=data.card_id,
            tag_id=data.tag_id,
        )
        return _endorsement_to_response(endorsement)
    except CannotEndorseOwnSkillError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нельзя подтверждать свои собственные навыки",
        )
    except AlreadyEndorsedError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Вы уже подтвердили этот навык",
        )
    except CardNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Карточка не найдена",
        )
    except TagNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Навык не найден на этой карточке",
        )


@router.delete(
    "/",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Удалить подтверждение",
    description="Снять лайк с навыка.",
)
async def remove_endorsement(
    endorser_id: UUID = Query(..., description="ID пользователя"),
    card_id: UUID = Query(..., description="ID карточки"),
    tag_id: UUID = Query(..., description="ID навыка"),
    service: SkillEndorsementService = Depends(get_skill_endorsement_service),
):
    """Удалить подтверждение навыка."""
    try:
        await service.remove_endorsement(endorser_id, card_id, tag_id)
    except EndorsementNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Подтверждение не найдено",
        )


@router.post(
    "/toggle",
    response_model=ToggleEndorsementResponse,
    summary="Переключить подтверждение",
    description="Если лайк стоит - убрать, если нет - поставить.",
)
async def toggle_endorsement(
    endorser_id: UUID = Query(..., description="ID пользователя"),
    data: SkillEndorsementCreate = ...,
    service: SkillEndorsementService = Depends(get_skill_endorsement_service),
):
    """Переключить состояние подтверждения."""
    try:
        is_endorsed, endorsement = await service.toggle_endorsement(
            endorser_id=endorser_id,
            card_id=data.card_id,
            tag_id=data.tag_id,
        )

        # Получить текущее количество подтверждений
        skills_data = await service.get_card_skills_with_endorsements(
            card_id=data.card_id,
            current_user_id=endorser_id,
        )
        skill = next((s for s in skills_data.skills if s.tag_id == data.tag_id), None)
        count = skill.endorsement_count if skill else 0

        return ToggleEndorsementResponse(
            is_endorsed=is_endorsed,
            endorsement=_endorsement_to_response(endorsement) if endorsement else None,
            endorsement_count=count,
        )
    except CannotEndorseOwnSkillError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нельзя подтверждать свои собственные навыки",
        )
    except CardNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Карточка не найдена",
        )
    except TagNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Навык не найден на этой карточке",
        )


@router.get(
    "/card/{card_id}",
    response_model=CardSkillsWithEndorsementsResponse,
    summary="Получить навыки карточки с подтверждениями",
    description="Получить все навыки карточки с количеством подтверждений и списком endorser-ов.",
)
async def get_card_skills_with_endorsements(
    card_id: UUID,
    current_user_id: UUID | None = Query(
        default=None,
        description="ID текущего пользователя для отметки 'вы подтвердили'",
    ),
    service: SkillEndorsementService = Depends(get_skill_endorsement_service),
):
    """Получить навыки карточки с информацией о подтверждениях."""
    try:
        result = await service.get_card_skills_with_endorsements(
            card_id=card_id,
            current_user_id=current_user_id,
        )

        return CardSkillsWithEndorsementsResponse(
            card_id=result.card_id,
            skills=[
                SkillWithEndorsementsResponse(
                    tag_id=s.tag_id,
                    tag_name=s.tag_name,
                    tag_category=s.tag_category,
                    proficiency=s.proficiency,
                    endorsement_count=s.endorsement_count,
                    endorsed_by_current_user=s.endorsed_by_current_user,
                    endorsers=[
                        EndorserInfo(
                            id=UUID(e["id"]),
                            name=e["name"],
                            avatar_url=e.get("avatar_url"),
                        )
                        for e in s.endorsers
                    ],
                )
                for s in result.skills
            ],
        )
    except CardNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Карточка не найдена",
        )


@router.get(
    "/my",
    response_model=MyEndorsementsResponse,
    summary="Мои подтверждения",
    description="Получить все подтверждения, которые я поставил другим пользователям.",
)
async def get_my_endorsements(
    user_id: UUID = Query(..., description="ID пользователя"),
    service: SkillEndorsementService = Depends(get_skill_endorsement_service),
):
    """Получить подтверждения, сделанные пользователем."""
    endorsements = await service.get_my_endorsements(user_id)
    return MyEndorsementsResponse(
        endorsements=[_endorsement_to_response(e) for e in endorsements],
        total=len(endorsements),
    )


@router.get(
    "/from-contacts",
    response_model=ContactEndorsersResponse,
    summary="Подтверждения от контактов",
    description="Получить подтверждения навыка от ваших контактов.",
)
async def get_endorsements_from_contacts(
    card_id: UUID = Query(..., description="ID карточки"),
    tag_id: UUID = Query(..., description="ID навыка"),
    contact_ids: list[UUID] = Query(..., description="ID ваших контактов"),
    service: SkillEndorsementService = Depends(get_skill_endorsement_service),
):
    """
    Получить подтверждения от контактов.
    Используется для показа "X из ваших контактов подтвердили этот навык".
    """
    endorsements = await service.get_endorsements_from_contacts(
        card_id=card_id,
        tag_id=tag_id,
        contact_user_ids=contact_ids,
    )

    # Получить имя навыка
    tag_name = endorsements[0].tag_name if endorsements else "навык"

    endorsers = [
        EndorserInfo(
            id=e.endorser_id,
            name=e.endorser_name,
            avatar_url=e.endorser_avatar_url,
        )
        for e in endorsements
    ]

    total = len(endorsers)
    if total == 0:
        message = "Никто из ваших контактов не подтвердил этот навык"
    elif total == 1:
        message = f"{endorsers[0].name} подтвердил этот навык"
    else:
        message = f"{total} из ваших контактов подтвердили этот навык"

    return ContactEndorsersResponse(
        card_id=card_id,
        tag_id=tag_id,
        tag_name=tag_name,
        endorsers_from_contacts=endorsers,
        total_from_contacts=total,
        message=message,
    )
