import { useState, useRef } from "react";
import { useContactPicker } from "../lib/useContactPicker";
import { readVcfFile } from "../lib/vcfParser";
import type { PhoneContact, ImportStats } from "../model/types";
import "./ContactImportButton.scss";

interface ContactImportButtonProps {
  onImport: (contacts: PhoneContact[]) => Promise<ImportStats>;
  onImported?: () => void;
  disabled?: boolean;
}

export function ContactImportButton({
  onImport,
  onImported,
  disabled = false,
}: ContactImportButtonProps) {
  const { isSupported: isPickerSupported, pickContacts, isLoading: isPickerLoading } = useContactPicker();
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePickerImport = async () => {
    setError(null);
    setImportResult(null);

    try {
      const contacts = await pickContacts();
      if (contacts.length === 0) return;

      setIsImporting(true);
      const result = await onImport(contacts);
      setImportResult(result);
      onImported?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка импорта");
    } finally {
      setIsImporting(false);
    }
  };

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setImportResult(null);

    try {
      const contacts = await readVcfFile(file);
      if (contacts.length === 0) {
        setError("Файл не содержит контактов");
        return;
      }

      setIsImporting(true);
      const result = await onImport(contacts);
      setImportResult(result);
      onImported?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка импорта");
    } finally {
      setIsImporting(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const isLoading = isPickerLoading || isImporting;

  return (
    <div className="contact-import">
      {isPickerSupported ? (
        <button
          className="contact-import__btn"
          onClick={handlePickerImport}
          disabled={disabled || isLoading}
        >
          {isLoading ? (
            <span className="contact-import__spinner" />
          ) : (
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          )}
          Импорт
        </button>
      ) : (
        <>
          <button
            className="contact-import__btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isLoading}
          >
            {isLoading ? (
              <span className="contact-import__spinner" />
            ) : (
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            )}
            Импорт .vcf
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".vcf,.vcard"
            onChange={handleFileImport}
            className="contact-import__file-input"
          />
        </>
      )}

      {error && (
        <div className="contact-import__error" onClick={() => setError(null)}>
          {error}
        </div>
      )}

      {importResult && (
        <div className="contact-import__result" onClick={() => setImportResult(null)}>
          Импортировано: {importResult.imported} из {importResult.total}
          {importResult.skipped > 0 && ` (пропущено: ${importResult.skipped})`}
        </div>
      )}
    </div>
  );
}
