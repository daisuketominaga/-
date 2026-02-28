"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { WEEKEND_ACTIVITIES } from "@/types";

interface IdealDayData {
  morningActivity: string;
  eveningScene: string;
  weekendActivities: string[];
}

interface Props {
  data: IdealDayData;
  onComplete: (data: IdealDayData) => void;
}

const morningOptions = [
  "ゆっくりコーヒーを淹れる",
  "子どもたちと朝食を準備する",
  "ジョギングや散歩に出かける",
  "新聞やニュースをチェックする",
  "庭の手入れをする",
];

export default function Step2IdealDay({ data, onComplete }: Props) {
  const [formData, setFormData] = useState<IdealDayData>({
    morningActivity: data.morningActivity || "",
    eveningScene: data.eveningScene || "",
    weekendActivities: data.weekendActivities || [],
  });
  const [morningCustom, setMorningCustom] = useState("");
  const [useMorningCustom, setUseMorningCustom] = useState(false);

  const toggleWeekendActivity = (activity: string) => {
    setFormData((prev) => ({
      ...prev,
      weekendActivities: prev.weekendActivities.includes(activity)
        ? prev.weekendActivities.filter((a) => a !== activity)
        : [...prev.weekendActivities, activity],
    }));
  };

  const isValid =
    (formData.morningActivity || morningCustom) && formData.eveningScene;

  const handleSubmit = () => {
    const finalData = {
      ...formData,
      morningActivity: useMorningCustom
        ? morningCustom
        : formData.morningActivity,
    };
    onComplete(finalData);
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-text-dark mb-2">理想の一日</h2>
        <p className="text-text-medium text-sm">
          あなたの理想の暮らしの一日を想像してみてください。
        </p>
      </div>

      {/* 朝の質問 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card mb-4"
      >
        <h3 className="font-bold text-text-dark mb-1">
          休日の朝、最初にすることは？
        </h3>
        <p className="text-xs text-text-light mb-3">
          選択肢から選ぶか、自由に入力してください
        </p>
        <div className="space-y-2 mb-3">
          {morningOptions.map((option) => (
            <button
              key={option}
              onClick={() => {
                setFormData((prev) => ({ ...prev, morningActivity: option }));
                setUseMorningCustom(false);
              }}
              className={`w-full text-left px-4 py-3 rounded-xl text-sm transition-all ${
                formData.morningActivity === option && !useMorningCustom
                  ? "bg-primary-orange/10 border-2 border-primary-orange text-primary-orange font-medium"
                  : "bg-gray-50 border-2 border-transparent text-text-dark hover:bg-gray-100"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
        <div>
          <input
            type="text"
            className="input-field text-sm"
            placeholder="その他（自由に入力してください）"
            value={morningCustom}
            onChange={(e) => {
              setMorningCustom(e.target.value);
              setUseMorningCustom(true);
            }}
            onFocus={() => setUseMorningCustom(true)}
          />
        </div>
      </motion.div>

      {/* 夕方の質問 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="card mb-4"
      >
        <h3 className="font-bold text-text-dark mb-1">
          夕方、家に帰ってきた時の理想の光景は？
        </h3>
        <p className="text-xs text-text-light mb-3">
          思い浮かぶ情景を自由にお書きください
        </p>
        <textarea
          className="input-field text-sm min-h-[100px] resize-none"
          placeholder="例：温かい光が灯ったリビングで、子どもたちが笑っている..."
          value={formData.eveningScene}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, eveningScene: e.target.value }))
          }
        />
      </motion.div>

      {/* 週末の質問 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="card mb-4"
      >
        <h3 className="font-bold text-text-dark mb-1">
          週末に家族でしたいことは？
        </h3>
        <p className="text-xs text-text-light mb-3">
          複数選択できます
        </p>
        <div className="flex flex-wrap gap-2">
          {WEEKEND_ACTIVITIES.map((activity) => (
            <button
              key={activity}
              onClick={() => toggleWeekendActivity(activity)}
              className={`px-3 py-2 rounded-xl text-sm transition-all ${
                formData.weekendActivities.includes(activity)
                  ? "bg-accent-teal text-white font-medium"
                  : "bg-gray-50 text-text-dark hover:bg-gray-100"
              }`}
            >
              {activity}
            </button>
          ))}
        </div>
      </motion.div>

      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        onClick={handleSubmit}
        disabled={!isValid}
        className={`w-full mt-6 text-lg py-4 rounded-2xl font-medium transition-all ${
          isValid
            ? "btn-primary"
            : "bg-gray-200 text-gray-400 cursor-not-allowed"
        }`}
      >
        次へ進む
      </motion.button>
    </div>
  );
}
