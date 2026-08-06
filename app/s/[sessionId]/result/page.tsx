"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import ValuesMapDisplay from "@/components/ValuesMapDisplay";
import { getSession } from "@/lib/sessionStore";
import type { Session } from "@/types";

export default function ResultPage({
  params,
}: {
  params: { sessionId: string };
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [feedback, setFeedback] = useState("");
  const [feedbackSent, setFeedbackSent] = useState(false);

  useEffect(() => {
    setSession(getSession(params.sessionId) || null);
  }, [params.sessionId]);

  if (!session || !session.valueMap) {
    return (
      <div className="min-h-screen bg-secondary-cream flex items-center justify-center px-4">
        <div className="card text-center max-w-sm">
          <div className="text-5xl mb-4">🔍</div>
          <h2 className="text-lg font-bold text-text-dark mb-2">
            結果が見つかりません
          </h2>
          <p className="text-text-medium text-sm">
            面談が完了すると、こちらで結果をご覧いただけます。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-secondary-cream to-white">
      <header className="bg-white/90 backdrop-blur-md border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-2">
          <div className="w-8 h-8 bg-primary-orange rounded-lg flex items-center justify-center text-white font-display font-bold text-xs">
            1¥
          </div>
          <div>
            <div className="font-display font-semibold text-text-dark text-sm leading-tight">
              イチエン不動産
            </div>
            <div className="text-[10px] text-text-light">
              ライフデザイン面談 結果
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-xl font-bold text-text-dark">
            {session.customer.name} 様の
            <br />
            ライフデザイン面談 結果
          </h1>
          <p className="text-text-light text-sm mt-1">
            {new Date(session.createdAt).toLocaleDateString("ja-JP")}
          </p>
        </motion.div>

        <ValuesMapDisplay
          valueMap={session.valueMap}
          valueWork={session.valueWork}
          sessionId={params.sessionId}
        />

        {session.proposalLetter && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.0 }}
            className="card mt-8"
          >
            <h3 className="font-bold text-text-dark mb-4 text-center text-lg">
              提案レター
            </h3>
            <div className="bg-secondary-cream rounded-xl p-5">
              <div className="text-sm text-text-dark leading-relaxed whitespace-pre-line">
                {session.proposalLetter.editedContent ||
                  session.proposalLetter.aiDraft}
              </div>
            </div>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2 }}
          className="card mt-8"
        >
          <h3 className="font-bold text-text-dark mb-2 text-center">
            感想をお聞かせください
          </h3>
          <p className="text-xs text-text-light text-center mb-4">
            今日の面談はいかがでしたか？一言いただけると嬉しいです。
          </p>
          {feedbackSent ? (
            <div className="text-center py-4">
              <div className="text-3xl mb-2">🙏</div>
              <p className="text-sm text-text-medium">ご感想ありがとうございます！</p>
            </div>
          ) : (
            <>
              <textarea
                className="input-field text-sm min-h-[80px] resize-none"
                placeholder="感想を入力してください..."
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
              />
              <button
                className="btn-teal w-full mt-3 text-sm"
                disabled={!feedback.trim()}
                onClick={() => setFeedbackSent(true)}
              >
                送信する
              </button>
            </>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.4 }}
          className="card mt-8 text-center"
        >
          <div className="text-3xl mb-2">🤝</div>
          <h3 className="font-bold text-text-dark mb-2">
            お友だちに紹介しませんか？
          </h3>
          <p className="text-xs text-text-light mb-4">
            イチエン不動産の「ライフデザイン面談」を
            大切なお友だちにもご紹介ください
          </p>
          <button className="btn-secondary w-full text-sm">
            紹介カードを送る
          </button>
        </motion.div>

        <div className="text-center mt-10 mb-6">
          <p className="text-xs text-text-light">
            株式会社イチエン不動産
            <br />
            「物件を探す前に、人生を探す。」
          </p>
        </div>
      </main>
    </div>
  );
}
