"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import StaffNav from "@/components/StaffNav";
import ValuesMapDisplay from "@/components/ValuesMapDisplay";
import { getSession, saveInterviewNotes, saveProposalLetter } from "@/lib/sessionStore";
import { generateAISuggestions, generateEmotionSignals, generateProposalLetter } from "@/lib/mockAI";
import { createSyncChannel } from "@/lib/syncChannel";
import type { Session, InterviewNote, AISuggestion } from "@/types";

const categoryColors: Record<string, string> = {
  暮らしの情景: "bg-blue-100 text-blue-700",
  家族の未来: "bg-purple-100 text-purple-700",
  隠れた価値観: "bg-amber-100 text-amber-700",
  その他: "bg-gray-100 text-gray-600",
};

const defaultSuggestions: AISuggestion[] = [
  {
    timestamp: new Date().toISOString(),
    question: "家に帰ってきた瞬間、最初にしたいことは何ですか？",
    category: "暮らしの情景",
    used: false,
  },
  {
    timestamp: new Date().toISOString(),
    question: "お子さんが大きくなった時、この家をどう思い出してほしいですか？",
    category: "家族の未来",
    used: false,
  },
  {
    timestamp: new Date().toISOString(),
    question: "もしお金が関係なかったら、どんな場所に住みたいですか？",
    category: "隠れた価値観",
    used: false,
  },
];

export default function StaffInterviewPage({
  params,
}: {
  params: { sessionId: string };
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [notes, setNotes] = useState<InterviewNote[]>([]);
  const [newNote, setNewNote] = useState("");
  const [noteCategory, setNoteCategory] = useState<InterviewNote["category"]>(
    "暮らしの情景"
  );
  const [suggestions, setSuggestions] = useState<AISuggestion[]>(defaultSuggestions);
  const [usedQuestions, setUsedQuestions] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"notes" | "map" | "letter">("notes");
  const [emotionSignals, setEmotionSignals] = useState<{ icon: string; message: string }[]>([
    { icon: "👀", message: "お客さんのワーク開始を待っています..." },
  ]);
  const [clientStep, setClientStep] = useState(0);
  const [isGeneratingLetter, setIsGeneratingLetter] = useState(false);

  const refreshSession = useCallback(() => {
    const s = getSession(params.sessionId);
    if (s) {
      setSession(s);
      if (s.interview?.notes) setNotes(s.interview.notes);
      if (s.interview?.aiSuggestions) setSuggestions(s.interview.aiSuggestions);
      if (s.valueWork) {
        setEmotionSignals(generateEmotionSignals(s.valueWork));
        setClientStep(s.valueWork.currentStep);
      }
    }
  }, [params.sessionId]);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    const sync = createSyncChannel(params.sessionId);
    const unsubscribe = sync.onMessage((msg) => {
      if (msg.type === "VALUE_WORK_PROGRESS" || msg.type === "VALUE_WORK_COMPLETE" || msg.type === "VALUE_MAP_READY") {
        refreshSession();
      }
    });
    return () => {
      unsubscribe();
      sync.close();
    };
  }, [params.sessionId, refreshSession]);

  const customerName = session?.customer.name || "お客様";

  const addNote = () => {
    if (!newNote.trim()) return;
    const note: InterviewNote = {
      timestamp: new Date().toISOString(),
      content: newNote,
      category: noteCategory,
    };
    const updatedNotes = [...notes, note];
    setNotes(updatedNotes);
    setNewNote("");
    saveInterviewNotes(params.sessionId, updatedNotes);

    const newUsed = [...usedQuestions];
    const newSuggestions = generateAISuggestions(newUsed);
    setSuggestions(newSuggestions);
  };

  const markSuggestionUsed = (index: number) => {
    const question = suggestions[index].question;
    setUsedQuestions((prev) => [...prev, question]);
    setSuggestions((prev) =>
      prev.map((s, i) => (i === index ? { ...s, used: true } : s))
    );
  };

  const handleGenerateLetter = () => {
    if (!session?.valueMap || !session?.customer) return;
    setIsGeneratingLetter(true);
    setTimeout(() => {
      const letter = generateProposalLetter(
        session.customer,
        session.valueMap!,
        notes
      );
      saveProposalLetter(params.sessionId, letter);
      refreshSession();
      setIsGeneratingLetter(false);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-secondary-cream">
      <StaffNav />
      <main className="max-w-3xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-bold text-text-dark">
              面談進行 — {customerName}
            </h1>
            <p className="text-xs text-text-light">
              セッション: {params.sessionId}
            </p>
          </div>
          <div className="flex gap-2 items-center">
            {clientStep > 0 && clientStep <= 5 && (
              <span className="bg-blue-100 text-blue-700 text-xs px-2.5 py-1 rounded-full font-medium">
                Step {clientStep}/5
              </span>
            )}
            {clientStep > 5 && (
              <span className="bg-green-100 text-green-700 text-xs px-2.5 py-1 rounded-full font-medium">
                ワーク完了
              </span>
            )}
            <span className="bg-green-100 text-green-700 text-xs px-2.5 py-1 rounded-full font-medium">
              同期中
            </span>
          </div>
        </div>

        <div className="flex gap-1 mb-4 bg-white rounded-xl p-1">
          {(["notes", "map", "letter"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab
                  ? "bg-primary-orange text-white"
                  : "text-text-medium hover:bg-gray-50"
              }`}
            >
              {tab === "notes" ? "メモ・AI提案" : tab === "map" ? "価値観マップ" : "レター"}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {activeTab === "notes" && (
            <motion.div
              key="notes"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="card-soft mb-4">
                <h3 className="text-xs font-bold text-text-medium mb-2">
                  感情シグナル
                </h3>
                <div className="space-y-1.5">
                  {emotionSignals.map((signal, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 text-xs text-text-medium"
                    >
                      <span>{signal.icon}</span>
                      <span>{signal.message}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card mb-4">
                <h3 className="font-bold text-text-dark text-sm mb-3">
                  AIの問いかけ提案
                </h3>
                <div className="space-y-2">
                  {suggestions.map((s, i) => (
                    <div
                      key={i}
                      className={`flex items-start gap-2 p-3 rounded-xl transition-all ${
                        s.used
                          ? "bg-gray-50 opacity-60"
                          : "bg-secondary-cream"
                      }`}
                    >
                      <div className="flex-1">
                        <span
                          className={`inline-block text-[10px] px-2 py-0.5 rounded-full mb-1 ${
                            categoryColors[s.category]
                          }`}
                        >
                          {s.category}
                        </span>
                        <p className="text-sm text-text-dark">{s.question}</p>
                      </div>
                      {!s.used && (
                        <button
                          onClick={() => markSuggestionUsed(i)}
                          className="text-xs text-primary-orange px-2 py-1 rounded-lg hover:bg-primary-orange/10 whitespace-nowrap"
                        >
                          使った
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="card mb-4">
                <h3 className="font-bold text-text-dark text-sm mb-3">
                  面談メモ
                </h3>
                <div className="flex gap-2 mb-3 flex-wrap">
                  {(
                    [
                      "暮らしの情景",
                      "家族の未来",
                      "隠れた価値観",
                      "その他",
                    ] as const
                  ).map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setNoteCategory(cat)}
                      className={`text-xs px-2.5 py-1 rounded-full transition-all ${
                        noteCategory === cat
                          ? categoryColors[cat] + " font-medium"
                          : "bg-gray-100 text-text-light"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <textarea
                    className="input-field text-sm flex-1 min-h-[80px] resize-none"
                    placeholder="お客さんの発言や気づいたことをメモ..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                  />
                </div>
                <button
                  onClick={addNote}
                  disabled={!newNote.trim()}
                  className="btn-primary w-full mt-2 text-sm py-2"
                >
                  メモを追加
                </button>
              </div>

              {notes.length > 0 && (
                <div className="card">
                  <h3 className="font-bold text-text-dark text-sm mb-3">
                    メモ一覧
                  </h3>
                  <div className="space-y-2">
                    {[...notes].reverse().map((note, i) => (
                      <div key={i} className="bg-gray-50 rounded-xl p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full ${
                              categoryColors[note.category]
                            }`}
                          >
                            {note.category}
                          </span>
                          <span className="text-[10px] text-text-light">
                            {new Date(note.timestamp).toLocaleTimeString(
                              "ja-JP",
                              { hour: "2-digit", minute: "2-digit" }
                            )}
                          </span>
                        </div>
                        <p className="text-sm text-text-dark">
                          {note.content}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === "map" && (
            <motion.div
              key="map"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {session?.valueMap ? (
                <ValuesMapDisplay
                  valueMap={session.valueMap}
                  valueWork={session.valueWork}
                  compact
                />
              ) : (
                <div className="card text-center py-12">
                  <div className="text-4xl mb-3">🗺️</div>
                  <p className="text-text-medium text-sm mb-2">
                    価値観ワークが完了すると、マップが表示されます
                  </p>
                  {clientStep > 0 && clientStep <= 5 && (
                    <p className="text-xs text-accent-teal">
                      お客さんは現在 Step {clientStep} に取り組んでいます
                    </p>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === "letter" && (
            <motion.div
              key="letter"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {session?.proposalLetter ? (
                <div className="space-y-4">
                  <div className="card">
                    <h3 className="font-bold text-text-dark mb-3">
                      提案レター（AI下書き）
                    </h3>
                    <div className="bg-secondary-cream rounded-xl p-4 text-sm text-text-dark leading-relaxed whitespace-pre-line">
                      {session.proposalLetter.aiDraft}
                    </div>
                  </div>
                  <Link
                    href={`/s/${params.sessionId}/letter`}
                    className="btn-primary w-full block text-center"
                  >
                    レターを編集・送付する
                  </Link>
                </div>
              ) : session?.valueMap ? (
                <div className="card text-center py-12">
                  <div className="text-4xl mb-3">📝</div>
                  <p className="text-text-medium text-sm mb-4">
                    価値観マップをもとにAIがレターを生成します
                  </p>
                  <button
                    onClick={handleGenerateLetter}
                    disabled={isGeneratingLetter}
                    className="btn-primary"
                  >
                    {isGeneratingLetter ? (
                      <span className="flex items-center gap-2">
                        <motion.span
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                        />
                        生成中...
                      </span>
                    ) : (
                      "レターを生成する"
                    )}
                  </button>
                </div>
              ) : (
                <div className="card text-center py-12">
                  <div className="text-4xl mb-3">📝</div>
                  <p className="text-text-medium text-sm">
                    面談完了後、AIがレターを自動生成します
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
