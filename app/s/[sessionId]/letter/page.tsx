"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  getSession,
  getCustomer,
  getLetter,
} from "@/lib/store";
import type { Customer, ProposalLetter } from "@/lib/types";

export default function LetterOutputPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();
  const printRef = useRef<HTMLDivElement>(null);

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [letter, setLetter] = useState<ProposalLetter | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    const session = getSession(sessionId);
    if (session) {
      const c = getCustomer(session.customer_id);
      if (c) setCustomer(c);
    }
    setLetter(getLetter(sessionId) || null);
  }, [sessionId]);

  const letterContent = letter
    ? (letter.edited_content || letter.ai_draft) +
      (letter.personal_note
        ? `\n\n■ 最後に\n\n${letter.personal_note}`
        : "")
    : "";

  const handlePrint = () => {
    window.print();
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(letterContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement("textarea");
      textarea.value = letterContent;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!letter) {
    return (
      <div className="min-h-screen bg-background-warm flex items-center justify-center">
        <div className="text-center">
          <p className="text-text-muted mb-4">レターが見つかりません</p>
          <button
            onClick={() => router.push(`/s/${sessionId}/review`)}
            className="text-brand-navy font-medium"
          >
            レビュー画面に戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-warm">
      {/* ヘッダー（印刷時は非表示） */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10 print:hidden">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push(`/s/${sessionId}/review`)}
              className="text-text-muted hover:text-text-primary"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <h1 className="text-lg font-bold text-brand-navy">
              提案レター出力
            </h1>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 print:p-0 print:max-w-none">
        {/* 出力オプション（印刷時は非表示） */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 print:hidden">
          <button
            onClick={handlePrint}
            className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow text-center"
          >
            <svg
              className="w-8 h-8 text-brand-navy mx-auto mb-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
              />
            </svg>
            <span className="text-sm font-medium text-text-primary">
              印刷 / PDF
            </span>
          </button>

          <button
            onClick={handleCopy}
            className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow text-center"
          >
            <svg
              className="w-8 h-8 text-brand-navy mx-auto mb-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
            <span className="text-sm font-medium text-text-primary">
              {copied ? "コピーしました" : "テキストコピー"}
            </span>
          </button>

          <button
            onClick={() => {
              const subject = `${customer?.name || ""}様 ライフデザイン面談のご報告`;
              const mailtoUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(letterContent)}`;
              window.open(mailtoUrl);
            }}
            className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow text-center"
          >
            <svg
              className="w-8 h-8 text-brand-navy mx-auto mb-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            <span className="text-sm font-medium text-text-primary">
              メール送信
            </span>
          </button>

          <button
            onClick={() => router.push("/dashboard")}
            className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow text-center"
          >
            <svg
              className="w-8 h-8 text-brand-navy mx-auto mb-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
              />
            </svg>
            <span className="text-sm font-medium text-text-primary">
              ダッシュボード
            </span>
          </button>
        </div>

        {/* レタープレビュー */}
        <div
          ref={printRef}
          className="bg-white rounded-2xl shadow-sm print:shadow-none print:rounded-none"
        >
          {/* レターヘッド */}
          <div className="border-b-2 border-brand-navy px-8 py-6 print:px-12 print:py-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-brand-navy rounded-lg flex items-center justify-center print:w-12 print:h-12">
                  <span className="text-white font-bold text-lg">一</span>
                </div>
                <div>
                  <h2 className="font-bold text-brand-navy text-lg">
                    株式会社イチエン不動産
                  </h2>
                  <p className="text-xs text-text-muted">
                    ICHIEN FUDOSAN Co., Ltd.
                  </p>
                </div>
              </div>
              <p className="text-xs text-text-muted">
                {new Date().toLocaleDateString("ja-JP", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
          </div>

          {/* レター本文 */}
          <div className="px-8 py-8 print:px-12 print:py-10">
            <div className="whitespace-pre-wrap text-text-primary leading-[1.9] text-[15px] print:text-base">
              {letterContent}
            </div>
          </div>
        </div>
      </div>

      {/* 印刷用スタイル */}
      <style jsx global>{`
        @media print {
          body {
            background: white !important;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
