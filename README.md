# 全裸の部屋 - 富永大介と友達

「真面目な話を、不真面目なテンションで」行うコミュニティプラットフォームです。

## 概要

契約書（覚書）に同意したメンバーだけがアクセスできる、ナレッジ共有プラットフォーム。
富永大介が本音で記録した講義・思考を記事として投稿し、メンバーがコメントで議論できます。

## 機能

- **契約書同意フロー**: 覚書を最後まで読み、同意した人だけがログイン可能
- **YouTube風ダッシュボード**: 記事をカード型グリッドで一覧表示
- **カテゴリフィルター**: 才能・成長、人間関係、利他・愛、キャリア・AI、人間の魅力、思考法
- **記事詳細**: YouTube動画埋め込み + 本文表示 + コメント機能
- **管理者投稿**: 富永大介のみが新しい講義を投稿可能
- **検索機能**: タイトル・本文・タグで横断検索

## 技術スタック

- **フレームワーク**: Next.js 14+ (App Router)
- **言語**: TypeScript (Strictモード)
- **スタイリング**: Tailwind CSS
- **状態管理**: React Hooks + localStorage

## セットアップ

```bash
npm install
npm run dev
```

ブラウザで `http://localhost:3000` を開く

## プロジェクト構造

```
app/
  page.tsx            # ランディング（契約書同意フロー）
  dashboard/page.tsx  # メインフィード（YouTube風記事一覧）
  articles/[id]/      # 記事詳細（コメント付き）
  admin/post/         # 管理者用投稿ページ
components/
  Header.tsx          # ヘッダーナビゲーション
  ArticleCard.tsx     # YouTube風記事カード
  CommentSection.tsx  # コメントセクション
  CategoryFilter.tsx  # カテゴリフィルター
data/
  charter.ts          # 契約書データ
  seedArticles.ts     # 初期記事（LINE履歴ベース）
types/
  index.ts            # TypeScript型定義
utils/
  auth.ts             # 認証ユーティリティ
  storage.ts          # localStorageユーティリティ
```

## 令和8年2月1日

甲：株式会社イチエン不動産 富永大介（ポンコツ代表）
乙：奇特な参加者のみなさま
