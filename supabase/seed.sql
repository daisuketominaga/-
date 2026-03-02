-- サンプルデータ投入

-- 顧客5名
INSERT INTO customers (id, name, type, status, staff, phone, email, source, source_name, urgency, last_contact, next_action_date, next_action, memo)
VALUES
  ('C0001', '田中 太郎', '買主', 'B', 'トミー', '090-1234-5678', 'tanaka@example.com', '税理士紹介', '佐藤税理士事務所', '庭付き戸建希望。学区重視。', '2026-02-28', '2026-03-05', '庭30㎡以上の物件を再検索して紹介', '妻と子ども2人（5歳・3歳）。月々12万まで。'),
  ('C0002', '鈴木 花子', '売主', 'A', '翼', '090-2345-6789', 'suzuki@example.com', '既存顧客紹介', '山田様からの紹介', '媒介契約更新が近い', '2026-03-01', '2026-03-03', '買付希望者への内覧調整', '相続物件。早期売却希望。'),
  ('C0003', '佐々木 一郎', '買主', 'C', 'トミー', '090-3456-7890', NULL, '自社反響', NULL, NULL, '2026-02-15', '2026-03-10', '希望条件に合う物件をピックアップ', 'ホームページからの問い合わせ。'),
  ('C0004', '高橋 美咲', '売買両方', 'S', 'トミー', '090-4567-8901', 'takahashi@example.com', '税理士紹介', '田村税理士事務所', '決済日確定。住替え先も探している', '2026-03-02', '2026-03-08', '決済書類の最終確認', '売却と購入を同時進行中。'),
  ('C0005', '山本 健太', '買主', 'D', '翼', '090-5678-9012', NULL, '建築会社紹介', '三和建設', NULL, '2026-02-10', '2026-03-15', '初回ヒアリングのアポ取り', '新築用地を探しているとのこと。');

-- シーケンスを更新
SELECT setval('customer_id_seq', 5);

-- 買主要望
INSERT INTO buyer_details (customer_id, area, property_type, budget, loan_status, move_date, conditions)
VALUES
  ('C0001', '海老名市・大和市', '戸建', '4,500万円', '審査中', '2026年内', '駅徒歩10分以内、庭30㎡以上、小学校徒歩10分以内'),
  ('C0003', '横浜市南区・中区', 'マンション', '3,000万円', '未実施', '2026年6月', '2LDK以上、築15年以内'),
  ('C0004', '藤沢市・茅ヶ崎市', '戸建', '5,000万円', '承認済み', '2026年6月', '4LDK以上、駐車場2台分'),
  ('C0005', '相模原市', '土地', '2,500万円', '未実施', '未定', '60坪以上、南向き');

-- 売主情報
INSERT INTO seller_details (customer_id, address, land_use, land_area, building_area, current_status, sale_reason, assessed_price, asking_price, mediation_type, mediation_expiry, reins)
VALUES
  ('C0002', '厚木市旭町2-3-4', '第一種住居地域', '150㎡', '110㎡', '空家', '相続', '3,200万円', '3,500万円', '専任', '2026-04-15', '登録済み'),
  ('C0004', '藤沢市辻堂5-6-7', '第一種低層住居専用地域', '200㎡', '130㎡', '居住中', '住替え', '4,800万円', '5,200万円', '専属専任', '2026-05-01', '登録済み');

-- 田中太郎のジャーナル3件
INSERT INTO journal (customer_id, date, action_type, content, value_change, next_hint)
VALUES
  ('C0001', '2026-01-20', '訪問',
   '佐藤税理士事務所からの紹介。自宅にて2時間ほど面談。家族構成や生活スタイルについてじっくりヒアリング。奥様も同席。',
   '「子どもたちが安心して外で遊べる環境がいちばん大事」。庭付きへのこだわりが強い。月々12万円まで。駅徒歩10分以内必須。妻と子ども2人（5歳・3歳）。',
   '駅近＋庭付き＋学区良好の戸建てを海老名・大和エリアで探す');

INSERT INTO journal (customer_id, date, action_type, content, property_name, property_address, property_price, property_land_area, property_building_area, reaction, reaction_detail, fit_memo, value_change, next_hint)
VALUES
  ('C0001', '2026-02-20', '物件紹介',
   '電話にて物件概要を説明。チラシをLINEで送付。',
   '大和市南林間 戸建', '大和市南林間3-15-8', '3,800万円', '130㎡', '95㎡',
   '却下', '小学校が遠いのがネック。徒歩20分以上かかると奥さんが難色。',
   '立地△ 価格◎ 広さ○',
   '学区への優先度が非常に高い。奥さんが通学路の安全性を重視。',
   '小学校徒歩10分以内を必須条件に追加');

INSERT INTO journal (customer_id, date, action_type, content, property_name, property_address, property_price, property_land_area, property_building_area, proposal_link, materials, explanation, reaction, reaction_detail, fit_memo, value_change, next_hint)
VALUES
  ('C0001', '2026-02-28', '物件紹介',
   '提案ページを作成してLINEで送付。週末に内覧可能か確認。',
   '海老名市中央3丁目 戸建', '海老名市中央3-22-11', '4,200万円', '110㎡', '95㎡',
   'https://gregarious-griffin-a535d8.netlify.app',
   'チラシ＋設備比較ページ',
   '駅徒歩8分で条件合致。海老名小学校まで徒歩5分。ローン月々11.5万円の試算も提示。',
   '検討中', '価格は予算内で良い。庭が狭いのが少し気になる。週末に家族で見に行きたいとのこと。',
   '立地◎ 価格○ 日当たり◎ 広さ△',
   '庭の広さへのこだわりが思ったより強い。最低30㎡欲しいと言っていた。',
   '庭30㎡以上で再度物件を絞り直す');
