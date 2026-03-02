-- イチエン不動産 CRM データベーススキーマ

-- 顧客ID自動採番用シーケンス
CREATE SEQUENCE IF NOT EXISTS customer_id_seq START 1;

-- 顧客IDの生成関数
CREATE OR REPLACE FUNCTION generate_customer_id()
RETURNS TEXT AS $$
BEGIN
  RETURN 'C' || LPAD(nextval('customer_id_seq')::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- 顧客マスタ
CREATE TABLE customers (
  id TEXT PRIMARY KEY DEFAULT generate_customer_id(),
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT '買主',
  status TEXT NOT NULL DEFAULT 'E',
  staff TEXT NOT NULL DEFAULT 'トミー',
  phone TEXT,
  email TEXT,
  line_id TEXT,
  source TEXT,
  source_name TEXT,
  urgency TEXT,
  last_contact DATE,
  next_action_date DATE,
  next_action TEXT,
  memo TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 買主要望
CREATE TABLE buyer_details (
  customer_id TEXT PRIMARY KEY REFERENCES customers(id) ON DELETE CASCADE,
  area TEXT,
  property_type TEXT,
  budget TEXT,
  loan_status TEXT,
  move_date TEXT,
  conditions TEXT
);

-- 売主情報
CREATE TABLE seller_details (
  customer_id TEXT PRIMARY KEY REFERENCES customers(id) ON DELETE CASCADE,
  address TEXT,
  land_use TEXT,
  land_area TEXT,
  building_area TEXT,
  current_status TEXT,
  sale_reason TEXT,
  assessed_price TEXT,
  asking_price TEXT,
  mediation_type TEXT,
  mediation_expiry DATE,
  reins TEXT
);

-- 顧客ジャーナル
CREATE TABLE journal (
  id BIGSERIAL PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  action_type TEXT NOT NULL,
  content TEXT NOT NULL,
  property_name TEXT,
  property_address TEXT,
  property_price TEXT,
  property_land_area TEXT,
  property_building_area TEXT,
  proposal_link TEXT,
  materials TEXT,
  explanation TEXT,
  reaction TEXT,
  reaction_detail TEXT,
  fit_memo TEXT,
  value_change TEXT,
  next_hint TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_journal_customer_id ON journal(customer_id);
CREATE INDEX idx_journal_date ON journal(date DESC);
CREATE INDEX idx_customers_status ON customers(status);
CREATE INDEX idx_customers_staff ON customers(staff);

-- Row Level Security
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyer_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE seller_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all" ON customers FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_all" ON buyer_details FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_all" ON seller_details FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_all" ON journal FOR ALL USING (auth.role() = 'authenticated');
