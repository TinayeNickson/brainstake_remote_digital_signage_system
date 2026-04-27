// Shared types — mirror the DB schema enums/tables.

export type UserRole = 'customer' | 'accountant' | 'admin';
export type AdFormat = 'image' | 'video' | 'audio';
export type AdDuration = '15' | '30' | '60';
export type BookingStatus =
  | 'awaiting_payment'
  | 'payment_submitted'
  | 'active'
  | 'rejected'
  | 'cancelled'
  | 'completed';
export type PaymentMethod =
  | 'ecocash'
  | 'bank_transfer'
  | 'onemoney'
  | 'cash'
  | 'other';
export type PaymentStatus = 'pending' | 'approved' | 'rejected';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: UserRole;
  created_at: string;
}

export interface Location {
  id: string;
  name: string;
  description: string | null;
  price_15s: number;
  price_30s: number;
  price_60s: number;
  max_slots_per_day: number;
  active: boolean;
  created_at: string;
}

export interface Package {
  id: string;
  name: string;
  description: string | null;
  base_slots_per_day: number;
  allows_15s: boolean;
  allows_30s: boolean;
  allows_60s: boolean;
  active: boolean;
  sort_order: number;
  created_at: string;
}

export interface SecurityGuard {
  id: string;
  name: string;
  phone: string;
  id_number: string | null;
  active: boolean;
  created_at: string;
}

export interface Device {
  id: string;
  code: string;
  name: string;
  location_id: string;
  guard_id: string;
  last_seen_at: string | null;
  active: boolean;
  created_at: string;
}

export interface Ad {
  id: string;
  customer_id: string;
  title: string;
  format: AdFormat;
  duration: AdDuration;
  media_url: string;
  media_path: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  created_at: string;
}

export interface Booking {
  id: string;
  customer_id: string;
  ad_id: string;
  location_id: string;
  duration: AdDuration;
  slots_per_day: number;
  start_date: string; // YYYY-MM-DD
  end_date: string;
  days_of_week: number[];
  scheduled_days_count: number;
  price_per_slot: number;
  total_price: number;
  status: BookingStatus;
  package_id: string | null;
  device_id: string | null;
  created_at: string;
  approved_at: string | null;
  approved_by: string | null;
}

export interface Payment {
  id: string;
  booking_id: string;
  amount: number;
  method: PaymentMethod;
  reference: string | null;
  proof_url: string;
  proof_path: string;
  status: PaymentStatus;
  submitted_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  reject_reason: string | null;
}

export interface Receipt {
  id: string;
  receipt_number: string;
  booking_id: string;
  payment_id: string;
  customer_id: string;
  amount: number;
  issued_at: string;
}

export interface Campaign {
  id: string;
  customer_id: string;
  ad_id: string;
  package_id: string | null;
  title: string;
  duration: AdDuration;
  slots_per_day: number;
  start_date: string;
  end_date: string;
  days_of_week: number[];
  scheduled_days_count: number;
  total_price: number;
  created_at: string;
}

export interface PriceQuote {
  price_per_slot: number;
  scheduled_days: number;
  total_price: number;
  max_slots_per_day: number;
}
