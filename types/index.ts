export interface Customer {
  id: string;
  name: string;
  type: "買主" | "売主" | "売買両方";
  status: "S" | "A" | "B" | "C" | "D" | "E";
  staff: "トミー" | "翼";
  phone: string | null;
  email: string | null;
  line_id: string | null;
  source: string | null;
  source_name: string | null;
  urgency: string | null;
  last_contact: string | null;
  next_action_date: string | null;
  next_action: string | null;
  memo: string | null;
  created_at: string;
}

export interface BuyerDetail {
  customer_id: string;
  area: string | null;
  property_type: string | null;
  budget: string | null;
  loan_status: string | null;
  move_date: string | null;
  conditions: string | null;
}

export interface SellerDetail {
  customer_id: string;
  address: string | null;
  land_use: string | null;
  land_area: string | null;
  building_area: string | null;
  current_status: string | null;
  sale_reason: string | null;
  assessed_price: string | null;
  asking_price: string | null;
  mediation_type: string | null;
  mediation_expiry: string | null;
  reins: string | null;
}

export interface Journal {
  id: number;
  customer_id: string;
  date: string;
  action_type: string;
  content: string;
  property_name: string | null;
  property_address: string | null;
  property_price: string | null;
  property_land_area: string | null;
  property_building_area: string | null;
  proposal_link: string | null;
  materials: string | null;
  explanation: string | null;
  reaction: string | null;
  reaction_detail: string | null;
  fit_memo: string | null;
  value_change: string | null;
  next_hint: string | null;
  created_at: string;
}

export type StatusKey = "S" | "A" | "B" | "C" | "D" | "E";

export interface StatusInfo {
  label: string;
  meaning: string;
  color: string;
  bgColor: string;
  frequency: string;
}

export interface CustomerWithDetails extends Customer {
  buyer_details?: BuyerDetail | null;
  seller_details?: SellerDetail | null;
  journal_count?: number;
}

export interface ExportData {
  customers: Customer[];
  buyer_details: BuyerDetail[];
  seller_details: SellerDetail[];
  journal: Journal[];
  exported_at: string;
}
