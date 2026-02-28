"use client";

import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
} from "recharts";
import type { ValueMap as ValueMapType } from "@/lib/types";

interface Props {
  valueMap: ValueMapType | null;
  compact?: boolean;
}

const AXIS_LABELS: Record<string, [string, string]> = {
  stability_vs_adventure: ["安定志向", "冒険志向"],
  function_vs_emotion: ["機能重視", "情緒重視"],
  private_vs_shared: ["個人の空間", "家族の共有空間"],
  urban_vs_nature: ["都市的", "自然的"],
  asset_vs_lifestyle: ["資産形成", "暮らしの豊かさ"],
};

function getAxisLabel(key: string, value: number): string {
  const labels = AXIS_LABELS[key];
  if (!labels) return key;
  // value: -100 to 100, negative = first label dominant, positive = second label dominant
  if (Math.abs(value) < 20) return `${labels[0]} / ${labels[1]}`;
  return value < 0 ? labels[0] : labels[1];
}

function normalizeForRadar(
  radarChart: ValueMapType["radar_chart"]
): { axis: string; value: number; fullMark: 100 }[] {
  return Object.entries(radarChart).map(([key, val]) => ({
    axis: AXIS_LABELS[key]
      ? val < 0
        ? AXIS_LABELS[key][0]
        : AXIS_LABELS[key][1]
      : key,
    value: Math.abs(val),
    fullMark: 100,
  }));
}

export default function ValueMapComponent({ valueMap, compact }: Props) {
  if (!valueMap) {
    return (
      <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
        <div className="w-16 h-16 bg-background-cream rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-8 h-8 text-text-muted"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
        </div>
        <p className="text-text-secondary">
          価値観マップはまだ生成されていません
        </p>
        <p className="text-text-muted text-sm mt-1">
          ワークの回答後にAIが分析します
        </p>
      </div>
    );
  }

  const radarData = normalizeForRadar(valueMap.radar_chart);

  return (
    <div className={compact ? "space-y-4" : "space-y-6"}>
      {/* レーダーチャート */}
      <div
        className={`bg-white rounded-2xl shadow-sm ${compact ? "p-4" : "p-6"}`}
      >
        {!compact && (
          <h3 className="text-lg font-bold text-brand-navy mb-4 text-center">
            あなたの価値観マップ
          </h3>
        )}
        <div className={compact ? "h-[250px]" : "h-[320px]"}>
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData} cx="50%" cy="50%">
              <PolarGrid stroke="#E5E7EB" />
              <PolarAngleAxis
                dataKey="axis"
                tick={{ fontSize: compact ? 10 : 12, fill: "#6B7280" }}
              />
              <Radar
                dataKey="value"
                stroke="#1B3A5C"
                fill="#1B3A5C"
                fillOpacity={0.15}
                strokeWidth={2}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* キーワードクラウド */}
      {valueMap.keywords.length > 0 && (
        <div
          className={`bg-white rounded-2xl shadow-sm ${compact ? "p-4" : "p-6"}`}
        >
          {!compact && (
            <h3 className="text-lg font-bold text-brand-navy mb-4 text-center">
              あなたの大切なキーワード
            </h3>
          )}
          <div className="flex flex-wrap gap-2 justify-center">
            {valueMap.keywords.map((kw, i) => {
              const size = Math.max(0.75, Math.min(1.5, kw.weight / 60));
              return (
                <span
                  key={i}
                  className="inline-block px-3 py-1.5 rounded-full bg-brand-navy/5 text-brand-navy"
                  style={{ fontSize: `${size}rem` }}
                >
                  {kw.word}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* サマリー */}
      {valueMap.summary && !compact && (
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h3 className="text-lg font-bold text-brand-navy mb-3">
            AIによる分析
          </h3>
          <p className="text-text-primary leading-relaxed whitespace-pre-wrap">
            {valueMap.summary}
          </p>
        </div>
      )}
    </div>
  );
}
