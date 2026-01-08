import { api } from "../shared/api";

// === Endorsement Types ===

export interface EndorserInfo {
  id: string;
  name: string;
  avatar_url: string | null;
}

export interface SkillWithEndorsements {
  tag_id: string;
  tag_name: string;
  tag_category: string;
  proficiency: number;
  endorsement_count: number;
  endorsed_by_current_user: boolean;
  endorsers: EndorserInfo[];
}

export interface CardSkillsWithEndorsements {
  card_id: string;
  skills: SkillWithEndorsements[];
}

export interface ToggleEndorsementResponse {
  is_endorsed: boolean;
  endorsement_count: number;
  endorsement: {
    id: string;
    endorser_id: string;
    card_id: string;
    tag_id: string;
    tag_name: string;
    created_at: string;
  } | null;
}

export interface SkillEndorsementCreate {
  card_id: string;
  tag_id: string;
}

// === Endorsement API ===

export const endorsementApi = {
  /**
   * Получить навыки карточки с информацией о подтверждениях
   */
  getCardSkills: async (
    cardId: string,
    currentUserId?: string
  ): Promise<CardSkillsWithEndorsements> => {
    const params = new URLSearchParams();
    if (currentUserId) {
      params.append("current_user_id", currentUserId);
    }
    const query = params.toString() ? `?${params.toString()}` : "";
    return api.get<CardSkillsWithEndorsements>(
      `/endorsements/card/${cardId}${query}`
    );
  },

  /**
   * Переключить состояние лайка (поставить/убрать)
   */
  toggle: async (
    endorserId: string,
    cardId: string,
    tagId: string
  ): Promise<ToggleEndorsementResponse> => {
    return api.post<ToggleEndorsementResponse>(
      `/endorsements/toggle?endorser_id=${encodeURIComponent(endorserId)}`,
      {
        card_id: cardId,
        tag_id: tagId,
      }
    );
  },

  /**
   * Поставить лайк на навык
   */
  endorse: async (
    endorserId: string,
    cardId: string,
    tagId: string
  ): Promise<void> => {
    await api.post(
      `/endorsements/?endorser_id=${encodeURIComponent(endorserId)}`,
      {
        card_id: cardId,
        tag_id: tagId,
      }
    );
  },

  /**
   * Убрать лайк с навыка
   */
  remove: async (
    endorserId: string,
    cardId: string,
    tagId: string
  ): Promise<void> => {
    const params = new URLSearchParams({
      endorser_id: endorserId,
      card_id: cardId,
      tag_id: tagId,
    });
    await api.delete(`/endorsements/?${params.toString()}`);
  },
};
