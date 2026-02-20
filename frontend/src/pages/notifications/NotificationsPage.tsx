import { useState, useEffect, useCallback } from "react";
import {
  type InvitationWithCompany,
  companyApi,
  getRoleName,
} from "@/entities/company";
import { type UserNotification, userApi } from "@/entities/user";
import { useAuth } from "@/features/auth";
import { IconButton, Loader, Button } from "@/shared";
import "./NotificationsPage.scss";

interface NotificationsPageProps {
  onBack?: () => void;
}

export function NotificationsPage({ onBack }: NotificationsPageProps) {
  const { user: authUser } = useAuth();
  const [invitations, setInvitations] = useState<InvitationWithCompany[]>([]);
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{
    message: string;
    type: "error" | "success";
  } | null>(null);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [invData, notifData] = await Promise.all([
        companyApi
          .getMyInvitations()
          .catch(() => [] as InvitationWithCompany[]),
        authUser?.id
          ? userApi
              .getNotifications(authUser.id)
              .catch(() => [] as UserNotification[])
          : Promise.resolve([] as UserNotification[]),
      ]);
      setInvitations(invData);
      setNotifications(notifData);
    } catch (err) {
      console.error("Failed to load notifications:", err);
    } finally {
      setIsLoading(false);
    }
  }, [authUser?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Отмечаем все уведомления как прочитанные при входе на страницу
  useEffect(() => {
    if (authUser?.id && notifications.some((n) => !n.is_read)) {
      userApi.markAllNotificationsRead(authUser.id).catch(() => {});
    }
  }, [authUser?.id, notifications]);

  const handleAccept = async (inv: InvitationWithCompany) => {
    setProcessingIds((prev) => new Set(prev).add(inv.id));
    try {
      await companyApi.acceptInvitation({ token: inv.token });
      setInvitations((prev) => prev.filter((i) => i.id !== inv.id));
      setToast({
        message: `Вы присоединились к «${inv.company.name}»`,
        type: "success",
      });
    } catch {
      setToast({ message: "Не удалось принять приглашение", type: "error" });
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(inv.id);
        return next;
      });
    }
  };

  const handleDecline = async (inv: InvitationWithCompany) => {
    setProcessingIds((prev) => new Set(prev).add(inv.id));
    try {
      await companyApi.declineInvitation({ token: inv.token });
      setInvitations((prev) => prev.filter((i) => i.id !== inv.id));
      setToast({ message: "Приглашение отклонено", type: "success" });
    } catch {
      setToast({ message: "Не удалось отклонить приглашение", type: "error" });
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(inv.id);
        return next;
      });
    }
  };

  const formatDate = (dateStr: string) => {
    // Бэкенд отдаёт UTC без суффикса Z — добавляем его для корректного парсинга
    const normalized = dateStr.endsWith("Z") ? dateStr : dateStr + "Z";
    const date = new Date(normalized);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return "только что";
    if (diffMin < 60) return `${diffMin} мин назад`;
    if (diffHours < 24) return `${diffHours} ч назад`;
    if (diffDays < 7) return `${diffDays} дн назад`;
    return date.toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "short",
    });
  };

  const hasContent = invitations.length > 0 || notifications.length > 0;

  return (
    <div className="notifications-page">
      {/* Header */}
      <header className="notifications-page__header">
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
        <div className="notifications-page__title-container">
          <h1 className="notifications-page__title">Уведомления</h1>
        </div>
        <div style={{ width: 36 }} />
      </header>

      {/* Toast */}
      {toast && (
        <div
          className={`notifications-page__toast notifications-page__toast--${toast.type}`}
          onClick={() => setToast(null)}
        >
          <span className="notifications-page__toast-icon">
            {toast.type === "error" ? "⚠️" : "✓"}
          </span>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="notifications-page__loading">
          <Loader />
        </div>
      ) : !hasContent ? (
        <div className="notifications-page__empty">
          <div className="notifications-page__empty-icon">🔔</div>
          <p className="notifications-page__empty-title">Нет уведомлений</p>
          <p className="notifications-page__empty-desc">
            Здесь будут появляться приглашения в компании и другие уведомления
          </p>
        </div>
      ) : (
        <div className="notifications-page__list">
          {/* Уведомления о добавлении в контакты */}
          {notifications.map((notif) => (
            <div
              key={notif.id}
              className={`notifications-page__card${!notif.is_read ? " notifications-page__card--unread" : ""}`}
            >
              <div className="notifications-page__card-avatar">
                {notif.actor_avatar_url ? (
                  <img
                    src={notif.actor_avatar_url}
                    alt={notif.actor_name || ""}
                    className="notifications-page__card-avatar-img"
                  />
                ) : (
                  <span className="notifications-page__card-avatar-placeholder">
                    {notif.actor_name
                      ? notif.actor_name
                          .split(" ")
                          .map((w) => w[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2)
                      : "?"}
                  </span>
                )}
              </div>
              <div className="notifications-page__card-body">
                <div className="notifications-page__card-top">
                  <span className="notifications-page__card-title">
                    {notif.title}
                  </span>
                  <span className="notifications-page__card-time">
                    {formatDate(notif.created_at)}
                  </span>
                </div>
                <p className="notifications-page__card-text">{notif.message}</p>
              </div>
            </div>
          ))}

          {/* Приглашения в компании */}
          {invitations.map((inv) => {
            const isProcessing = processingIds.has(inv.id);
            return (
              <div key={inv.id} className="notifications-page__card">
                <div className="notifications-page__card-icon">🏢</div>
                <div className="notifications-page__card-body">
                  <div className="notifications-page__card-top">
                    <span className="notifications-page__card-title">
                      Приглашение в компанию
                    </span>
                    <span className="notifications-page__card-time">
                      {formatDate(inv.created_at)}
                    </span>
                  </div>
                  <p className="notifications-page__card-text">
                    <strong>{inv.company.name}</strong>
                    {inv.invited_by && (
                      <>
                        {" "}
                        · от {inv.invited_by.first_name}{" "}
                        {inv.invited_by.last_name}
                      </>
                    )}
                  </p>
                  <span className="notifications-page__card-role">
                    Роль: {getRoleName(inv.role)}
                  </span>
                  <div className="notifications-page__card-actions">
                    <Button
                      size="sm"
                      onClick={() => handleAccept(inv)}
                      disabled={isProcessing}
                    >
                      Принять
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDecline(inv)}
                      disabled={isProcessing}
                    >
                      Отклонить
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
