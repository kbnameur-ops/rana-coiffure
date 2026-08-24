export type Category = {
  id: number;
  name: string;
  sort_order: number;
};

export type Service = {
  id: number;
  category_id: number | null;
  name: string;
  description: string;
  price_cents: number;
  duration_min: number;
  sort_order: number;
  active: boolean;
  bookable: boolean;
};

export type OpeningHour = {
  id: number;
  weekday: number;
  open_min: number;
  close_min: number;
};

export type Closure = {
  id: number;
  date: string;
  reason: string;
};

export type Staff = {
  id: number;
  name: string;
  role_label: string;
  active: boolean;
  sort_order: number;
  access_code_hash: string;
  failed_logins: number;
  locked_until: string;
};

export type StaffHour = {
  id: number;
  staff_id: number;
  weekday: number;
  open_min: number;
  close_min: number;
};

export type BookingStatus =
  | "confirmed"
  | "cancelled"
  | "done"
  | "no_show"
  /** Prestation saisie par un coiffeur, en attente de validation du salon. */
  | "pending";

export type Booking = {
  id: number;
  ref: string;
  service_id: number | null;
  service_name: string;
  staff_id: number | null;
  staff_name: string;
  price_cents: number;
  duration_min: number;
  date: string;
  start_min: number;
  end_min: number;
  customer_name: string;
  phone: string;
  email: string;
  notes: string;
  status: BookingStatus;
  client_id: number | null;
  source: "online" | "walk_in";
  created_by_staff_id: number | null;
  created_at: string;
};

export type Settings = Record<string, string>;

/** Bornes de configuration des plannings : de 08h00 à minuit. */
export const PLANNING_MIN = 8 * 60;
export const PLANNING_MAX = 24 * 60;

export const WEEKDAYS = [
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
  "Dimanche",
] as const;
