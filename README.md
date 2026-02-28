# ライフデザイン面談アプリ

**「物件を探す前に、人生を探す。」**

不動産購入を検討しているお客さんに対して、物件紹介の前段階で「自分の人生の価値観」を一緒に探る面談体験を提供するWebアプリ。面談の結果をAIが分析し、その人だけの「提案レター」を生成します。

## 主な機能

- **2台同期モード**: スタッフ用（スマホ/PC）とお客さん用（iPad）の2画面をリアルタイム同期
- **価値観ワーク**: 5ステップの対話型ワーク（スライダー・選択・自由記述）
- **AI面談アシスト**: 面談中にスタッフ画面にAIが問いかけを提案
- **価値観マップ**: レーダーチャート＋キーワードクラウドで価値観を可視化
- **提案レター自動生成**: AIが面談内容をもとに提案レターを下書き
- **PDF/印刷出力**: レターヘッド付きの提案レターを出力

## 技術スタック

- **フロントエンド**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **チャート**: Recharts（レーダーチャート）
- **アニメーション**: Framer Motion
- **データベース**: Supabase（PostgreSQL + Realtime + 認証）
- **AI**: Anthropic Claude API
- **デプロイ**: Vercel

## セットアップ

1. 依存関係のインストール:
```bash
npm install
```

2. 環境変数の設定:
```bash
cp .env.example .env.local
```
`.env.local` に以下の値を設定:
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase プロジェクト URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase Anon Key
- `ANTHROPIC_API_KEY` - Claude API キー
- `NEXT_PUBLIC_APP_URL` - アプリの公開URL

3. 開発サーバーの起動:
```bash
npm run dev
```

4. ブラウザで `http://localhost:3000` を開く

> **Note**: Supabase/Claude APIの設定がなくてもローカルストレージモードで動作します。

## データベースセットアップ

Supabaseを使用する場合、`supabase/schema.sql` のSQLをSupabase SQL Editorで実行してください。

## 画面構成

### スタッフ用画面
- `/` - ログイン
- `/dashboard` - 顧客一覧・面談管理
- `/session/new` - 新規面談セットアップ（QRコード生成）
- `/s/{sessionId}/staff` - 面談進行画面（メモ入力・AI提案）
- `/s/{sessionId}/review` - AI分析レビュー・レター編集
- `/s/{sessionId}/letter` - 提案レター出力

### お客さん用画面
- `/s/{sessionId}/client` - ウェルカム → 価値観ワーク → 価値観マップ
