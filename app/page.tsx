"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { isLoggedIn, login } from "@/utils/auth";
import { initializeWithSeedData } from "@/utils/storage";
import { SEED_ARTICLES } from "@/data/seedArticles";
import {
  CHARTER_SECTIONS,
  CHARTER_HEADER,
  CHARTER_DISCLAIMER,
  CHARTER_DATE,
  CHARTER_PARTY_A,
  CHARTER_PARTY_B,
} from "@/data/charter";

export default function LandingPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [showCharter, setShowCharter] = useState(false);
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    initializeWithSeedData(SEED_ARTICLES);
    if (isLoggedIn()) {
      router.push("/dashboard");
    }
  }, [router]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const threshold = 50;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < threshold) {
      setScrolledToBottom(true);
    }
  };

  const handleJoin = () => {
    if (!name.trim()) return;
    login(name.trim());
    initializeWithSeedData(SEED_ARTICLES);
    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* ヒーロー */}
        {!showCharter && (
          <div className="text-center">
            <div className="mb-8">
              <div className="w-20 h-20 bg-brand-accent rounded-full flex items-center justify-center text-3xl font-bold mx-auto mb-4">
                全
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold mb-2">
                全裸の部屋
              </h1>
              <p className="text-brand-muted text-lg">富永大介と友達</p>
            </div>

            <p className="text-gray-300 mb-2 text-sm leading-relaxed max-w-md mx-auto">
              真面目な話を、不真面目なテンションで。
            </p>
            <p className="text-gray-400 mb-8 text-xs leading-relaxed max-w-md mx-auto">
              お互いの脳みそをハッキングし合い、
              <br />
              自分一人では到達できない「勘違いの向こう側」へ行くための
              <br />
              思考の実験場。
            </p>

            <button
              onClick={() => setShowCharter(true)}
              className="px-8 py-3 bg-brand-accent text-white font-bold rounded-full hover:bg-red-600 transition-colors text-lg"
            >
              入会する
            </button>

            <p className="text-brand-muted text-xs mt-4">
              ※法的効力は一切ありませんが、心の効力は絶大です。
            </p>
          </div>
        )}

        {/* 契約書 */}
        {showCharter && (
          <div className="bg-brand-card rounded-2xl p-6 border border-brand-border">
            <h2 className="text-xl font-bold text-center mb-1">
              {CHARTER_HEADER}
            </h2>
            <p className="text-brand-accent text-xs text-center mb-4">
              {CHARTER_DISCLAIMER}
            </p>

            <div
              className="charter-scroll pr-2 mb-4"
              onScroll={handleScroll}
            >
              {CHARTER_SECTIONS.map((section, i) => (
                <div key={i} className="mb-6">
                  <h3 className="text-sm font-bold text-brand-accent mb-2">
                    {section.title}
                  </h3>
                  <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
                    {section.body}
                  </p>
                </div>
              ))}

              <div className="border-t border-brand-border pt-4 mt-4">
                <p className="text-xs text-brand-muted text-right">
                  {CHARTER_DATE}
                </p>
                <p className="text-xs text-brand-muted text-right">
                  {CHARTER_PARTY_A}
                </p>
                <p className="text-xs text-brand-muted text-right">
                  {CHARTER_PARTY_B}
                </p>
              </div>
            </div>

            {!scrolledToBottom && (
              <p className="text-xs text-brand-accent text-center mb-4 animate-pulse">
                最後までスクロールして読んでください
              </p>
            )}

            {scrolledToBottom && (
              <div className="space-y-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    className="w-4 h-4 accent-brand-accent"
                  />
                  <span className="text-sm text-gray-300">
                    上記の覚書を読み、なんとなく合意しました
                  </span>
                </label>

                {agreed && (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="あなたの名前を入力（例: 田中靖哉）"
                      className="w-full px-4 py-3 bg-brand-darker border border-brand-border rounded-lg text-white placeholder-brand-muted focus:outline-none focus:border-brand-accent transition-colors"
                      onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                    />
                    <button
                      onClick={handleJoin}
                      disabled={!name.trim()}
                      className="w-full py-3 bg-brand-accent text-white font-bold rounded-lg hover:bg-red-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      全裸で入室する
                    </button>
                  </div>
                )}

                <button
                  onClick={() => {
                    setShowCharter(false);
                    setScrolledToBottom(false);
                    setAgreed(false);
                  }}
                  className="w-full text-sm text-brand-muted hover:text-white transition-colors py-2"
                >
                  やっぱりやめる（クーリングオフ）
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
