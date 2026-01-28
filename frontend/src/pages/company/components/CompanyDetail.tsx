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
  Button,
  Modal,
  Input,
  Loader,
} from "@/shared";
import { RoleSelect } from "./RoleSelect";
import { RolesManager } from "./RolesManager";
import "./CompanyDetail.scss";

type SidebarTab = "members" | "roles" | "settings";

interface CompanyDetailProps {
  company: CompanyWithRole;
  members: CompanyMember[];
  invitations: CompanyInvitation[];
  isLoadingMembers: boolean;
  isLoadingInvitations: boolean;
  currentUserId?: string;
  // Визитки для выбора
  userCards?: BusinessCard[];
  selectedCardId?: string | null;
  onSelectCard?: (cardId: string | null) => Promise<void>;
  // Просмотр визитки участника
  onViewMemberCard?: (userId: string, cardId: string) => void;
  // Доступные роли в компании
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
    allow_auto_join: boolean;
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
  // isLoadingInvitations используется для отображения загрузки приглашений
  void isLoadingInvitations;
  const [activeTab, setActiveTab] = useState<SidebarTab>("members");
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isCardSelectModalOpen, setIsCardSelectModalOpen] = useState(false);
  const [isSelectingCard, setIsSelectingCard] = useState(false);

  // Проверка права на управление ролями
  const canManageRolesCheck = canChangeRoles(company.role);

  // Находим роль Member по умолчанию для приглашений
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
    allow_auto_join: company.company.allow_auto_join,
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

  return (
    <div className="company-detail">
      {/* Sidebar */}
      <aside className="company-detail__sidebar">
        <button className="company-detail__back" onClick={onBack}>
          <span>←</span>
          <span>Все компании</span>
        </button>

        <div className="company-detail__sidebar-header">
          <div className="company-detail__sidebar-logo">
            {company.company.logo_url ? (
              <img src={company.company.logo_url} alt={company.company.name} />
            ) : (
              <span>{company.company.name.charAt(0).toUpperCase()}</span>
            )}
          </div>
          <div className="company-detail__sidebar-info">
            <Typography variant="h3">{company.company.name}</Typography>
            <Typography variant="small" color="secondary">
              @{company.company.email_domain}
            </Typography>
          </div>
        </div>

        {/* Блок с ролью и правами */}
        <div className="company-detail__role-info">
          <div
            className="company-detail__role-badge"
            style={{
              backgroundColor: company.role
                ? `${getRoleColor(company.role)}15`
                : undefined,
              borderColor: company.role
                ? getRoleColor(company.role)
                : undefined,
            }}
          >
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
              <span className="company-detail__perm-item company-detail__perm-item--active">
                ✓ Приглашения
              </span>
            )}
            {canManageMembers(company.role) && (
              <span className="company-detail__perm-item company-detail__perm-item--active">
                ✓ Управление
              </span>
            )}
            {canDeleteCompany(company.role) && (
              <span className="company-detail__perm-item company-detail__perm-item--active">
                ✓ Удаление
              </span>
            )}
            {!canInvite(company.role) && (
              <span className="company-detail__perm-item">Только просмотр</span>
            )}
          </div>
        </div>

        <nav className="company-detail__nav">
          <button
            className={`company-detail__nav-item ${
              activeTab === "members" ? "company-detail__nav-item--active" : ""
            }`}
            onClick={() => setActiveTab("members")}
          >
            <span className="company-detail__nav-icon">👥</span>
            <span>Участники</span>
            <span className="company-detail__nav-count">{members.length}</span>
          </button>

          {canManageRolesCheck && (
            <button
              className={`company-detail__nav-item ${
                activeTab === "roles" ? "company-detail__nav-item--active" : ""
              }`}
              onClick={() => setActiveTab("roles")}
            >
              <span className="company-detail__nav-icon">🎭</span>
              <span>Роли</span>
            </button>
          )}

          {canManageMembers(company.role) && (
            <button
              className={`company-detail__nav-item ${
                activeTab === "settings"
                  ? "company-detail__nav-item--active"
                  : ""
              }`}
              onClick={() => setActiveTab("settings")}
            >
              <span className="company-detail__nav-icon">⚙️</span>
              <span>Настройки</span>
            </button>
          )}
        </nav>

        <div className="company-detail__sidebar-footer">
          {!canDeleteCompany(company.role) && (
            <button
              className="company-detail__leave-btn"
              onClick={onLeaveCompany}
            >
              Покинуть компанию
            </button>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="company-detail__main">
        {activeTab === "members" && (
          <div className="company-detail__members">
            {/* Моя визитка в компании */}
            {userCards.length > 0 && (
              <div className="company-detail__my-card">
                <div className="company-detail__my-card-header">
                  <Typography variant="h3">Моя визитка</Typography>
                  <Typography variant="small" color="secondary">
                    Визитка, которую увидят участники компании
                  </Typography>
                </div>
                <button
                  className="company-detail__my-card-btn"
                  onClick={() => setIsCardSelectModalOpen(true)}
                >
                  {selectedCard ? (
                    <>
                      <span className="company-detail__my-card-icon">📇</span>
                      <div className="company-detail__my-card-info">
                        <span className="company-detail__my-card-title">
                          {selectedCard.title}
                        </span>
                        <span className="company-detail__my-card-subtitle">
                          {selectedCard.display_name}
                        </span>
                      </div>
                      <span className="company-detail__my-card-action">
                        Изменить
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="company-detail__my-card-icon">➕</span>
                      <span className="company-detail__my-card-placeholder">
                        Выбрать визитку для отображения
                      </span>
                    </>
                  )}
                </button>
              </div>
            )}

            <div className="company-detail__members-header">
              <Typography variant="h2">Участники компании</Typography>
              {canInvite(company.role) && (
                <Button onClick={() => setIsInviteModalOpen(true)}>
                  + Пригласить
                </Button>
              )}
            </div>

            {/* Pending invitations */}
            {canManageMembers(company.role) &&
              pendingInvitations.length > 0 && (
                <div className="company-detail__invitations">
                  <Typography variant="h3">
                    Ожидающие приглашения ({pendingInvitations.length})
                  </Typography>
                  <div className="company-detail__invitations-list">
                    {pendingInvitations.map((inv) => (
                      <div key={inv.id} className="invitation-item">
                        <div className="invitation-item__icon">📧</div>
                        <div className="invitation-item__info">
                          <Typography variant="body">{inv.email}</Typography>
                          <div className="invitation-item__role">
                            <span
                              className="invitation-item__role-dot"
                              style={{
                                backgroundColor: getRoleColor(inv.role),
                              }}
                            />
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
                        </div>
                        <button
                          className="invitation-item__cancel"
                          onClick={() => onCancelInvitation(inv.id)}
                        >
                          Отменить
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            {/* Members list */}
            {isLoadingMembers ? (
              <div className="company-detail__loading">
                <Loader />
              </div>
            ) : (
              <div className="company-detail__members-list">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className={`member-card ${
                      member.selected_card_id ? "member-card--has-card" : ""
                    }`}
                    onClick={() => {
                      if (member.selected_card_id && onViewMemberCard) {
                        onViewMemberCard(
                          member.user.id,
                          member.selected_card_id,
                        );
                      }
                    }}
                    style={{
                      cursor: member.selected_card_id ? "pointer" : "default",
                    }}
                  >
                    <Avatar
                      src={member.user.avatar_url || undefined}
                      initials={`${member.user.first_name.charAt(
                        0,
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
                      {member.selected_card_id && (
                        <span className="member-card__card-hint">
                          📇 Нажмите, чтобы посмотреть визитку
                        </span>
                      )}
                    </div>
                    <div className="member-card__role-badge">
                      <span
                        className="member-card__role-dot"
                        style={{ backgroundColor: getRoleColor(member.role) }}
                      />
                      <Tag
                        size="sm"
                        variant={
                          isOwnerRole(member.role) ? "outline" : "default"
                        }
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
                    {canChangeRoles(company.role) &&
                      member.user.id !== currentUserId &&
                      !isOwnerRole(member.role) && (
                        <div
                          className="member-card__actions"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <select
                            className="member-card__role-select"
                            value={member.role?.id || ""}
                            onChange={(e) =>
                              onChangeRole(member.user.id, e.target.value)
                            }
                            style={{
                              borderColor: getRoleColor(member.role),
                            }}
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
                            className="member-card__remove"
                            onClick={() => onRemoveMember(member.user.id)}
                            title="Удалить участника"
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

        {activeTab === "roles" && canManageRolesCheck && (
          <div className="company-detail__roles">
            <RolesManager
              companyId={company.company.id}
              canManageRoles={canManageRolesCheck}
              onRolesChange={onRolesChange}
            />
          </div>
        )}

        {activeTab === "settings" && canManageMembers(company.role) && (
          <div className="company-detail__settings">
            <Typography variant="h2">Настройки компании</Typography>

            <div className="settings-section">
              <Typography variant="h3">Информация о компании</Typography>
              <div className="settings-info">
                <div className="settings-info__row">
                  <Typography variant="small" color="secondary">
                    Название
                  </Typography>
                  <Typography variant="body">{company.company.name}</Typography>
                </div>
                <div className="settings-info__row">
                  <Typography variant="small" color="secondary">
                    Домен
                  </Typography>
                  <Typography variant="body">
                    @{company.company.email_domain}
                  </Typography>
                </div>
                <div className="settings-info__row">
                  <Typography variant="small" color="secondary">
                    Описание
                  </Typography>
                  <Typography variant="body">
                    {company.company.description || "—"}
                  </Typography>
                </div>
                <div className="settings-info__row">
                  <Typography variant="small" color="secondary">
                    Авто-вступление
                  </Typography>
                  <Typography variant="body">
                    {company.company.allow_auto_join ? "Включено" : "Выключено"}
                  </Typography>
                </div>
              </div>
              <Button
                variant="secondary"
                onClick={() => {
                  setEditForm({
                    name: company.company.name,
                    description: company.company.description || "",
                    allow_auto_join: company.company.allow_auto_join,
                  });
                  setIsEditModalOpen(true);
                }}
              >
                Редактировать
              </Button>
            </div>

            {canDeleteCompany(company.role) && (
              <div className="settings-section settings-section--danger">
                <Typography variant="h3">Опасная зона</Typography>
                <Typography variant="small" color="secondary">
                  Удаление компании необратимо. Все данные будут потеряны.
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
      </main>

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
        <div className="card-select-modal">
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
