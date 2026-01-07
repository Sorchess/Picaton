import { api } from '../shared/api';

// === Tag Generation Types ===
export interface TextTagGenerationRequest {
  text: string;
}

export interface TextTagGenerationResponse {
  suggestions: string[];
  source_text: string;
}

// === Tag Generation API ===
export const generateTagsFromText = async (
  cardId: string,
  ownerId: string,
  text: string
): Promise<TextTagGenerationResponse> => {
  const response = await api.post<TextTagGenerationResponse>(
    `/cards/${cardId}/generate-tags-from-text?owner_id=${encodeURIComponent(ownerId)}`,
    { text }
  );
  return response;
};