"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { PRIORITY_ITEMS } from "@/types";

interface Props {
  data: Record<string, number>;
  onComplete: (data: Record<string, number>) => void;
}

export default function Step1Priorities({ data, onComplete }: Props) {
  const [values, setValues] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    PRIORITY_ITEMS.forEach((item) => {
      initial[item.key] = data[item.key] ?? 50;
    });
    return initial;
  });

  const handleChange = (key: string, value: number) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-text-dark mb-2">
          暮らしのプライオリティ
        </h2>
        <p className="text-text-medium text-sm">
          それぞれの項目があなたにとってどれくらい重要か、スライダーで教えてください。
        </p>
      </div>

      <div className="space-y-5">
        {PRIORITY_ITEMS.map((item, index) => (
          <motion.div
            key={item.key}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.08 }}
            className="card"
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">{item.icon}</span>
              <span className="font-medium text-text-dark">{item.label}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-text-light w-16 text-right">
                低い
              </span>
              <input
                type="range"
                min="0"
                max="100"
                value={values[item.key]}
                onChange={(e) =>
                  handleChange(item.key, parseInt(e.target.value))
                }
                className="flex-1 h-2 bg-gray-200 rounded-full appearance-none cursor-pointer
                  [&::-webkit-slider-thumb]:appearance-none
                  [&::-webkit-slider-thumb]:h-6
                  [&::-webkit-slider-thumb]:w-6
                  [&::-webkit-slider-thumb]:rounded-full
                  [&::-webkit-slider-thumb]:bg-primary-orange
                  [&::-webkit-slider-thumb]:shadow-button
                  [&::-webkit-slider-thumb]:cursor-pointer
                  [&::-webkit-slider-thumb]:transition-transform
                  [&::-webkit-slider-thumb]:hover:scale-110"
              />
              <span className="text-xs text-text-light w-16">高い</span>
            </div>
            <div className="text-center mt-1">
              <span className="text-sm font-display font-semibold text-primary-orange">
                {values[item.key]}
              </span>
            </div>
          </motion.div>
        ))}
      </div>

      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => onComplete(values)}
        className="btn-primary w-full mt-8 text-lg py-4"
      >
        次へ進む
      </motion.button>
    </div>
  );
}
