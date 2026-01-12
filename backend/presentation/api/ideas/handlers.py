"""API handlers для идей и свайпов (Фабрика Идей)."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from application.services.idea import (
    IdeaService,
    IdeaNotFoundError,
    IdeaAccessDeniedError,
    CreateIdeaData,
    UpdateIdeaData,
)
from application.services.swipe import SwipeService
from application.services.ai_team_matching import AITeamMatchingService
from application.services.ai_prd_generator import AIPRDGeneratorService
from application.services.gamification import GamificationService
from domain.enums.idea import IdeaStatus, IdeaVisibility, SwipeDirection
from infrastructure.dependencies import (
    get_idea_service,
    get_swipe_service,
    get_ai_team_matching_service,
    get_ai_prd_generator_service,
    get_gamification_service,
    get_idea_comment_repository,
    get_user_service,
    get_current_user_id,
)
from presentation.api.ideas.schemas import (
    CreateIdeaRequest,
    CreateIdeaFromVoiceRequest,
    GeneratePRDRequest,
    UpdateIdeaRequest,
    SwipeRequest,
    AddCommentRequest,
    IdeaResponse,
    IdeaListResponse,
    IdeaAuthorResponse,
    IdeaLeaderboardResponse,
    LeaderboardIdeaResponse,
    PRDResponse,
    SwipeResponse,
    CommentResponse,
    CommentListResponse,
    MatchedExpertResponse,
    TeamSuggestionResponse,
    IdeaAnalysisResponse,
    GeneratedPRDResponse,
    UserGamificationResponse,
    LeaderboardEntryResponse,
    LeaderboardResponse,
)


router = APIRouter(prefix="/ideas", tags=["ideas"])


def _idea_to_response(idea, author=None, include_prd: bool = True) -> IdeaResponse:
    """Преобразовать сущность идеи в response."""
    author_response = None
    if author:
        author_response = IdeaAuthorResponse(
            id=author.id,
            first_name=author.first_name,
            last_name=author.last_name,
            avatar_url=author.avatar_url,
            reputation=getattr(author, "reputation", None),
        )

    # PRD данные
    prd = None
    if include_prd and idea.has_prd():
        prd = PRDResponse(
            problem_statement=idea.problem_statement,
            solution_description=idea.solution_description,
            target_users=idea.target_users,
            mvp_scope=idea.mvp_scope,
            success_metrics=idea.success_metrics,
            risks=idea.risks,
            timeline=idea.timeline,
            generated_by_ai=idea.prd_generated_by_ai,
        )

    return IdeaResponse(
        id=idea.id,
        author_id=idea.author_id,
        author=author_response,
        title=idea.title,
        description=idea.description,
        prd=prd,
        required_skills=idea.required_skills,
        ai_suggested_skills=idea.ai_suggested_skills,
        ai_suggested_roles=idea.ai_suggested_roles,
        skills_confidence=idea.skills_confidence,
        status=idea.status.value,
        visibility=idea.visibility.value,
        company_id=idea.company_id,
        department_id=idea.department_id,
        likes_count=idea.likes_count,
        super_likes_count=idea.super_likes_count,
        dislikes_count=idea.dislikes_count,
        views_count=idea.views_count,
        comments_count=idea.comments_count,
        idea_score=idea.idea_score,
        created_at=idea.created_at,
        updated_at=idea.updated_at,
        published_at=idea.published_at,
    )


# ============ Ideas CRUD ============


@router.post("", response_model=IdeaResponse, status_code=status.HTTP_201_CREATED)
async def create_idea(
    data: CreateIdeaRequest,
    current_user_id: UUID = Depends(get_current_user_id),
    idea_service: IdeaService = Depends(get_idea_service),
):
    """Создать новую идею."""
    try:
        visibility = IdeaVisibility(data.visibility)
    except ValueError:
        visibility = IdeaVisibility.PUBLIC

    idea = await idea_service.create_idea(
        author_id=current_user_id,
        data=CreateIdeaData(
            title=data.title,
            description=data.description,
            required_skills=data.required_skills,
            visibility=visibility,
            company_id=data.company_id,
        ),
    )

    return _idea_to_response(idea)


@router.get("/my", response_model=IdeaListResponse)
async def get_my_ideas(
    status_filter: str | None = Query(None, alias="status"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user_id: UUID = Depends(get_current_user_id),
    idea_service: IdeaService = Depends(get_idea_service),
):
    """Получить мои идеи."""
    idea_status = None
    if status_filter:
        try:
            idea_status = IdeaStatus(status_filter)
        except ValueError:
            pass

    ideas = await idea_service.get_my_ideas(
        author_id=current_user_id,
        status=idea_status,
        limit=limit,
        offset=offset,
    )

    return IdeaListResponse(
        ideas=[_idea_to_response(idea) for idea in ideas],
        total=len(ideas),
    )


@router.get("/feed", response_model=IdeaListResponse)
async def get_ideas_feed(
    limit: int = Query(20, ge=1, le=50),
    company_id: UUID | None = None,
    current_user_id: UUID = Depends(get_current_user_id),
    idea_service: IdeaService = Depends(get_idea_service),
    user_service=Depends(get_user_service),
):
    """
    Получить ленту идей для свайпа.
    Исключает собственные идеи и уже просмотренные.
    """
    ideas = await idea_service.get_ideas_for_swipe(
        user_id=current_user_id,
        company_id=company_id,
        limit=limit,
    )

    # Получаем информацию об авторах
    responses = []
    for idea in ideas:
        try:
            author = await user_service.get_user(idea.author_id)
            responses.append(_idea_to_response(idea, author))
        except Exception:
            responses.append(_idea_to_response(idea))

    return IdeaListResponse(
        ideas=responses,
        total=len(responses),
    )


# ============ Leaderboard (static routes before /{idea_id}) ============


@router.get("/leaderboard", response_model=IdeaLeaderboardResponse)
async def get_ideas_leaderboard(
    period: str = Query("all", pattern="^(all|weekly|monthly)$"),
    company_id: UUID | None = Query(None),
    department_id: UUID | None = Query(None),
    limit: int = Query(10, ge=1, le=50),
    idea_service: IdeaService = Depends(get_idea_service),
    user_service=Depends(get_user_service),
):
    """
    Получить таблицу лидеров идей.
    Ранжирование по IdeaScore.
    """
    period_days = None
    if period == "weekly":
        period_days = 7
    elif period == "monthly":
        period_days = 30

    ideas = await idea_service._idea_repo.get_leaderboard(
        company_id=company_id,
        department_id=department_id,
        period_days=period_days,
        limit=limit,
    )

    result = []
    for rank, idea in enumerate(ideas, 1):
        try:
            author = await user_service.get_user(idea.author_id)
            author_response = IdeaAuthorResponse(
                id=author.id,
                first_name=author.first_name,
                last_name=author.last_name,
                avatar_url=author.avatar_url,
            )
        except Exception:
            author_response = IdeaAuthorResponse(
                id=idea.author_id,
                first_name="Unknown",
                last_name="User",
            )

        result.append(
            LeaderboardIdeaResponse(
                id=idea.id,
                title=idea.title,
                author=author_response,
                idea_score=idea.idea_score,
                likes_count=idea.likes_count,
                super_likes_count=idea.super_likes_count,
                rank=rank,
            )
        )

    return IdeaLeaderboardResponse(
        ideas=result,
        period=period,
    )


# ============ CRUD with {idea_id} ============


@router.get("/{idea_id}", response_model=IdeaResponse)
async def get_idea(
    idea_id: UUID,
    idea_service: IdeaService = Depends(get_idea_service),
    user_service=Depends(get_user_service),
):
    """Получить идею по ID."""
    try:
        idea = await idea_service.get_idea(idea_id)
    except IdeaNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Idea not found",
        )

    try:
        author = await user_service.get_user(idea.author_id)
        return _idea_to_response(idea, author)
    except Exception:
        return _idea_to_response(idea)


@router.put("/{idea_id}", response_model=IdeaResponse)
async def update_idea(
    idea_id: UUID,
    data: UpdateIdeaRequest,
    current_user_id: UUID = Depends(get_current_user_id),
    idea_service: IdeaService = Depends(get_idea_service),
):
    """Обновить идею."""
    visibility = None
    if data.visibility:
        try:
            visibility = IdeaVisibility(data.visibility)
        except ValueError:
            pass

    try:
        idea = await idea_service.update_idea(
            idea_id=idea_id,
            owner_id=current_user_id,
            data=UpdateIdeaData(
                title=data.title,
                description=data.description,
                required_skills=data.required_skills,
                visibility=visibility,
            ),
        )
    except IdeaNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Idea not found",
        )
    except IdeaAccessDeniedError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    return _idea_to_response(idea)


@router.delete("/{idea_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_idea(
    idea_id: UUID,
    current_user_id: UUID = Depends(get_current_user_id),
    idea_service: IdeaService = Depends(get_idea_service),
):
    """Удалить идею."""
    try:
        await idea_service.delete_idea(idea_id, current_user_id)
    except IdeaNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Idea not found",
        )
    except IdeaAccessDeniedError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )


@router.post("/{idea_id}/publish", response_model=IdeaResponse)
async def publish_idea(
    idea_id: UUID,
    current_user_id: UUID = Depends(get_current_user_id),
    idea_service: IdeaService = Depends(get_idea_service),
):
    """Опубликовать идею."""
    try:
        idea = await idea_service.publish_idea(idea_id, current_user_id)
    except IdeaNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Idea not found",
        )
    except IdeaAccessDeniedError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )

    return _idea_to_response(idea)


@router.post("/{idea_id}/archive", response_model=IdeaResponse)
async def archive_idea(
    idea_id: UUID,
    current_user_id: UUID = Depends(get_current_user_id),
    idea_service: IdeaService = Depends(get_idea_service),
):
    """Архивировать идею."""
    try:
        idea = await idea_service.archive_idea(idea_id, current_user_id)
    except IdeaNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Idea not found",
        )
    except IdeaAccessDeniedError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )

    return _idea_to_response(idea)


# ============ AI Matching ============


@router.get("/{idea_id}/analysis", response_model=IdeaAnalysisResponse)
async def analyze_idea(
    idea_id: UUID,
    current_user_id: UUID = Depends(get_current_user_id),
    idea_service: IdeaService = Depends(get_idea_service),
    matching_service: AITeamMatchingService = Depends(get_ai_team_matching_service),
):
    """AI-анализ идеи: определение требуемых навыков и ролей."""
    try:
        idea = await idea_service.get_idea(idea_id)
    except IdeaNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Idea not found",
        )

    analysis = await matching_service.analyze_idea(idea)

    # Сохраняем AI-предложенные навыки
    await idea_service.set_ai_suggested_skills(idea_id, analysis.skills)

    return IdeaAnalysisResponse(
        skills=analysis.skills,
        roles=analysis.roles,
        priority_skills=analysis.priority_skills,
    )


@router.get("/{idea_id}/matches", response_model=list[MatchedExpertResponse])
async def get_matched_experts(
    idea_id: UUID,
    limit: int = Query(20, ge=1, le=50),
    current_user_id: UUID = Depends(get_current_user_id),
    idea_service: IdeaService = Depends(get_idea_service),
    matching_service: AITeamMatchingService = Depends(get_ai_team_matching_service),
):
    """Получить подходящих экспертов для реализации идеи."""
    try:
        idea = await idea_service.get_idea(idea_id)
    except IdeaNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Idea not found",
        )

    experts = await matching_service.find_matching_experts(
        idea=idea,
        limit=limit,
        exclude_user_id=idea.author_id,
    )

    return [
        MatchedExpertResponse(
            user_id=e.user_id,
            card_id=e.card_id,
            display_name=e.display_name,
            avatar_url=e.avatar_url,
            bio=e.bio,
            matching_skills=e.matching_skills,
            all_skills=e.all_skills,
            match_score=e.match_score,
        )
        for e in experts
    ]


@router.get("/{idea_id}/team-suggestion", response_model=TeamSuggestionResponse)
async def get_team_suggestion(
    idea_id: UUID,
    max_team_size: int = Query(5, ge=2, le=10),
    current_user_id: UUID = Depends(get_current_user_id),
    idea_service: IdeaService = Depends(get_idea_service),
    matching_service: AITeamMatchingService = Depends(get_ai_team_matching_service),
):
    """Получить предложение по оптимальному составу команды."""
    try:
        idea = await idea_service.get_idea(idea_id)
    except IdeaNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Idea not found",
        )

    suggestion = await matching_service.suggest_team(
        idea=idea,
        max_team_size=max_team_size,
    )

    return TeamSuggestionResponse(
        experts=[
            MatchedExpertResponse(
                user_id=e.user_id,
                card_id=e.card_id,
                display_name=e.display_name,
                avatar_url=e.avatar_url,
                bio=e.bio,
                matching_skills=e.matching_skills,
                all_skills=e.all_skills,
                match_score=e.match_score,
            )
            for e in suggestion.experts
        ],
        coverage=suggestion.coverage,
        missing_skills=suggestion.missing_skills,
        team_score=suggestion.team_score,
    )


# ============ Swipes ============


@router.post("/swipe", response_model=SwipeResponse)
async def swipe_idea(
    data: SwipeRequest,
    current_user_id: UUID = Depends(get_current_user_id),
    swipe_service: SwipeService = Depends(get_swipe_service),
    idea_service: IdeaService = Depends(get_idea_service),
    gamification_service: GamificationService = Depends(get_gamification_service),
):
    """Свайпнуть идею (like/dislike/super_like)."""
    try:
        direction = SwipeDirection(data.direction)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid direction",
        )

    try:
        result = await swipe_service.swipe(
            user_id=current_user_id,
            idea_id=data.idea_id,
            direction=direction,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    # Записываем время вовлечения
    if data.engagement_time_seconds:
        await idea_service._idea_repo.add_engagement_time(
            data.idea_id, data.engagement_time_seconds
        )

    # Записываем дизлайк если нужно
    if direction == SwipeDirection.DISLIKE:
        await idea_service._idea_repo.increment_dislikes(data.idea_id)

    # Начисляем очки за свайп
    points_result = await gamification_service.record_swipe(current_user_id)

    return SwipeResponse(
        swipe_id=result.swipe.id,
        idea_id=data.idea_id,
        direction=data.direction,
        is_match=result.is_match,
        match_user_ids=result.match_user_ids,
        points_earned=points_result.points_earned,
        new_badges=points_result.new_badges,
        current_streak=points_result.current_streak,
    )


@router.delete("/swipe/{idea_id}", status_code=status.HTTP_204_NO_CONTENT)
async def undo_swipe(
    idea_id: UUID,
    current_user_id: UUID = Depends(get_current_user_id),
    swipe_service: SwipeService = Depends(get_swipe_service),
):
    """Отменить свайп."""
    await swipe_service.undo_swipe(current_user_id, idea_id)


@router.get("/likes/received")
async def get_received_likes(
    limit: int = Query(50, ge=1, le=100),
    current_user_id: UUID = Depends(get_current_user_id),
    swipe_service: SwipeService = Depends(get_swipe_service),
    idea_service: IdeaService = Depends(get_idea_service),
):
    """Получить лайки на мои идеи."""
    likes = await swipe_service.get_likes_on_my_ideas(current_user_id, limit)

    result = []
    for user_id, idea_id in likes:
        try:
            idea = await idea_service.get_idea(idea_id)
            result.append(
                {
                    "user_id": str(user_id),
                    "idea_id": str(idea_id),
                    "idea_title": idea.title,
                }
            )
        except Exception:
            pass

    return result


# ============ PRD Generation ============


@router.post("/generate-prd", response_model=GeneratedPRDResponse)
async def generate_prd(
    data: GeneratePRDRequest,
    current_user_id: UUID = Depends(get_current_user_id),
    prd_service: AIPRDGeneratorService = Depends(get_ai_prd_generator_service),
):
    """
    Сгенерировать PRD из текста или голосовой транскрипции.
    Используется для AI-заполнения шаблона идеи.
    """
    prd = await prd_service.generate_prd(
        raw_input=data.raw_input,
        input_type=data.input_type,
        context=data.context,
    )

    return GeneratedPRDResponse(
        title=prd.title,
        problem_statement=prd.problem_statement,
        solution_description=prd.solution_description,
        target_users=prd.target_users,
        mvp_scope=prd.mvp_scope,
        success_metrics=prd.success_metrics,
        risks=prd.risks,
        timeline=prd.timeline,
        required_skills=prd.required_skills,
        roles=prd.roles,
        confidence=prd.confidence,
    )


@router.post(
    "/from-voice", response_model=IdeaResponse, status_code=status.HTTP_201_CREATED
)
async def create_idea_from_voice(
    data: CreateIdeaFromVoiceRequest,
    current_user_id: UUID = Depends(get_current_user_id),
    idea_service: IdeaService = Depends(get_idea_service),
    prd_service: AIPRDGeneratorService = Depends(get_ai_prd_generator_service),
    gamification_service: GamificationService = Depends(get_gamification_service),
):
    """
    Создать идею из голосового ввода с AI-генерацией PRD.
    Транскрипция преобразуется в структурированный PRD.
    """
    # Генерируем PRD из транскрипции
    prd = await prd_service.generate_prd(
        raw_input=data.transcript,
        input_type="voice_transcript",
    )

    try:
        visibility = IdeaVisibility(data.visibility)
    except ValueError:
        visibility = IdeaVisibility.PUBLIC

    # Создаём идею
    idea = await idea_service.create_idea(
        author_id=current_user_id,
        data=CreateIdeaData(
            title=prd.title,
            description=data.transcript,
            required_skills=prd.required_skills,
            visibility=visibility,
            company_id=data.company_id,
        ),
    )

    # Обновляем PRD поля
    idea.set_prd(
        problem_statement=prd.problem_statement,
        solution_description=prd.solution_description,
        target_users=prd.target_users,
        mvp_scope=prd.mvp_scope,
        success_metrics=prd.success_metrics,
        risks=prd.risks,
        timeline=prd.timeline,
        generated_by_ai=True,
    )
    idea.set_ai_suggested_skills(prd.required_skills, prd.confidence)
    idea.set_ai_suggested_roles(prd.roles)

    # Сохраняем
    await idea_service._idea_repo.update(idea)

    # Начисляем очки
    await gamification_service.record_idea_created(current_user_id)

    return _idea_to_response(idea)


# ============ Gamification ============


@router.get("/gamification/me", response_model=UserGamificationResponse)
async def get_my_gamification(
    current_user_id: UUID = Depends(get_current_user_id),
    gamification_service: GamificationService = Depends(get_gamification_service),
):
    """Получить свою статистику геймификации."""
    stats = await gamification_service.get_user_stats(current_user_id)

    return UserGamificationResponse(
        total_points=stats.total_points,
        weekly_points=stats.weekly_points,
        monthly_points=stats.monthly_points,
        level=stats.level,
        badges=stats.badges,
        current_voting_streak=stats.current_voting_streak,
        max_voting_streak=stats.max_voting_streak,
        reputation=stats.reputation,
        ideas_count=stats.ideas_count,
        swipes_count=stats.swipes_count,
        projects_count=stats.projects_count,
        completed_projects_count=stats.completed_projects_count,
    )


@router.get("/gamification/leaderboard", response_model=LeaderboardResponse)
async def get_users_leaderboard(
    period: str = Query("all", pattern="^(all|weekly|monthly)$"),
    company_id: UUID | None = Query(None),
    department_id: UUID | None = Query(None),
    limit: int = Query(10, ge=1, le=50),
    current_user_id: UUID = Depends(get_current_user_id),
    gamification_service: GamificationService = Depends(get_gamification_service),
):
    """Получить таблицу лидеров пользователей."""
    entries = await gamification_service.get_leaderboard(
        period=period,
        company_id=company_id,
        department_id=department_id,
        limit=limit,
    )

    # Находим свою позицию
    my_rank = None
    for entry in entries:
        if entry.user_id == current_user_id:
            my_rank = entry.rank
            break

    return LeaderboardResponse(
        entries=[
            LeaderboardEntryResponse(
                user_id=e.user_id,
                display_name=e.display_name,
                avatar_url=e.avatar_url,
                points=e.points,
                level=e.level,
                badges_count=e.badges_count,
                rank=e.rank,
            )
            for e in entries
        ],
        period=period,
        my_rank=my_rank,
    )


# ============ Comments ============


@router.get("/{idea_id}/comments", response_model=CommentListResponse)
async def get_idea_comments(
    idea_id: UUID,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user_id: UUID = Depends(get_current_user_id),
    idea_service: IdeaService = Depends(get_idea_service),
    comment_repo=Depends(get_idea_comment_repository),
    user_service=Depends(get_user_service),
):
    """Получить комментарии к идее."""
    # Проверяем доступ к идее
    idea = await idea_service.get_idea(idea_id)
    if not idea:
        raise HTTPException(status_code=404, detail="Idea not found")

    comments = await comment_repo.get_by_idea(idea_id, limit=limit, offset=offset)
    total = await comment_repo.count_by_idea(idea_id)

    result = []
    for comment in comments:
        try:
            author = await user_service.get_user(comment.author_id)
            author_name = f"{author.first_name} {author.last_name}"
            author_avatar = author.avatar_url
        except Exception:
            author_name = "Unknown User"
            author_avatar = None

        result.append(
            CommentResponse(
                id=comment.id,
                idea_id=comment.idea_id,
                author_id=comment.author_id,
                author_name=author_name,
                author_avatar=author_avatar,
                content=comment.content,
                is_question=comment.is_question,
                created_at=comment.created_at,
            )
        )

    return CommentListResponse(comments=result, total=total)


@router.post(
    "/{idea_id}/comments",
    response_model=CommentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_comment(
    idea_id: UUID,
    data: AddCommentRequest,
    current_user_id: UUID = Depends(get_current_user_id),
    idea_service: IdeaService = Depends(get_idea_service),
    comment_repo=Depends(get_idea_comment_repository),
    user_service=Depends(get_user_service),
    gamification_service: GamificationService = Depends(get_gamification_service),
):
    """Добавить комментарий к идее."""
    from domain.entities.idea_comment import IdeaComment

    # Проверяем доступ к идее
    idea = await idea_service.get_idea(idea_id)
    if not idea:
        raise HTTPException(status_code=404, detail="Idea not found")

    # Создаём комментарий
    comment = IdeaComment.create(
        idea_id=idea_id,
        author_id=current_user_id,
        content=data.content,
        is_question=data.is_question,
    )

    await comment_repo.create(comment)

    # Увеличиваем счётчик комментариев
    await idea_service._idea_repo.increment_comments(idea_id)

    # Начисляем очки за комментарий
    from domain.entities.gamification import PointsAction

    await gamification_service.award_points(current_user_id, PointsAction.CHAT_MESSAGE)

    # Получаем данные автора
    try:
        author = await user_service.get_user(current_user_id)
        author_name = f"{author.first_name} {author.last_name}"
        author_avatar = author.avatar_url
    except Exception:
        author_name = "Unknown User"
        author_avatar = None

    return CommentResponse(
        id=comment.id,
        idea_id=comment.idea_id,
        author_id=comment.author_id,
        author_name=author_name,
        author_avatar=author_avatar,
        content=comment.content,
        is_question=comment.is_question,
        created_at=comment.created_at,
    )
