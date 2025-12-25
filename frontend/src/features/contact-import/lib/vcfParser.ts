import type { PhoneContact } from "../model/types";

/**
 * Parse VCF (vCard) file content into contacts array.
 * Supports vCard 2.1, 3.0, and 4.0 formats.
 */
export function parseVcfFile(content: string): PhoneContact[] {
  const contacts: PhoneContact[] = [];

  // Split by vCard entries
  const vcards = content.split(/BEGIN:VCARD/i).filter(Boolean);

  for (const vcard of vcards) {
    const contact = parseVCard(vcard);
    if (contact.name) {
      contacts.push(contact);
    }
  }

  return contacts;
}

function parseVCard(vcard: string): PhoneContact {
  const lines = vcard.split(/\r?\n/);

  let name = "";
  let phone: string | undefined;
  let email: string | undefined;

  for (const line of lines) {
    const trimmed = line.trim();

    // Full Name (FN)
    if (trimmed.toUpperCase().startsWith("FN:")) {
      name = trimmed.slice(3).trim();
    }
    // Name (N) as fallback
    else if (trimmed.toUpperCase().startsWith("N:") && !name) {
      const parts = trimmed.slice(2).split(";");
      const lastName = parts[0]?.trim() || "";
      const firstName = parts[1]?.trim() || "";
      name = `${firstName} ${lastName}`.trim();
    }
    // Phone (TEL)
    else if (trimmed.toUpperCase().startsWith("TEL") && !phone) {
      phone = extractValue(trimmed);
    }
    // Email (EMAIL)
    else if (trimmed.toUpperCase().startsWith("EMAIL") && !email) {
      email = extractValue(trimmed);
    }
  }

  return {
    name: name || "Без имени",
    phone,
    email,
  };
}

function extractValue(line: string): string {
  // Handle formats like "TEL;TYPE=CELL:+1234567890" or "TEL:+1234567890"
  const colonIndex = line.indexOf(":");
  if (colonIndex === -1) return "";

  return line.slice(colonIndex + 1).trim();
}

/**
 * Read VCF file and parse its content.
 */
export function readVcfFile(file: File): Promise<PhoneContact[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const contacts = parseVcfFile(content);
        resolve(contacts);
      } catch (err) {
        reject(new Error("Ошибка парсинга VCF файла"));
      }
    };

    reader.onerror = () => {
      reject(new Error("Ошибка чтения файла"));
    };

    reader.readAsText(file);
  });
}
