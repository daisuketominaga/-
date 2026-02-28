"use client";

import { useState } from "react";

interface Props {
  suggestedKeywords: string[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  loading: boolean;
}

export default function Step5TopValues({
  suggestedKeywords,
  selectedValues,
  onChange,
  loading,
}: Props) {
  const [draggedItem, setDraggedItem] = useState<string | null>(null);

  const toggleValue = (keyword: string) => {
    if (selectedValues.includes(keyword)) {
      onChange(selectedValues.filter((v) => v !== keyword));
    } else if (selectedValues.length < 3) {
      onChange([...selectedValues, keyword]);
    }
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    const updated = [...selectedValues];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    onChange(updated);
  };

  const moveDown = (index: number) => {
    if (index === selectedValues.length - 1) return;
    const updated = [...selectedValues];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    onChange(updated);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center mb-8">
          <p className="text-sm text-brand-gold font-medium mb-2">
            Step 5 / 5
          </p>
          <h2 className="text-2xl font-bold text-brand-navy mb-2">
            大切にしたいこと
          </h2>
          <p className="text-text-secondary">
            あなたの回答を分析しています...
          </p>
        </div>
        <div className="flex justify-center py-12">
          <div className="w-12 h-12 border-4 border-brand-navy/20 border-t-brand-navy rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <p className="text-sm text-brand-gold font-medium mb-2">Step 5 / 5</p>
        <h2 className="text-2xl font-bold text-brand-navy mb-2">
          大切にしたいこと
        </h2>
        <p className="text-text-secondary">
          あなたの回答から見えてきた価値観です。
          <br />
          最も大切な3つを選んでください。
        </p>
      </div>

      {/* キーワード選択 */}
      <div className="bg-white rounded-xl p-5 shadow-sm">
        <p className="text-sm text-text-muted mb-4">
          {selectedValues.length}/3 選択済み
        </p>
        <div className="flex flex-wrap gap-2">
          {suggestedKeywords.map((keyword) => {
            const isSelected = selectedValues.includes(keyword);
            const isDisabled = !isSelected && selectedValues.length >= 3;
            return (
              <button
                key={keyword}
                onClick={() => !isDisabled && toggleValue(keyword)}
                disabled={isDisabled}
                className={`px-4 py-2.5 rounded-full border-2 transition-all text-sm ${
                  isSelected
                    ? "border-brand-navy bg-brand-navy text-white font-medium"
                    : isDisabled
                      ? "border-gray-100 bg-gray-50 text-text-muted cursor-not-allowed"
                      : "border-gray-200 text-text-primary hover:border-brand-navy/50"
                }`}
              >
                {keyword}
              </button>
            );
          })}
        </div>
      </div>

      {/* 順位付け */}
      {selectedValues.length > 0 && (
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <h3 className="font-bold text-text-primary mb-3">
            選んだ順に並べてください
          </h3>
          <p className="text-xs text-text-muted mb-4">
            上が最も大切なもの
          </p>
          <div className="space-y-2">
            {selectedValues.map((value, index) => (
              <div
                key={value}
                className="flex items-center gap-3 bg-background-cream rounded-xl px-4 py-3"
              >
                <span className="w-7 h-7 bg-brand-navy text-white rounded-full flex items-center justify-center text-sm font-bold shrink-0">
                  {index + 1}
                </span>
                <span className="flex-1 font-medium text-text-primary">
                  {value}
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => moveUp(index)}
                    disabled={index === 0}
                    className="p-1 text-text-muted hover:text-brand-navy disabled:opacity-30"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 15l7-7 7 7"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={() => moveDown(index)}
                    disabled={index === selectedValues.length - 1}
                    className="p-1 text-text-muted hover:text-brand-navy disabled:opacity-30"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
