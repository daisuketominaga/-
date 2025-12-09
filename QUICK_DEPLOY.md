# 🚀 クイックデプロイガイド

## 3ステップで公開！

### ステップ1: Vercel CLIをインストール
```bash
npm install -g vercel
```

### ステップ2: Vercelにログイン
```bash
vercel login
```
ブラウザが開くので、GitHubアカウントまたはメールアドレスでログインしてください。

### ステップ3: デプロイ
```bash
vercel --prod
```

質問には以下のように答えてください：
- Set up and deploy? → **Y**
- Which scope? → あなたのアカウントを選択
- Link to existing project? → **N**
- What's your project's name? → **easycook-kids**（そのままEnterでもOK）
- In which directory is your code located? → **./**（そのままEnter）

### 完了！
デプロイが完了すると、以下のようなURLが表示されます：
```
✅ Production: https://easycook-kids-xxxxx.vercel.app
```

このURLをコピーして、誰かにシェアすればOKです！

---

## 📝 補足：GitHubと連携する場合

GitHubと連携すると、コードをプッシュするたびに自動でデプロイされます。

```bash
# Gitリポジトリを初期化
git init
git add .
git commit -m "Initial commit"

# GitHubでリポジトリを作成後
git remote add origin https://github.com/あなたのユーザー名/easycook-kids.git
git branch -M main
git push -u origin main
```

その後、VercelのWeb UI（https://vercel.com）からGitHubリポジトリをインポートするだけです。

