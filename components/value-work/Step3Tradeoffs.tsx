"use client";

import { TRADEOFF_PAIRS } from "@/lib/types";
import type { TradeoffAnswer } from "@/lib/types";

interface Props {
  values: TradeoffAnswer[];
  onChange: (values: TradeoffAnswer[]) => void;
}

export default function Step3Tradeoffs({ values, onChange }: Props) {
  const getAnswer = (
    pair: [string, string]
  ): TradeoffAnswer => {
    return (
      values.find(
        (v) => v.pair[0] === pair[0] && v.pair[1] === pair[1]
      ) || { pair, choice: "neutral" as const, reason: "" }
    );
  };

  const updateAnswer = (
    pair: [string, string],
    choice: "A" | "B" | "neutral",
    reason?: string
  ) => {
    const existing = values.filter(
      (v) => !(v.pair[0] === pair[0] && v.pair[1] === pair[1])
    );
    const current = getAnswer(pair);
    onChange([
      ...existing,
      { pair, choice, reason: reason !== undefined ? reason : current.reason },
    ]);
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <p className="text-sm text-brand-gold font-medium mb-2">Step 3 / 5</p>
        <h2 className="text-2xl font-bold text-brand-navy mb-2">
          トレードオフ選択
        </h2>
        <p className="text-text-secondary">
          どちらかを選ぶとしたら？直感で選んでください
        </p>
      </div>

      <div className="space-y-4">
        {TRADEOFF_PAIRS.map((pair, index) => {
          const answer = getAnswer(pair);
          return (
            <div key={index} className="bg-white rounded-xl p-5 shadow-sm">
              <p className="text-xs text-text-muted mb-3">
                Q{index + 1}. どちらを選びますか？
              </p>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <button
                  onClick={() => updateAnswer(pair, "A")}
                  className={`px-3 py-4 rounded-xl border-2 transition-all text-sm leading-tight ${
                    answer.choice === "A"
                      ? "border-brand-navy bg-brand-navy/5 text-brand-navy font-medium"
                      : "border-gray-200 text-text-primary hover:border-gray-300"
                  }`}
                >
                  {pair[0]}
                </button>
                <button
                  onClick={() => updateAnswer(pair, "neutral")}
                  className={`px-3 py-4 rounded-xl border-2 transition-all text-sm ${
                    answer.choice === "neutral"
                      ? "border-gray-400 bg-gray-50 text-gray-600 font-medium"
                      : "border-gray-200 text-text-muted hover:border-gray-300"
                  }`}
                >
                  どちらとも
                  <br />
                  言えない
                </button>
                <button
                  onClick={() => updateAnswer(pair, "B")}
                  className={`px-3 py-4 rounded-xl border-2 transition-all text-sm leading-tight ${
                    answer.choice === "B"
                      ? "border-brand-navy bg-brand-navy/5 text-brand-navy font-medium"
                      : "border-gray-200 text-text-primary hover:border-gray-300"
                  }`}
                >
                  {pair[1]}
                </button>
              </div>
              <input
                type="text"
                placeholder="理由があれば（任意）"
                value={answer.reason}
                onChange={(e) =>
                  updateAnswer(pair, answer.choice, e.target.value)
                }
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-brand-navy focus:outline-none text-sm"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
