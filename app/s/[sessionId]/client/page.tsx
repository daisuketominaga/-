"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Step1Priorities from "@/components/value-work/Step1Priorities";
import Step2IdealDay from "@/components/value-work/Step2IdealDay";
import Step3Tradeoffs from "@/components/value-work/Step3Tradeoffs";
import Step4Letter from "@/components/value-work/Step4Letter";
import Step5TopValues from "@/components/value-work/Step5TopValues";
import ValueMapComponent from "@/components/ValueMap";
import {
  getSession,
  getValueWork,
  saveValueWork,
  getValueMap,
  emit,
  subscribeBroadcast,
} from "@/lib/store";
import type {
  Session,
  ValueWorkAnswers,
  ValueMap,
  TradeoffAnswer,
} from "@/lib/types";

type ViewState = "welcome" | "work" | "map" | "complete";

export default function ClientPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [view, setView] = useState<ViewState>("welcome");
  const [currentStep, setCurrentStep] = useState(1);
  const [session, setSession] = useState<Session | null>(null);
  const [valueMap, setValueMap] = useState<ValueMap | null>(null);
  const [step5Loading, setStep5Loading] = useState(false);
  const [suggestedKeywords, setSuggestedKeywords] = useState<string[]>([]);

  // ワーク回答状態
  const [priorities, setPriorities] = useState<Record<string, number>>({});
  const [idealDay, setIdealDay] = useState({
    morning_activity: "",
    evening_scene: "",
    weekend_activities: [] as string[],
  });
  const [tradeoffs, setTradeoffs] = useState<TradeoffAnswer[]>([]);
  const [letter, setLetter] = useState("");
  const [topValues, setTopValues] = useState<string[]>([]);

  // セッションとデータの読み込み
  useEffect(() => {
    if (!sessionId) return;
    const s = getSession(sessionId);
    if (s) setSession(s);

    const vw = getValueWork(sessionId);
    if (vw) {
      setPriorities(vw.step1_priorities || {});
      setIdealDay(
        vw.step2_ideal_day || {
          morning_activity: "",
          evening_scene: "",
          weekend_activities: [],
        }
      );
      setTradeoffs(vw.step3_tradeoffs || []);
      setLetter(vw.step4_letter || "");
      setTopValues(vw.step5_top_values || []);
    }

    const vm = getValueMap(sessionId);
    if (vm) setValueMap(vm);
  }, [sessionId]);

  // BroadcastChannel でリアルタイム同期（価値観マップ更新を受信）
  useEffect(() => {
    if (!sessionId) return;
    const unsub = subscribeBroadcast(`valuemap_${sessionId}`, (data) => {
      setValueMap(data as ValueMap);
    });
    return unsub;
  }, [sessionId]);

  // 保存＋同期
  const saveAndSync = useCallback(
    (stepData: Partial<ValueWorkAnswers>) => {
      if (!sessionId) return;
      saveValueWork(sessionId, stepData);
      emit(`valuework_${sessionId}`, { ...stepData, sessionId });
    },
    [sessionId]
  );

  // Step5用のキーワード生成
  const generateKeywords = async () => {
    setStep5Loading(true);
    try {
      const res = await fetch("/api/ai/value-map", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          priorities,
          idealDay,
          tradeoffs,
          letter,
          keywordsOnly: true,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSuggestedKeywords(data.keywords || []);
      } else {
        // フォールバックのキーワード
        setSuggestedKeywords([
          "家族の時間",
          "朝の静けさ",
          "庭のある暮らし",
          "子どもの笑い声",
          "自然とのつながり",
          "安心できる場所",
          "成長する住まい",
          "街の便利さ",
        ]);
      }
    } catch {
      setSuggestedKeywords([
        "家族の時間",
        "朝の静けさ",
        "庭のある暮らし",
        "子どもの笑い声",
        "自然とのつながり",
        "安心できる場所",
        "成長する住まい",
        "街の便利さ",
      ]);
    } finally {
      setStep5Loading(false);
    }
  };

  const nextStep = () => {
    // 現在のステップの回答を保存
    switch (currentStep) {
      case 1:
        saveAndSync({ step1_priorities: priorities });
        break;
      case 2:
        saveAndSync({ step2_ideal_day: idealDay });
        break;
      case 3:
        saveAndSync({ step3_tradeoffs: tradeoffs });
        break;
      case 4:
        saveAndSync({ step4_letter: letter });
        generateKeywords();
        break;
      case 5:
        saveAndSync({
          step5_top_values: topValues,
          completed_at: new Date().toISOString(),
        });
        // 価値観マップ生成をリクエスト
        generateValueMap();
        setView("map");
        return;
    }
    setCurrentStep((s) => Math.min(5, s + 1));
  };

  const prevStep = () => {
    setCurrentStep((s) => Math.max(1, s - 1));
  };

  const generateValueMap = async () => {
    try {
      const res = await fetch("/api/ai/value-map", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          priorities,
          idealDay,
          tradeoffs,
          letter,
          topValues,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const vm: ValueMap = {
          id: "",
          session_id: sessionId,
          radar_chart: data.radarChart,
          keywords: data.keywords.map((w: string) => ({
            word: w,
            weight: 50 + Math.random() * 50,
          })),
          summary: data.summary,
          created_at: new Date().toISOString(),
        };
        setValueMap(vm);
        emit(`valuemap_${sessionId}`, vm);
      }
    } catch {
      // フォールバック
    }
  };

  // ウェルカムページ
  if (view === "welcome") {
    return (
      <div className="min-h-screen bg-background-warm flex flex-col items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-md w-full text-center"
        >
          <div className="w-20 h-20 bg-brand-navy rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-lg">
            <span className="text-white text-3xl font-bold">一</span>
          </div>

          <h1 className="text-3xl font-bold text-brand-navy mb-4 leading-tight">
            ようこそ
          </h1>
          <p className="text-xl text-text-secondary mb-2 leading-relaxed">
            今日はあなたの
            <br />
            <span className="text-brand-navy font-bold">
              &ldquo;理想の暮らし&rdquo;
            </span>
            を
            <br />
            一緒に探す時間です
          </p>
          <p className="text-text-muted mt-6 mb-10">
            物件の条件ではなく、あなたの「大切にしたいこと」を
            <br />
            見つけるための短いワークです
          </p>

          <button
            onClick={() => setView("work")}
            className="w-full bg-brand-navy text-white py-4 rounded-xl text-xl font-medium hover:bg-brand-navy-light transition-colors shadow-lg"
          >
            始める
          </button>

          <p className="text-xs text-text-muted mt-6">
            所要時間：約15〜20分
          </p>
        </motion.div>
      </div>
    );
  }

  // 価値観マップ表示
  if (view === "map") {
    return (
      <div className="min-h-screen bg-background-warm px-4 py-8">
        <div className="max-w-lg mx-auto">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
          >
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-brand-navy mb-2">
                あなたの価値観マップ
              </h2>
              <p className="text-text-secondary">
                ワークの結果から見えてきたあなたの価値観です
              </p>
            </div>

            <ValueMapComponent valueMap={valueMap} />

            {!valueMap && (
              <div className="text-center py-12">
                <div className="w-12 h-12 border-4 border-brand-navy/20 border-t-brand-navy rounded-full animate-spin mx-auto mb-4" />
                <p className="text-text-secondary">
                  AIがあなたの価値観を分析しています...
                </p>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    );
  }

  // ワーク画面
  return (
    <div className="min-h-screen bg-background-warm">
      {/* プログレスバー */}
      <div className="sticky top-0 bg-white/90 backdrop-blur z-10 border-b border-gray-100">
        <div className="max-w-lg mx-auto px-4 py-3">
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5].map((step) => (
              <div
                key={step}
                className={`flex-1 h-1.5 rounded-full transition-colors ${
                  step <= currentStep ? "bg-brand-navy" : "bg-gray-200"
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 pb-32">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            {currentStep === 1 && (
              <Step1Priorities
                values={priorities}
                onChange={(key, value) =>
                  setPriorities((prev) => ({ ...prev, [key]: value }))
                }
              />
            )}
            {currentStep === 2 && (
              <Step2IdealDay values={idealDay} onChange={setIdealDay} />
            )}
            {currentStep === 3 && (
              <Step3Tradeoffs values={tradeoffs} onChange={setTradeoffs} />
            )}
            {currentStep === 4 && (
              <Step4Letter value={letter} onChange={setLetter} />
            )}
            {currentStep === 5 && (
              <Step5TopValues
                suggestedKeywords={suggestedKeywords}
                selectedValues={topValues}
                onChange={setTopValues}
                loading={step5Loading}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* 固定フッター */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-4">
        <div className="max-w-lg mx-auto flex gap-3">
          {currentStep > 1 && (
            <button
              onClick={prevStep}
              className="px-6 py-3 rounded-xl border-2 border-gray-200 text-text-secondary font-medium hover:bg-gray-50 transition-colors"
            >
              戻る
            </button>
          )}
          <button
            onClick={nextStep}
            disabled={currentStep === 5 && topValues.length < 3}
            className="flex-1 bg-brand-navy text-white py-3 rounded-xl text-lg font-medium hover:bg-brand-navy-light transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {currentStep === 5
              ? "結果を見る"
              : currentStep === 4
                ? "スキップして次へ"
                : "次へ"}
          </button>
        </div>
      </div>
    </div>
  );
}
