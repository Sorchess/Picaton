import { useState, useCallback } from "react";
import type { PhoneContact } from "../model/types";

declare global {
  interface Navigator {
    contacts?: {
      select: (
        properties: string[],
        options?: { multiple?: boolean }
      ) => Promise<
        Array<{
          name?: string[];
          tel?: string[];
          email?: string[];
        }>
      >;
      getProperties: () => Promise<string[]>;
    };
  }
}

export function useContactPicker() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSupported =
    typeof navigator !== "undefined" &&
    "contacts" in navigator &&
    "ContactsManager" in window;

  const pickContacts = useCallback(async (): Promise<PhoneContact[]> => {
    if (!navigator.contacts) {
      throw new Error("Contact Picker API not supported");
    }

    setIsLoading(true);
    setError(null);

    try {
      const contacts = await navigator.contacts.select(
        ["name", "tel", "email"],
        { multiple: true }
      );

      return contacts.map((contact) => ({
        name: contact.name?.[0] || "Без имени",
        phone: contact.tel?.[0],
        email: contact.email?.[0],
      }));
    } catch (err) {
      if (err instanceof Error && err.name === "InvalidStateError") {
        // User cancelled
        return [];
      }
      const message = err instanceof Error ? err.message : "Ошибка выбора контактов";
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isSupported,
    isLoading,
    error,
    pickContacts,
  };
}
