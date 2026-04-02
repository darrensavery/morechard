export interface Env {
  DB: D1Database;
  ENVIRONMENT: string;
  JWT_SECRET: string;
  RESEND_API_KEY: string;
  APP_URL: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  FIREBASE_PROJECT_ID: string;
}

export type PaymentType = 'LIFETIME' | 'AI_ANNUAL';

/** Shape returned by SELECT on the families table for trial/license checks. */
export interface FamilyLicenseRow {
  id: string;
  trial_start_date: string | null;   // ISO datetime string from D1
  is_activated: number;              // D1 returns booleans as 0/1
  has_lifetime_license: number;
  ai_subscription_expiry: string | null;
}

/** Result shape passed to the frontend for the TrialCountdown component. */
export interface TrialStatus {
  is_activated: boolean;
  days_remaining: number | null;   // null = trial not yet started
  is_expired: boolean;
  has_lifetime_license: boolean;
  ai_subscription_active: boolean;
}

export type Currency = 'GBP' | 'PLN';
export type VerifyMode = 'amicable' | 'standard';
export type EntryType = 'credit' | 'reversal' | 'payment';
export type VerificationStatus = 'pending' | 'verified_auto' | 'verified_manual' | 'disputed' | 'reversed';
export type GovernanceStatus = 'pending' | 'confirmed' | 'rejected' | 'expired';
export type Role = 'parent' | 'child';

export type DisputeCode =
  | 'ERR_NO_CONSENT'
  | 'ERR_NO_PROOF'
  | 'ERR_OUT_OF_SCOPE'
  | 'ERR_SPLIT_MISMATCH'
  | 'ERR_DUPLICATE';

export const DISPUTE_CODES: DisputeCode[] = [
  'ERR_NO_CONSENT',
  'ERR_NO_PROOF',
  'ERR_OUT_OF_SCOPE',
  'ERR_SPLIT_MISMATCH',
  'ERR_DUPLICATE',
];

export type CategoryCode =
  | 'CAT_EDUCATION'
  | 'CAT_MEDICAL'
  | 'CAT_CLOTHING'
  | 'CAT_ACTIVITIES'
  | 'CAT_TRAVEL'
  | 'CAT_CHILDCARE'
  | 'CAT_MAINTENANCE'
  | 'CAT_OTHER';

export const CATEGORY_CODES: CategoryCode[] = [
  'CAT_EDUCATION', 'CAT_MEDICAL', 'CAT_CLOTHING', 'CAT_ACTIVITIES',
  'CAT_TRAVEL', 'CAT_CHILDCARE', 'CAT_MAINTENANCE', 'CAT_OTHER',
];

export interface LedgerEntry {
  id: number;
  family_id: string;
  child_id: string;
  chore_id: string | null;
  entry_type: EntryType;
  amount: number;
  currency: Currency;
  description: string;
  receipt_id: string | null;
  category: CategoryCode | null;
  verification_status: VerificationStatus;
  authorised_by: string | null;
  verified_at: number | null;
  verified_by: string | null;
  dispute_code: DisputeCode | null;
  dispute_before: number | null;
  previous_hash: string;
  record_hash: string;
  ip_address: string;
  created_at: number;
}

export interface GovernanceRequest {
  id: number;
  family_id: string;
  requested_by: string;
  confirmed_by: string | null;
  old_mode: VerifyMode;
  new_mode: VerifyMode;
  status: GovernanceStatus;
  requested_at: number;
  expires_at: number;
  confirmed_at: number | null;
  request_ip: string;
  confirm_ip: string | null;
}

export interface StatusLogEntry {
  id: number;
  ledger_id: number;
  from_status: VerificationStatus;
  to_status: VerificationStatus;
  actor_id: string;
  dispute_code: DisputeCode | null;
  ip_address: string;
  created_at: number;
}
