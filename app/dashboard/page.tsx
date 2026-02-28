"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getCustomers, getSessions } from "@/lib/store";
import type { Customer, Session } from "@/lib/types";

const STATUS_COLORS: Record<string, string> = {
  事前準備: "bg-gray-100 text-gray-700",
  面談済み: "bg-blue-100 text-blue-700",
  レター送付済み: "bg-brand-gold/20 text-brand-navy",
  物件提案中: "bg-green-100 text-green-700",
  成約: "bg-brand-green/20 text-brand-green",
  見送り: "bg-red-100 text-red-700",
};

export default function DashboardPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);

  useEffect(() => {
    setCustomers(getCustomers());
    setSessions(getSessions());
  }, []);

  const getLatestSession = (customerId: string): Session | undefined => {
    return sessions
      .filter((s) => s.customer_id === customerId)
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0];
  };

  return (
    <div className="min-h-screen bg-background-warm">
      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-navy rounded-lg flex items-center justify-center">
              <span className="text-white font-bold">一</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-brand-navy">
                ダッシュボード
              </h1>
              <p className="text-xs text-text-muted">イチエン不動産</p>
            </div>
          </div>
          <button
            onClick={() => router.push("/session/new")}
            className="bg-brand-navy text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-brand-navy-light transition-colors shadow-sm"
          >
            新規面談
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* 統計 */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-2xl font-bold text-brand-navy">
              {customers.length}
            </p>
            <p className="text-xs text-text-muted">総顧客数</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-2xl font-bold text-brand-green">
              {sessions.filter((s) => s.status === "進行中").length}
            </p>
            <p className="text-xs text-text-muted">進行中の面談</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-2xl font-bold text-brand-gold">
              {
                customers.filter(
                  (c) =>
                    c.status === "面談済み" || c.status === "レター送付済み"
                ).length
              }
            </p>
            <p className="text-xs text-text-muted">フォロー待ち</p>
          </div>
        </div>

        {/* 顧客一覧 */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-text-primary">顧客一覧</h2>
        </div>

        {customers.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
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
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </div>
            <p className="text-text-secondary mb-2">
              まだ顧客が登録されていません
            </p>
            <p className="text-text-muted text-sm mb-6">
              「新規面談」から最初の面談を始めましょう
            </p>
            <button
              onClick={() => router.push("/session/new")}
              className="bg-brand-navy text-white px-6 py-3 rounded-xl text-sm font-medium hover:bg-brand-navy-light transition-colors"
            >
              最初の面談を始める
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {customers.map((customer) => {
              const session = getLatestSession(customer.id);
              return (
                <div
                  key={customer.id}
                  className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => {
                    if (session) {
                      router.push(`/s/${session.id}/staff`);
                    }
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-text-primary">
                        {customer.name} 様
                      </h3>
                      <p className="text-sm text-text-muted mt-0.5">
                        {customer.family?.children?.length
                          ? `ご家族${(customer.family.spouse ? 1 : 0) + customer.family.children.length + 1}人`
                          : customer.family?.spouse
                            ? "ご夫婦"
                            : ""}
                        {customer.purchase_purpose &&
                          ` / ${customer.purchase_purpose}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs px-3 py-1 rounded-full ${STATUS_COLORS[customer.status] || STATUS_COLORS["事前準備"]}`}
                      >
                        {customer.status}
                      </span>
                      <svg
                        className="w-5 h-5 text-text-muted"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </div>
                  </div>
                  {session && (
                    <div className="mt-2 pt-2 border-t border-gray-50 flex items-center gap-4 text-xs text-text-muted">
                      <span>
                        最終面談:{" "}
                        {new Date(session.created_at).toLocaleDateString(
                          "ja-JP"
                        )}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded ${session.status === "進行中" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}
                      >
                        {session.status}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
