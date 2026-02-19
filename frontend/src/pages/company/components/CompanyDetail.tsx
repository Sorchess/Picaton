import { useState } from "react";
import type {
  CompanyWithRole,
  CompanyMember,
  CompanyInvitation,
  CompanyRoleInfo,
} from "@/entities/company";
import type { BusinessCard } from "@/entities/business-card";
import {
  getRoleName,
  getRoleColor,
  isOwnerRole,
  canManageMembers,
  canInvite,
  canDeleteCompany,
  canChangeRoles,
} from "@/entities/company";
import {
  Typography,
  Avatar,
  Tag,
  Card,
  Button,
  Modal,
  Input,
  Loader,
  IconButton,
} from "@/shared";
import { RoleSelect } from "./RoleSelect";
import { RolesManager } from "./RolesManager";
import "./CompanyDetail.scss";

type SubPage = "main" | "members" | "roles" | "privacy";

interface CompanyDetailProps {
  company: CompanyWithRole;
  members: CompanyMember[];
  invitations: CompanyInvitation[];
  isLoadingMembers: boolean;
  isLoadingInvitations: boolean;
  currentUserId?: string;
  userCards?: BusinessCard[];
  selectedCardId?: string | null;
  onSelectCard?: (cardId: string | null) => Promise<void>;
  onViewMemberCard?: (userId: string, cardId: string) => void;
  availableRoles?: CompanyRoleInfo[];
  onBack: () => void;
  onInvite: (email: string, roleId?: string) => Promise<void>;
  onCancelInvitation: (invitationId: string) => Promise<void>;
  onChangeRole: (userId: string, newRoleId: string) => Promise<void>;
  onRemoveMember: (userId: string) => Promise<void>;
  onLeaveCompany: () => Promise<void>;
  onUpdateCompany: (data: {
    name: string;
    description: string;
  }) => Promise<void>;
  onDeleteCompany: () => Promise<void>;
  onRolesChange?: () => void;
}

export function CompanyDetail({
  company,
  members,
  invitations,
  isLoadingMembers,
  isLoadingInvitations,
  currentUserId,
  userCards = [],
  selectedCardId,
  onSelectCard,
  onViewMemberCard,
  availableRoles = [],
  onBack,
  onInvite,
  onCancelInvitation,
  onChangeRole,
  onRemoveMember,
  onLeaveCompany,
  onUpdateCompany,
  onDeleteCompany,
  onRolesChange,
}: CompanyDetailProps) {
  void isLoadingInvitations;
  const [subPage, setSubPage] = useState<SubPage>("main");
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isCardSelectModalOpen, setIsCardSelectModalOpen] = useState(false);
  const [isSelectingCard, setIsSelectingCard] = useState(false);

  const canManageRolesCheck = canChangeRoles(company.role);

  const defaultRole =
    availableRoles.find((r) => r.name === "Member") ||
    availableRoles[availableRoles.length - 1];

  const [inviteForm, setInviteForm] = useState({
    email: "",
    roleId: defaultRole?.id || "",
  });
  const [editForm, setEditForm] = useState({
    name: company.company.name,
    description: company.company.description || "",
  });

  const [isSaving, setIsSaving] = useState(false);

  const handleInvite = async () => {
    if (!inviteForm.email.trim()) return;
    setIsSaving(true);
    try {
      await onInvite(inviteForm.email, inviteForm.roleId || undefined);
      setInviteForm({ email: "", roleId: defaultRole?.id || "" });
      setIsInviteModalOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateCompany = async () => {
    setIsSaving(true);
    try {
      await onUpdateCompany(editForm);
      setIsEditModalOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCompany = async () => {
    setIsSaving(true);
    try {
      await onDeleteCompany();
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectCard = async (cardId: string | null) => {
    if (!onSelectCard) return;
    setIsSelectingCard(true);
    try {
      await onSelectCard(cardId);
      setIsCardSelectModalOpen(false);
    } finally {
      setIsSelectingCard(false);
    }
  };

  const selectedCard = userCards.find((c) => c.id === selectedCardId);

  const pendingInvitations = invitations.filter(
    (inv) => inv.status === "pending",
  );

  // Format join date
  const formatDate = (dateStr: string): string => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("ru-RU", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
    } catch {
      return "";
    }
  };

  // Build nav items
  const navItems: { id: SubPage; label: string; emoji: string }[] = [
    { id: "members", label: "Участники", emoji: "👥" },
  ];
  if (canManageRolesCheck) {
    navItems.push({ id: "roles", label: "Роли", emoji: "🎭" });
  }
  if (canManageMembers(company.role)) {
    navItems.push({ id: "privacy", label: "Приватность", emoji: "🔒" });
  }

  // ——— Sub-page rendering ———
  if (subPage !== "main") {
    const subPageTitles: Record<SubPage, string> = {
      main: "",
      members: "Участники",
      roles: "Роли",
      privacy: "Приватность",
    };

    return (
      <div className="company-detail">
        {/* Sub-page Top Bar */}
        <div className="company-detail__topbar">
          <IconButton aria-label="Назад" onClick={() => setSubPage("main")}>
            <svg width="10" height="18" viewBox="0 0 10 18" fill="none">
              <path
                d="M9 1L1 9L9 17"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </IconButton>
          <div className="company-detail__topbar-title">
            <span>{subPageTitles[subPage]}</span>
          </div>
          <div style={{ width: 36 }} />
        </div>

        <div className="company-detail__content">
          {/* Members Sub-page */}
          {subPage === "members" && (
            <div className="company-detail__section">
              {canInvite(company.role) && (
                <button
                  className="company-detail__invite-btn"
                  onClick={() => setIsInviteModalOpen(true)}
                >
                  <span className="company-detail__invite-btn-icon">+</span>
                  <span>Пригласить участника</span>
                </button>
              )}

              {canManageMembers(company.role) &&
                pendingInvitations.length > 0 && (
                  <div className="company-detail__pending">
                    <span className="company-detail__section-title">
                      Ожидающие ({pendingInvitations.length})
                    </span>
                    {pendingInvitations.map((inv) => (
                      <Card
                        key={inv.id}
                        className="company-detail__member-card"
                      >
                        <div className="company-detail__member-row">
                          <div className="company-detail__member-avatar company-detail__member-avatar--invite">
                            📧
                          </div>
                          <div className="company-detail__member-info">
                            <span className="company-detail__member-name">
                              {inv.email}
                            </span>
                            <Tag
                              size="sm"
                              style={{
                                backgroundColor: inv.role
                                  ? `${getRoleColor(inv.role)}15`
                                  : undefined,
                                borderColor: inv.role
                                  ? getRoleColor(inv.role)
                                  : undefined,
                                color: inv.role
                                  ? getRoleColor(inv.role)
                                  : undefined,
                              }}
                            >
                              {getRoleName(inv.role)}
                            </Tag>
                          </div>
                          <button
                            className="company-detail__member-action company-detail__member-action--cancel"
                            onClick={() => onCancelInvitation(inv.id)}
                          >
                            ✕
                          </button>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}

              <span className="company-detail__section-title">
                Все участники ({members.length})
              </span>

              {isLoadingMembers ? (
                <div className="company-detail__loading">
                  <Loader />
                </div>
              ) : (
                <div className="company-detail__members-list">
                  {members.map((member) => (
                    <Card
                      key={member.id}
                      className={`company-detail__member-card ${
                        member.selected_card_id
                          ? "company-detail__member-card--clickable"
                          : ""
                      }`}
                      variant={
                        member.selected_card_id ? "interactive" : "default"
                      }
                      onClick={() => {
                        if (member.selected_card_id && onViewMemberCard) {
                          onViewMemberCard(
                            member.user.id,
                            member.selected_card_id,
                          );
                        }
                      }}
                    >
                      <div className="company-detail__member-row">
                        <Avatar
                          src={member.user.avatar_url || undefined}
                          initials={`${member.user.first_name.charAt(
                            0,
                          )}${member.user.last_name.charAt(0)}`}
                          size="md"
                        />
                        <div className="company-detail__member-info">
                          <span className="company-detail__member-name">
                            {member.user.first_name} {member.user.last_name}
                          </span>
                          <span className="company-detail__member-email">
                            {member.user.email}
                          </span>
                        </div>
                        <div className="company-detail__member-role">
                          <span
                            className="company-detail__member-role-dot"
                            style={{
                              backgroundColor: getRoleColor(member.role),
                            }}
                          />
                          <Tag
                            size="sm"
                            style={{
                              backgroundColor: member.role
                                ? `${getRoleColor(member.role)}15`
                                : undefined,
                              borderColor: member.role
                                ? getRoleColor(member.role)
                                : undefined,
                              color: member.role
                                ? getRoleColor(member.role)
                                : undefined,
                            }}
                          >
                            {isOwnerRole(member.role) && "👑 "}
                            {getRoleName(member.role)}
                          </Tag>
                        </div>
                      </div>

                      {canChangeRoles(company.role) &&
                        member.user.id !== currentUserId &&
                        !isOwnerRole(member.role) && (
                          <div
                            className="company-detail__member-controls"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <select
                              className="company-detail__member-select"
                              value={member.role?.id || ""}
                              onChange={(e) =>
                                onChangeRole(member.user.id, e.target.value)
                              }
                            >
                              {availableRoles
                                .filter((r) => !isOwnerRole(r))
                                .map((role) => (
                                  <option key={role.id} value={role.id}>
                                    {role.name}
                                  </option>
                                ))}
                            </select>
                            <button
                              className="company-detail__member-action company-detail__member-action--remove"
                              onClick={() => onRemoveMember(member.user.id)}
                              title="Удалить участника"
                            >
                              ✕
                            </button>
                          </div>
                        )}
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Roles Sub-page */}
          {subPage === "roles" && canManageRolesCheck && (
            <div className="company-detail__section">
              <RolesManager
                companyId={company.company.id}
                canManageRoles={canManageRolesCheck}
                onRolesChange={onRolesChange}
              />
            </div>
          )}

          {/* Privacy Sub-page */}
          {subPage === "privacy" && canManageMembers(company.role) && (
            <div className="company-detail__section">
              <Card className="company-detail__card">
                <span className="company-detail__card-label">
                  Информация о компании
                </span>
                <div className="company-detail__settings-rows">
                  <div className="company-detail__settings-row">
                    <span className="company-detail__settings-label">
                      Название
                    </span>
                    <span className="company-detail__settings-value">
                      {company.company.name}
                    </span>
                  </div>
                  <div className="company-detail__settings-row">
                    <span className="company-detail__settings-label">
                      Домен
                    </span>
                    <span className="company-detail__settings-value">
                      @{company.company.email_domain}
                    </span>
                  </div>
                  <div className="company-detail__settings-row">
                    <span className="company-detail__settings-label">
                      Описание
                    </span>
                    <span className="company-detail__settings-value">
                      {company.company.description || "—"}
                    </span>
                  </div>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setEditForm({
                      name: company.company.name,
                      description: company.company.description || "",
                    });
                    setIsEditModalOpen(true);
                  }}
                >
                  Редактировать
                </Button>
              </Card>

              {canDeleteCompany(company.role) && (
                <Card className="company-detail__card company-detail__card--danger">
                  <span className="company-detail__card-label company-detail__card-label--danger">
                    Опасная зона
                  </span>
                  <p className="company-detail__card-hint">
                    Удаление компании необратимо. Все данные будут потеряны.
                  </p>
                  <Button
                    variant="danger"
                    onClick={() => setIsDeleteModalOpen(true)}
                  >
                    Удалить компанию
                  </Button>
                </Card>
              )}
            </div>
          )}
        </div>

        {/* Modals also available in sub-pages */}
        <Modal
          isOpen={isInviteModalOpen}
          onClose={() => setIsInviteModalOpen(false)}
          title="Пригласить участника"
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
              <label>Роль для приглашаемого участника</label>
              <RoleSelect
                roles={availableRoles}
                selectedRoleId={inviteForm.roleId}
                onChange={(roleId) => setInviteForm({ ...inviteForm, roleId })}
                excludeOwner={true}
              />
            </div>
            <div className="form-actions">
              <Button
                variant="ghost"
                onClick={() => setIsInviteModalOpen(false)}
              >
                Отмена
              </Button>
              <Button
                onClick={handleInvite}
                disabled={isSaving || !inviteForm.email.trim()}
              >
                {isSaving ? "Отправка..." : "Отправить"}
              </Button>
            </div>
          </div>
        </Modal>

        <Modal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title="Редактировать компанию"
        >
          <div className="edit-company-form">
            <Input
              label="Название компании"
              value={editForm.name}
              onChange={(e) =>
                setEditForm({ ...editForm, name: e.target.value })
              }
            />
            <Input
              label="Описание"
              value={editForm.description}
              onChange={(e) =>
                setEditForm({ ...editForm, description: e.target.value })
              }
            />
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

        <Modal
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          title="Удалить компанию"
        >
          <div className="delete-confirm">
            <Typography variant="body">
              Вы уверены, что хотите удалить компанию{" "}
              <strong>{company.company.name}</strong>?
            </Typography>
            <Typography variant="small" color="secondary">
              Это действие необратимо. Все участники будут удалены из компании.
            </Typography>
            <div className="form-actions">
              <Button
                variant="ghost"
                onClick={() => setIsDeleteModalOpen(false)}
              >
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

  // ——— Main page ———
  return (
    <div className="company-detail">
      {/* Top Bar */}
      <div className="company-detail__topbar">
        <IconButton aria-label="Назад" onClick={onBack}>
          <svg width="10" height="18" viewBox="0 0 10 18" fill="none">
            <path
              d="M9 1L1 9L9 17"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </IconButton>
        <div className="company-detail__topbar-title">
          <span>{company.company.name}</span>
        </div>
        {canManageMembers(company.role) ? (
          <IconButton
            aria-label="Настройки"
            onClick={() => {
              setEditForm({
                name: company.company.name,
                description: company.company.description || "",
              });
              setIsEditModalOpen(true);
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
            </svg>
          </IconButton>
        ) : (
          <div style={{ width: 36 }} />
        )}
      </div>

      {/* Content */}
      <div className="company-detail__content">
        {/* Hero Block */}
        <div className="company-detail__hero">
          <div className="company-detail__hero-logo">
            {company.company.logo_url ? (
              <img src={company.company.logo_url} alt={company.company.name} />
            ) : (
              <span className="company-detail__hero-logo-letter">
                {company.company.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          <div className="company-detail__hero-info">
            <h1 className="company-detail__hero-name">
              {company.company.name}
            </h1>
            <div className="company-detail__hero-domain">
              @{company.company.email_domain}
            </div>
          </div>

          {/* Stats */}
          <div className="company-detail__hero-stats">
            <div className="company-detail__hero-stat company-detail__hero-stat--members">
              {members.length} Участников
            </div>
            <div
              className="company-detail__hero-stat company-detail__hero-stat--role"
              style={{
                backgroundColor: company.role
                  ? `${getRoleColor(company.role)}15`
                  : undefined,
                borderColor: company.role
                  ? `${getRoleColor(company.role)}30`
                  : undefined,
                color: company.role ? getRoleColor(company.role) : undefined,
              }}
            >
              {isOwnerRole(company.role) && "👑 "}
              {getRoleName(company.role)}
            </div>
          </div>
        </div>

        {/* Info Cards */}
        <div className="company-detail__cards">
          {/* Description */}
          {company.company.description && (
            <Card className="company-detail__card">
              <span className="company-detail__card-label">О компании</span>
              <p className="company-detail__card-text">
                {company.company.description}
              </p>
            </Card>
          )}

          {/* Domain card */}
          <Card className="company-detail__card">
            <div className="company-detail__card-row">
              <div className="company-detail__card-content">
                <span className="company-detail__card-label">Домен</span>
                <span className="company-detail__card-value">
                  @{company.company.email_domain}
                </span>
              </div>
              <span className="company-detail__card-icon">🌐</span>
            </div>
          </Card>

          {/* Join date */}
          <Card className="company-detail__card">
            <span className="company-detail__card-label">Дата вступления</span>
            <span className="company-detail__card-value">
              {formatDate(company.joined_at)}
            </span>
          </Card>

          {/* My business card in company */}
          {userCards.length > 0 && (
            <Card
              className="company-detail__card"
              variant="interactive"
              onClick={() => setIsCardSelectModalOpen(true)}
            >
              <div className="company-detail__card-row">
                <div className="company-detail__card-content">
                  <span className="company-detail__card-label">
                    Моя визитка
                  </span>
                  <span className="company-detail__card-value">
                    {selectedCard ? `📇 ${selectedCard.title}` : "Не выбрана"}
                  </span>
                </div>
                <span className="company-detail__card-chevron">›</span>
              </div>
            </Card>
          )}

          {/* Role & permissions card */}
          <Card className="company-detail__card">
            <span className="company-detail__card-label">Ваша роль</span>
            <div className="company-detail__role-badge">
              <span
                className="company-detail__role-dot"
                style={{ backgroundColor: getRoleColor(company.role) }}
              />
              <span className="company-detail__role-name">
                {isOwnerRole(company.role) && "👑 "}
                {getRoleName(company.role)}
              </span>
            </div>
            <div className="company-detail__permissions">
              {canInvite(company.role) && (
                <span className="company-detail__perm-tag company-detail__perm-tag--active">
                  ✓ Приглашения
                </span>
              )}
              {canManageMembers(company.role) && (
                <span className="company-detail__perm-tag company-detail__perm-tag--active">
                  ✓ Управление
                </span>
              )}
              {canDeleteCompany(company.role) && (
                <span className="company-detail__perm-tag company-detail__perm-tag--active">
                  ✓ Удаление
                </span>
              )}
              {!canInvite(company.role) && (
                <span className="company-detail__perm-tag">
                  Только просмотр
                </span>
              )}
            </div>
          </Card>
        </div>

        {/* Navigation Buttons */}
        <div className="company-detail__nav-list">
          {navItems.map((item) => (
            <button
              key={item.id}
              className="company-detail__nav-item"
              onClick={() => setSubPage(item.id)}
            >
              <div className="company-detail__nav-item-icon">{item.emoji}</div>
              <span className="company-detail__nav-item-label">
                {item.label}
              </span>
              <svg
                className="company-detail__nav-item-arrow"
                width="8"
                height="14"
                viewBox="0 0 8 14"
                fill="none"
              >
                <path
                  d="M1 1L7 7L1 13"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          ))}
        </div>

        {/* Leave button */}
        {!canDeleteCompany(company.role) && (
          <button
            className="company-detail__leave-btn"
            onClick={onLeaveCompany}
          >
            Покинуть компанию
          </button>
        )}
      </div>

      {/* ——— MODALS ——— */}

      {/* Invite Modal */}
      <Modal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        title="Пригласить участника"
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
            <label>Роль для приглашаемого участника</label>
            <RoleSelect
              roles={availableRoles}
              selectedRoleId={inviteForm.roleId}
              onChange={(roleId) => setInviteForm({ ...inviteForm, roleId })}
              excludeOwner={true}
            />
          </div>
          <div className="form-actions">
            <Button variant="ghost" onClick={() => setIsInviteModalOpen(false)}>
              Отмена
            </Button>
            <Button
              onClick={handleInvite}
              disabled={isSaving || !inviteForm.email.trim()}
            >
              {isSaving ? "Отправка..." : "Отправить"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Редактировать компанию"
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

      {/* Delete Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Удалить компанию"
      >
        <div className="delete-confirm">
          <Typography variant="body">
            Вы уверены, что хотите удалить компанию{" "}
            <strong>{company.company.name}</strong>?
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

      {/* Card Select Modal */}
      <Modal
        isOpen={isCardSelectModalOpen}
        onClose={() => setIsCardSelectModalOpen(false)}
        title="Выберите визитку"
      >
        <div className="card-select-modal" style={{ padding: "20px" }}>
          <Typography variant="body" color="secondary">
            Выберите визитку, которую будут видеть участники компании{" "}
            <strong>{company.company.name}</strong>
          </Typography>
          <div className="card-select-modal__list">
            {userCards.map((card) => (
              <button
                key={card.id}
                className={`card-select-modal__item ${
                  selectedCardId === card.id
                    ? "card-select-modal__item--selected"
                    : ""
                }`}
                onClick={() => handleSelectCard(card.id)}
                disabled={isSelectingCard}
              >
                <div className="card-select-modal__item-icon">📇</div>
                <div className="card-select-modal__item-info">
                  <span className="card-select-modal__item-title">
                    {card.title}
                    {card.is_primary && (
                      <span className="card-select-modal__item-badge">★</span>
                    )}
                  </span>
                  <span className="card-select-modal__item-bio">
                    {card.ai_generated_bio || card.bio || "Без описания"}
                  </span>
                </div>
                {selectedCardId === card.id && (
                  <span className="card-select-modal__item-check">✓</span>
                )}
              </button>
            ))}
          </div>
          {selectedCardId && (
            <button
              className="card-select-modal__clear"
              onClick={() => handleSelectCard(null)}
              disabled={isSelectingCard}
            >
              Снять выбор
            </button>
          )}
        </div>
      </Modal>
    </div>
  );
}
