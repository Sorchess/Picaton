import { useState, useEffect, useMemo, useCallback } from "react";
import type { SavedContact } from "@/entities/user";
import { userApi } from "@/entities/user";
import { useAuth } from "@/features/auth";
import {
  ContactImportButton,
  type PhoneContact,
  type ImportStats,
  type HashedContact,
  type ContactSyncResult,
} from "@/features/contact-import";
import { Tag, Loader, Typography, Modal, Input, TagInput } from "@/shared";
import "./ContactsPage.scss";

export function ContactsPage() {
  const { user: authUser } = useAuth();
  const [contacts, setContacts] = useState<SavedContact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedContact, setSelectedContact] = useState<SavedContact | null>(
    null
  );
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newContact, setNewContact] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    email: "",
    messenger_type: "",
    messenger_value: "",
    notes: "",
  });
  const [newContactTags, setNewContactTags] = useState<string[]>([]);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [isLoadingAI, setIsLoadingAI] = useState(false);

  // Edit contact state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [editContact, setEditContact] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    email: "",
    messenger_type: "",
    messenger_value: "",
    notes: "",
  });
  const [editContactTags, setEditContactTags] = useState<string[]>([]);
  const [editAiSuggestions, setEditAiSuggestions] = useState<string[]>([]);
  const [isEditLoadingAI, setIsEditLoadingAI] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const MESSENGER_TYPES = [
    { value: "telegram", label: "Telegram", placeholder: "@username" },
    { value: "whatsapp", label: "WhatsApp", placeholder: "+7 999 123 45 67" },
    { value: "vk", label: "ВКонтакте", placeholder: "id или username" },
    { value: "messenger", label: "Messenger", placeholder: "username" },
  ];

  useEffect(() => {
    loadContacts();
  }, [authUser?.id]);

  const loadContacts = async () => {
    if (!authUser?.id) return;
    setIsLoading(true);
    try {
      const data = await userApi.getContacts(authUser.id);
      setContacts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    if (!confirm("Удалить контакт?")) return;
    try {
      await userApi.deleteContact(contactId);
      setContacts((prev) => prev.filter((c) => c.id !== contactId));
      setSelectedContact(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка удаления");
    }
  };

  const handleAddContact = async () => {
    if (!authUser?.id || !newContact.first_name.trim()) return;
    try {
      const contact = await userApi.addManualContact(authUser.id, {
        first_name: newContact.first_name,
        last_name: newContact.last_name,
        phone: newContact.phone || undefined,
        email: newContact.email || undefined,
        messenger_type: newContact.messenger_type || undefined,
        messenger_value: newContact.messenger_value || undefined,
        notes: newContact.notes || undefined,
        search_tags: newContactTags.length > 0 ? newContactTags : undefined,
      });
      setContacts((prev) => [contact, ...prev]);
      setNewContact({
        first_name: "",
        last_name: "",
        phone: "",
        email: "",
        messenger_type: "",
        messenger_value: "",
        notes: "",
      });
      setNewContactTags([]);
      setAiSuggestions([]);
      setIsAddModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка добавления");
    }
  };

  const handleGenerateAITags = async () => {
    if (!newContact.notes.trim() || newContact.notes.length < 3) return;
    setIsLoadingAI(true);
    try {
      const result = await userApi.generateTagsFromNotes(newContact.notes);
      setAiSuggestions(result.tags);
    } catch (err) {
      console.error("Ошибка генерации тегов:", err);
    } finally {
      setIsLoadingAI(false);
    }
  };

  const handleOpenEditModal = (contact: SavedContact) => {
    setEditingContactId(contact.id);
    setEditContact({
      first_name: contact.first_name || "",
      last_name: contact.last_name || "",
      phone: contact.phone || "",
      email: contact.email || "",
      messenger_type: contact.messenger_type || "",
      messenger_value: contact.messenger_value || "",
      notes: contact.notes || "",
    });
    setEditContactTags(contact.search_tags || []);
    setEditAiSuggestions([]);
    setIsEditModalOpen(true);
    setSelectedContact(null);
  };

  const handleUpdateContact = async () => {
    if (!editingContactId) return;

    setIsSaving(true);
    try {
      const updated = await userApi.updateContact(editingContactId, {
        first_name: editContact.first_name,
        last_name: editContact.last_name,
        phone: editContact.phone || undefined,
        email: editContact.email || undefined,
        messenger_type: editContact.messenger_type || undefined,
        messenger_value: editContact.messenger_value || undefined,
        notes: editContact.notes || undefined,
        search_tags: editContactTags.length > 0 ? editContactTags : undefined,
      });
      setContacts((prev) =>
        prev.map((c) => (c.id === editingContactId ? updated : c))
      );
      setIsEditModalOpen(false);
      setEditingContactId(null);
      setEditContact({
        first_name: "",
        last_name: "",
        phone: "",
        email: "",
        messenger_type: "",
        messenger_value: "",
        notes: "",
      });
      setEditContactTags([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка обновления");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditGenerateAITags = async () => {
    if (!editContact.notes.trim() || editContact.notes.length < 3) return;
    setIsEditLoadingAI(true);
    try {
      const result = await userApi.generateTagsFromNotes(editContact.notes);
      setEditAiSuggestions(result.tags);
    } catch (err) {
      console.error("Ошибка генерации тегов:", err);
    } finally {
      setIsEditLoadingAI(false);
    }
  };

  const handleImportContacts = async (
    phoneContacts: PhoneContact[]
  ): Promise<ImportStats> => {
    if (!authUser?.id) {
      return { total: 0, imported: 0, skipped: 0, errors: ["Не авторизован"] };
    }

    try {
      const result = await userApi.importContacts(
        authUser.id,
        phoneContacts.map((c) => ({
          name: c.name,
          phone: c.phone,
          email: c.email,
        }))
      );

      return {
        total: phoneContacts.length,
        imported: result.imported_count,
        skipped: result.skipped_count,
        errors: result.errors,
      };
    } catch (err) {
      return {
        total: phoneContacts.length,
        imported: 0,
        skipped: phoneContacts.length,
        errors: [err instanceof Error ? err.message : "Ошибка импорта"],
      };
    }
  };

  const handleSyncContacts = useCallback(
    async (hashedContacts: HashedContact[]): Promise<ContactSyncResult> => {
      if (!authUser?.id) {
        throw new Error("Не авторизован");
      }

      const result = await userApi.syncContacts(authUser.id, hashedContacts);
      return {
        found: result.found,
        found_count: result.found_count,
        pending_count: result.pending_count,
      };
    },
    [authUser?.id]
  );

  const getContactFullName = (contact: SavedContact) => {
    if (contact.first_name || contact.last_name) {
      return `${contact.first_name} ${contact.last_name}`.trim();
    }
    return contact.name;
  };

  const filteredContacts = useMemo(() => {
    // Step 1: Filter by search query
    let result = contacts;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = contacts.filter((contact) => {
        const fullName = getContactFullName(contact).toLowerCase();
        return (
          fullName.includes(q) ||
          contact.email?.toLowerCase().includes(q) ||
          contact.phone?.includes(q) ||
          contact.messenger_value?.toLowerCase().includes(q) ||
          contact.search_tags.some((tag) => tag.toLowerCase().includes(q))
        );
      });
    }

    // Step 2: Sort by matching tags (DESC), then by name (ASC)
    const userTags = authUser?.search_tags || [];
    if (userTags.length === 0) {
      return result.sort((a, b) =>
        getContactFullName(a).localeCompare(getContactFullName(b), "ru")
      );
    }

    const userTagsSet = new Set(userTags.map((t) => t.toLowerCase()));

    return result.sort((a, b) => {
      const scoreA = a.search_tags.filter((tag) =>
        userTagsSet.has(tag.toLowerCase())
      ).length;
      const scoreB = b.search_tags.filter((tag) =>
        userTagsSet.has(tag.toLowerCase())
      ).length;

      if (scoreB !== scoreA) {
        return scoreB - scoreA; // Higher score first
      }
      return getContactFullName(a).localeCompare(getContactFullName(b), "ru");
    });
  }, [contacts, searchQuery, authUser?.search_tags]);

  const getInitials = (contact: SavedContact) => {
    if (contact.first_name && contact.last_name) {
      return (contact.first_name[0] + contact.last_name[0]).toUpperCase();
    }
    const name = getContactFullName(contact);
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const getMessengerLabel = (type: string | null) => {
    if (!type) return "";
    const found = MESSENGER_TYPES.find((m) => m.value === type);
    return found?.label || type;
  };

  if (isLoading) {
    return (
      <div className="contacts-page contacts-page--loading">
        <Loader />
        <Typography variant="body" color="muted">
          Загрузка контактов...
        </Typography>
      </div>
    );
  }

  return (
    <div className="contacts-page">
      <div className="contacts-page__header">
        <div className="contacts-page__title-row">
          <h1 className="contacts-page__title">
            Мои <span className="contacts-page__title-accent">контакты</span>
          </h1>
          <div className="contacts-page__actions">
            <ContactImportButton
              onImport={handleImportContacts}
              onSync={handleSyncContacts}
              onImported={loadContacts}
            />
            <button
              className="contacts-page__add-btn"
              onClick={() => setIsAddModalOpen(true)}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
              Добавить
            </button>
          </div>
        </div>

        <div className="contacts-page__search">
          <svg
            className="contacts-page__search-icon"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            className="contacts-page__search-input"
            placeholder="Поиск по контактам..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="contacts-page__stats">
          <span className="contacts-page__count">
            {filteredContacts.length} из {contacts.length} контактов
          </span>
        </div>
      </div>

      {error && (
        <div className="contacts-page__error" onClick={() => setError(null)}>
          {error}
        </div>
      )}

      {filteredContacts.length === 0 ? (
        <div className="contacts-page__empty">
          <svg
            width="64"
            height="64"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <h3>
            {contacts.length === 0 ? "Нет контактов" : "Ничего не найдено"}
          </h3>
          <p>
            {contacts.length === 0
              ? "Добавляйте экспертов из поиска или создавайте контакты вручную"
              : "Попробуйте изменить поисковый запрос"}
          </p>
        </div>
      ) : (
        <div className="contacts-page__grid">
          {filteredContacts.map((contact) => (
            <div
              key={contact.id}
              className="contacts-page__card"
              onClick={() => setSelectedContact(contact)}
            >
              <div className="contacts-page__card-avatar">
                {getInitials(contact)}
              </div>
              <div className="contacts-page__card-info">
                <h3 className="contacts-page__card-name">
                  {getContactFullName(contact)}
                </h3>
                {contact.email && (
                  <p className="contacts-page__card-email">{contact.email}</p>
                )}
                {contact.phone && (
                  <p className="contacts-page__card-phone">{contact.phone}</p>
                )}
                {contact.messenger_type && contact.messenger_value && (
                  <p className="contacts-page__card-messenger">
                    {getMessengerLabel(contact.messenger_type)}:{" "}
                    {contact.messenger_value}
                  </p>
                )}
              </div>
              {contact.search_tags.length > 0 && (
                <div className="contacts-page__card-tags">
                  {contact.search_tags.slice(0, 3).map((tag) => (
                    <Tag key={tag} size="sm">
                      {tag}
                    </Tag>
                  ))}
                  {contact.search_tags.length > 3 && (
                    <Tag variant="outline" size="sm">
                      +{contact.search_tags.length - 3}
                    </Tag>
                  )}
                </div>
              )}
              <div className="contacts-page__card-source">
                {contact.source === "user" && (
                  <span className="contacts-page__source-badge contacts-page__source-badge--user">
                    Пользователь
                  </span>
                )}
                {contact.source === "manual" && (
                  <span className="contacts-page__source-badge contacts-page__source-badge--manual">
                    Вручную
                  </span>
                )}
                {contact.source === "import" && (
                  <span className="contacts-page__source-badge contacts-page__source-badge--import">
                    Импорт
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Contact Details Modal */}
      <Modal
        isOpen={!!selectedContact}
        onClose={() => setSelectedContact(null)}
        title="Детали контакта"
      >
        {selectedContact && (
          <div className="contacts-page__modal">
            <div className="contacts-page__modal-avatar">
              {getInitials(selectedContact)}
            </div>
            <h2 className="contacts-page__modal-name">
              {getContactFullName(selectedContact)}
            </h2>

            <div className="contacts-page__modal-info">
              {selectedContact.email && (
                <div className="contacts-page__modal-row">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <rect width="20" height="16" x="2" y="4" rx="2" />
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                  <a href={`mailto:${selectedContact.email}`}>
                    {selectedContact.email}
                  </a>
                </div>
              )}
              {selectedContact.phone && (
                <div className="contacts-page__modal-row">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                  <a href={`tel:${selectedContact.phone}`}>
                    {selectedContact.phone}
                  </a>
                </div>
              )}
              {selectedContact.messenger_type && selectedContact.messenger_value && (
                <div className="contacts-page__modal-row contacts-page__modal-row--messenger">
                  <span className="contacts-page__messenger-icon">
                    {selectedContact.messenger_type === "telegram" && "✈️"}
                    {selectedContact.messenger_type === "whatsapp" && "💬"}
                    {selectedContact.messenger_type === "vk" && "🔷"}
                    {selectedContact.messenger_type === "messenger" && "💭"}
                  </span>
                  <span>
                    {getMessengerLabel(selectedContact.messenger_type)}:{" "}
                    {selectedContact.messenger_value}
                  </span>
                </div>
              )}
            </div>

            {selectedContact.notes && (
              <div className="contacts-page__modal-notes">
                <h4>Заметки</h4>
                <p>{selectedContact.notes}</p>
              </div>
            )}

            {selectedContact.search_tags.length > 0 && (
              <div className="contacts-page__modal-tags">
                <h4>Теги</h4>
                <div className="contacts-page__tags-list">
                  {selectedContact.search_tags.map((tag) => (
                    <Tag key={tag}>{tag}</Tag>
                  ))}
                </div>
              </div>
            )}

            <div className="contacts-page__modal-actions">
              <button
                className="contacts-page__btn contacts-page__btn--secondary"
                onClick={() => handleOpenEditModal(selectedContact)}
              >
                Редактировать
              </button>
              <button
                className="contacts-page__btn contacts-page__btn--danger"
                onClick={() => handleDeleteContact(selectedContact.id)}
              >
                Удалить
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit Contact Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingContactId(null);
        }}
        title="Редактировать контакт"
      >
        <div className="contacts-page__add-form">
          <div className="contacts-page__add-form-row">
            <Input
              label="Имя *"
              value={editContact.first_name}
              onChange={(e) =>
                setEditContact((prev) => ({ ...prev, first_name: e.target.value }))
              }
              placeholder="Иван"
              required
            />
            <Input
              label="Фамилия"
              value={editContact.last_name}
              onChange={(e) =>
                setEditContact((prev) => ({ ...prev, last_name: e.target.value }))
              }
              placeholder="Иванов"
            />
          </div>
          <Input
            label="Email"
            type="email"
            value={editContact.email}
            onChange={(e) =>
              setEditContact((prev) => ({ ...prev, email: e.target.value }))
            }
            placeholder="ivan@example.com"
          />
          <Input
            label="Телефон"
            type="tel"
            value={editContact.phone}
            onChange={(e) =>
              setEditContact((prev) => ({ ...prev, phone: e.target.value }))
            }
            placeholder="+7 999 123 45 67"
          />
          <div className="contacts-page__add-form-messenger">
            <label>Мессенджер</label>
            <div className="contacts-page__messenger-row">
              <select
                value={editContact.messenger_type}
                onChange={(e) =>
                  setEditContact((prev) => ({ ...prev, messenger_type: e.target.value }))
                }
                className="contacts-page__messenger-select"
              >
                <option value="">Выберите...</option>
                {MESSENGER_TYPES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={editContact.messenger_value}
                onChange={(e) =>
                  setEditContact((prev) => ({ ...prev, messenger_value: e.target.value }))
                }
                placeholder={
                  MESSENGER_TYPES.find((m) => m.value === editContact.messenger_type)
                    ?.placeholder || "@username или номер"
                }
                className="contacts-page__messenger-input"
                disabled={!editContact.messenger_type}
              />
            </div>
          </div>
          <div className="contacts-page__add-form-notes">
            <label>Заметки</label>
            <textarea
              value={editContact.notes}
              onChange={(e) =>
                setEditContact((prev) => ({ ...prev, notes: e.target.value }))
              }
              placeholder="Дизайнер из Яндекса, познакомились на конференции..."
              rows={3}
            />
          </div>
          <TagInput
            label="Теги для поиска"
            value={editContactTags}
            onChange={setEditContactTags}
            placeholder="Добавьте тег..."
            suggestions={editAiSuggestions}
            onGenerateSuggestions={editContact.notes.length >= 3 ? handleEditGenerateAITags : undefined}
            isLoadingSuggestions={isEditLoadingAI}
            maxTags={10}
          />
          <div className="contacts-page__add-form-actions">
            <button
              className="contacts-page__btn contacts-page__btn--secondary"
              onClick={() => {
                setIsEditModalOpen(false);
                setEditingContactId(null);
              }}
            >
              Отмена
            </button>
            <button
              className="contacts-page__btn contacts-page__btn--primary"
              onClick={handleUpdateContact}
              disabled={!editContact.first_name.trim() || isSaving}
            >
              {isSaving ? "Сохранение..." : "Сохранить"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Add Contact Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Добавить контакт"
      >
        <div className="contacts-page__add-form">
          <div className="contacts-page__add-form-row">
            <Input
              label="Имя *"
              value={newContact.first_name}
              onChange={(e) =>
                setNewContact((prev) => ({ ...prev, first_name: e.target.value }))
              }
              placeholder="Иван"
              required
            />
            <Input
              label="Фамилия"
              value={newContact.last_name}
              onChange={(e) =>
                setNewContact((prev) => ({ ...prev, last_name: e.target.value }))
              }
              placeholder="Иванов"
            />
          </div>
          <Input
            label="Email"
            type="email"
            value={newContact.email}
            onChange={(e) =>
              setNewContact((prev) => ({ ...prev, email: e.target.value }))
            }
            placeholder="ivan@example.com"
          />
          <Input
            label="Телефон"
            type="tel"
            value={newContact.phone}
            onChange={(e) =>
              setNewContact((prev) => ({ ...prev, phone: e.target.value }))
            }
            placeholder="+7 999 123 45 67"
          />
          <div className="contacts-page__add-form-messenger">
            <label>Мессенджер</label>
            <div className="contacts-page__messenger-row">
              <select
                value={newContact.messenger_type}
                onChange={(e) =>
                  setNewContact((prev) => ({ ...prev, messenger_type: e.target.value }))
                }
                className="contacts-page__messenger-select"
              >
                <option value="">Выберите...</option>
                {MESSENGER_TYPES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={newContact.messenger_value}
                onChange={(e) =>
                  setNewContact((prev) => ({ ...prev, messenger_value: e.target.value }))
                }
                placeholder={
                  MESSENGER_TYPES.find((m) => m.value === newContact.messenger_type)
                    ?.placeholder || "@username или номер"
                }
                className="contacts-page__messenger-input"
                disabled={!newContact.messenger_type}
              />
            </div>
          </div>
          <div className="contacts-page__add-form-notes">
            <label>Заметки</label>
            <textarea
              value={newContact.notes}
              onChange={(e) =>
                setNewContact((prev) => ({ ...prev, notes: e.target.value }))
              }
              placeholder="Дизайнер из Яндекса, познакомились на конференции..."
              rows={3}
            />
          </div>
          <TagInput
            label="Теги для поиска"
            value={newContactTags}
            onChange={setNewContactTags}
            placeholder="Добавьте тег..."
            suggestions={aiSuggestions}
            onGenerateSuggestions={newContact.notes.length >= 3 ? handleGenerateAITags : undefined}
            isLoadingSuggestions={isLoadingAI}
            maxTags={10}
          />
          <div className="contacts-page__add-form-actions">
            <button
              className="contacts-page__btn contacts-page__btn--secondary"
              onClick={() => setIsAddModalOpen(false)}
            >
              Отмена
            </button>
            <button
              className="contacts-page__btn contacts-page__btn--primary"
              onClick={handleAddContact}
              disabled={!newContact.first_name.trim()}
            >
              Добавить
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
