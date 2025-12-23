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
    }
  ) =>
    api.post<SearchResult>("/users/search", {
      query,
      limit: options?.limit ?? 20,
      include_users: options?.include_users ?? true,
      include_contacts: options?.include_contacts ?? true,
    }),

  // Сохранить контакт пользователя
  saveContact: (
    userId: string,
    targetUserId: string,
    searchTags?: string[],
    notes?: string
  ) =>
    api.post<SavedContact>(`/users/${userId}/contacts`, {
      user_id: targetUserId,
      search_tags: searchTags ?? [],
      notes,
    }),

  // Добавить контакт вручную
  addManualContact: (
    userId: string,
    data: {
      name: string;
      phone?: string;
      email?: string;
      notes?: string;
      search_tags?: string[];
    }
  ) => api.post<SavedContact>(`/users/${userId}/contacts/manual`, data),

  // Получить контакты пользователя
  getContacts: (userId: string, skip = 0, limit = 100) =>
    api.get<SavedContact[]>(
      `/users/${userId}/contacts?skip=${skip}&limit=${limit}`
    ),

  // Обновить контакт
  updateContact: (
    contactId: string,
    data: { search_tags?: string[]; notes?: string }
  ) => api.patch<SavedContact>(`/users/contacts/${contactId}`, data),

  // Удалить контакт
  deleteContact: (contactId: string) =>
    api.delete(`/users/contacts/${contactId}`),

  // Импорт контактов
  importContacts: (
    userId: string,
    contacts: Array<{ name: string; phone?: string; email?: string }>
  ) => api.post<ImportResult>(`/users/${userId}/contacts/import`, { contacts }),

  // Импорт vCard
  importVCard: (userId: string, vcardData: string) =>
    api.post<ImportResult>(`/users/${userId}/contacts/import-vcard`, {
      vcard_data: vcardData,
    }),
};
