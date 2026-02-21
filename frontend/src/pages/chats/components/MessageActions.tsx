import type { Conversation, DirectMessage } from "@/entities/direct-chat";
import { getParticipantInitials, getParticipantName } from "@/entities/direct-chat";
import { Avatar, Modal } from "@/shared";
import type { MessageActionsController } from "../hooks/useMessageActions";

interface MessageActionsProps {
  controller: MessageActionsController;
  visibleMessages: DirectMessage[];
  conversations: Conversation[];
  currentUserId?: string;
}

export function MessageActions({
  controller,
  visibleMessages,
  conversations,
  currentUserId,
}: MessageActionsProps) {
  return (
    <>
      {controller.actionMenu && (
        <div
          ref={controller.menuRef}
          className="chats-page__message-menu"
          style={{ top: controller.actionMenu.top, left: controller.actionMenu.left }}
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
                <button
                  type="button"
                  className="chats-page__message-menu-item"
                  onClick={() => controller.handleCopyMessage(msg)}
                >
                  Скопировать
                </button>
                {canForward && (
                  <button
                    type="button"
                    className="chats-page__message-menu-item"
                    onClick={() => controller.handleForwardMessage(msg)}
                  >
                    Переслать
                  </button>
                )}
                {isOwn && (
                  <button
                    type="button"
                    className="chats-page__message-menu-item"
                    onClick={() => controller.handleStartEdit(msg)}
                  >
                    Изменить
                  </button>
                )}
                <button
                  type="button"
                  className="chats-page__message-menu-item"
                  onClick={() => controller.openDeleteDialog(msg)}
                >
                  Удалить
                </button>
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
          <h3 className="chats-page__modal-title">Удалить сообщение?</h3>
          <p className="chats-page__modal-text">
            Выберите, как удалить это сообщение.
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
              Удалить у меня
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
                Удалить у всех
              </button>
            )}
          </div>
        </div>
      </Modal>

      <Modal isOpen={controller.isForwardOpen} onClose={controller.closeForwardModal}>
        <div className="chats-page__modal">
          <h3 className="chats-page__modal-title">Переслать сообщение</h3>
          <p className="chats-page__modal-text">
            Выберите диалог для пересылки.
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
              Отмена
            </button>
            <button
              type="button"
              className="chats-page__modal-btn chats-page__modal-btn--primary"
              onClick={controller.handleConfirmForward}
              disabled={!controller.forwardTargetId}
            >
              Переслать
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
