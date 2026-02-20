import { api } from "@/shared/api";
import type {
  User,
  UserPublic,
  UserCreate,
  UserUpdate,
  QRCodeResponse,
  SearchResult,
  SavedContact,
  ImportResult,
  PrivacySettings,
} from "./types";

export const userApi = {
  // Создание пользователя
  create: (data: UserCreate) => api.post<User>("/users/", data),

  // Получить публичную информацию
  getPublic: (userId: string) => api.get<UserPublic>(`/users/${userId}`),

  // Получить полную информацию (для владельца)
  getFull: (userId: string) => api.get<User>(`/users/${userId}/full`),

  // Обновить профиль
  update: (userId: string, data: UserUpdate) =>
    api.patch<User>(`/users/${userId}`, data),

  // Удалить пользователя
  delete: (userId: string) => api.delete(`/users/${userId}`),

  // Добавить рандомный факт
  addFact: (userId: string, fact: string) =>
    api.post<User>(`/users/${userId}/facts`, { fact }),

  // Сгенерировать AI-био
  generateBio: (userId: string) =>
    api.post<{ bio: string }>(`/users/${userId}/generate-bio`),

  // Сгенерировать теги из bio
  generateTags: (userId: string) =>
    api.post<User>(`/users/${userId}/generate-tags`),

  // Предложить теги из bio (для выбора пользователем)
  suggestTags: (userId: string) =>
    api.post<{
      suggestions: Array<{
        name: string;
        category: string;
        confidence: number;
        reason: string;
      }>;
      bio_used: string;
    }>(`/users/${userId}/suggest-tags`),

  // Применить выбранные теги
  applyTags: (userId: string, selectedTags: string[], bio?: string) =>
    api.post<User>(`/users/${userId}/apply-tags`, {
      selected_tags: selectedTags,
      bio,
    }),

  // Обновить теги поиска
  updateSearchTags: (userId: string, tags: string[]) =>
    api.put<User>(`/users/${userId}/search-tags`, { tags }),

  // Получить QR-код
  getQRCode: (userId: string, type: "profile" | "vcard" = "profile") =>
    api.get<QRCodeResponse>(`/users/${userId}/qr-code?qr_type=${type}`),

  // Поиск экспертов
  search: (
    query: string,
    options?: {
      limit?: number;
      include_users?: boolean;
      include_contacts?: boolean;
      owner_id?: string;
      company_ids?: string[];
    },
  ) =>
    api.post<SearchResult>("/users/search", {
      query,
      limit: options?.limit ?? 20,
      include_users: options?.include_users ?? true,
      include_contacts: options?.include_contacts ?? true,
      company_ids: options?.company_ids ?? null,
    }),

  // Сохранить контакт пользователя (или конкретную карточку)
  saveContact: (
    userId: string,
    targetUserId: string,
    cardId?: string,
    searchTags?: string[],
    notes?: string,
  ) =>
    api.post<SavedContact>(`/users/${userId}/contacts`, {
      user_id: targetUserId,
      card_id: cardId || null,
      search_tags: searchTags ?? [],
      notes,
    }),

  // Добавить контакт вручную
  addManualContact: (
    userId: string,
    data: {
      first_name: string;
      last_name: string;
      phone?: string;
      email?: string;
      messenger_type?: string;
      messenger_value?: string;
      notes?: string;
      search_tags?: string[];
    },
  ) => api.post<SavedContact>(`/users/${userId}/contacts/manual`, data),

  // Получить контакты пользователя
  getContacts: (userId: string, skip = 0, limit = 100) =>
    api.get<SavedContact[]>(
      `/users/${userId}/contacts?skip=${skip}&limit=${limit}`,
    ),

  // Обновить контакт
  updateContact: (
    contactId: string,
    data: {
      first_name?: string;
      last_name?: string;
      phone?: string;
      email?: string;
      messenger_type?: string;
      messenger_value?: string;
      notes?: string;
      search_tags?: string[];
    },
  ) => api.patch<SavedContact>(`/users/contacts/${contactId}`, data),

  // Удалить контакт
  deleteContact: (contactId: string) =>
    api.delete(`/users/contacts/${contactId}`),

  // Импорт контактов
  importContacts: (
    userId: string,
    contacts: Array<{ name: string; phone?: string; email?: string }>,
  ) => api.post<ImportResult>(`/users/${userId}/contacts/import`, { contacts }),

  // Синхронизация контактов (Enterprise/Privacy-First)
  syncContacts: (
    userId: string,
    hashedContacts: Array<{ name: string; hash: string }>,
  ) =>
    api.post<{
      found: Array<{
        hash: string;
        original_name: string;
        user: { id: string; name: string; avatar_url?: string };
      }>;
      found_count: number;
      pending_count: number;
    }>(`/users/${userId}/contacts/sync`, {
      hashed_contacts: hashedContacts,
    }),

  // Генерация тегов из заметок (AI)
  generateTagsFromNotes: (notes: string) =>
    api.post<{ tags: string[] }>("/users/contacts/generate-tags", { notes }),

  // Загрузка аватарки
  uploadAvatar: (userId: string, file: File) =>
    api.upload<{ avatar_url: string }>(`/users/${userId}/avatar`, file),

  // ============ User Profile Contacts ============

  // Добавить контакт в профиль
  addProfileContact: (
    userId: string,
    data: {
      type: string;
      value: string;
      is_primary?: boolean;
      is_visible?: boolean;
    },
  ) => api.post<User>(`/users/${userId}/profile-contacts`, data),

  // Обновить видимость контакта
  updateProfileContactVisibility: (
    userId: string,
    contactType: string,
    value: string,
    isVisible: boolean,
  ) =>
    api.patch<User>(
      `/users/${userId}/profile-contacts?contact_type=${encodeURIComponent(
        contactType,
      )}&value=${encodeURIComponent(value)}`,
      { is_visible: isVisible },
    ),

  // Удалить контакт из профиля
  deleteProfileContact: (userId: string, contactType: string, value: string) =>
    api.delete<User>(
      `/users/${userId}/profile-contacts?contact_type=${encodeURIComponent(
        contactType,
      )}&value=${encodeURIComponent(value)}`,
    ),

  // Синхронизировать контакты профиля с визитной карточкой
  syncProfileToCard: (userId: string) =>
    api.post<{ synced_count: number; total_contacts: number }>(
      `/users/${userId}/sync-contacts`,
    ),

  // Изменить видимость профиля (публичный/приватный)
  updateVisibility: (userId: string, isPublic: boolean) =>
    api.patch<User>(`/users/${userId}/visibility`, { is_public: isPublic }),

  // Отправить код подтверждения на email
  sendEmailVerificationCode: (userId: string, email: string) =>
    api.post<{ message: string }>(`/users/${userId}/email/send-code`, {
      email,
    }),

  // Подтвердить email кодом
  verifyEmailCode: (userId: string, code: string) =>
    api.post<{ message: string; email: string }>(
      `/users/${userId}/email/verify`,
      { code },
    ),

  // Настройки приватности
  getPrivacySettings: (userId: string) =>
    api.get<PrivacySettings>(`/users/${userId}/privacy`),

  updatePrivacySettings: (userId: string, data: Partial<PrivacySettings>) =>
    api.patch<PrivacySettings>(`/users/${userId}/privacy`, data),
};
