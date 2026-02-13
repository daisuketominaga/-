"use client";

import { useRouter } from "next/navigation";
import { getCurrentUser, isAdmin, logout } from "@/utils/auth";

export default function Header() {
  const router = useRouter();
  const user = getCurrentUser();

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  return (
    <header className="sticky top-0 z-50 bg-brand-darker border-b border-brand-border">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* ロゴ */}
        <button
          onClick={() => router.push("/dashboard")}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <div className="w-8 h-8 bg-brand-accent rounded-full flex items-center justify-center text-white font-bold text-sm">
            全
          </div>
          <span className="text-lg font-bold hidden sm:inline">
            全裸の部屋
          </span>
        </button>

        {/* 右側 */}
        <div className="flex items-center gap-3">
          {isAdmin() && (
            <button
              onClick={() => router.push("/admin/post")}
              className="px-3 py-1.5 bg-brand-accent text-white text-sm rounded-lg hover:bg-red-600 transition-colors"
            >
              投稿する
            </button>
          )}
          {user && (
            <>
              <span className="text-sm text-brand-muted hidden sm:inline">
                {user.name}
              </span>
              <button
                onClick={handleLogout}
                className="text-sm text-brand-muted hover:text-white transition-colors"
              >
                ログアウト
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
