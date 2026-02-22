import type {
  Dispatch,
  MouseEvent as ReactMouseEvent,
  RefObject,
  SetStateAction,
  TouchEvent,
} from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { directChatApi } from "@/entities/direct-chat";
import type { DirectMessage, DMWebSocket } from "@/entities/direct-chat";

interface UseMessageActionsParams {
  activeConversationId: string | null;
  wsRef: RefObject<DMWebSocket | null>;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  setInputValue: (value: string) => void;
  setMessages: Dispatch<SetStateAction<DirectMessage[]>>;
  setLocallyHiddenMessageIds: Dispatch<SetStateAction<Set<string>>>;
}

export interface MessageActionsController {
  editingMessageId: string | null;
  actionMenu: { messageId: string; top: number; left: number } | null;
  deleteTarget: DirectMessage | null;
  forwardMessage: DirectMessage | null;
  isForwardOpen: boolean;
  forwardTargetId: string | null;
  menuRef: RefObject<HTMLDivElement | null>;
  closeActionMenu: () => void;
  openActionMenu: (e: ReactMouseEvent, msg: DirectMessage) => void;
  handleMessageTouchStart: (
    e: TouchEvent<HTMLDivElement>,
    msg: DirectMessage,
  ) => void;
  handleMessageTouchEnd: () => void;
  handleMessageTouchMove: (e: TouchEvent<HTMLDivElement>) => void;
  handleCopyMessage: (msg: DirectMessage) => Promise<void>;
  handleStartEdit: (msg: DirectMessage) => void;
  handleCancelEdit: () => void;
  openDeleteDialog: (msg: DirectMessage) => void;
  handleDeleteForMe: (msg: DirectMessage) => Promise<void>;
  handleDeleteForEveryone: (msg: DirectMessage) => void;
  handleForwardMessage: (msg: DirectMessage) => void;
  handleForwardMessages: (msgs: DirectMessage[]) => void;
  handleConfirmForward: () => void;
  setForwardTargetId: Dispatch<SetStateAction<string | null>>;
  closeForwardModal: () => void;
  setDeleteTarget: Dispatch<SetStateAction<DirectMessage | null>>;
  resetMessageActions: () => void;
}

export function useMessageActions({
  activeConversationId,
  wsRef,
  inputRef,
  setInputValue,
  setMessages,
  setLocallyHiddenMessageIds,
}: UseMessageActionsParams): MessageActionsController {
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [actionMenu, setActionMenu] = useState<{
    messageId: string;
    top: number;
    left: number;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DirectMessage | null>(null);
  const [forwardMessageIds, setForwardMessageIds] = useState<string[]>([]);
  const [isForwardOpen, setIsForwardOpen] = useState(false);
  const [forwardTargetId, setForwardTargetId] = useState<string | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);
  const touchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const closeActionMenu = useCallback(() => setActionMenu(null), []);

  const openActionMenuAt = useCallback(
    (leftSeed: number, topSeed: number, messageId: string) => {
      const menuWidth = 220;
      const menuHeight = 300;
      const padding = 12;
      let left = leftSeed;
      let top = topSeed;
      if (left + menuWidth > window.innerWidth - padding) {
        left = window.innerWidth - menuWidth - padding;
      }
      if (top + menuHeight > window.innerHeight - padding) {
        top = window.innerHeight - menuHeight - padding;
      }
      if (left < padding) left = padding;
      if (top < padding) top = padding;
      setActionMenu({ messageId, left, top });
    },
    [],
  );

  const openActionMenu = useCallback(
    (e: ReactMouseEvent, msg: DirectMessage) => {
      e.preventDefault();
      e.stopPropagation();
      openActionMenuAt(e.clientX, e.clientY, msg.id);
    },
    [openActionMenuAt],
  );

  const handleMessageTouchStart = useCallback(
    (e: TouchEvent<HTMLDivElement>, msg: DirectMessage) => {
      if (touchTimeoutRef.current) clearTimeout(touchTimeoutRef.current);
      const touch = e.touches[0];
      const rect = e.currentTarget.getBoundingClientRect();
      const x = touch?.clientX ?? rect.left + rect.width / 2;
      const y = touch?.clientY ?? rect.top + 16;
      touchStartRef.current = { x, y };
      touchTimeoutRef.current = setTimeout(() => {
        openActionMenuAt(x, y, msg.id);
      }, 500);
    },
    [openActionMenuAt],
  );

  const handleMessageTouchEnd = useCallback(() => {
    if (touchTimeoutRef.current) {
      clearTimeout(touchTimeoutRef.current);
      touchTimeoutRef.current = null;
    }
    touchStartRef.current = null;
  }, []);

  const handleMessageTouchMove = useCallback(
    (e: TouchEvent<HTMLDivElement>) => {
      if (!touchTimeoutRef.current || !touchStartRef.current) return;
      const touch = e.touches[0];
      if (!touch) return;
      const dx = Math.abs(touch.clientX - touchStartRef.current.x);
      const dy = Math.abs(touch.clientY - touchStartRef.current.y);
      // Ignore tiny finger jitter; cancel only on real drag/scroll.
      if (dx > 10 || dy > 10) {
        clearTimeout(touchTimeoutRef.current);
        touchTimeoutRef.current = null;
      }
    },
    [],
  );

  const handleCopyMessage = useCallback(
    async (msg: DirectMessage) => {
      closeActionMenu();
      const text = msg.content || "";
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
    },
    [closeActionMenu],
  );

  const handleStartEdit = useCallback(
    (msg: DirectMessage) => {
      closeActionMenu();
      setEditingMessageId(msg.id);
      setInputValue(msg.content || "");
      setTimeout(() => inputRef.current?.focus(), 0);
    },
    [closeActionMenu, inputRef, setInputValue],
  );

  const handleCancelEdit = useCallback(() => {
    setEditingMessageId(null);
    setInputValue("");
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [inputRef, setInputValue]);

  const openDeleteDialog = useCallback(
    (msg: DirectMessage) => {
      closeActionMenu();
      setDeleteTarget(msg);
    },
    [closeActionMenu],
  );

  const handleDeleteForMe = useCallback(
    async (msg: DirectMessage) => {
      closeActionMenu();
      if (!activeConversationId) return;
      try {
        await directChatApi.deleteMessage(activeConversationId, msg.id, true);
        setLocallyHiddenMessageIds((prev) => {
          const next = new Set(prev);
          next.add(msg.id);
          return next;
        });
      } catch (err) {
        console.error("Failed to delete message for me:", err);
      } finally {
        setDeleteTarget(null);
      }
    },
    [activeConversationId, closeActionMenu, setLocallyHiddenMessageIds],
  );

  const handleDeleteForEveryone = useCallback(
    (msg: DirectMessage) => {
      closeActionMenu();
      if (!activeConversationId) return;
      wsRef.current?.deleteMessage(activeConversationId, msg.id, false);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msg.id ? { ...m, is_deleted: true, content: "" } : m,
        ),
      );
      setDeleteTarget(null);
    },
    [activeConversationId, closeActionMenu, setMessages, wsRef],
  );

  const handleForwardMessage = useCallback(
    (msg: DirectMessage) => {
      closeActionMenu();
      setIsForwardOpen(true);
      setForwardTargetId(activeConversationId || null);
      setForwardMessageIds([msg.id]);
      setDeleteTarget(null);
    },
    [activeConversationId, closeActionMenu],
  );

  const handleForwardMessages = useCallback(
    (msgs: DirectMessage[]) => {
      const ids = msgs.map((m) => m.id).filter((id) => !id.startsWith("temp-"));
      if (ids.length === 0) return;
      closeActionMenu();
      setIsForwardOpen(true);
      setForwardTargetId(activeConversationId || null);
      setForwardMessageIds(ids);
      setDeleteTarget(null);
    },
    [activeConversationId, closeActionMenu],
  );

  const closeForwardModal = useCallback(() => {
    setIsForwardOpen(false);
    setForwardMessageIds([]);
  }, []);

  const handleConfirmForward = useCallback(() => {
    if (forwardMessageIds.length === 0 || !forwardTargetId) return;
    forwardMessageIds.forEach((messageId) => {
      wsRef.current?.forwardMessage(forwardTargetId, messageId);
    });
    closeForwardModal();
    setForwardTargetId(null);
  }, [closeForwardModal, forwardMessageIds, forwardTargetId, wsRef]);

  const resetMessageActions = useCallback(() => {
    setEditingMessageId(null);
    setActionMenu(null);
    setDeleteTarget(null);
    setForwardMessageIds([]);
    setIsForwardOpen(false);
    setForwardTargetId(null);
  }, []);

  useEffect(() => {
    if (!actionMenu || !menuRef.current) return;

    const padding = 12;
    const menuRect = menuRef.current.getBoundingClientRect();
    let nextLeft = actionMenu.left;
    let nextTop = actionMenu.top;

    if (nextLeft + menuRect.width > window.innerWidth - padding) {
      nextLeft = window.innerWidth - menuRect.width - padding;
    }
    if (nextTop + menuRect.height > window.innerHeight - padding) {
      nextTop = window.innerHeight - menuRect.height - padding;
    }
    if (nextLeft < padding) nextLeft = padding;
    if (nextTop < padding) nextTop = padding;

    if (nextLeft !== actionMenu.left || nextTop !== actionMenu.top) {
      setActionMenu((prev) =>
        prev ? { ...prev, left: nextLeft, top: nextTop } : prev,
      );
    }
  }, [actionMenu]);

  useEffect(() => {
    const handleOutside = (e: globalThis.MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) {
        closeActionMenu();
      }
    };
    if (actionMenu) {
      window.addEventListener("mousedown", handleOutside);
      return () => window.removeEventListener("mousedown", handleOutside);
    }
  }, [actionMenu, closeActionMenu]);

  useEffect(() => {
    return () => {
      if (touchTimeoutRef.current) {
        clearTimeout(touchTimeoutRef.current);
      }
    };
  }, []);

  return {
    editingMessageId,
    actionMenu,
    deleteTarget,
    forwardMessage: null,
    isForwardOpen,
    forwardTargetId,
    menuRef,
    closeActionMenu,
    openActionMenu,
    handleMessageTouchStart,
    handleMessageTouchEnd,
    handleMessageTouchMove,
    handleCopyMessage,
    handleStartEdit,
    handleCancelEdit,
    openDeleteDialog,
    handleDeleteForMe,
    handleDeleteForEveryone,
    handleForwardMessage,
    handleForwardMessages,
    handleConfirmForward,
    setForwardTargetId,
    closeForwardModal,
    setDeleteTarget,
    resetMessageActions,
  };
}
