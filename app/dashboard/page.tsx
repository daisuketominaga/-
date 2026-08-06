"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import StaffNav from "@/components/StaffNav";
import { getAllSessions } from "@/lib/sessionStore";
import type { Session } from "@/types";

const statusColors: Record<string, string> = {
  準備中: "bg-yellow-100 text-yellow-700",
  面談中: "bg-blue-100 text-blue-700",
  分析中: "bg-purple-100 text-purple-700",
  完了: "bg-green-100 text-green-700",
};

const customerStatusColors: Record<string, string> = {
  事前準備: "bg-gray-100 text-gray-600",
  面談済み: "bg-blue-100 text-blue-700",
  レター送付済み: "bg-green-100 text-green-700",
  物件提案中: "bg-purple-100 text-purple-700",
  成約: "bg-primary-orange/10 text-primary-orange",
  見送り: "bg-red-100 text-red-600",
};

export default function DashboardPage() {
  const [sessions, setSessions] = useState<Session[]>([]);

  useEffect(() => {
    setSessions(getAllSessions());
  }, []);

  useEffect(() => {
    const onFocus = () => setSessions(getAllSessions());
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const stats = {
    total: sessions.length,
    active: sessions.filter((s) => s.status === "面談中" || s.status === "準備中").length,
    completed: sessions.filter((s) => s.status === "完了").length,
  };

  return (
    <div className="min-h-screen bg-secondary-cream">
      <StaffNav />
      <main className="max-w-5xl mx-auto px-4 py-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-text-dark mb-1">
            ダッシュボード
          </h1>
          <p className="text-text-light text-sm">
            面談の管理・顧客の状況を確認できます
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="card text-center">
            <div className="text-3xl font-display font-bold text-primary-orange">
              {stats.total}
            </div>
            <div className="text-xs text-text-light mt-1">全セッション</div>
          </div>
          <div className="card text-center">
            <div className="text-3xl font-display font-bold text-accent-teal">
              {stats.active}
            </div>
            <div className="text-xs text-text-light mt-1">進行中</div>
          </div>
          <div className="card text-center">
            <div className="text-3xl font-display font-bold text-green-500">
              {stats.completed}
            </div>
            <div className="text-xs text-text-light mt-1">完了</div>
          </div>
        </div>

        <Link href="/s/new" className="btn-primary w-full block text-center mb-8 text-lg py-4">
          + 新しい面談を始める
        </Link>

        <div className="mb-4">
          <h2 className="text-lg font-bold text-text-dark mb-4">
            面談セッション
          </h2>
          <div className="space-y-3">
            {sessions.map((session) => (
              <Link
                key={session.id}
                href={`/s/${session.id}/staff`}
                className="card block hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-bold text-text-dark text-lg">
                      {session.customer.name}
                    </h3>
                    <p className="text-text-light text-sm">
                      {session.customer.age > 0 && `${session.customer.age}歳`}
                      {session.customer.family.spouse && " / ご夫婦"}
                      {session.customer.family.children.length > 0 &&
                        ` / お子さん${session.customer.family.children.length}人`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        statusColors[session.status]
                      }`}
                    >
                      {session.status}
                    </span>
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        customerStatusColors[session.customer.status]
                      }`}
                    >
                      {session.customer.status}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-text-light">
                  <span>{session.customer.purchasePurpose}</span>
                  {session.customer.preferredArea && (
                    <span>{session.customer.preferredArea}</span>
                  )}
                  {session.customer.budget && (
                    <span>
                      {session.customer.budget.min}〜{session.customer.budget.max}万円
                    </span>
                  )}
                </div>
                {session.valueMap && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="flex flex-wrap gap-1.5">
                      {session.valueMap.keywords.slice(0, 4).map((kw) => (
                        <span
                          key={kw.word}
                          className="bg-primary-orange/5 text-primary-orange text-xs px-2 py-0.5 rounded-full"
                        >
                          {kw.word}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
