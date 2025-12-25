export interface PhoneContact {
  name: string;
  phone?: string;
  email?: string;
}

export interface ImportStats {
  total: number;
  imported: number;
  skipped: number;
  errors: string[];
}

// Hash-based sync types (Enterprise/Privacy-First)

export interface HashedContact {
  name: string;
  hash: string;
}

export interface FoundUser {
  hash: string;
  original_name: string;
  user: {
    id: string;
    name: string;
    avatar_url?: string;
  };
}

export interface ContactSyncResult {
  found: FoundUser[];
  pending_count: number;
  found_count: number;
}

export interface ContactSyncRequest {
  hashed_contacts: HashedContact[];
}
