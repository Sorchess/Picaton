import type { ReactNode } from "react";
import type { Conversation, DirectMessage } from "@/entities/direct-chat";
import {
  getParticipantInitials,
  getParticipantName,
} from "@/entities/direct-chat";
import { Avatar, Modal } from "@/shared";
import { useI18n } from "@/shared/config";
import type { MessageActionsController } from "../hooks/useMessageActions";

interface MessageActionsProps {
  controller: MessageActionsController;
  visibleMessages: DirectMessage[];
  conversations: Conversation[];
  currentUserId?: string;
  onReplyMessage: (msg: DirectMessage) => void;
  onStartMultiSelect: (msg: DirectMessage) => void;
  onForwardComplete: (targetConversationId: string) => void;
}

interface MenuActionButtonProps {
  label: string;
  onClick: () => void;
  icon: ReactNode;
  danger?: boolean;
}

function MenuActionButton({
  label,
  onClick,
  icon,
  danger = false,
}: MenuActionButtonProps) {
  return (
    <button
      type="button"
      className={`chats-page__message-menu-item ${danger ? "chats-page__message-menu-item--danger" : ""}`}
      onClick={onClick}
    >
      <span
        className="chats-page__message-menu-icon"
        style={{ marginRight: "5px" }}
      >
        {icon}
      </span>
      <span>{label}</span>
    </button>
  );
}

export function MessageActions({
  controller,
  visibleMessages,
  conversations,
  currentUserId,
  onReplyMessage,
  onStartMultiSelect,
  onForwardComplete,
}: MessageActionsProps) {
  const { t } = useI18n();

  const handleConfirmForward = () => {
    const targetConversationId = controller.forwardTargetId;
    controller.handleConfirmForward();
    if (targetConversationId) {
      onForwardComplete(targetConversationId);
    }
  };

  return (
    <>
      {controller.actionMenu && (
        <div
          ref={controller.menuRef}
          className="chats-page__message-menu"
          style={{
            top: controller.actionMenu.top,
            left: controller.actionMenu.left,
          }}
        >
          {(() => {
            const msg = visibleMessages.find(
              (m) => m.id === controller.actionMenu?.messageId,
            );
            if (!msg) return null;
            const isOwn = msg.sender_id === currentUserId;
            const canForward = !msg.id.startsWith("temp-");

            return (
              <>
                <MenuActionButton
                  label={t("chats.copy")}
                  onClick={() => controller.handleCopyMessage(msg)}
                  icon={
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M9 9H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-3"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M9 15h9a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2h-9a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2Z"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  }
                />
                <MenuActionButton
                  label={t("chats.replyAction")}
                  onClick={() => onReplyMessage(msg)}
                  icon={
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M10 8L4 12L10 16"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M20 12H4"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                    </svg>
                  }
                />
                <MenuActionButton
                  label={t("chats.select")}
                  onClick={() => onStartMultiSelect(msg)}
                  icon={
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M4 7h11M4 12h11M4 17h7"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                      <path
                        d="M18 16.5l1.7 1.7L23 15"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  }
                />
                {canForward && (
                  <MenuActionButton
                    label={t("chats.forwardAction")}
                    onClick={() => controller.handleForwardMessage(msg)}
                    icon={
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <path
                          d="M22 2L11 13"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                        />
                        <path
                          d="M22 2L15 22L11 13L2 9L22 2Z"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    }
                  />
                )}
                {isOwn && (
                  <MenuActionButton
                    label={t("chats.edit")}
                    onClick={() => controller.handleStartEdit(msg)}
                    icon={
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <path
                          d="M12 20h9"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                        />
                        <path
                          d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    }
                  />
                )}
                <MenuActionButton
                  label={t("chats.deleteAction")}
                  onClick={() => controller.openDeleteDialog(msg)}
                  danger
                  icon={
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M3 6h18"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                      <path
                        d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                      <path
                        d="M19 6l-1 14a1 1 0 0 1-1 .9H7a1 1 0 0 1-1-.9L5 6"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                    </svg>
                  }
                />
              </>
            );
          })()}
        </div>
      )}

      <Modal
        isOpen={Boolean(controller.deleteTarget) && !controller.isForwardOpen}
        onClose={() => controller.setDeleteTarget(null)}
      >
        <div className="chats-page__modal">
          <h3 className="chats-page__modal-title">
            {t("chats.deleteMessage")}
          </h3>
          <p className="chats-page__modal-text">
            {t("chats.chooseDeleteSingle")}
          </p>
          <div className="chats-page__modal-actions">
            <button
              type="button"
              className="chats-page__modal-btn"
              onClick={() => {
                if (controller.deleteTarget) {
                  void controller.handleDeleteForMe(controller.deleteTarget);
                }
              }}
            >
              {t("chats.deleteForMe")}
            </button>
            {controller.deleteTarget?.sender_id === currentUserId && (
              <button
                type="button"
                className="chats-page__modal-btn chats-page__modal-btn--danger"
                onClick={() => {
                  if (controller.deleteTarget) {
                    controller.handleDeleteForEveryone(controller.deleteTarget);
                  }
                }}
              >
                {t("chats.deleteForEveryone")}
              </button>
            )}
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={controller.isForwardOpen}
        onClose={controller.closeForwardModal}
      >
        <div className="chats-page__modal">
          <h3 className="chats-page__modal-title">
            {t("chats.forwardMessage")}
          </h3>
          <p className="chats-page__modal-text">
            {t("chats.chooseForwardDialog")}
          </p>
          <div className="chats-page__forward-list">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                type="button"
                className={`chats-page__forward-item ${
                  controller.forwardTargetId === conv.id
                    ? "chats-page__forward-item--active"
                    : ""
                }`}
                onClick={() => controller.setForwardTargetId(conv.id)}
              >
                <Avatar
                  src={conv.participant.avatar_url || undefined}
                  initials={getParticipantInitials(conv.participant)}
                  size="sm"
                />
                <span className="chats-page__forward-name">
                  {getParticipantName(conv.participant)}
                </span>
              </button>
            ))}
          </div>
          <div className="chats-page__modal-actions">
            <button
              type="button"
              className="chats-page__modal-btn"
              onClick={controller.closeForwardModal}
            >
              {t("chats.cancel")}
            </button>
            <button
              type="button"
              className="chats-page__modal-btn chats-page__modal-btn--primary"
              onClick={handleConfirmForward}
              disabled={!controller.forwardTargetId}
            >
              {t("chats.forwardAction")}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
