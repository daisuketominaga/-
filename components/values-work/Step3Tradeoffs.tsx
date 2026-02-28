"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { TRADEOFF_PAIRS } from "@/types";
import type { TradeoffChoice } from "@/types";

interface Props {
  data: TradeoffChoice[];
  onComplete: (data: TradeoffChoice[]) => void;
}

export default function Step3Tradeoffs({ data, onComplete }: Props) {
  const [choices, setChoices] = useState<TradeoffChoice[]>(() =>
    TRADEOFF_PAIRS.map((pair, i) => ({
      pair,
      choice: data[i]?.choice || ("neutral" as const),
      reason: data[i]?.reason || "",
    }))
  );
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const handleChoice = (
    index: number,
    choice: "A" | "B" | "neutral"
  ) => {
    setChoices((prev) =>
      prev.map((c, i) => (i === index ? { ...c, choice } : c))
    );
  };

  const handleReason = (index: number, reason: string) => {
    setChoices((prev) =>
      prev.map((c, i) => (i === index ? { ...c, reason } : c))
    );
  };

  const allAnswered = choices.every((c) => c.choice !== "neutral" || true);

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-text-dark mb-2">
          トレードオフ選択
        </h2>
        <p className="text-text-medium text-sm">
          どちらかを選ぶとしたら？直感で選んでください。「どちらでもない」もOKです。
        </p>
      </div>

      <div className="space-y-4">
        {choices.map((item, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="card"
          >
            <div className="text-xs text-text-light mb-3 text-center">
              Q{index + 1}
            </div>

            <div className="flex items-stretch gap-2 mb-3">
              {/* Option A */}
              <button
                onClick={() => handleChoice(index, "A")}
                className={`flex-1 p-3 rounded-xl text-sm font-medium transition-all text-center ${
                  item.choice === "A"
                    ? "bg-primary-orange text-white shadow-button"
                    : "bg-gray-50 text-text-dark hover:bg-gray-100"
                }`}
              >
                {item.pair[0]}
              </button>

              {/* VS */}
              <div className="flex items-center">
                <span className="text-xs text-text-light font-display font-bold">
                  VS
                </span>
              </div>

              {/* Option B */}
              <button
                onClick={() => handleChoice(index, "B")}
                className={`flex-1 p-3 rounded-xl text-sm font-medium transition-all text-center ${
                  item.choice === "B"
                    ? "bg-accent-teal text-white"
                    : "bg-gray-50 text-text-dark hover:bg-gray-100"
                }`}
              >
                {item.pair[1]}
              </button>
            </div>

            {/* Neutral option */}
            <button
              onClick={() => handleChoice(index, "neutral")}
              className={`w-full py-2 rounded-lg text-xs transition-all ${
                item.choice === "neutral"
                  ? "bg-gray-200 text-text-dark font-medium"
                  : "text-text-light hover:bg-gray-50"
              }`}
            >
              どちらでもない
            </button>

            {/* Reason (expandable) */}
            {item.choice !== "neutral" && (
              <div className="mt-2">
                <button
                  onClick={() =>
                    setExpandedIndex(expandedIndex === index ? null : index)
                  }
                  className="text-xs text-primary-orange"
                >
                  {expandedIndex === index
                    ? "閉じる"
                    : "理由を教えてください（任意）"}
                </button>
                {expandedIndex === index && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    transition={{ duration: 0.2 }}
                  >
                    <textarea
                      className="input-field text-sm mt-2 min-h-[60px] resize-none"
                      placeholder="選んだ理由を教えてください..."
                      value={item.reason}
                      onChange={(e) => handleReason(index, e.target.value)}
                    />
                  </motion.div>
                )}
              </div>
            )}
          </motion.div>
        ))}
      </div>

      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => onComplete(choices)}
        disabled={!allAnswered}
        className="btn-primary w-full mt-8 text-lg py-4"
      >
        次へ進む
      </motion.button>
    </div>
  );
}
