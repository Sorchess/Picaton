import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/features/auth";
import {
  type CompanyWithRole,
  type CompanyMember,
  type CompanyInvitation,
  type InvitationWithCompany,
  type CompanyRole,
  companyApi,
  roleLabels,
  canManageMembers,
  canInvite,
  canDeleteCompany,
  canChangeRoles,
} from "@/entities/company";
import {
  Button,
  Modal,
  Input,
  Loader,
  Typography,
  Avatar,
  Tag,
} from "@/shared";
import "./CompanyPage.scss";

type TabType = "members" | "invitations" | "settings";

// Парсинг ошибок API (422, 409, и т.д.)
function parseApiError(err: unknown): string {
  const error = err as {
    data?: { detail?: string | Array<{ msg?: string; loc?: string[] }> };
    message?: string;
  };

  // Если detail - это массив (422 Validation Error)
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

  // Если detail - строка
  if (typeof error.data?.detail === "string") {
    return error.data.detail;
  }

  // Fallback
  return error.message || "Произошла ошибка";
}

export function CompanyPage() {
  const { user: authUser } = useAuth();

  // Состояние компаний
  const [companies, setCompanies] = useState<CompanyWithRole[]>([]);
  const [selectedCompany, setSelectedCompany] =
    useState<CompanyWithRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Табы
  const [activeTab, setActiveTab] = useState<TabType>("members");

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

  // Модалки
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Формы
  const [createForm, setCreateForm] = useState({
    name: "",
    email_domain: "",
    description: "",
    allow_auto_join: false,
  });
  const [inviteForm, setInviteForm] = useState({
    email: "",
    role: "member" as CompanyRole,
  });
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    allow_auto_join: false,
  });

  const [isSaving, setIsSaving] = useState(false);

  // Toast уведомления
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" } | null>(null);

  // Автоскрытие toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Показать ошибку
  const showError = (message: string) => setToast({ message, type: "error" });
  const showSuccess = (message: string) => setToast({ message, type: "success" });

  // Загрузка компаний
  const loadCompanies = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await companyApi.getMyCompanies();
      setCompanies(data);
      if (data.length > 0 && !selectedCompany) {
        setSelectedCompany(data[0]);
      }
    } catch (err) {
      showError(parseApiError(err));
    } finally {
      setIsLoading(false);
    }
  }, [selectedCompany]);

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
  const loadMembers = useCallback(async () => {
    if (!selectedCompany) return;
    setIsLoadingMembers(true);
    try {
      const data = await companyApi.getMembers(selectedCompany.company.id);
      setMembers(data);
    } catch (err) {
      console.error("Ошибка загрузки членов:", err);
    } finally {
      setIsLoadingMembers(false);
    }
  }, [selectedCompany]);

  // Загрузка приглашений компании
  const loadInvitations = useCallback(async () => {
    if (!selectedCompany || !canManageMembers(selectedCompany.role)) return;
    setIsLoadingInvitations(true);
    try {
      const data = await companyApi.getInvitations(selectedCompany.company.id);
      setInvitations(data);
    } catch (err) {
      console.error("Ошибка загрузки приглашений:", err);
    } finally {
      setIsLoadingInvitations(false);
    }
  }, [selectedCompany]);

  useEffect(() => {
    loadCompanies();
    loadMyInvitations();
  }, []);

  useEffect(() => {
    if (selectedCompany) {
      loadMembers();
      if (canManageMembers(selectedCompany.role)) {
        loadInvitations();
      }
    }
  }, [selectedCompany, loadMembers, loadInvitations]);

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
      setSelectedCompany({
        company: newCompany,
        role: "owner",
        joined_at: new Date().toISOString(),
      });
      setIsCreateModalOpen(false);
      setCreateForm({
        name: "",
        email_domain: "",
        description: "",
        allow_auto_join: false,
      });
      showSuccess("Компания успешно создана!");
    } catch (err: unknown) {
      showError(parseApiError(err));
    } finally {
      setIsSaving(false);
    }
  };

  // Отправка приглашения
  const handleInvite = async () => {
    if (!selectedCompany || !inviteForm.email.trim()) return;
    setIsSaving(true);
    try {
      await companyApi.createInvitation(selectedCompany.company.id, {
        email: inviteForm.email,
        role: inviteForm.role,
      });
      await loadInvitations();
      setIsInviteModalOpen(false);
      setInviteForm({ email: "", role: "member" });
      showSuccess("Приглашение отправлено!");
    } catch (err: unknown) {
      showError(parseApiError(err));
    } finally {
      setIsSaving(false);
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
    } catch (err: unknown) {
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
    } catch (err: unknown) {
      showError(parseApiError(err));
    } finally {
      setIsSaving(false);
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
      await loadInvitations();
    } catch (err: unknown) {
      showError(parseApiError(err));
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
      await loadMembers();
      showSuccess("Роль изменена");
    } catch (err: unknown) {
      showError(parseApiError(err));
    }
  };

  // Удалить члена
  const handleRemoveMember = async (userId: string) => {
    if (!selectedCompany || !confirm("Удалить этого участника из компании?"))
      return;
    try {
      await companyApi.removeMember(selectedCompany.company.id, userId);
      await loadMembers();
    } catch (err: unknown) {
      showError(parseApiError(err));
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
      setSelectedCompany(null);
      await loadCompanies();
    } catch (err: unknown) {
      showError(parseApiError(err));
    }
  };

  // Обновить компанию
  const handleUpdateCompany = async () => {
    if (!selectedCompany) return;
    setIsSaving(true);
    try {
      const updated = await companyApi.update(selectedCompany.company.id, {
        name: editForm.name || undefined,
        description: editForm.description || undefined,
        allow_auto_join: editForm.allow_auto_join,
      });
      setSelectedCompany({
        ...selectedCompany,
        company: updated,
      });
      setIsEditModalOpen(false);
      await loadCompanies();
      showSuccess("Компания обновлена");
    } catch (err: unknown) {
      showError(parseApiError(err));
    } finally {
      setIsSaving(false);
    }
  };

  // Удалить компанию
  const handleDeleteCompany = async () => {
    if (!selectedCompany) return;
    setIsSaving(true);
    try {
      await companyApi.delete(selectedCompany.company.id);
      setSelectedCompany(null);
      setIsDeleteModalOpen(false);
      await loadCompanies();
    } catch (err: unknown) {
      showError(parseApiError(err));
    } finally {
      setIsSaving(false);
    }
  };

  // Открыть модалку редактирования
  const openEditModal = () => {
    if (!selectedCompany) return;
    setEditForm({
      name: selectedCompany.company.name,
      description: selectedCompany.company.description || "",
      allow_auto_join: selectedCompany.company.allow_auto_join,
    });
    setIsEditModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="company-page">
        <div className="company-page__loading">
          <Loader />
        </div>
      </div>
    );
  }

  return (
    <div className="company-page">
      {/* Toast \u0443\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u044f */}
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

      {/* Заголовок */}
      <div className="company-page__header">
        <div>
          <Typography variant="h1">Компании</Typography>
          <Typography variant="small" color="secondary">
            Управление корпоративными пространствами
          </Typography>
        </div>
        <Button onClick={() => setIsCreateModalOpen(true)}>
          + Создать компанию
        </Button>
      </div>

      {/* Мои приглашения */}
      {myInvitations.length > 0 && (
        <div className="company-page__invitations-banner">
          <Typography variant="h3">📬 У вас есть приглашения</Typography>
          <div className="company-page__invitations-list">
            {myInvitations.map((inv) => (
              <div key={inv.id} className="invitation-card">
                <div className="invitation-card__info">
                  <Typography variant="body">
                    Приглашение в <strong>{inv.company.name}</strong>
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

      {/* Список компаний и детали */}
      <div className="company-page__content">
        {/* Сайдбар со списком компаний */}
        <div className="company-page__sidebar">
          <Typography variant="h3">Мои компании</Typography>
          {companies.length === 0 ? (
            <div className="company-page__empty">
              <Typography color="secondary">У вас пока нет компаний</Typography>
            </div>
          ) : (
            <div className="company-list">
              {companies.map((item) => (
                <div
                  key={item.company.id}
                  className={`company-list__item ${
                    selectedCompany?.company.id === item.company.id
                      ? "company-list__item--active"
                      : ""
                  }`}
                  onClick={() => setSelectedCompany(item)}
                >
                  <div className="company-list__avatar">
                    {item.company.logo_url ? (
                      <img
                        src={item.company.logo_url}
                        alt={item.company.name}
                      />
                    ) : (
                      <span>{item.company.name.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="company-list__info">
                    <Typography variant="body">{item.company.name}</Typography>
                    <Tag size="sm">{roleLabels[item.role]}</Tag>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Детали компании */}
        {selectedCompany ? (
          <div className="company-page__details">
            {/* Шапка компании */}
            <div className="company-details__header">
              <div className="company-details__title">
                <div className="company-details__logo">
                  {selectedCompany.company.logo_url ? (
                    <img
                      src={selectedCompany.company.logo_url}
                      alt={selectedCompany.company.name}
                    />
                  ) : (
                    <span>
                      {selectedCompany.company.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div>
                  <Typography variant="h2">
                    {selectedCompany.company.name}
                  </Typography>
                  <Typography variant="small" color="secondary">
                    @{selectedCompany.company.email_domain}
                  </Typography>
                </div>
              </div>
              <div className="company-details__actions">
                {canInvite(selectedCompany.role) && (
                  <Button onClick={() => setIsInviteModalOpen(true)}>
                    + Пригласить
                  </Button>
                )}
                {canManageMembers(selectedCompany.role) && (
                  <Button variant="secondary" onClick={openEditModal}>
                    Настройки
                  </Button>
                )}
                {!canDeleteCompany(selectedCompany.role) && (
                  <Button variant="ghost" onClick={handleLeaveCompany}>
                    Покинуть
                  </Button>
                )}
              </div>
            </div>

            {selectedCompany.company.description && (
              <Typography
                variant="body"
                color="secondary"
                className="company-details__description"
              >
                {selectedCompany.company.description}
              </Typography>
            )}

            {/* Табы */}
            <div className="company-details__tabs">
              <button
                className={`tab ${
                  activeTab === "members" ? "tab--active" : ""
                }`}
                onClick={() => setActiveTab("members")}
              >
                Участники
              </button>
              {canManageMembers(selectedCompany.role) && (
                <button
                  className={`tab ${
                    activeTab === "invitations" ? "tab--active" : ""
                  }`}
                  onClick={() => setActiveTab("invitations")}
                >
                  Приглашения
                </button>
              )}
              {canManageMembers(selectedCompany.role) && (
                <button
                  className={`tab ${
                    activeTab === "settings" ? "tab--active" : ""
                  }`}
                  onClick={() => setActiveTab("settings")}
                >
                  Настройки
                </button>
              )}
            </div>

            {/* Контент табов */}
            <div className="company-details__content">
              {activeTab === "members" && (
                <div className="members-tab">
                  {isLoadingMembers ? (
                    <Loader />
                  ) : (
                    <div className="members-list">
                      {members.map((member) => (
                        <div key={member.id} className="member-card">
                          <Avatar
                            src={member.user.avatar_url || undefined}
                            initials={`${member.user.first_name.charAt(
                              0
                            )}${member.user.last_name.charAt(0)}`}
                            size="md"
                          />
                          <div className="member-card__info">
                            <Typography variant="body">
                              {member.user.first_name} {member.user.last_name}
                            </Typography>
                            <Typography variant="small" color="secondary">
                              {member.user.email}
                            </Typography>
                          </div>
                          <Tag
                            size="sm"
                            variant={
                              member.role === "owner" ? "outline" : "default"
                            }
                          >
                            {roleLabels[member.role]}
                          </Tag>
                          {canChangeRoles(selectedCompany.role) &&
                            member.user.id !== authUser?.id &&
                            member.role !== "owner" && (
                              <div className="member-card__actions">
                                <select
                                  value={member.role}
                                  onChange={(e) =>
                                    handleChangeRole(
                                      member.user.id,
                                      e.target.value as CompanyRole
                                    )
                                  }
                                >
                                  <option value="admin">Администратор</option>
                                  <option value="member">Участник</option>
                                </select>
                                <button
                                  className="member-card__remove"
                                  onClick={() =>
                                    handleRemoveMember(member.user.id)
                                  }
                                >
                                  ✕
                                </button>
                              </div>
                            )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "invitations" &&
                canManageMembers(selectedCompany.role) && (
                  <div className="invitations-tab">
                    {isLoadingInvitations ? (
                      <Loader />
                    ) : invitations.length === 0 ? (
                      <div className="invitations-tab__empty">
                        <Typography color="secondary">
                          Нет активных приглашений
                        </Typography>
                      </div>
                    ) : (
                      <div className="invitations-list">
                        {invitations.map((inv) => (
                          <div key={inv.id} className="invitation-item">
                            <div className="invitation-item__info">
                              <Typography variant="body">
                                {inv.email}
                              </Typography>
                              <div className="invitation-item__meta">
                                <Tag size="sm">{roleLabels[inv.role]}</Tag>
                                <Tag
                                  size="sm"
                                  variant={
                                    inv.status === "pending"
                                      ? "outline"
                                      : "default"
                                  }
                                >
                                  {inv.status === "pending"
                                    ? "Ожидает"
                                    : inv.status === "accepted"
                                    ? "Принято"
                                    : inv.status === "declined"
                                    ? "Отклонено"
                                    : inv.status === "expired"
                                    ? "Истекло"
                                    : "Отменено"}
                                </Tag>
                              </div>
                            </div>
                            {inv.status === "pending" && (
                              <div className="invitation-item__actions">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleCancelInvitation(inv.id)}
                                >
                                  Отменить
                                </Button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

              {activeTab === "settings" &&
                canManageMembers(selectedCompany.role) && (
                  <div className="settings-tab">
                    <div className="settings-section">
                      <Typography variant="h3">
                        Информация о компании
                      </Typography>
                      <div className="settings-info">
                        <div className="settings-info__row">
                          <Typography variant="small" color="secondary">
                            Название
                          </Typography>
                          <Typography variant="body">
                            {selectedCompany.company.name}
                          </Typography>
                        </div>
                        <div className="settings-info__row">
                          <Typography variant="small" color="secondary">
                            Домен
                          </Typography>
                          <Typography variant="body">
                            @{selectedCompany.company.email_domain}
                          </Typography>
                        </div>
                        <div className="settings-info__row">
                          <Typography variant="small" color="secondary">
                            Авто-вступление
                          </Typography>
                          <Typography variant="body">
                            {selectedCompany.company.allow_auto_join
                              ? "Включено"
                              : "Выключено"}
                          </Typography>
                        </div>
                      </div>
                      <Button variant="secondary" onClick={openEditModal}>
                        Редактировать
                      </Button>
                    </div>

                    {canDeleteCompany(selectedCompany.role) && (
                      <div className="settings-section settings-section--danger">
                        <Typography variant="h3">Опасная зона</Typography>
                        <Typography variant="small" color="secondary">
                          Удаление компании необратимо. Все данные будут
                          потеряны.
                        </Typography>
                        <Button
                          variant="danger"
                          onClick={() => setIsDeleteModalOpen(true)}
                        >
                          Удалить компанию
                        </Button>
                      </div>
                    )}
                  </div>
                )}
            </div>
          </div>
        ) : (
          <div className="company-page__no-selection">
            <Typography color="secondary">
              Выберите компанию из списка или создайте новую
            </Typography>
          </div>
        )}
      </div>

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

      {/* Модалка приглашения */}
      <Modal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        title="Пригласить участника"
        size="sm"
      >
        <div className="invite-form">
          <Input
            label="Email"
            type="email"
            value={inviteForm.email}
            onChange={(e) =>
              setInviteForm({ ...inviteForm, email: e.target.value })
            }
            placeholder="user@example.com"
          />
          <div className="form-field">
            <label>Роль</label>
            <select
              value={inviteForm.role}
              onChange={(e) =>
                setInviteForm({
                  ...inviteForm,
                  role: e.target.value as CompanyRole,
                })
              }
            >
              <option value="member">Участник</option>
              <option value="admin">Администратор</option>
            </select>
          </div>
          <div className="form-actions">
            <Button variant="ghost" onClick={() => setIsInviteModalOpen(false)}>
              Отмена
            </Button>
            <Button
              onClick={handleInvite}
              disabled={isSaving || !inviteForm.email.trim()}
            >
              {isSaving ? "Отправка..." : "Отправить приглашение"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Модалка редактирования */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Редактировать компанию"
        size="md"
      >
        <div className="edit-company-form">
          <Input
            label="Название компании"
            value={editForm.name}
            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
          />
          <Input
            label="Описание"
            value={editForm.description}
            onChange={(e) =>
              setEditForm({ ...editForm, description: e.target.value })
            }
          />
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={editForm.allow_auto_join}
              onChange={(e) =>
                setEditForm({ ...editForm, allow_auto_join: e.target.checked })
              }
            />
            <span>Разрешить автоматическое вступление по домену email</span>
          </label>
          <div className="form-actions">
            <Button variant="ghost" onClick={() => setIsEditModalOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleUpdateCompany} disabled={isSaving}>
              {isSaving ? "Сохранение..." : "Сохранить"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Модалка удаления */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Удалить компанию"
        size="sm"
      >
        <div className="delete-confirm">
          <Typography variant="body">
            Вы уверены, что хотите удалить компанию{" "}
            <strong>{selectedCompany?.company.name}</strong>?
          </Typography>
          <Typography variant="small" color="secondary">
            Это действие необратимо. Все участники будут удалены из компании.
          </Typography>
          <div className="form-actions">
            <Button variant="ghost" onClick={() => setIsDeleteModalOpen(false)}>
              Отмена
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteCompany}
              disabled={isSaving}
            >
              {isSaving ? "Удаление..." : "Удалить"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
