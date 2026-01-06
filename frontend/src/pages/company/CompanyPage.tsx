import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/features/auth";
import {
  type CompanyWithRole,
  type CompanyMember,
  type CompanyInvitation,
  type InvitationWithCompany,
  type CompanyRole,
  type CompanyCardAssignment,
  companyApi,
  roleLabels,
  canManageMembers,
} from "@/entities/company";
import type {
  BusinessCard,
  BusinessCardPublic,
} from "@/entities/business-card";
import { businessCardApi } from "@/entities/business-card";
import type { UserPublic } from "@/entities/user";
import { userApi } from "@/entities/user";
import { SpecialistModal } from "@/features/specialist-modal";
import { Button, Modal, Input, Loader, Typography } from "@/shared";
import { CompanyList, CompanyDetail } from "./components";
import "./CompanyPage.scss";

// Парсинг ошибок API
function parseApiError(err: unknown): string {
  const error = err as {
    data?: { detail?: string | Array<{ msg?: string; loc?: string[] }> };
    message?: string;
  };

  if (Array.isArray(error.data?.detail)) {
    const messages = error.data.detail.map((item) => {
      const field = item.loc?.slice(-1)[0] || "Поле";
      const fieldLabels: Record<string, string> = {
        name: "Название",
        email_domain: "Домен email",
        email: "Email",
        description: "Описание",
      };
      return `${fieldLabels[field] || field}: ${item.msg}`;
    });
    return messages.join(". ");
  }

  if (typeof error.data?.detail === "string") {
    return error.data.detail;
  }

  return error.message || "Произошла ошибка";
}

type ViewMode = "list" | "detail";

export function CompanyPage() {
  const { user: authUser } = useAuth();

  // View mode
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  // Состояние компаний
  const [companies, setCompanies] = useState<CompanyWithRole[]>([]);
  const [selectedCompany, setSelectedCompany] =
    useState<CompanyWithRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Члены компании
  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);

  // Приглашения компании
  const [invitations, setInvitations] = useState<CompanyInvitation[]>([]);
  const [isLoadingInvitations, setIsLoadingInvitations] = useState(false);

  // Мои приглашения
  const [myInvitations, setMyInvitations] = useState<InvitationWithCompany[]>(
    []
  );

  // Визитки пользователя
  const [userCards, setUserCards] = useState<BusinessCard[]>([]);
  const [cardAssignments, setCardAssignments] = useState<
    CompanyCardAssignment[]
  >([]);

  // Просмотр визитки участника
  const [viewingUser, setViewingUser] = useState<
    (UserPublic & { card_id?: string }) | null
  >(null);
  const [isViewCardModalOpen, setIsViewCardModalOpen] = useState(false);
  const [isLoadingViewCard, setIsLoadingViewCard] = useState(false);
  const [savedCardIds, setSavedCardIds] = useState<Set<string>>(new Set());

  // Модалка создания
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    email_domain: "",
    description: "",
    allow_auto_join: false,
  });
  const [isSaving, setIsSaving] = useState(false);

  // Toast уведомления
  const [toast, setToast] = useState<{
    message: string;
    type: "error" | "success";
  } | null>(null);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const showError = (message: string) => setToast({ message, type: "error" });
  const showSuccess = (message: string) =>
    setToast({ message, type: "success" });

  // Загрузка компаний
  const loadCompanies = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await companyApi.getMyCompanies();
      setCompanies(data);
    } catch (err) {
      showError(parseApiError(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Загрузка моих приглашений
  const loadMyInvitations = useCallback(async () => {
    try {
      const data = await companyApi.getMyInvitations();
      setMyInvitations(data);
    } catch (err) {
      console.error("Ошибка загрузки приглашений:", err);
    }
  }, []);

  // Загрузка членов
  const loadMembers = useCallback(async (companyId: string) => {
    setIsLoadingMembers(true);
    try {
      const data = await companyApi.getMembers(companyId);
      setMembers(data);
    } catch (err) {
      console.error("Ошибка загрузки членов:", err);
    } finally {
      setIsLoadingMembers(false);
    }
  }, []);

  // Загрузка приглашений компании
  const loadInvitations = useCallback(
    async (companyId: string, role: CompanyRole) => {
      if (!canManageMembers(role)) return;
      setIsLoadingInvitations(true);
      try {
        const data = await companyApi.getInvitations(companyId);
        setInvitations(data);
      } catch (err) {
        console.error("Ошибка загрузки приглашений:", err);
      } finally {
        setIsLoadingInvitations(false);
      }
    },
    []
  );

  // Загрузка визиток пользователя
  const loadUserCards = useCallback(async () => {
    if (!authUser?.id) return;
    try {
      const response = await businessCardApi.getAll(authUser.id);
      setUserCards(response.cards);
    } catch (err) {
      console.error("Ошибка загрузки визиток:", err);
    }
  }, [authUser?.id]);

  // Загрузка связей визиток с компаниями
  const loadCardAssignments = useCallback(async () => {
    try {
      const data = await companyApi.getMyCardAssignments();
      setCardAssignments(data);
    } catch (err) {
      console.error("Ошибка загрузки связей визиток:", err);
    }
  }, []);

  // Получить выбранную визитку для компании
  const getSelectedCardId = (companyId: string): string | null => {
    const assignment = cardAssignments.find((a) => a.company_id === companyId);
    return assignment?.selected_card_id || null;
  };

  // Обработчик выбора визитки
  const handleSelectCard = async (companyId: string, cardId: string | null) => {
    try {
      const result = await companyApi.setSelectedCard(companyId, cardId);
      setCardAssignments((prev) => {
        const idx = prev.findIndex((a) => a.company_id === companyId);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = result;
          return updated;
        }
        return [...prev, result];
      });
      showSuccess(cardId ? "Визитка выбрана" : "Выбор визитки снят");
    } catch (err) {
      showError(parseApiError(err));
      throw err;
    }
  };

  // Конвертация BusinessCardPublic в UserPublic для SpecialistModal
  const cardToUserPublic = (
    card: BusinessCardPublic
  ): UserPublic & { card_id: string } => {
    const nameParts = card.display_name.split(" ");
    return {
      id: card.owner_id,
      card_id: card.id,
      first_name: nameParts[1] || nameParts[0] || "",
      last_name: nameParts[0] || "",
      middle_name: nameParts[2] || null,
      avatar_url: card.avatar_url,
      bio: card.bio,
      ai_generated_bio: card.ai_generated_bio,
      location: null,
      position: card.title || null,
      tags: card.tags.map((t) => ({
        id: t.id,
        name: t.name,
        category: t.category,
        proficiency: t.proficiency,
      })),
      search_tags: card.search_tags,
      contacts: card.contacts.filter((c) => c.is_visible),
      profile_completeness: card.completeness,
    };
  };

  // Просмотр визитки участника
  const handleViewMemberCard = async (userId: string, cardId: string) => {
    setIsLoadingViewCard(true);
    setIsViewCardModalOpen(true);
    try {
      const card = await businessCardApi.getPublic(cardId);

      // Получаем аватарку участника из списка members, если у визитки нет своей
      const member = members.find((m) => m.user.id === userId);
      const avatarUrl = card.avatar_url || member?.user.avatar_url || null;

      const userForModal = cardToUserPublic({ ...card, avatar_url: avatarUrl });
      setViewingUser(userForModal);

      // Проверяем, сохранена ли эта карточка в контактах
      if (authUser?.id) {
        try {
          const contacts = await userApi.getContacts(authUser.id);
          const savedIds = new Set(
            contacts
              .filter((c) => c.saved_card_id)
              .map((c) => c.saved_card_id as string)
          );
          setSavedCardIds(savedIds);
        } catch {
          // Игнорируем ошибку загрузки контактов
        }
      }
    } catch (err) {
      showError("Не удалось загрузить визитку");
      setIsViewCardModalOpen(false);
    } finally {
      setIsLoadingViewCard(false);
    }
  };

  // Сохранение контакта из модалки
  const handleSaveContactFromCard = async (
    user: UserPublic & { card_id?: string }
  ) => {
    if (!authUser?.id) return;
    try {
      await userApi.saveContact(authUser.id, user.id, user.card_id);
      if (user.card_id) {
        setSavedCardIds((prev) => new Set([...prev, user.card_id!]));
      }
      showSuccess("Контакт сохранен!");
      closeViewCard();
    } catch (err) {
      showError("Не удалось сохранить контакт");
    }
  };

  // Удаление контакта из модалки
  const handleDeleteContactFromCard = async (
    user: UserPublic & { card_id?: string }
  ) => {
    if (!authUser?.id) return;
    try {
      const contacts = await userApi.getContacts(authUser.id);
      const contactToDelete = contacts.find(
        (c) =>
          (user.card_id && c.saved_card_id === user.card_id) ||
          c.saved_user_id === user.id
      );
      if (contactToDelete) {
        await userApi.deleteContact(contactToDelete.id);
        if (user.card_id) {
          setSavedCardIds((prev) => {
            const newSet = new Set(prev);
            newSet.delete(user.card_id!);
            return newSet;
          });
        }
        showSuccess("Контакт удален");
        closeViewCard();
      }
    } catch (err) {
      showError("Не удалось удалить контакт");
    }
  };

  const closeViewCard = () => {
    setIsViewCardModalOpen(false);
    setViewingUser(null);
  };

  useEffect(() => {
    loadCompanies();
    loadMyInvitations();
    loadUserCards();
    loadCardAssignments();
  }, [loadCompanies, loadMyInvitations, loadUserCards, loadCardAssignments]);

  // При выборе компании - переход на детальную страницу
  const handleSelectCompany = (company: CompanyWithRole) => {
    setSelectedCompany(company);
    setViewMode("detail");
    loadMembers(company.company.id);
    loadInvitations(company.company.id, company.role);
  };

  // Возврат к списку
  const handleBackToList = () => {
    setViewMode("list");
    setSelectedCompany(null);
    setMembers([]);
    setInvitations([]);
    loadCompanies();
  };

  // Создание компании
  const handleCreateCompany = async () => {
    if (!createForm.name.trim() || !createForm.email_domain.trim()) return;
    setIsSaving(true);
    try {
      const newCompany = await companyApi.create({
        name: createForm.name,
        email_domain: createForm.email_domain,
        description: createForm.description || undefined,
        allow_auto_join: createForm.allow_auto_join,
      });
      await loadCompanies();
      const newCompanyWithRole: CompanyWithRole = {
        company: newCompany,
        role: "owner",
        joined_at: new Date().toISOString(),
      };
      setIsCreateModalOpen(false);
      setCreateForm({
        name: "",
        email_domain: "",
        description: "",
        allow_auto_join: false,
      });
      showSuccess("Компания успешно создана!");
      // Сразу открываем новую компанию
      handleSelectCompany(newCompanyWithRole);
    } catch (err) {
      showError(parseApiError(err));
    } finally {
      setIsSaving(false);
    }
  };

  // Отправка приглашения
  const handleInvite = async (email: string, role: CompanyRole) => {
    if (!selectedCompany) return;
    try {
      await companyApi.createInvitation(selectedCompany.company.id, {
        email,
        role,
      });
      await loadInvitations(selectedCompany.company.id, selectedCompany.role);
      showSuccess("Приглашение отправлено!");
    } catch (err) {
      showError(parseApiError(err));
      throw err;
    }
  };

  // Отменить приглашение
  const handleCancelInvitation = async (invitationId: string) => {
    if (!selectedCompany) return;
    try {
      await companyApi.cancelInvitation(
        selectedCompany.company.id,
        invitationId
      );
      await loadInvitations(selectedCompany.company.id, selectedCompany.role);
    } catch (err) {
      showError(parseApiError(err));
      throw err;
    }
  };

  // Изменить роль члена
  const handleChangeRole = async (userId: string, newRole: CompanyRole) => {
    if (!selectedCompany) return;
    try {
      await companyApi.updateMemberRole(
        selectedCompany.company.id,
        userId,
        newRole
      );
      await loadMembers(selectedCompany.company.id);
      showSuccess("Роль изменена");
    } catch (err) {
      showError(parseApiError(err));
      throw err;
    }
  };

  // Удалить члена
  const handleRemoveMember = async (userId: string) => {
    if (!selectedCompany || !confirm("Удалить этого участника из компании?"))
      return;
    try {
      await companyApi.removeMember(selectedCompany.company.id, userId);
      await loadMembers(selectedCompany.company.id);
    } catch (err) {
      showError(parseApiError(err));
      throw err;
    }
  };

  // Покинуть компанию
  const handleLeaveCompany = async () => {
    if (
      !selectedCompany ||
      !confirm("Вы уверены, что хотите покинуть компанию?")
    )
      return;
    try {
      await companyApi.leave(selectedCompany.company.id);
      showSuccess("Вы покинули компанию");
      handleBackToList();
    } catch (err) {
      showError(parseApiError(err));
      throw err;
    }
  };

  // Обновить компанию
  const handleUpdateCompany = async (data: {
    name: string;
    description: string;
    allow_auto_join: boolean;
  }) => {
    if (!selectedCompany) return;
    try {
      const updated = await companyApi.update(selectedCompany.company.id, {
        name: data.name || undefined,
        description: data.description || undefined,
        allow_auto_join: data.allow_auto_join,
      });
      setSelectedCompany({
        ...selectedCompany,
        company: updated,
      });
      showSuccess("Компания обновлена");
    } catch (err) {
      showError(parseApiError(err));
      throw err;
    }
  };

  // Удалить компанию
  const handleDeleteCompany = async () => {
    if (!selectedCompany) return;
    try {
      await companyApi.delete(selectedCompany.company.id);
      showSuccess("Компания удалена");
      handleBackToList();
    } catch (err) {
      showError(parseApiError(err));
      throw err;
    }
  };

  // Принять приглашение
  const handleAcceptInvitation = async (token: string) => {
    setIsSaving(true);
    try {
      await companyApi.acceptInvitation({ token });
      await loadCompanies();
      await loadMyInvitations();
      showSuccess("Вы присоединились к компании!");
    } catch (err) {
      showError(parseApiError(err));
    } finally {
      setIsSaving(false);
    }
  };

  // Отклонить приглашение
  const handleDeclineInvitation = async (token: string) => {
    setIsSaving(true);
    try {
      await companyApi.declineInvitation({ token });
      await loadMyInvitations();
    } catch (err) {
      showError(parseApiError(err));
    } finally {
      setIsSaving(false);
    }
  };

  // Loading state
  if (isLoading && viewMode === "list") {
    return (
      <div className="company-page">
        <div className="company-page__loading">
          <Loader />
        </div>
      </div>
    );
  }

  // Detail view - полноэкранная страница компании с sidebar
  if (viewMode === "detail" && selectedCompany) {
    return (
      <div className="company-page company-page--detail">
        {/* Toast */}
        {toast && (
          <div
            className={`company-page__toast company-page__toast--${toast.type}`}
            onClick={() => setToast(null)}
          >
            <span className="company-page__toast-icon">
              {toast.type === "error" ? "⚠️" : "✓"}
            </span>
            <span>{toast.message}</span>
            <button className="company-page__toast-close">×</button>
          </div>
        )}

        <CompanyDetail
          company={selectedCompany}
          members={members}
          invitations={invitations}
          isLoadingMembers={isLoadingMembers}
          isLoadingInvitations={isLoadingInvitations}
          currentUserId={authUser?.id}
          userCards={userCards}
          selectedCardId={getSelectedCardId(selectedCompany.company.id)}
          onSelectCard={(cardId) =>
            handleSelectCard(selectedCompany.company.id, cardId)
          }
          onViewMemberCard={handleViewMemberCard}
          onBack={handleBackToList}
          onInvite={handleInvite}
          onCancelInvitation={handleCancelInvitation}
          onChangeRole={handleChangeRole}
          onRemoveMember={handleRemoveMember}
          onLeaveCompany={handleLeaveCompany}
          onUpdateCompany={handleUpdateCompany}
          onDeleteCompany={handleDeleteCompany}
        />

        {/* Модалка просмотра визитки участника */}
        {isLoadingViewCard && isViewCardModalOpen && (
          <Modal isOpen={true} onClose={closeViewCard} title="Загрузка...">
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                padding: "40px",
              }}
            >
              <Loader />
            </div>
          </Modal>
        )}

        {!isLoadingViewCard && (
          <SpecialistModal
            user={viewingUser}
            isOpen={isViewCardModalOpen && !!viewingUser}
            onClose={closeViewCard}
            onSaveContact={handleSaveContactFromCard}
            onDeleteContact={handleDeleteContactFromCard}
            isSaved={
              viewingUser?.card_id
                ? savedCardIds.has(viewingUser.card_id)
                : false
            }
          />
        )}
      </div>
    );
  }

  // List view
  return (
    <div className="company-page">
      {/* Toast */}
      {toast && (
        <div
          className={`company-page__toast company-page__toast--${toast.type}`}
          onClick={() => setToast(null)}
        >
          <span className="company-page__toast-icon">
            {toast.type === "error" ? "⚠️" : "✓"}
          </span>
          <span>{toast.message}</span>
          <button className="company-page__toast-close">×</button>
        </div>
      )}

      {/* Мои приглашения */}
      {myInvitations.length > 0 && (
        <div className="company-page__invitations-banner">
          <div className="company-page__invitations-header">
            <span className="company-page__invitations-icon">📬</span>
            <Typography variant="h3">У вас есть приглашения</Typography>
          </div>
          <div className="company-page__invitations-list">
            {myInvitations.map((inv) => (
              <div key={inv.id} className="invitation-card">
                <div className="invitation-card__info">
                  <Typography variant="body">
                    <strong>{inv.company.name}</strong>
                  </Typography>
                  <Typography variant="small" color="secondary">
                    Роль: {roleLabels[inv.role]}
                    {inv.invited_by &&
                      ` • От: ${inv.invited_by.first_name} ${inv.invited_by.last_name}`}
                  </Typography>
                </div>
                <div className="invitation-card__actions">
                  <Button
                    size="sm"
                    onClick={() =>
                      handleAcceptInvitation(
                        (inv as unknown as { token?: string }).token || ""
                      )
                    }
                    disabled={isSaving}
                  >
                    Принять
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      handleDeclineInvitation(
                        (inv as unknown as { token?: string }).token || ""
                      )
                    }
                    disabled={isSaving}
                  >
                    Отклонить
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Список компаний */}
      <CompanyList
        companies={companies}
        onSelectCompany={handleSelectCompany}
        onCreateCompany={() => setIsCreateModalOpen(true)}
      />

      {/* Модалка создания компании */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Создать компанию"
        size="md"
      >
        <div className="create-company-form">
          <Input
            label="Название компании"
            value={createForm.name}
            onChange={(e) =>
              setCreateForm({ ...createForm, name: e.target.value })
            }
            placeholder="Моя компания"
          />
          <Input
            label="Домен email"
            value={createForm.email_domain}
            onChange={(e) =>
              setCreateForm({ ...createForm, email_domain: e.target.value })
            }
            placeholder="company.com"
          />
          <Input
            label="Описание (опционально)"
            value={createForm.description}
            onChange={(e) =>
              setCreateForm({ ...createForm, description: e.target.value })
            }
            placeholder="Краткое описание компании"
          />
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={createForm.allow_auto_join}
              onChange={(e) =>
                setCreateForm({
                  ...createForm,
                  allow_auto_join: e.target.checked,
                })
              }
            />
            <span>Разрешить автоматическое вступление по домену email</span>
          </label>
          <div className="form-actions">
            <Button variant="ghost" onClick={() => setIsCreateModalOpen(false)}>
              Отмена
            </Button>
            <Button
              onClick={handleCreateCompany}
              disabled={
                isSaving ||
                !createForm.name.trim() ||
                !createForm.email_domain.trim()
              }
            >
              {isSaving ? "Создание..." : "Создать"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
