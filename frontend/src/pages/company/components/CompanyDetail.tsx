import { useState } from "react";
import type {
  CompanyWithRole,
  CompanyMember,
  CompanyInvitation,
  CompanyRole,
} from "@/entities/company";
import type { BusinessCard } from "@/entities/business-card";
import {
  roleLabels,
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
import "./CompanyDetail.scss";

type SidebarTab = "members" | "settings";

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
  onBack: () => void;
  onInvite: (email: string, role: CompanyRole) => Promise<void>;
  onCancelInvitation: (invitationId: string) => Promise<void>;
  onChangeRole: (userId: string, newRole: CompanyRole) => Promise<void>;
  onRemoveMember: (userId: string) => Promise<void>;
  onLeaveCompany: () => Promise<void>;
  onUpdateCompany: (data: {
    name: string;
    description: string;
    allow_auto_join: boolean;
  }) => Promise<void>;
  onDeleteCompany: () => Promise<void>;
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
  onBack,
  onInvite,
  onCancelInvitation,
  onChangeRole,
  onRemoveMember,
  onLeaveCompany,
  onUpdateCompany,
  onDeleteCompany,
}: CompanyDetailProps) {
  // isLoadingInvitations используется для отображения загрузки приглашений
  void isLoadingInvitations;
  const [activeTab, setActiveTab] = useState<SidebarTab>("members");
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isCardSelectModalOpen, setIsCardSelectModalOpen] = useState(false);
  const [isSelectingCard, setIsSelectingCard] = useState(false);

  const [inviteForm, setInviteForm] = useState({
    email: "",
    role: "member" as CompanyRole,
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
      await onInvite(inviteForm.email, inviteForm.role);
      setInviteForm({ email: "", role: "member" });
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
    (inv) => inv.status === "pending"
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

        {/* Секция выбора визитки */}
        {userCards.length > 0 && (
          <div className="company-detail__card-select">
            <Typography variant="small" color="secondary">
              Моя визитка в компании:
            </Typography>
            <button
              className="company-detail__card-btn"
              onClick={() => setIsCardSelectModalOpen(true)}
            >
              {selectedCard ? (
                <>
                  <span className="company-detail__card-icon">📇</span>
                  <span className="company-detail__card-name">
                    {selectedCard.title}
                  </span>
                </>
              ) : (
                <>
                  <span className="company-detail__card-icon">➕</span>
                  <span className="company-detail__card-name">
                    Выбрать визитку
                  </span>
                </>
              )}
              <span className="company-detail__card-arrow">›</span>
            </button>
          </div>
        )}

        <div className="company-detail__sidebar-footer">
          <Tag
            size="sm"
            variant={company.role === "owner" ? "outline" : "default"}
          >
            {roleLabels[company.role]}
          </Tag>
          {!canDeleteCompany(company.role) && (
            <button
              className="company-detail__leave-btn"
              onClick={onLeaveCompany}
            >
              Покинуть
            </button>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="company-detail__main">
        {activeTab === "members" && (
          <div className="company-detail__members">
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
                          <Tag size="sm">{roleLabels[inv.role]}</Tag>
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
                      variant={member.role === "owner" ? "outline" : "default"}
                    >
                      {roleLabels[member.role]}
                    </Tag>
                    {canChangeRoles(company.role) &&
                      member.user.id !== currentUserId &&
                      member.role !== "owner" && (
                        <div className="member-card__actions">
                          <select
                            value={member.role}
                            onChange={(e) =>
                              onChangeRole(
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
                            onClick={() => onRemoveMember(member.user.id)}
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

      {/* Delete Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Удалить компанию"
        size="sm"
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
        size="md"
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
