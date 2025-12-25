/**
 * Phone number hashing utilities for privacy-first contact sync.
 * Uses SHA-256 to ensure server never sees raw phone numbers.
 */

/**
 * Normalizes a phone number by keeping only last 10 digits.
 * Handles various formats: +7, 8, with/without spaces/dashes.
 */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.slice(-10);
}

/**
 * Hashes a phone number using SHA-256.
 * Returns hex string representation.
 */
export async function hashPhone(phone: string): Promise<string> {
  const normalized = normalizePhone(phone);

  if (normalized.length !== 10) {
    throw new Error(`Invalid phone number: ${phone}`);
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);

  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Hashes multiple phone numbers in parallel.
 */
export async function hashPhones(
  phones: Array<{ name: string; phone: string }>
): Promise<Array<{ name: string; hash: string }>> {
  const results = await Promise.all(
    phones.map(async ({ name, phone }) => {
      try {
        const hash = await hashPhone(phone);
        return { name, hash };
      } catch {
        return null;
      }
    })
  );

  return results.filter((r): r is { name: string; hash: string } => r !== null);
}

/**
 * Parses a multi-line text input into phone entries.
 * Supports formats:
 * - "Name: +7 999 123 45 67"
 * - "Name - 89991234567"
 * - "+79991234567"
 */
export function parsePhoneInput(
  input: string
): Array<{ name: string; phone: string }> {
  const lines = input
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  return lines
    .map((line) => {
      // Try "Name: phone" or "Name - phone" format
      const separatorMatch = line.match(/^(.+?)\s*[:–-]\s*(.+)$/);
      if (separatorMatch) {
        const [, name, phone] = separatorMatch;
        const digits = phone.replace(/\D/g, "");
        if (digits.length >= 10) {
          return { name: name.trim(), phone: digits };
        }
      }

      // Try phone-only format
      const digits = line.replace(/\D/g, "");
      if (digits.length >= 10) {
        return { name: `+${digits.slice(-11)}`, phone: digits };
      }

      return null;
    })
    .filter((entry): entry is { name: string; phone: string } => entry !== null);
}
