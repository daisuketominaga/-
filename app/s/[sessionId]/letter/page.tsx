"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import StaffNav from "@/components/StaffNav";
import { getSession, saveProposalLetter, markLetterSent } from "@/lib/sessionStore";
import type { Session } from "@/types";

export default function LetterPage({
  params,
}: {
  params: { sessionId: string };
}) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    setSession(getSession(params.sessionId) || null);
  }, [params.sessionId]);

  const letter = session?.proposalLetter;

  const [editedContent, setEditedContent] = useState("");
  const [personalNote, setPersonalNote] = useState("");
  const [sentStatus, setSentStatus] = useState<"editing" | "preview" | "sent">("editing");
  const [selectedFormats, setSelectedFormats] = useState<string[]>([]);

  useEffect(() => {
    if (letter) {
      setEditedContent(letter.editedContent || letter.aiDraft || "");
      setPersonalNote(letter.personalNote || "");
    }
  }, [letter]);

  const toggleFormat = (format: string) => {
    setSelectedFormats((prev) =>
      prev.includes(format)
        ? prev.filter((f) => f !== format)
        : [...prev, format]
    );
  };

  const handleSave = () => {
    if (!session?.proposalLetter) return;
    saveProposalLetter(params.sessionId, {
      ...session.proposalLetter,
      editedContent,
      personalNote,
    });
  };

  const handleSend = () => {
    handleSave();
    markLetterSent(params.sessionId, selectedFormats.join("・"));

    if (selectedFormats.includes("pdf")) {
      setTimeout(() => window.print(), 300);
    }
    setSentStatus("sent");
  };

  if (sentStatus === "sent") {
    return (
      <div className="min-h-screen bg-secondary-cream">
        <StaffNav />
        <main className="max-w-lg mx-auto px-4 py-12">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="card text-center"
          >
            <div className="text-5xl mb-4">🎉</div>
            <h2 className="text-xl font-bold text-text-dark mb-2">
              レターを送付しました
            </h2>
            <p className="text-text-medium text-sm mb-6">
              {session?.customer.name} 様への提案レターを
              {selectedFormats.join("・")}で送付しました。
            </p>
            <div className="space-y-3">
              <button
                onClick={() => router.push(`/s/${params.sessionId}/staff`)}
                className="btn-primary w-full"
              >
                面談画面に戻る
              </button>
              <button
                onClick={() => router.push("/dashboard")}
                className="btn-secondary w-full"
              >
                ダッシュボードに戻る
              </button>
            </div>
          </motion.div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary-cream">
      <div className="no-print">
        <StaffNav />
      </div>
      <main className="max-w-3xl mx-auto px-4 py-6">
        <div className="mb-6 no-print">
          <h1 className="text-xl font-bold text-text-dark mb-1">
            提案レター — {session?.customer.name} 様
          </h1>
          <p className="text-text-light text-sm">
            AIの下書きを確認・編集して送付してください
          </p>
        </div>

        <div className="flex gap-1 mb-4 bg-white rounded-xl p-1 no-print">
          <button
            onClick={() => setSentStatus("editing")}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
              sentStatus === "editing"
                ? "bg-primary-orange text-white"
                : "text-text-medium"
            }`}
          >
            編集
          </button>
          <button
            onClick={() => { handleSave(); setSentStatus("preview"); }}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
              sentStatus === "preview"
                ? "bg-primary-orange text-white"
                : "text-text-medium"
            }`}
          >
            プレビュー
          </button>
        </div>

        {sentStatus === "editing" ? (
          <div className="space-y-4 no-print">
            <div className="card">
              <h3 className="font-bold text-text-dark text-sm mb-3">
                レター本文
              </h3>
              <textarea
                className="input-field text-sm min-h-[400px] resize-y leading-relaxed font-sans"
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
              />
            </div>

            <div className="card">
              <h3 className="font-bold text-text-dark text-sm mb-2">
                トミーさんの個人的メッセージ
              </h3>
              <p className="text-xs text-text-light mb-3">
                「最後に」セクションに入る個人的なメッセージを書いてください
              </p>
              <textarea
                className="input-field text-sm min-h-[120px] resize-none leading-relaxed"
                placeholder="今日お話しして感じたこと、印象に残ったことなど..."
                value={personalNote}
                onChange={(e) => setPersonalNote(e.target.value)}
              />
            </div>
          </div>
        ) : (
          <div className="card" id="letter-preview">
            <div className="bg-white border border-gray-200 rounded-xl p-6 md:p-8 print-content">
              <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-primary-orange rounded-lg flex items-center justify-center text-white font-display font-bold text-xs">
                    1¥
                  </div>
                  <div>
                    <div className="font-display font-semibold text-text-dark text-sm">
                      株式会社イチエン不動産
                    </div>
                    <div className="text-[10px] text-text-light">
                      ライフデザイン面談
                    </div>
                  </div>
                </div>
                <div className="text-xs text-text-light">
                  {new Date().toLocaleDateString("ja-JP")}
                </div>
              </div>

              <div className="text-sm text-text-dark leading-relaxed whitespace-pre-line mb-8">
                {editedContent}
              </div>

              {personalNote && (
                <div className="bg-secondary-cream rounded-xl p-4 mb-6">
                  <p className="text-sm text-text-dark leading-relaxed whitespace-pre-line">
                    {personalNote}
                  </p>
                </div>
              )}

              <div className="text-right text-sm text-text-medium">
                <p>株式会社イチエン不動産</p>
                <p className="font-medium">富永 大介</p>
              </div>
            </div>
          </div>
        )}

        <div className="card mt-4 no-print">
          <h3 className="font-bold text-text-dark text-sm mb-3">
            送付方法を選択
          </h3>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {[
              { key: "pdf", label: "PDF", icon: "📄" },
              { key: "email", label: "メール", icon: "📧" },
              { key: "line", label: "LINE", icon: "💬" },
              { key: "screen", label: "画面表示", icon: "📱" },
            ].map((format) => (
              <button
                key={format.key}
                onClick={() => toggleFormat(format.key)}
                className={`p-3 rounded-xl text-sm flex items-center gap-2 transition-all ${
                  selectedFormats.includes(format.key)
                    ? "bg-primary-orange/10 border-2 border-primary-orange text-primary-orange font-medium"
                    : "bg-gray-50 border-2 border-transparent text-text-dark hover:bg-gray-100"
                }`}
              >
                <span>{format.icon}</span>
                <span>{format.label}</span>
              </button>
            ))}
          </div>
          <button
            onClick={handleSend}
            disabled={selectedFormats.length === 0}
            className={`w-full py-3 rounded-2xl font-medium transition-all ${
              selectedFormats.length > 0
                ? "btn-primary"
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
            }`}
          >
            レターを送付する
          </button>
        </div>
      </main>
    </div>
  );
}
