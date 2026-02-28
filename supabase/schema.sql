-- ライフデザイン面談アプリ データベーススキーマ
-- Supabase (PostgreSQL)

-- 顧客テーブル
CREATE TABLE customers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  age INTEGER,
  family JSONB DEFAULT '{}',
  purchase_purpose TEXT DEFAULT '',
  budget_min INTEGER,
  budget_max INTEGER,
  preferred_area TEXT DEFAULT '',
  status TEXT DEFAULT '事前準備' CHECK (status IN ('事前準備', '面談済み', 'レター送付済み', '物件提案中', '成約', '見送り')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 面談セッションテーブル
CREATE TABLE sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  staff_url TEXT NOT NULL,
  client_url TEXT NOT NULL,
  status TEXT DEFAULT '準備中' CHECK (status IN ('準備中', '進行中', '完了')),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 面談メモテーブル
CREATE TABLE interview_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  category TEXT DEFAULT 'その他' CHECK (category IN ('暮らしの情景', '家族の未来', '隠れた価値観', 'その他')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI提案テーブル
CREATE TABLE ai_suggestions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('暮らしの情景', '家族の未来', '隠れた価値観')),
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 価値観ワーク回答テーブル
CREATE TABLE value_work_answers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE UNIQUE,
  step1_priorities JSONB DEFAULT '{}',
  step2_ideal_day JSONB DEFAULT '{}',
  step3_tradeoffs JSONB DEFAULT '[]',
  step4_letter TEXT DEFAULT '',
  step5_top_values JSONB DEFAULT '[]',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 価値観マップテーブル
CREATE TABLE value_maps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE UNIQUE,
  radar_chart JSONB DEFAULT '{}',
  keywords JSONB DEFAULT '[]',
  summary TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 提案レターテーブル
CREATE TABLE proposal_letters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE UNIQUE,
  ai_draft TEXT DEFAULT '',
  edited_content TEXT DEFAULT '',
  personal_note TEXT DEFAULT '',
  sent_at TIMESTAMPTZ,
  sent_via TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_sessions_customer ON sessions(customer_id);
CREATE INDEX idx_notes_session ON interview_notes(session_id);
CREATE INDEX idx_suggestions_session ON ai_suggestions(session_id);

-- リアルタイム同期のためのPublication
ALTER PUBLICATION supabase_realtime ADD TABLE interview_notes;
ALTER PUBLICATION supabase_realtime ADD TABLE ai_suggestions;
ALTER PUBLICATION supabase_realtime ADD TABLE value_work_answers;
ALTER PUBLICATION supabase_realtime ADD TABLE value_maps;

-- RLS (Row Level Security) ポリシー
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE value_work_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE value_maps ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_letters ENABLE ROW LEVEL SECURITY;

-- スタッフは全データにアクセス可能（認証済みユーザー）
CREATE POLICY "staff_all_access" ON customers FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "staff_all_access" ON sessions FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "staff_all_access" ON interview_notes FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "staff_all_access" ON ai_suggestions FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "staff_all_access" ON value_work_answers FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "staff_all_access" ON value_maps FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "staff_all_access" ON proposal_letters FOR ALL USING (auth.role() = 'authenticated');

-- お客さん（匿名ユーザー）はセッションリンク経由で限定アクセス
CREATE POLICY "anon_read_sessions" ON sessions FOR SELECT USING (auth.role() = 'anon');
CREATE POLICY "anon_read_valuework" ON value_work_answers FOR ALL USING (auth.role() = 'anon');
CREATE POLICY "anon_read_valuemaps" ON value_maps FOR SELECT USING (auth.role() = 'anon');
CREATE POLICY "anon_read_notes" ON interview_notes FOR SELECT USING (auth.role() = 'anon');
