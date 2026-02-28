"use client";

import { motion } from "framer-motion";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";
import type { ValueMap, ValueWork } from "@/types";

interface Props {
  valueMap: ValueMap;
  valueWork?: ValueWork;
  sessionId?: string;
  compact?: boolean;
}

const axisLabels: Record<string, [string, string]> = {
  stability_vs_adventure: ["安定志向", "冒険志向"],
  function_vs_emotion: ["機能重視", "情緒重視"],
  private_vs_shared: ["個人の空間", "家族の共有空間"],
  urban_vs_nature: ["都市的", "自然的"],
  asset_vs_lifestyle: ["資産形成", "暮らしの豊かさ"],
};

export default function ValuesMapDisplay({
  valueMap,
  valueWork,
  sessionId,
  compact = false,
}: Props) {
  const radarData = Object.entries(valueMap.radarChart).map(([key, value]) => {
    const labels = axisLabels[key];
    const normalizedValue = ((value + 100) / 200) * 100;
    return {
      axis: normalizedValue >= 50 ? labels[1] : labels[0],
      value: Math.abs(normalizedValue - 50) + 50,
      fullMark: 100,
    };
  });

  return (
    <div className={compact ? "" : "max-w-2xl mx-auto px-4 py-8"}>
      {!compact && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="text-4xl mb-3">🗺️</div>
          <h2 className="text-2xl font-bold text-text-dark mb-2">
            あなたの価値観マップ
          </h2>
          <p className="text-text-medium text-sm">
            面談とワークの内容をもとに、あなたの価値観を可視化しました
          </p>
        </motion.div>
      )}

      {/* レーダーチャート */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2, duration: 0.6 }}
        className="card mb-6"
      >
        {!compact && (
          <h3 className="font-bold text-text-dark mb-4 text-center">
            価値観のバランス
          </h3>
        )}
        <div className={compact ? "h-[200px]" : "h-[300px]"}>
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData}>
              <PolarGrid stroke="#e5e7eb" />
              <PolarAngleAxis
                dataKey="axis"
                tick={{ fontSize: compact ? 10 : 12, fill: "#6B6B6B" }}
              />
              <PolarRadiusAxis
                angle={90}
                domain={[0, 100]}
                tick={false}
                axisLine={false}
              />
              <Radar
                name="価値観"
                dataKey="value"
                stroke="#FF7A45"
                fill="#FF7A45"
                fillOpacity={0.2}
                strokeWidth={2}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* キーワードクラウド */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="card mb-6"
      >
        {!compact && (
          <h3 className="font-bold text-text-dark mb-4 text-center">
            あなたを表すキーワード
          </h3>
        )}
        <div className="flex flex-wrap gap-2 justify-center">
          {valueMap.keywords.map((kw, index) => {
            const size =
              kw.weight > 85
                ? "text-lg px-4 py-2"
                : kw.weight > 70
                ? "text-base px-3 py-1.5"
                : "text-sm px-2.5 py-1";
            const opacity =
              kw.weight > 85 ? "100" : kw.weight > 70 ? "80" : "60";
            return (
              <motion.span
                key={kw.word}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5 + index * 0.08 }}
                className={`${size} bg-primary-orange/${opacity === "100" ? "15" : opacity === "80" ? "10" : "5"} text-primary-orange rounded-full font-medium`}
              >
                {kw.word}
              </motion.span>
            );
          })}
        </div>
      </motion.div>

      {/* サマリー */}
      {!compact && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="card mb-6"
        >
          <h3 className="font-bold text-text-dark mb-3 text-center">
            AIによる分析
          </h3>
          <p className="text-text-medium text-sm leading-relaxed">
            {valueMap.summary}
          </p>
        </motion.div>
      )}

      {/* TOP3 */}
      {valueWork && valueWork.step5TopValues.length === 3 && !compact && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="card mb-6"
        >
          <h3 className="font-bold text-text-dark mb-4 text-center">
            あなたが選んだ 大切なこと TOP3
          </h3>
          <div className="space-y-2">
            {valueWork.step5TopValues.map((value, i) => (
              <div
                key={value}
                className="flex items-center gap-3 bg-secondary-cream rounded-xl p-3"
              >
                <span className="w-8 h-8 bg-primary-orange text-white rounded-full flex items-center justify-center text-sm font-bold font-display flex-shrink-0">
                  {i + 1}
                </span>
                <span className="font-medium text-text-dark">{value}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* 結果閲覧リンク */}
      {sessionId && !compact && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="text-center"
        >
          <p className="text-xs text-text-light mb-3">
            この結果は後からでもご覧いただけます
          </p>
          <p className="text-xs text-text-light">
            株式会社イチエン不動産 ライフデザイン面談
          </p>
        </motion.div>
      )}
    </div>
  );
}
