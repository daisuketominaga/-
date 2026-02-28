"use client";

import { useState } from "react";
import { motion, Reorder } from "framer-motion";

interface Props {
  data: string[];
  onComplete: (data: string[]) => void;
}

const suggestedValues = [
  "子どもの笑い声が響く暮らし",
  "自然を感じる毎日",
  "家族の温かい食卓",
  "静かで落ち着ける空間",
  "便利で快適な生活",
  "自分らしい空間づくり",
  "地域とのつながり",
  "将来の安心感",
];

export default function Step5TopValues({ data, onComplete }: Props) {
  const [selected, setSelected] = useState<string[]>(
    data.length > 0 ? [...data] : []
  );

  const toggleValue = (value: string) => {
    if (selected.includes(value)) {
      setSelected(selected.filter((v) => v !== value));
    } else if (selected.length < 3) {
      setSelected([...selected, value]);
    }
  };

  const isComplete = selected.length === 3;

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-text-dark mb-2">
          大切にしたいこと TOP3
        </h2>
        <p className="text-text-medium text-sm">
          あなたの回答をもとに、キーワードを提示しました。
          最も大切な3つを選んで、順位をつけてください。
        </p>
      </div>

      {/* 選択エリア */}
      <div className="mb-6">
        <p className="label-text mb-2">
          キーワードを3つ選んでください（{selected.length}/3）
        </p>
        <div className="grid grid-cols-2 gap-2">
          {suggestedValues.map((value, index) => {
            const isSelected = selected.includes(value);
            const rank = selected.indexOf(value) + 1;
            return (
              <motion.button
                key={value}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => toggleValue(value)}
                disabled={!isSelected && selected.length >= 3}
                className={`relative p-3 rounded-xl text-sm text-left transition-all ${
                  isSelected
                    ? "bg-primary-orange/10 border-2 border-primary-orange text-primary-orange font-medium"
                    : selected.length >= 3
                    ? "bg-gray-50 text-gray-300 border-2 border-transparent cursor-not-allowed"
                    : "bg-gray-50 text-text-dark border-2 border-transparent hover:bg-gray-100"
                }`}
              >
                {isSelected && (
                  <span className="absolute -top-2 -right-2 w-6 h-6 bg-primary-orange text-white rounded-full flex items-center justify-center text-xs font-bold">
                    {rank}
                  </span>
                )}
                {value}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* 順位表示 */}
      {selected.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="card mb-6"
        >
          <h3 className="font-bold text-text-dark mb-3 text-sm">
            あなたのTOP3（ドラッグで順位変更）
          </h3>
          <Reorder.Group
            axis="y"
            values={selected}
            onReorder={setSelected}
            className="space-y-2"
          >
            {selected.map((value, index) => (
              <Reorder.Item
                key={value}
                value={value}
                className="flex items-center gap-3 bg-secondary-cream rounded-xl p-3 cursor-grab active:cursor-grabbing"
              >
                <span className="w-7 h-7 bg-primary-orange text-white rounded-full flex items-center justify-center text-sm font-bold font-display flex-shrink-0">
                  {index + 1}
                </span>
                <span className="text-sm font-medium text-text-dark">
                  {value}
                </span>
                <span className="ml-auto text-text-light text-xs">⠿</span>
              </Reorder.Item>
            ))}
          </Reorder.Group>
        </motion.div>
      )}

      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => onComplete(selected)}
        disabled={!isComplete}
        className={`w-full mt-4 text-lg py-4 rounded-2xl font-medium transition-all ${
          isComplete
            ? "btn-primary"
            : "bg-gray-200 text-gray-400 cursor-not-allowed"
        }`}
      >
        価値観マップを見る
      </motion.button>
    </div>
  );
}
