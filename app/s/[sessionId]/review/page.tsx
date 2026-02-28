"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import ValueMapComponent from "@/components/ValueMap";
import {
  getSession,
  getCustomer,
  getNotes,
  getValueWork,
  getValueMap,
  getLetter,
  saveLetter,
} from "@/lib/store";
import type {
  Customer,
  InterviewNote,
  ValueWorkAnswers,
  ValueMap,
  ProposalLetter,
} from "@/lib/types";

export default function ReviewPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [notes, setNotes] = useState<InterviewNote[]>([]);
  const [valueWork, setValueWork] = useState<ValueWorkAnswers | null>(null);
  const [valueMap, setValueMap] = useState<ValueMap | null>(null);
  const [letter, setLetterState] = useState<ProposalLetter | null>(null);
  const [generating, setGenerating] = useState(false);
  const [editedContent, setEditedContent] = useState("");
  const [personalNote, setPersonalNote] = useState("");
  const [activeSection, setActiveSection] = useState<
    "map" | "letter" | "edit"
  >("map");

  useEffect(() => {
    if (!sessionId) return;
    const session = getSession(sessionId);
    if (session) {
      const c = getCustomer(session.customer_id);
      if (c) setCustomer(c);
    }
    setNotes(getNotes(sessionId));
    setValueWork(getValueWork(sessionId) || null);
    setValueMap(getValueMap(sessionId) || null);

    const existingLetter = getLetter(sessionId);
    if (existingLetter) {
      setLetterState(existingLetter);
      setEditedContent(
        existingLetter.edited_content || existingLetter.ai_draft
      );
      setPersonalNote(existingLetter.personal_note);
    }
  }, [sessionId]);

  const generateLetter = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/ai/letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: customer
            ? {
                name: customer.name,
                age: customer.age,
                family: customer.family,
              }
            : null,
          notes: notes.map((n) => ({
            content: n.content,
            category: n.category,
          })),
          valueWork: valueWork
            ? {
                idealDay: valueWork.step2_ideal_day,
                topValues: valueWork.step5_top_values,
                letter: valueWork.step4_letter,
              }
            : null,
          valueMap: valueMap
            ? {
                summary: valueMap.summary,
                keywords: valueMap.keywords,
              }
            : null,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const saved = saveLetter(sessionId, {
          ai_draft: data.letter,
          edited_content: data.letter,
        });
        setLetterState(saved);
        setEditedContent(data.letter);
        setActiveSection("edit");
      }
    } catch (error) {
      console.error("Letter generation failed:", error);
    } finally {
      setGenerating(false);
    }
  };

  const saveEdits = () => {
    if (!sessionId) return;
    saveLetter(sessionId, {
      edited_content: editedContent,
      personal_note: personalNote,
    });
    router.push(`/s/${sessionId}/letter`);
  };

  return (
    <div className="min-h-screen bg-background-warm">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/dashboard")}
              className="text-text-muted hover:text-text-primary"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <div>
              <h1 className="text-lg font-bold text-brand-navy">
                AI分析レビュー
              </h1>
              <p className="text-xs text-text-muted">
                {customer?.name} 様
              </p>
            </div>
          </div>
        </div>

        {/* セクションタブ */}
        <div className="max-w-3xl mx-auto px-4">
          <div className="flex gap-1 -mb-px">
            {[
              { key: "map" as const, label: "価値観マップ" },
              { key: "letter" as const, label: "レター生成" },
              { key: "edit" as const, label: "レター編集" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveSection(tab.key)}
                className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                  activeSection === tab.key
                    ? "text-brand-navy border-b-2 border-brand-navy"
                    : "text-text-muted hover:text-text-secondary"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* 価値観マップセクション */}
        {activeSection === "map" && (
          <ValueMapComponent valueMap={valueMap} />
        )}

        {/* レター生成セクション */}
        {activeSection === "letter" && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm text-center">
              <h2 className="text-xl font-bold text-brand-navy mb-3">
                提案レターの自動生成
              </h2>
              <p className="text-text-secondary mb-6">
                面談メモ・ワーク回答・価値観マップの全データを使って、
                <br />
                AIがお客様専用の提案レターを下書きします。
              </p>

              <div className="bg-background-cream rounded-xl p-4 mb-6 text-left">
                <h3 className="text-sm font-bold text-text-primary mb-2">
                  使用するデータ
                </h3>
                <ul className="text-sm text-text-secondary space-y-1">
                  <li>面談メモ：{notes.length}件</li>
                  <li>
                    ワーク回答：
                    {valueWork?.completed_at ? "完了済み" : "未完了"}
                  </li>
                  <li>
                    価値観マップ：{valueMap ? "生成済み" : "未生成"}
                  </li>
                </ul>
              </div>

              <button
                onClick={generateLetter}
                disabled={generating}
                className="w-full bg-brand-navy text-white py-4 rounded-xl text-lg font-medium hover:bg-brand-navy-light transition-colors shadow-md disabled:opacity-50"
              >
                {generating ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    AIが下書きを作成中...
                  </span>
                ) : letter ? (
                  "レターを再生成する"
                ) : (
                  "レターを生成する"
                )}
              </button>
            </div>

            {letter?.ai_draft && (
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <h3 className="text-sm font-bold text-brand-navy mb-3">
                  AIの下書き
                </h3>
                <div className="whitespace-pre-wrap text-text-primary leading-relaxed text-sm border border-gray-100 rounded-xl p-5 bg-background-cream">
                  {letter.ai_draft}
                </div>
              </div>
            )}
          </div>
        )}

        {/* レター編集セクション */}
        {activeSection === "edit" && (
          <div className="space-y-6">
            {!editedContent ? (
              <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
                <p className="text-text-muted">
                  まずは「レター生成」タブからレターを生成してください
                </p>
              </div>
            ) : (
              <>
                <div className="bg-white rounded-2xl p-6 shadow-sm">
                  <h3 className="text-sm font-bold text-brand-navy mb-3">
                    レター本文（編集可能）
                  </h3>
                  <textarea
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    rows={20}
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-brand-navy focus:outline-none resize-none text-sm leading-relaxed"
                  />
                </div>

                <div className="bg-white rounded-2xl p-6 shadow-sm">
                  <h3 className="text-sm font-bold text-brand-navy mb-3">
                    「最後に」- 個人的なメッセージ
                  </h3>
                  <p className="text-xs text-text-muted mb-3">
                    面談で感じたことを、トミーさん自身の言葉で添えてください
                  </p>
                  <textarea
                    value={personalNote}
                    onChange={(e) => setPersonalNote(e.target.value)}
                    placeholder="今日の面談で特に印象的だったことや、お客様への個人的なメッセージを..."
                    rows={6}
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-brand-navy focus:outline-none resize-none text-sm leading-relaxed"
                  />
                </div>

                <button
                  onClick={saveEdits}
                  className="w-full bg-brand-navy text-white py-4 rounded-xl text-lg font-medium hover:bg-brand-navy-light transition-colors shadow-md"
                >
                  レターを確定して出力画面へ
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
