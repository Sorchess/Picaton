import { useEffect } from "react";
import { ContactProfileView } from "@/features/contact-profile";
import type { UserPublic } from "@/entities/user";
import type { SavedContact } from "@/entities/user";
import { userApi } from "@/entities/user";
import { useAuth } from "@/features/auth";
import "./ContactProfilePage.scss";

interface ContactProfilePageProps {
  user: UserPublic;
  cardId?: string;
  savedContact?: SavedContact | null;
  onBack: () => void;
  onContactSaved?: () => void;
  onContactDeleted?: () => void;
}

export function ContactProfilePage({
  user,
  cardId,
  savedContact,
  onBack,
  onContactSaved,
  onContactDeleted,
}: ContactProfilePageProps) {
  const { user: authUser } = useAuth();

  // Скроллим вверх при открытии страницы
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handleSaveContact = async (userToSave: UserPublic) => {
    if (!authUser?.id) return;
    try {
      await userApi.saveContact(authUser.id, userToSave.id, cardId);
      onContactSaved?.();
      onBack();
    } catch (error) {
      console.error("Failed to save contact:", error);
    }
  };

  const handleDeleteContact = async () => {
    if (!savedContact) return;
    try {
      await userApi.deleteContact(savedContact.id);
      onContactDeleted?.();
      onBack();
    } catch (error) {
      console.error("Failed to delete contact:", error);
    }
  };

  const isSaved = !!savedContact;

  return (
    <div className="contact-profile-page">
      <ContactProfileView
        user={user}
        cardId={cardId}
        onClose={onBack}
        onSaveContact={handleSaveContact}
        onDeleteContact={isSaved ? handleDeleteContact : undefined}
        isSaved={isSaved}
      />
    </div>
  );
}
