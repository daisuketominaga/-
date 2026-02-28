"use client";

import { PRIORITY_ITEMS } from "@/lib/types";

interface Props {
  values: Record<string, number>;
  onChange: (key: string, value: number) => void;
}

export default function Step1Priorities({ values, onChange }: Props) {
  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <p className="text-sm text-brand-gold font-medium mb-2">Step 1 / 5</p>
        <h2 className="text-2xl font-bold text-brand-navy mb-2">
          暮らしのプライオリティ
        </h2>
        <p className="text-text-secondary">
          それぞれの項目について、あなたにとっての重要度を教えてください
        </p>
      </div>

      <div className="space-y-6">
        {PRIORITY_ITEMS.map((item) => {
          const value = values[item.key] ?? 50;
          return (
            <div key={item.key} className="bg-white rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="font-medium text-text-primary">
                  {item.label}
                </span>
                <span className="text-sm text-brand-navy font-bold min-w-[3rem] text-right">
                  {value}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-text-muted whitespace-nowrap">
                  低い
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={value}
                  onChange={(e) =>
                    onChange(item.key, parseInt(e.target.value))
                  }
                  className="flex-1"
                />
                <span className="text-xs text-text-muted whitespace-nowrap">
                  高い
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
