"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LandingPage() {
  const router = useRouter();
  const [showLogin, setShowLogin] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // MVP: パスワードチェックなしでダッシュボードへ遷移
    // Supabase認証は本番環境で設定
    setTimeout(() => {
      router.push("/dashboard");
    }, 500);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {/* ロゴ・ブランド */}
        <div className="mb-12">
          <div className="w-20 h-20 bg-brand-navy rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
            <span className="text-white text-3xl font-bold">一</span>
          </div>
          <h1 className="text-3xl font-bold text-brand-navy mb-3">
            ライフデザイン面談
          </h1>
          <p className="text-text-secondary text-lg leading-relaxed">
            物件を探す前に、人生を探す。
          </p>
          <p className="text-text-muted text-sm mt-2">
            株式会社イチエン不動産
          </p>
        </div>

        {!showLogin ? (
          <div className="space-y-4">
            <button
              onClick={() => setShowLogin(true)}
              className="w-full bg-brand-navy text-white py-4 px-6 rounded-xl text-lg font-medium hover:bg-brand-navy-light transition-colors shadow-md"
            >
              スタッフログイン
            </button>
            <p className="text-text-muted text-sm">
              お客様は面談時にQRコードからアクセスしてください
            </p>
          </div>
        ) : (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="メールアドレス"
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-brand-navy focus:outline-none text-lg"
              />
            </div>
            <div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="パスワード"
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-brand-navy focus:outline-none text-lg"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-navy text-white py-4 px-6 rounded-xl text-lg font-medium hover:bg-brand-navy-light transition-colors shadow-md disabled:opacity-50"
            >
              {loading ? "ログイン中..." : "ログイン"}
            </button>
            <button
              type="button"
              onClick={() => setShowLogin(false)}
              className="text-text-muted text-sm hover:text-text-secondary"
            >
              戻る
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
