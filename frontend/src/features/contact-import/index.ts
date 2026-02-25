export { PhoneBookSyncButton } from "./ui/PhoneBookSyncButton";
export {
  hashPhone,
  hashPhones,
  parsePhoneInput,
  normalizePhone,
} from "./lib/hashPhone";
export { pickContacts, detectBackend } from "./lib/nativeContacts";
export type { PickedContact, ContactsBackend } from "./lib/nativeContacts";
export type {
  PhoneContact,
  ImportStats,
  HashedContact,
  ContactSyncResult,
  ContactSyncRequest,
  FoundUser,
} from "./model/types";
