"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import ValueMapComponent from "@/components/ValueMap";
import {
  getSession,
  getCustomer,
  getNotes,
  addNote,
  getSuggestions,
  setSuggestions,
  markSuggestionUsed,
  getValueWork,
  getValueMap,
  updateSession,
  emit,
  subscribeBroadcast,
} from "@/lib/store";
import type {
  Session,
  Customer,
  InterviewNote,
  AISuggestion,
  ValueWorkAnswers,
  ValueMap,
} from "@/lib/types";

type NoteCategory = InterviewNote["category"];

const CATEGORY_COLORS: Record<NoteCategory, string> = {
  暮らしの情景: "bg-blue-100 text-blue-700",
  家族の未来: "bg-green-100 text-green-700",
  隠れた価値観: "bg-purple-100 text-purple-700",
  その他: "bg-gray-100 text-gray-700",
};

export default function StaffPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();

  const [session, setSession] = useState<Session | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [notes, setNotes] = useState<InterviewNote[]>([]);
  const [suggestions, setSuggestionsState] = useState<AISuggestion[]>([]);
  const [valueWork, setValueWork] = useState<ValueWorkAnswers | null>(null);
  const [valueMap, setValueMapState] = useState<ValueMap | null>(null);

  // メモ入力状態
  const [noteContent, setNoteContent] = useState("");
  const [noteCategory, setNoteCategory] = useState<NoteCategory>("その他");
  const [aiLoading, setAiLoading] = useState(false);

  // タブ状態
  const [activeTab, setActiveTab] = useState<
    "memo" | "suggestions" | "work" | "map"
  >("memo");

  // 初期データ読み込み
  useEffect(() => {
    if (!sessionId) return;
    const s = getSession(sessionId);
    if (s) {
      setSession(s);
      const c = getCustomer(s.customer_id);
      if (c) setCustomer(c);
      if (s.status === "準備中") {
        updateSession(sessionId, {
          status: "進行中",
          started_at: new Date().toISOString(),
        });
      }
    }
    setNotes(getNotes(sessionId));
    setSuggestionsState(getSuggestions(sessionId));
    setValueWork(getValueWork(sessionId) || null);
    setValueMapState(getValueMap(sessionId) || null);
  }, [sessionId]);

  // BroadcastChannel でお客さん側の更新を受信
  useEffect(() => {
    if (!sessionId) return;
    const unsub1 = subscribeBroadcast(
      `valuework_${sessionId}`,
      (data) => {
        setValueWork(getValueWork(sessionId) || null);
      }
    );
    const unsub2 = subscribeBroadcast(
      `valuemap_${sessionId}`,
      (data) => {
        setValueMapState(data as ValueMap);
      }
    );
    return () => {
      unsub1();
      unsub2();
    };
  }, [sessionId]);

  // メモ送信
  const handleSubmitNote = async () => {
    if (!noteContent.trim() || !sessionId) return;

    const note = addNote(sessionId, noteContent.trim(), noteCategory);
    setNotes((prev) => [...prev, note]);
    setNoteContent("");

    // AIに問いかけを生成させる
    await fetchAISuggestions([...notes, note]);
  };

  // AI提案の取得
  const fetchAISuggestions = async (currentNotes: InterviewNote[]) => {
    setAiLoading(true);
    try {
      const res = await fetch("/api/ai/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          customer: customer
            ? {
                name: customer.name,
                age: customer.age,
                family: customer.family,
                purchasePurpose: customer.purchase_purpose,
              }
            : null,
          notes: currentNotes.map((n) => ({
            content: n.content,
            category: n.category,
          })),
          valueWork: valueWork
            ? {
                priorities: valueWork.step1_priorities,
                idealDay: valueWork.step2_ideal_day,
                tradeoffs: valueWork.step3_tradeoffs,
              }
            : null,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const newSuggestions = setSuggestions(
          sessionId,
          (data.suggestions || []).map(
            (s: { question: string; category: string }) => ({
              question: s.question,
              category: s.category,
              used: false,
            })
          )
        );
        setSuggestionsState(newSuggestions);
      }
    } catch {
      // AI unavailable - silent fail
    } finally {
      setAiLoading(false);
    }
  };

  // 提案を使用済みにする
  const handleUseSuggestion = (suggestion: AISuggestion) => {
    markSuggestionUsed(suggestion.id);
    setSuggestionsState((prev) =>
      prev.map((s) => (s.id === suggestion.id ? { ...s, used: true } : s))
    );
  };

  // 面談終了
  const handleEndSession = () => {
    if (!sessionId) return;
    updateSession(sessionId, {
      status: "完了",
      ended_at: new Date().toISOString(),
    });
    router.push(`/s/${sessionId}/review`);
  };

  return (
    <div className="min-h-screen bg-background-warm">
      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-base font-bold text-brand-navy">
                面談進行中
              </h1>
              <p className="text-xs text-text-muted">
                {customer?.name} 様
                {customer?.family?.children?.length
                  ? ` / ご家族${(customer.family.spouse ? 1 : 0) + customer.family.children.length + 1}人`
                  : ""}
              </p>
            </div>
            <button
              onClick={handleEndSession}
              className="text-sm px-4 py-2 rounded-lg bg-red-50 text-red-600 font-medium hover:bg-red-100 transition-colors"
            >
              面談終了
            </button>
          </div>

          {/* タブ */}
          <div className="flex gap-1 mt-3 -mb-px">
            {[
              { key: "memo" as const, label: "メモ" },
              { key: "suggestions" as const, label: "AI提案" },
              { key: "work" as const, label: "ワーク回答" },
              { key: "map" as const, label: "マップ" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                  activeTab === tab.key
                    ? "bg-background-warm text-brand-navy border-t-2 border-x border-brand-navy border-gray-100"
                    : "text-text-muted hover:text-text-secondary"
                }`}
              >
                {tab.label}
                {tab.key === "suggestions" && aiLoading && (
                  <span className="ml-1 animate-pulse-soft">...</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-4 pb-48">
        {/* メモタブ */}
        {activeTab === "memo" && (
          <div className="space-y-3">
            {notes.length === 0 && (
              <p className="text-center text-text-muted py-8 text-sm">
                面談中のメモをここに入力してください。
                <br />
                AIが内容を分析し、次の問いかけを提案します。
              </p>
            )}
            {notes.map((note) => (
              <div key={note.id} className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${CATEGORY_COLORS[note.category]}`}
                  >
                    {note.category}
                  </span>
                  <span className="text-xs text-text-muted">
                    {new Date(note.created_at).toLocaleTimeString("ja-JP", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <p className="text-text-primary text-sm leading-relaxed">
                  {note.content}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* AI提案タブ */}
        {activeTab === "suggestions" && (
          <div className="space-y-3">
            {suggestions.length === 0 && !aiLoading && (
              <p className="text-center text-text-muted py-8 text-sm">
                メモを入力すると、AIが次の問いかけを提案します
              </p>
            )}
            {aiLoading && (
              <div className="text-center py-8">
                <div className="w-8 h-8 border-3 border-brand-navy/20 border-t-brand-navy rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-text-muted">
                  AIが問いかけを考えています...
                </p>
              </div>
            )}
            {suggestions
              .filter((s) => !s.used)
              .map((suggestion) => (
                <div
                  key={suggestion.id}
                  className="bg-white rounded-xl p-4 shadow-sm"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${CATEGORY_COLORS[suggestion.category as NoteCategory] || CATEGORY_COLORS["その他"]}`}
                    >
                      {suggestion.category}
                    </span>
                  </div>
                  <p className="text-text-primary text-sm leading-relaxed mb-3">
                    {suggestion.question}
                  </p>
                  <button
                    onClick={() => handleUseSuggestion(suggestion)}
                    className="text-xs text-brand-navy font-medium hover:text-brand-navy-light"
                  >
                    使用済みにする
                  </button>
                </div>
              ))}
            {suggestions.filter((s) => s.used).length > 0 && (
              <div className="mt-6">
                <p className="text-xs text-text-muted mb-2">使用済みの提案</p>
                {suggestions
                  .filter((s) => s.used)
                  .map((suggestion) => (
                    <div
                      key={suggestion.id}
                      className="bg-gray-50 rounded-xl p-3 mb-2 opacity-60"
                    >
                      <p className="text-text-muted text-sm">
                        {suggestion.question}
                      </p>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* ワーク回答タブ */}
        {activeTab === "work" && (
          <div className="space-y-4">
            {!valueWork ? (
              <p className="text-center text-text-muted py-8 text-sm">
                お客様がワークに回答すると、ここに表示されます
              </p>
            ) : (
              <>
                {/* Step1 */}
                {Object.keys(valueWork.step1_priorities || {}).length > 0 && (
                  <div className="bg-white rounded-xl p-4 shadow-sm">
                    <h3 className="text-sm font-bold text-brand-navy mb-3">
                      暮らしのプライオリティ
                    </h3>
                    <div className="space-y-2">
                      {Object.entries(valueWork.step1_priorities).map(
                        ([key, val]) => (
                          <div key={key} className="flex items-center gap-3">
                            <span className="text-xs text-text-secondary w-32 truncate">
                              {key}
                            </span>
                            <div className="flex-1 bg-gray-100 rounded-full h-2">
                              <div
                                className="bg-brand-navy rounded-full h-2 transition-all"
                                style={{ width: `${val}%` }}
                              />
                            </div>
                            <span className="text-xs text-text-muted w-8 text-right">
                              {val}
                            </span>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}

                {/* Step2 */}
                {valueWork.step2_ideal_day?.morning_activity && (
                  <div className="bg-white rounded-xl p-4 shadow-sm">
                    <h3 className="text-sm font-bold text-brand-navy mb-3">
                      理想の一日
                    </h3>
                    <div className="space-y-2 text-sm text-text-primary">
                      <p>
                        <span className="text-text-muted">朝：</span>
                        {valueWork.step2_ideal_day.morning_activity}
                      </p>
                      {valueWork.step2_ideal_day.evening_scene && (
                        <p>
                          <span className="text-text-muted">夕方：</span>
                          {valueWork.step2_ideal_day.evening_scene}
                        </p>
                      )}
                      {valueWork.step2_ideal_day.weekend_activities?.length >
                        0 && (
                        <p>
                          <span className="text-text-muted">週末：</span>
                          {valueWork.step2_ideal_day.weekend_activities.join(
                            "、"
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Step5 */}
                {valueWork.step5_top_values?.length > 0 && (
                  <div className="bg-white rounded-xl p-4 shadow-sm">
                    <h3 className="text-sm font-bold text-brand-navy mb-3">
                      大切にしたい3つ
                    </h3>
                    <div className="space-y-2">
                      {valueWork.step5_top_values.map((v, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="w-6 h-6 bg-brand-navy text-white rounded-full flex items-center justify-center text-xs font-bold">
                            {i + 1}
                          </span>
                          <span className="text-sm text-text-primary">
                            {v}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* マップタブ */}
        {activeTab === "map" && (
          <ValueMapComponent valueMap={valueMap} compact />
        )}
      </div>

      {/* 固定メモ入力 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-3 shadow-lg">
        <div className="max-w-lg mx-auto">
          {/* カテゴリ選択 */}
          <div className="flex gap-1.5 mb-2">
            {(
              [
                "暮らしの情景",
                "家族の未来",
                "隠れた価値観",
                "その他",
              ] as NoteCategory[]
            ).map((cat) => (
              <button
                key={cat}
                onClick={() => setNoteCategory(cat)}
                className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                  noteCategory === cat
                    ? CATEGORY_COLORS[cat]
                    : "bg-gray-50 text-text-muted"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmitNote();
                }
              }}
              placeholder="面談メモを入力..."
              className="flex-1 px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-brand-navy focus:outline-none text-sm"
            />
            <button
              onClick={handleSubmitNote}
              disabled={!noteContent.trim()}
              className="bg-brand-navy text-white px-5 py-3 rounded-xl font-medium hover:bg-brand-navy-light transition-colors disabled:opacity-50"
            >
              送信
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
