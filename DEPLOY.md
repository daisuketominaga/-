# EasyCook Kids デプロイガイド

このアプリをVercelで公開してシェアする手順です。

## 方法1: Vercel CLIを使用（推奨）

### 1. Vercelアカウントの作成
- https://vercel.com にアクセス
- GitHubアカウントでサインアップ（推奨）またはメールアドレスで登録

### 2. Vercel CLIのインストール
```bash
npm install -g vercel
```

### 3. ログイン
```bash
vercel login
```

### 4. デプロイ
プロジェクトのルートディレクトリで実行：
```bash
vercel
```

初回は質問されます：
- Set up and deploy? → **Y**
- Which scope? → あなたのアカウントを選択
- Link to existing project? → **N**（新規プロジェクト）
- What's your project's name? → **easycook-kids**（または任意の名前）
- In which directory is your code located? → **./**（そのままEnter）

### 5. 本番環境にデプロイ
```bash
vercel --prod
```

### 6. URLを確認
デプロイが完了すると、以下のようなURLが表示されます：
```
https://easycook-kids.vercel.app
```

このURLをシェアすれば、誰でもアプリにアクセスできます！

---

## 方法2: Vercel Web UIを使用（GitHub連携）

### 1. GitHubリポジトリを作成
```bash
# Gitリポジトリを初期化
git init
git add .
git commit -m "Initial commit"

# GitHubでリポジトリを作成後、以下を実行
git remote add origin https://github.com/あなたのユーザー名/easycook-kids.git
git branch -M main
git push -u origin main
```

### 2. Vercelでプロジェクトをインポート
1. https://vercel.com/dashboard にアクセス
2. 「Add New...」→「Project」をクリック
3. GitHubリポジトリを選択
4. 「Import」をクリック
5. 設定を確認して「Deploy」をクリック

### 3. デプロイ完了
数分でデプロイが完了し、URLが発行されます。

---

## カスタムドメインの設定（オプション）

1. Vercelダッシュボードでプロジェクトを開く
2. 「Settings」→「Domains」を選択
3. ドメイン名を入力して追加

---

## 注意事項

- 無料プランでも十分に使用できます
- 自動的にHTTPSが有効になります
- GitHubと連携すると、プッシュするたびに自動デプロイされます
- 環境変数が必要な場合は、Vercelダッシュボードの「Settings」→「Environment Variables」で設定できます

---

## トラブルシューティング

### ビルドエラーが発生する場合
```bash
# ローカルでビルドをテスト
npm run build
```

### 画像が表示されない場合
- `next.config.js`の`remotePatterns`設定を確認
- Unsplashの画像URLが正しいか確認

### データが読み込まれない場合
- `public/data/`ディレクトリにJSONファイルがあるか確認
- ブラウザのコンソールでエラーを確認

