import { useState, useEffect } from "react";
import type { SavedContact } from "@/entities/user";
import { userApi } from "@/entities/user";
import { useAuth } from "@/features/auth";
import { Tag, Loader, Typography, Modal, Input } from "@/shared";
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
    name: "",
    phone: "",
    email: "",
    notes: "",
  });

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
    if (!authUser?.id || !newContact.name.trim()) return;
    try {
      const contact = await userApi.addManualContact(authUser.id, {
        name: newContact.name,
        phone: newContact.phone || undefined,
        email: newContact.email || undefined,
        notes: newContact.notes || undefined,
      });
      setContacts((prev) => [contact, ...prev]);
      setNewContact({ name: "", phone: "", email: "", notes: "" });
      setIsAddModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка добавления");
    }
  };

  const filteredContacts = contacts.filter((contact) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      contact.name.toLowerCase().includes(q) ||
      contact.email?.toLowerCase().includes(q) ||
      contact.phone?.includes(q) ||
      contact.search_tags.some((tag) => tag.toLowerCase().includes(q))
    );
  });

  const getInitials = (name: string) => {
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
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
                {getInitials(contact.name)}
              </div>
              <div className="contacts-page__card-info">
                <h3 className="contacts-page__card-name">{contact.name}</h3>
                {contact.email && (
                  <p className="contacts-page__card-email">{contact.email}</p>
                )}
                {contact.phone && (
                  <p className="contacts-page__card-phone">{contact.phone}</p>
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
              {getInitials(selectedContact.name)}
            </div>
            <h2 className="contacts-page__modal-name">
              {selectedContact.name}
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
                className="contacts-page__btn contacts-page__btn--danger"
                onClick={() => handleDeleteContact(selectedContact.id)}
              >
                Удалить
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Add Contact Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Добавить контакт"
      >
        <div className="contacts-page__add-form">
          <Input
            label="Имя"
            value={newContact.name}
            onChange={(e) =>
              setNewContact((prev) => ({ ...prev, name: e.target.value }))
            }
            placeholder="Иван Иванов"
            required
          />
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
          <div className="contacts-page__add-form-notes">
            <label>Заметки</label>
            <textarea
              value={newContact.notes}
              onChange={(e) =>
                setNewContact((prev) => ({ ...prev, notes: e.target.value }))
              }
              placeholder="Дополнительная информация..."
              rows={3}
            />
          </div>
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
              disabled={!newContact.name.trim()}
            >
              Добавить
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
