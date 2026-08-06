"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Step1Priorities from "@/components/values-work/Step1Priorities";
import Step2IdealDay from "@/components/values-work/Step2IdealDay";
import Step3Tradeoffs from "@/components/values-work/Step3Tradeoffs";
import Step4Letter from "@/components/values-work/Step4Letter";
import Step5TopValues from "@/components/values-work/Step5TopValues";
import ValuesMapDisplay from "@/components/ValuesMapDisplay";
import { getSession, saveValueWork, saveValueMap, updateSessionStatus } from "@/lib/sessionStore";
import { generateValueMap, generateValueKeywords } from "@/lib/mockAI";
import { createSyncChannel } from "@/lib/syncChannel";
import { createEmptyValueWork } from "@/lib/mockData";
import type { ValueWork, ValueMap, Session } from "@/types";

type Phase = "welcome" | "work" | "generating" | "map";

export default function ClientPage({
  params,
}: {
  params: { sessionId: string };
}) {
  const [phase, setPhase] = useState<Phase>("welcome");
  const [session, setSession] = useState<Session | null>(null);
  const [valueWork, setValueWork] = useState<ValueWork>(
    createEmptyValueWork("new")
  );
  const [currentStep, setCurrentStep] = useState(1);
  const [generatedMap, setGeneratedMap] = useState<ValueMap | null>(null);
  const [suggestedKeywords, setSuggestedKeywords] = useState<string[]>([]);

  useEffect(() => {
    const s = getSession(params.sessionId);
    if (s) {
      setSession(s);
      if (s.valueWork && s.valueWork.completedAt) {
        setValueWork(s.valueWork);
        if (s.valueMap) {
          setGeneratedMap(s.valueMap);
          setPhase("map");
        }
      } else if (s.valueWork && s.valueWork.currentStep > 1) {
        setValueWork(s.valueWork);
        setCurrentStep(s.valueWork.currentStep);
        setPhase("work");
      }
    }
  }, [params.sessionId]);

  const sync = typeof window !== "undefined"
    ? createSyncChannel(params.sessionId)
    : null;

  const handleStepComplete = (step: number, data: Partial<ValueWork>) => {
    const updated = { ...valueWork, ...data, currentStep: step + 1 };
    setValueWork(updated);

    saveValueWork(params.sessionId, updated);

    sync?.send({
      type: "VALUE_WORK_PROGRESS",
      sessionId: params.sessionId,
      data: { step, currentStep: step + 1 },
    });

    if (step === 4) {
      const keywords = generateValueKeywords(updated);
      setSuggestedKeywords(keywords);
    }

    if (step < 5) {
      setCurrentStep(step + 1);
    } else {
      setPhase("generating");
      updateSessionStatus(params.sessionId, "分析中");

      setTimeout(() => {
        const customer = session?.customer || {
          id: "unknown",
          name: "お客様",
          age: 0,
          family: { children: [] },
          purchasePurpose: "初めての購入" as const,
          createdAt: new Date().toISOString(),
          status: "面談済み" as const,
        };

        const completedWork: ValueWork = {
          ...updated,
          step5TopValues: data.step5TopValues || updated.step5TopValues,
          completedAt: new Date().toISOString(),
        };
        saveValueWork(params.sessionId, completedWork);

        const map = generateValueMap(completedWork, customer);
        setGeneratedMap(map);
        saveValueMap(params.sessionId, map);

        sync?.send({
          type: "VALUE_WORK_COMPLETE",
          sessionId: params.sessionId,
          data: { valueMap: map },
        });

        setPhase("map");
      }, 2500);
    }
  };

  if (phase === "welcome") {
    return (
      <WelcomePage
        customerName={session?.customer.name}
        onStart={() => {
          setPhase("work");
          updateSessionStatus(params.sessionId, "面談中");
        }}
      />
    );
  }

  if (phase === "generating") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-secondary-cream to-white flex flex-col items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="w-16 h-16 border-4 border-primary-orange/20 border-t-primary-orange rounded-full mx-auto mb-6"
          />
          <h2 className="text-xl font-bold text-text-dark mb-2">
            あなたの価値観を分析しています
          </h2>
          <p className="text-text-medium text-sm">
            AIが回答をもとに価値観マップを生成中...
          </p>
        </motion.div>
      </div>
    );
  }

  if (phase === "map" && generatedMap) {
    return (
      <div className="min-h-screen bg-secondary-cream">
        <ValuesMapDisplay
          valueMap={generatedMap}
          valueWork={valueWork}
          sessionId={params.sessionId}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary-cream">
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
                suggestedKeywords={suggestedKeywords}
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

function WelcomePage({
  customerName,
  onStart,
}: {
  customerName?: string;
  onStart: () => void;
}) {
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
        {customerName && (
          <p className="text-text-medium text-sm mb-2">
            {customerName} 様
          </p>
        )}
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
