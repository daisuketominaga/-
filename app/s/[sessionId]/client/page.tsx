"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Step1Priorities from "@/components/values-work/Step1Priorities";
import Step2IdealDay from "@/components/values-work/Step2IdealDay";
import Step3Tradeoffs from "@/components/values-work/Step3Tradeoffs";
import Step4Letter from "@/components/values-work/Step4Letter";
import Step5TopValues from "@/components/values-work/Step5TopValues";
import ValuesMapDisplay from "@/components/ValuesMapDisplay";
import {
  createEmptyValueWork,
  getMockValueMap,
} from "@/lib/mockData";
import type { ValueWork } from "@/types";

type Phase = "welcome" | "work" | "map";

export default function ClientPage({
  params,
}: {
  params: { sessionId: string };
}) {
  const [phase, setPhase] = useState<Phase>("welcome");
  const [valueWork, setValueWork] = useState<ValueWork>(
    createEmptyValueWork("new")
  );
  const [currentStep, setCurrentStep] = useState(1);

  const handleStepComplete = (step: number, data: Partial<ValueWork>) => {
    setValueWork((prev) => ({ ...prev, ...data }));
    if (step < 5) {
      setCurrentStep(step + 1);
    } else {
      setPhase("map");
    }
  };

  if (phase === "welcome") {
    return <WelcomePage onStart={() => setPhase("work")} />;
  }

  if (phase === "map") {
    return (
      <div className="min-h-screen bg-secondary-cream">
        <ValuesMapDisplay
          valueMap={getMockValueMap()}
          valueWork={valueWork}
          sessionId={params.sessionId}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary-cream">
      {/* Progress bar */}
      <div className="bg-white/90 backdrop-blur-md sticky top-0 z-50 px-4 py-3 border-b border-gray-100">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-text-dark">
              Step {currentStep} / 5
            </span>
            <span className="text-xs text-text-light">
              {stepLabels[currentStep - 1]}
            </span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-primary-orange to-primary-coral rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${(currentStep / 5) * 100}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
        </div>
      </div>

      {/* Step content */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.3 }}
          >
            {currentStep === 1 && (
              <Step1Priorities
                data={valueWork.step1Priorities}
                onComplete={(data) =>
                  handleStepComplete(1, { step1Priorities: data })
                }
              />
            )}
            {currentStep === 2 && (
              <Step2IdealDay
                data={valueWork.step2IdealDay}
                onComplete={(data) =>
                  handleStepComplete(2, { step2IdealDay: data })
                }
              />
            )}
            {currentStep === 3 && (
              <Step3Tradeoffs
                data={valueWork.step3Tradeoffs}
                onComplete={(data) =>
                  handleStepComplete(3, { step3Tradeoffs: data })
                }
              />
            )}
            {currentStep === 4 && (
              <Step4Letter
                data={valueWork.step4Letter}
                onComplete={(data) =>
                  handleStepComplete(4, { step4Letter: data })
                }
                onSkip={() => handleStepComplete(4, { step4Letter: "" })}
              />
            )}
            {currentStep === 5 && (
              <Step5TopValues
                data={valueWork.step5TopValues}
                onComplete={(data) =>
                  handleStepComplete(5, {
                    step5TopValues: data as [string, string, string],
                  })
                }
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

const stepLabels = [
  "暮らしのプライオリティ",
  "理想の一日",
  "トレードオフ選択",
  "家族への手紙",
  "大切にしたいこと",
];

function WelcomePage({ onStart }: { onStart: () => void }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-secondary-cream to-white flex flex-col items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="text-center max-w-md"
      >
        <div className="w-20 h-20 bg-primary-orange rounded-3xl flex items-center justify-center text-white font-display font-bold text-3xl mx-auto mb-6 shadow-button">
          1¥
        </div>
        <h1 className="text-3xl font-bold text-text-dark mb-3 leading-tight">
          あなたの
          <br />
          <span className="text-primary-orange">理想の暮らし</span>
          を
          <br />
          一緒に探しましょう
        </h1>
        <p className="text-text-medium leading-relaxed mb-8">
          これから約15分間、あなたの価値観や暮らしのイメージを
          一緒に見つけていく時間です。正解はありません。
          感じるままにお答えください。
        </p>

        <div className="space-y-4 mb-10">
          <div className="card-soft flex items-center gap-3 text-left">
            <span className="text-2xl">🎯</span>
            <div>
              <p className="font-medium text-text-dark text-sm">
                全5ステップ・約15分
              </p>
              <p className="text-xs text-text-light">
                スライダー・選択・自由記述で進みます
              </p>
            </div>
          </div>
          <div className="card-soft flex items-center gap-3 text-left">
            <span className="text-2xl">💝</span>
            <div>
              <p className="font-medium text-text-dark text-sm">
                正解はありません
              </p>
              <p className="text-xs text-text-light">
                あなたの素直な気持ちが一番大切です
              </p>
            </div>
          </div>
          <div className="card-soft flex items-center gap-3 text-left">
            <span className="text-2xl">🗺️</span>
            <div>
              <p className="font-medium text-text-dark text-sm">
                あなただけの価値観マップ
              </p>
              <p className="text-xs text-text-light">
                回答をもとに、AIがあなたの価値観を可視化します
              </p>
            </div>
          </div>
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={onStart}
          className="btn-primary w-full text-lg py-4"
        >
          はじめる
        </motion.button>
        <p className="text-xs text-text-light mt-4">
          株式会社イチエン不動産 ライフデザイン面談
        </p>
      </motion.div>
    </div>
  );
}
