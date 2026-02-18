import { api } from "@/shared/api";
import type {
  BusinessCard,
  BusinessCardPublic,
  BusinessCardCreate,
  BusinessCardUpdate,
  BusinessCardListResponse,
  CardContactAdd,
  DocumentTranscribeResponse,
  SpeechRecognitionResponse,
} from "./types";

export const businessCardApi = {
  // ============ CRUD ============

  // Создать новую карточку
  create: (ownerId: string, data: BusinessCardCreate) =>
    api.post<BusinessCard>(`/cards/?owner_id=${ownerId}`, data),

  // Получить все карточки пользователя
  getAll: (ownerId: string) =>
    api.get<BusinessCardListResponse>(`/cards/user/${ownerId}`),

  // Получить основную карточку пользователя
  getPrimary: (ownerId: string) =>
    api.get<BusinessCardPublic>(`/cards/user/${ownerId}/primary`),

  // Получить публичную информацию о карточке
  getPublic: (cardId: string) =>
    api.get<BusinessCardPublic>(`/cards/${cardId}`),

  // Получить полную информацию о карточке (для владельца)
  getFull: (cardId: string) => api.get<BusinessCard>(`/cards/${cardId}/full`),

  // Обновить карточку
  update: (cardId: string, ownerId: string, data: BusinessCardUpdate) =>
    api.patch<BusinessCard>(`/cards/${cardId}?owner_id=${ownerId}`, data),

  // Удалить карточку
  delete: (cardId: string, ownerId: string) =>
    api.delete(`/cards/${cardId}?owner_id=${ownerId}`),

  // Очистить содержимое карточки (bio, AI bio, теги, контакты)
  clearContent: (cardId: string, ownerId: string) =>
    api.post<BusinessCard>(`/cards/${cardId}/clear?owner_id=${ownerId}`),

  // Установить карточку как основную
  setPrimary: (cardId: string, ownerId: string) =>
    api.post<BusinessCard>(`/cards/${cardId}/set-primary?owner_id=${ownerId}`),

  // ============ Контакты ============

  // Добавить контакт в карточку
  addContact: (cardId: string, ownerId: string, data: CardContactAdd) =>
    api.post<BusinessCard>(
      `/cards/${cardId}/contacts?owner_id=${ownerId}`,
      data,
    ),

  // Обновить видимость контакта
  updateContactVisibility: (
    cardId: string,
    ownerId: string,
    contactType: string,
    value: string,
    isVisible: boolean,
  ) =>
    api.patch<BusinessCard>(
      `/cards/${cardId}/contacts?owner_id=${ownerId}&contact_type=${encodeURIComponent(
        contactType,
      )}&value=${encodeURIComponent(value)}`,
      { is_visible: isVisible },
    ),

  // Удалить контакт из карточки
  deleteContact: (
    cardId: string,
    ownerId: string,
    contactType: string,
    value: string,
  ) =>
    api.delete<BusinessCard>(
      `/cards/${cardId}/contacts?owner_id=${ownerId}&contact_type=${encodeURIComponent(
        contactType,
      )}&value=${encodeURIComponent(value)}`,
    ),

  // ============ Теги ============

  // Обновить теги для поиска
  updateSearchTags: (cardId: string, ownerId: string, tags: string[]) =>
    api.put<BusinessCard>(`/cards/${cardId}/search-tags?owner_id=${ownerId}`, {
      tags,
    }),

  // ============ Emojis ============

  // Обновить эмодзи профиля
  updateEmojis: (cardId: string, ownerId: string, emojis: string[]) =>
    api.put<BusinessCard>(`/cards/${cardId}/emojis?owner_id=${ownerId}`, {
      emojis,
    }),

  // ============ Random Facts ============

  // Добавить рандомный факт
  addFact: (cardId: string, ownerId: string, fact: string) =>
    api.post<BusinessCard>(`/cards/${cardId}/facts?owner_id=${ownerId}`, {
      fact,
    }),

  // ============ AI Bio ============

  // Сгенерировать AI-презентацию
  generateBio: (cardId: string, ownerId: string) =>
    api.post<{ bio: string; card_id: string }>(
      `/cards/${cardId}/generate-bio?owner_id=${ownerId}`,
    ),

  // Предложить теги из bio (для выбора пользователем)
  suggestTags: (cardId: string, ownerId: string) =>
    api.post<{
      suggestions: Array<{
        name: string;
        category: string;
        confidence: number;
        reason: string;
      }>;
      bio_used: string;
      card_id: string;
    }>(`/cards/${cardId}/suggest-tags?owner_id=${ownerId}`),

  // ============ QR Code ============

  // Получить QR-код для визитной карточки с опциональным сроком действия
  getQRCode: (cardId: string, duration?: string) =>
    api.get<{
      image_base64: string;
      card_id: string;
      token?: string;
      expires_at?: string;
    }>(`/cards/${cardId}/qr-code${duration ? `?duration=${duration}` : ""}`),

  // ============ Avatar Upload ============

  // Загрузить аватарку для визитки
  uploadAvatar: (cardId: string, ownerId: string, file: File) =>
    api.upload<{ avatar_url: string; card_id: string }>(
      `/cards/${cardId}/avatar?owner_id=${ownerId}`,
      file,
    ),

  // ============ Транскрибация документов ============

  // Извлечь текст из документа (PDF, DOCX, TXT, RTF)
  transcribeDocument: (file: File) =>
    api.upload<DocumentTranscribeResponse>("/cards/transcribe-document", file),

  // ============ Распознавание речи (Yandex SpeechKit) ============

  // Распознать речь из аудиофайла
  recognizeSpeech: (audioBlob: Blob) =>
    api.upload<SpeechRecognitionResponse>(
      "/cards/recognize-speech",
      new File([audioBlob], "audio.webm", {
        type: audioBlob.type || "audio/webm",
      }),
    ),
};
