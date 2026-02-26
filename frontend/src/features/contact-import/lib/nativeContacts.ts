/**
 * Native contacts bridge.
 *
 * Provides a unified API that works on:
 * - iOS / Android (via Capacitor @capacitor-community/contacts plugin)
 * - Chrome on Android (via Contact Picker API)
 * - Desktop browsers (not supported — shows instructions modal)
 *
 * The bridge auto-detects the runtime environment and picks the best strategy.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PickedContact {
  name: string;
  phones: string[];
  emails: string[];
}

export type ContactsBackend = "capacitor" | "contact-picker" | "none";

// ─── Capacitor detection ────────────────────────────────────────────────────

/**
 * Returns true when running inside a Capacitor native shell (iOS/Android).
 * Works even before any Capacitor JS is imported.
 */
function isCapacitorNative(): boolean {
  return (
    typeof window !== "undefined" &&
    // Capacitor injects this global on native platforms
    !!(window as unknown as Record<string, unknown>).Capacitor &&
    (
      (window as unknown as Record<string, unknown>).Capacitor as Record<
        string,
        unknown
      >
    )?.isNativePlatform === true
  );
}

/**
 * Returns true when the Contact Picker API is available (Chrome Android).
 */
function hasContactPickerApi(): boolean {
  return (
    typeof navigator !== "undefined" &&
    "contacts" in navigator &&
    !!navigator.contacts
  );
}

/**
 * Determine which contacts backend is available in the current runtime.
 */
export function detectBackend(): ContactsBackend {
  if (isCapacitorNative()) return "capacitor";
  if (hasContactPickerApi()) return "contact-picker";
  return "none";
}

// ─── Capacitor implementation ───────────────────────────────────────────────

async function pickViaCapacitor(): Promise<PickedContact[]> {
  // Dynamic import — only loads the plugin when actually needed.
  // This keeps the bundle small for plain-web users.
  const { Contacts } = await import("@capacitor-community/contacts");

  // Request permission first (iOS shows the system dialog here)
  const permResult = await Contacts.requestPermissions();
  if (permResult.contacts !== "granted") {
    throw new DOMException("Contacts permission denied", "NotAllowedError");
  }

  // Fetch ALL contacts (full phone book access)
  const { contacts } = await Contacts.getContacts({
    projection: {
      name: true,
      phones: true,
      emails: true,
    },
  });

  return contacts.map((c) => ({
    name: c.name?.display ?? c.name?.given ?? "Unknown",
    phones: (c.phones ?? []).map((p) => p.number ?? "").filter(Boolean),
    emails: (c.emails ?? []).map((e) => e.address ?? "").filter(Boolean),
  }));
}

// ─── Contact Picker API implementation (Chrome Android) ─────────────────────

async function pickViaContactPicker(): Promise<PickedContact[]> {
  if (!navigator.contacts) {
    throw new Error("Contact Picker API not available");
  }

  const raw = await navigator.contacts.select(["name", "tel", "email"], {
    multiple: true,
  });

  return raw.map((c) => ({
    name: c.name?.[0] ?? "Unknown",
    phones: c.tel ?? [],
    emails: c.email ?? [],
  }));
}

// ─── Unified public API ─────────────────────────────────────────────────────

/**
 * Pick contacts from the device.
 *
 * - On Capacitor (iOS/Android native) — reads the full phone book.
 * - On Chrome Android — opens the Contact Picker UI.
 * - Everywhere else — throws with name "NotSupportedError".
 */
export async function pickContacts(): Promise<PickedContact[]> {
  const backend = detectBackend();

  switch (backend) {
    case "capacitor":
      return pickViaCapacitor();
    case "contact-picker":
      return pickViaContactPicker();
    case "none":
      throw new DOMException(
        "No contacts API available on this platform",
        "NotSupportedError",
      );
  }
}
