import { Modal } from "@/shared";
import type { UserPublic } from "@/entities/user";
import { ContactProfileView } from "./ContactProfileView";
import "./SpecialistModal.scss";

interface SpecialistModalProps {
  user: UserPublic | null;
  cardId?: string; // ID карточки для эндорсментов
  isOpen: boolean;
  onClose: () => void;
  onSaveContact?: (user: UserPublic) => void;
  onDeleteContact?: ((user: UserPublic) => void) | (() => void);
  isSaved?: boolean;
}

export function SpecialistModal({
  user,
  cardId,
  isOpen,
  onClose,
  onSaveContact,
  onDeleteContact,
  isSaved = false,
}: SpecialistModalProps) {
  if (!user) return null;

  // Используем новый ContactProfileView для отображения профиля контакта
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="fullscreen"
      className="specialist-modal specialist-modal--fullscreen"
    >
      <ContactProfileView
        user={user}
        cardId={cardId}
        onClose={onClose}
        onSaveContact={onSaveContact}
        onDeleteContact={onDeleteContact}
        isSaved={isSaved}
      />
    </Modal>
  );
}
