export interface PhoneContact {
  name: string;
  phone?: string;
  email?: string;
}

export interface ContactPickerResult {
  contacts: PhoneContact[];
  source: "picker" | "vcf";
}

export interface ImportStats {
  total: number;
  imported: number;
  skipped: number;
  errors: string[];
}
