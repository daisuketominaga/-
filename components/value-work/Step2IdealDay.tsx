"use client";

import { WEEKEND_OPTIONS } from "@/lib/types";

interface IdealDay {
  morning_activity: string;
  evening_scene: string;
  weekend_activities: string[];
}

interface Props {
  values: IdealDay;
  onChange: (values: IdealDay) => void;
}

const MORNING_OPTIONS = [
  "コーヒーを淹れてゆっくり飲む",
  "家族と一緒に朝食をつくる",
  "ジョギングや散歩に出かける",
  "ベランダや庭で朝の空気を吸う",
  "ゆっくり読書をする",
  "子どもと遊ぶ",
];

export default function Step2IdealDay({ values, onChange }: Props) {
  const toggleWeekend = (activity: string) => {
    const current = values.weekend_activities || [];
    const updated = current.includes(activity)
      ? current.filter((a) => a !== activity)
      : [...current, activity];
    onChange({ ...values, weekend_activities: updated });
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <p className="text-sm text-brand-gold font-medium mb-2">Step 2 / 5</p>
        <h2 className="text-2xl font-bold text-brand-navy mb-2">
          理想の一日
        </h2>
        <p className="text-text-secondary">
          あなたの理想の暮らしの風景を教えてください
        </p>
      </div>

      {/* 朝の過ごし方 */}
      <div className="bg-white rounded-xl p-5 shadow-sm">
        <h3 className="font-bold text-text-primary mb-3">
          休日の朝、最初にすることは？
        </h3>
        <div className="grid grid-cols-1 gap-2">
          {MORNING_OPTIONS.map((option) => (
            <button
              key={option}
              onClick={() =>
                onChange({ ...values, morning_activity: option })
              }
              className={`text-left px-4 py-3 rounded-xl border-2 transition-all ${
                values.morning_activity === option
                  ? "border-brand-navy bg-brand-navy/5 text-brand-navy font-medium"
                  : "border-gray-200 text-text-primary hover:border-gray-300"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
        <div className="mt-3">
          <input
            type="text"
            placeholder="その他（自由記述）"
            value={
              MORNING_OPTIONS.includes(values.morning_activity)
                ? ""
                : values.morning_activity
            }
            onChange={(e) =>
              onChange({ ...values, morning_activity: e.target.value })
            }
            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-brand-navy focus:outline-none"
          />
        </div>
      </div>

      {/* 夕方の光景 */}
      <div className="bg-white rounded-xl p-5 shadow-sm">
        <h3 className="font-bold text-text-primary mb-3">
          夕方、家に帰ってきた時の理想の光景は？
        </h3>
        <textarea
          value={values.evening_scene}
          onChange={(e) =>
            onChange({ ...values, evening_scene: e.target.value })
          }
          placeholder="例：リビングの窓から夕日が差し込んでいて、キッチンから美味しそうな匂いがする..."
          rows={4}
          className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-brand-navy focus:outline-none resize-none"
        />
      </div>

      {/* 週末の活動 */}
      <div className="bg-white rounded-xl p-5 shadow-sm">
        <h3 className="font-bold text-text-primary mb-3">
          週末に家族でしたいことは？（複数選択可）
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {WEEKEND_OPTIONS.map((option) => (
            <button
              key={option}
              onClick={() => toggleWeekend(option)}
              className={`text-left px-4 py-3 rounded-xl border-2 transition-all text-sm ${
                (values.weekend_activities || []).includes(option)
                  ? "border-brand-navy bg-brand-navy/5 text-brand-navy font-medium"
                  : "border-gray-200 text-text-primary hover:border-gray-300"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
