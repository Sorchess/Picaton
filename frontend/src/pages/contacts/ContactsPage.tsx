import { useState, useEffect, useMemo, useCallback } from "react";
import type { SavedContact, UserPublic } from "@/entities/user";
import { userApi } from "@/entities/user";
import { businessCardApi } from "@/entities/business-card";
import {
  companyApi,
  type CompanyMember,
  type CompanyWithRole,
} from "@/entities/company";
import { useAuth } from "@/features/auth";
import { ContactImportButton } from "@/features/contact-import";
import {
  Tag,
  Loader,
  Typography,
  Modal,
  Input,
  Avatar,
  IconButton,
  Tabs,
  type Tab,
} from "@/shared";
import "./ContactsPage.scss";

type TabType = "my" | "company" | "recommendations";

interface ContactCardData {
  id: string;
  name: string;
  position?: string | null;
  company?: string | null;
  avatarUrl?: string | null;
  tags: string[];
  type: "saved" | "company" | "recommendation";
  originalData: SavedContact | CompanyMember | UserPublic;
}

interface ContactsPageProps {
  onOpenContact?: (
    user: UserPublic,
    cardId?: string,
    savedContact?: SavedContact | null,
  ) => void;
}

export function ContactsPage({ onOpenContact }: ContactsPageProps) {
  const { user: authUser } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>("my");
  const [contacts, setContacts] = useState<SavedContact[]>([]);
  const [companyMembers, setCompanyMembers] = useState<CompanyMember[]>([]);
  const [recommendations, setRecommendations] = useState<UserPublic[]>([]);
  const [myCompanies, setMyCompanies] = useState<CompanyWithRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedContact, setSelectedContact] = useState<SavedContact | null>(
    null,
  );
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newContact, setNewContact] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    email: "",
    notes: "",
  });
  const [newContactTags, setNewContactTags] = useState<string[]>([]);

  // Edit contact state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [editContact, setEditContact] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    email: "",
    notes: "",
  });
  const [editContactTags, setEditContactTags] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const loadContacts = useCallback(async () => {
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
  }, [authUser?.id]);

  const loadCompanyMembers = useCallback(async () => {
    try {
      const companies = await companyApi.getMyCompanies();
      setMyCompanies(companies);

      // Загружаем членов из всех компаний пользователя
      const allMembers: CompanyMember[] = [];
      const seenUserIds = new Set<string>();

      for (const company of companies) {
        try {
          const members = await companyApi.getMembers(company.company.id);
          // Исключаем текущего пользователя и дубликаты
          for (const member of members) {
            if (
              member.user.id !== authUser?.id &&
              !seenUserIds.has(member.user.id)
            ) {
              seenUserIds.add(member.user.id);
              allMembers.push(member);
            }
          }
        } catch {
          // Игнорируем ошибки для отдельных компаний
        }
      }
      setCompanyMembers(allMembers);
    } catch {
      // Нет компаний или ошибка
      setCompanyMembers([]);
    }
  }, [authUser?.id]);

  const loadRecommendations = useCallback(async () => {
    if (!authUser?.id || !authUser?.search_tags?.length) {
      setRecommendations([]);
      return;
    }

    try {
      // Ищем пользователей по тегам текущего пользователя
      const query = authUser.search_tags.slice(0, 3).join(" ");
      const result = await userApi.search(query, {
        limit: 20,
        include_users: true,
        include_contacts: false,
      });

      // Исключаем себя и тех, кто уже в контактах
      const savedUserIds = new Set(
        contacts.map((c) => c.saved_user_id).filter(Boolean),
      );
      const filteredUsers = result.cards
        .filter(
          (card) =>
            card.owner_id !== authUser.id && !savedUserIds.has(card.owner_id),
        )
        .slice(0, 10)
        .map(
          (card) =>
            ({
              id: card.owner_id,
              first_name: card.owner_first_name,
              last_name: card.owner_last_name,
              avatar_url: card.avatar_url,
              bio: card.bio,
              ai_generated_bio: card.ai_generated_bio,
              location: null,
              position: null,
              tags: [],
              search_tags: card.search_tags,
              contacts: card.contacts.map((c) => ({
                type: c.type,
                value: c.value,
                is_primary: c.is_primary,
                is_visible: true,
              })),
              profile_completeness: card.completeness,
            }) as UserPublic,
        );

      setRecommendations(filteredUsers);
    } catch {
      setRecommendations([]);
    }
  }, [authUser?.id, authUser?.search_tags, contacts]);

  useEffect(() => {
    loadContacts();
    loadCompanyMembers();
  }, [loadContacts, loadCompanyMembers]);

  useEffect(() => {
    if (activeTab === "recommendations") {
      loadRecommendations();
    }
  }, [activeTab, loadRecommendations]);

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
        notes: newContact.notes || undefined,
        search_tags: newContactTags.length > 0 ? newContactTags : undefined,
      });
      setContacts((prev) => [contact, ...prev]);
      setNewContact({
        first_name: "",
        last_name: "",
        phone: "",
        email: "",
        notes: "",
      });
      setNewContactTags([]);
      setIsAddModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка добавления");
    }
  };

  // Save recommendation as contact
  const handleSaveRecommendation = async (user: UserPublic) => {
    if (!authUser?.id) return;
    try {
      await userApi.saveContact(
        authUser.id,
        user.id,
        undefined,
        user.search_tags,
      );
      await loadContacts();
      setRecommendations((prev) => prev.filter((r) => r.id !== user.id));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Ошибка сохранения контакта",
      );
    }
  };

  // Open user profile for registered users
  const handleOpenUserProfile = async (contact: SavedContact) => {
    if (!contact.saved_user_id) {
      setSelectedContact(contact);
      return;
    }

    try {
      let userData: UserPublic;

      if (contact.saved_card_id) {
        const cardData = await businessCardApi.getPublic(contact.saved_card_id);
        const firstName = cardData.display_name
          ? cardData.display_name.split(" ")[0]
          : contact.first_name;
        const lastName = cardData.display_name
          ? cardData.display_name.split(" ").slice(1).join(" ")
          : contact.last_name;

        userData = {
          id: cardData.owner_id,
          first_name: firstName,
          last_name: lastName,
          avatar_url: cardData.avatar_url,
          bio: cardData.bio,
          ai_generated_bio: cardData.ai_generated_bio,
          location: null,
          tags: cardData.tags,
          search_tags: cardData.search_tags,
          contacts: cardData.contacts.map((c) => ({
            type: c.type,
            value: c.value,
            is_primary: c.is_primary,
            is_visible: c.is_visible,
          })),
          profile_completeness: cardData.completeness,
        };
      } else {
        const userDataFromApi = await userApi.getPublic(contact.saved_user_id);
        let contactsToUse = userDataFromApi.contacts || [];
        let tagsToUse = userDataFromApi.tags || [];
        let searchTagsToUse = userDataFromApi.search_tags || [];

        if (contact.contacts && contact.contacts.length > 0) {
          contactsToUse = contact.contacts;
        }

        if (contact.search_tags && contact.search_tags.length > 0) {
          searchTagsToUse = contact.search_tags;
        }

        if (contactsToUse.length === 0) {
          try {
            const primaryCard = await businessCardApi.getPrimary(
              contact.saved_user_id,
            );
            if (primaryCard) {
              contactsToUse = primaryCard.contacts.map((c) => ({
                type: c.type,
                value: c.value,
                is_primary: c.is_primary,
                is_visible: c.is_visible,
              }));
              if (primaryCard.tags && primaryCard.tags.length > 0) {
                tagsToUse = primaryCard.tags;
              }
              if (
                primaryCard.search_tags &&
                primaryCard.search_tags.length > 0
              ) {
                searchTagsToUse = primaryCard.search_tags;
              }
            }
          } catch {
            // Ignore
          }
        }

        userData = {
          ...userDataFromApi,
          contacts: contactsToUse,
          tags: tagsToUse,
          search_tags: searchTagsToUse,
        };
      }

      // Используем навигацию вместо модального окна
      if (onOpenContact) {
        onOpenContact(userData, contact.saved_card_id ?? undefined, contact);
      }
    } catch {
      setSelectedContact(contact);
    }
  };

  const handleOpenCompanyMemberProfile = async (member: CompanyMember) => {
    try {
      const userData = await userApi.getPublic(member.user.id);
      // Используем навигацию вместо модального окна
      if (onOpenContact) {
        onOpenContact(userData, undefined, null);
      }
    } catch {
      setError("Не удалось загрузить профиль");
    }
  };

  const handleOpenRecommendationProfile = (user: UserPublic) => {
    // Используем навигацию вместо модального окна
    if (onOpenContact) {
      onOpenContact(user, undefined, null);
    }
  };

  const handleOpenEditModal = (contact: SavedContact) => {
    setEditingContactId(contact.id);
    setEditContact({
      first_name: contact.first_name || "",
      last_name: contact.last_name || "",
      phone: contact.phone || "",
      email: contact.email || "",
      notes: contact.notes || "",
    });
    setEditContactTags(contact.search_tags || []);
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
        notes: editContact.notes || undefined,
        search_tags: editContactTags.length > 0 ? editContactTags : undefined,
      });
      setContacts((prev) =>
        prev.map((c) => (c.id === editingContactId ? updated : c)),
      );
      setIsEditModalOpen(false);
      setEditingContactId(null);
      setEditContact({
        first_name: "",
        last_name: "",
        phone: "",
        email: "",
        notes: "",
      });
      setEditContactTags([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка обновления");
    } finally {
      setIsSaving(false);
    }
  };

  const getContactFullName = (contact: SavedContact) => {
    if (contact.first_name || contact.last_name) {
      return `${contact.first_name} ${contact.last_name}`.trim();
    }
    return contact.name;
  };

  const getInitials = (name: string) => {
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  // Контакты без себя
  const contactsWithoutSelf = useMemo(
    () => contacts.filter((c) => c.saved_user_id !== authUser?.id),
    [contacts, authUser?.id],
  );

  // Transform data to unified card format
  const transformedContacts: ContactCardData[] = useMemo(() => {
    if (activeTab === "my") {
      let result = contactsWithoutSelf;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        result = result.filter((contact) => {
          const fullName = getContactFullName(contact).toLowerCase();
          return (
            fullName.includes(q) ||
            contact.email?.toLowerCase().includes(q) ||
            contact.phone?.includes(q) ||
            contact.search_tags.some((tag) => tag.toLowerCase().includes(q))
          );
        });
      }

      // Sort by matching tags
      const userTags = authUser?.search_tags || [];
      if (userTags.length > 0) {
        const userTagsSet = new Set(userTags.map((t) => t.toLowerCase()));
        result = [...result].sort((a, b) => {
          const scoreA = a.search_tags.filter((tag) =>
            userTagsSet.has(tag.toLowerCase()),
          ).length;
          const scoreB = b.search_tags.filter((tag) =>
            userTagsSet.has(tag.toLowerCase()),
          ).length;
          if (scoreB !== scoreA) return scoreB - scoreA;
          return getContactFullName(a).localeCompare(
            getContactFullName(b),
            "ru",
          );
        });
      }

      return result.map((c) => ({
        id: c.id,
        name: getContactFullName(c),
        position: null,
        company: null,
        avatarUrl: null,
        tags: c.search_tags,
        type: "saved" as const,
        originalData: c,
      }));
    }

    if (activeTab === "company") {
      let result = companyMembers;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        result = result.filter((member) => {
          const fullName =
            `${member.user.first_name} ${member.user.last_name}`.toLowerCase();
          return (
            fullName.includes(q) || member.user.email?.toLowerCase().includes(q)
          );
        });
      }

      return result.map((m) => {
        // Find the company this member belongs to
        const memberCompany = myCompanies.length > 0 ? myCompanies[0] : null;
        return {
          id: m.id,
          name: `${m.user.first_name} ${m.user.last_name}`,
          position: m.role?.name || null,
          company: memberCompany?.company.name || null,
          avatarUrl: m.user.avatar_url,
          tags: [],
          type: "company" as const,
          originalData: m,
        };
      });
    }

    if (activeTab === "recommendations") {
      return recommendations.map((u) => ({
        id: u.id,
        name: `${u.first_name} ${u.last_name}`,
        position: u.position || null,
        company: null,
        avatarUrl: u.avatar_url,
        tags: u.search_tags,
        type: "recommendation" as const,
        originalData: u,
      }));
    }

    return [];
  }, [
    activeTab,
    contactsWithoutSelf,
    companyMembers,
    recommendations,
    searchQuery,
    authUser?.search_tags,
    myCompanies,
  ]);

  const handleCardClick = (card: ContactCardData) => {
    if (card.type === "saved") {
      handleOpenUserProfile(card.originalData as SavedContact);
    } else if (card.type === "company") {
      handleOpenCompanyMemberProfile(card.originalData as CompanyMember);
    } else if (card.type === "recommendation") {
      handleOpenRecommendationProfile(card.originalData as UserPublic);
    }
  };

  const tabs: Tab[] = [
    { id: "my", label: "Мои контакты" },
    { id: "company", label: "Компания" },
    { id: "recommendations", label: "Рекомендации" },
  ];

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
      {/* Header */}
      <header className="contacts-page__header">
        <IconButton onClick={() => {}} aria-label="Редактировать">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path
              d="M3.60742 16.1367L1.24414 17.0449C1.10091 17.097 0.970703 17.0645 0.853516 16.9473C0.742839 16.8301 0.713542 16.6966 0.765625 16.5469L1.72266 14.252L12.709 3.27539L14.584 5.16016L3.60742 16.1367ZM15.5215 4.24219L13.627 2.35742L14.6816 1.3125C14.9421 1.05859 15.2122 0.921875 15.4922 0.902344C15.7721 0.882812 16.0326 0.990234 16.2734 1.22461L16.6543 1.61523C16.8952 1.85612 17.0091 2.11328 16.9961 2.38672C16.9831 2.66016 16.8431 2.93034 16.5762 3.19727L15.5215 4.24219Z"
              fill="currentColor"
            />
          </svg>
        </IconButton>
        <div className="contacts-page__title-container">
          <h1 className="contacts-page__title">Контакты</h1>
        </div>
        <IconButton
          onClick={() => setIsAddModalOpen(true)}
          aria-label="Добавить контакт"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path
              d="M9.768 16.0391C9.768 16.332 9.66 16.5859 9.445 16.8008C9.23 17.0156 8.97 17.123 8.664 17.123C8.365 17.123 8.107 17.0156 7.893 16.8008C7.678 16.5859 7.57 16.332 7.57 16.0391V1.86914C7.57 1.56966 7.678 1.3125 7.893 1.09766C8.107 0.882812 8.365 0.775391 8.664 0.775391C8.97 0.775391 9.23 0.882812 9.445 1.09766C9.66 1.3125 9.768 1.56966 9.768 1.86914V16.0391ZM1.584 10.043C1.285 10.043 1.027 9.93883 0.812 9.73047C0.598 9.51562 0.49 9.25521 0.49 8.94922C0.49 8.64974 0.598 8.39258 0.812 8.17773C1.027 7.95638 1.285 7.8457 1.584 7.8457H15.744C16.044 7.8457 16.301 7.95638 16.516 8.17773C16.73 8.39258 16.838 8.64974 16.838 8.94922C16.838 9.25521 16.73 9.51562 16.516 9.73047C16.301 9.93883 16.044 10.043 15.744 10.043H1.584Z"
              fill="currentColor"
            />
          </svg>
        </IconButton>
      </header>

      {/* Tabs */}
      <Tabs
        tabs={tabs}
        activeId={activeTab}
        onChange={(id) => {
          setActiveTab(id as TabType);
          setSearchQuery("");
        }}
        className="contacts-page__tabs"
      />

      {error && (
        <div className="contacts-page__error" onClick={() => setError(null)}>
          {error}
        </div>
      )}

      {/* Contact List */}
      <div className="contacts-page__list">
        {transformedContacts.length === 0 ? (
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
              {activeTab === "my" &&
                contactsWithoutSelf.length === 0 &&
                "Нет контактов"}
              {activeTab === "my" &&
                contactsWithoutSelf.length > 0 &&
                "Ничего не найдено"}
              {activeTab === "company" && "Нет коллег"}
              {activeTab === "recommendations" && "Нет рекомендаций"}
            </h3>
            <p>
              {activeTab === "my" &&
                contactsWithoutSelf.length === 0 &&
                "Добавляйте экспертов из поиска или создавайте контакты вручную"}
              {activeTab === "my" &&
                contactsWithoutSelf.length > 0 &&
                "Попробуйте изменить поисковый запрос"}
              {activeTab === "company" &&
                "Присоединитесь к компании, чтобы видеть коллег"}
              {activeTab === "recommendations" &&
                "Заполните теги в профиле для получения рекомендаций"}
            </p>
          </div>
        ) : (
          transformedContacts.map((card) => (
            <div
              key={card.id}
              className="contacts-page__card"
              onClick={() => handleCardClick(card)}
            >
              <div className="contacts-page__card-avatar">
                {card.avatarUrl ? (
                  <Avatar src={card.avatarUrl} alt={card.name} size="lg" />
                ) : (
                  <Avatar initials={getInitials(card.name)} size="lg" />
                )}
              </div>
              <div className="contacts-page__card-info">
                <h3 className="contacts-page__card-name">{card.name}</h3>
                {(card.position || card.company) && (
                  <p className="contacts-page__card-position">
                    {card.position}
                    {card.position && card.company && <br />}
                    {card.company}
                  </p>
                )}
                {card.tags.length > 0 && (
                  <div className="contacts-page__card-tags">
                    {card.tags.slice(0, 4).map((tag) => (
                      <Tag key={tag} size="sm">
                        {tag}
                      </Tag>
                    ))}
                    {card.tags.length > 4 && (
                      <Tag variant="outline" size="sm">
                        +{card.tags.length - 4}
                      </Tag>
                    )}
                  </div>
                )}
              </div>
              {card.type === "recommendation" && (
                <button
                  className="contacts-page__card-action"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSaveRecommendation(card.originalData as UserPublic);
                  }}
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
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Import button for "my" tab */}
      {activeTab === "my" && (
        <div className="contacts-page__import">
          <ContactImportButton onSyncComplete={() => loadContacts()} />
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
              <Avatar
                initials={getInitials(getContactFullName(selectedContact))}
                size="xl"
              />
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
                setEditContact((prev) => ({
                  ...prev,
                  first_name: e.target.value,
                }))
              }
              placeholder="Иван"
              required
            />
            <Input
              label="Фамилия"
              value={editContact.last_name}
              onChange={(e) =>
                setEditContact((prev) => ({
                  ...prev,
                  last_name: e.target.value,
                }))
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
                setNewContact((prev) => ({
                  ...prev,
                  first_name: e.target.value,
                }))
              }
              placeholder="Иван"
              required
            />
            <Input
              label="Фамилия"
              value={newContact.last_name}
              onChange={(e) =>
                setNewContact((prev) => ({
                  ...prev,
                  last_name: e.target.value,
                }))
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
