"use client";

import { useState } from "react";
import { motion } from "framer-motion";

interface Props {
  data: string;
  onComplete: (data: string) => void;
  onSkip: () => void;
}

export default function Step4Letter({ data, onComplete, onSkip }: Props) {
  const [letter, setLetter] = useState(data || "");

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h2 className="text-xl font-bold text-text-dark mb-2">
          家族への手紙
        </h2>
        <p className="text-text-medium text-sm leading-relaxed">
          このステップは任意です。でも、書いてくださった方には、
          より深い提案をお届けできます。
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="card mb-6"
      >
        <div className="bg-secondary-cream rounded-2xl p-4 mb-4">
          <p className="text-text-dark text-sm leading-relaxed italic">
            「5年後、この家で暮らしている家族に一通の手紙を書くとしたら、
            何を伝えたいですか？」
          </p>
        </div>

        <textarea
          className="input-field text-sm min-h-[200px] resize-none leading-relaxed"
          placeholder="5年後の家族へ、あなたの想いを書いてみてください..."
          value={letter}
          onChange={(e) => setLetter(e.target.value)}
        />

        {letter.length > 0 && (
          <div className="text-right mt-2">
            <span className="text-xs text-text-light">
              {letter.length}文字
            </span>
          </div>
        )}
      </motion.div>

      <div className="space-y-3">
        {letter.length > 0 ? (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => onComplete(letter)}
            className="btn-primary w-full text-lg py-4"
          >
            次へ進む
          </motion.button>
        ) : (
          <>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={onSkip}
              className="btn-secondary w-full py-4"
            >
              スキップして次へ
            </motion.button>
            <p className="text-xs text-text-light text-center">
              手紙を書いてくださると、より深い提案ができます
            </p>
          </>
        )}
      </div>
    </div>
  );
}
