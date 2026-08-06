"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase";
import { Customer, Journal, StatusKey } from "@/types";
import { STATUS_MAP, STATUS_ORDER } from "@/utils/constants";

interface JournalWithCustomer extends Journal {
  customers: { name: string } | null;
}

export default function DashboardPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [journals, setJournals] = useState<JournalWithCustomer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient();

      const [customersRes, journalsRes] = await Promise.all([
        supabase.from("customers").select("*"),
        supabase
          .from("journal")
          .select("*, customers(name)")
          .order("date", { ascending: false })
          .limit(5),
      ]);

      if (customersRes.data) {
        setCustomers(customersRes.data as Customer[]);
      }
      if (journalsRes.data) {
        setJournals(journalsRes.data as JournalWithCustomer[]);
      }

      setLoading(false);
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-navy border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">読み込み中...</p>
        </div>
      </div>
    );
  }

  const today = new Date().toISOString().split("T")[0];

  // Status counts
  const statusCounts: Record<StatusKey, number> = {
    S: 0,
    A: 0,
    B: 0,
    C: 0,
    D: 0,
    E: 0,
  };
  customers.forEach((c) => {
    if (c.status in statusCounts) {
      statusCounts[c.status]++;
    }
  });

  // Overdue customers: next_action_date is before today
  const overdueCustomers = customers.filter(
    (c) => c.next_action_date && c.next_action_date < today
  );

  // No contact for 14+ days
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  const fourteenDaysAgoStr = fourteenDaysAgo.toISOString().split("T")[0];

  const noContactCustomers = customers.filter(
    (c) =>
      c.last_contact &&
      c.last_contact <= fourteenDaysAgoStr &&
      c.status !== "S" &&
      c.status !== "E"
  );

  // Source statistics
  const sourceCounts: Record<string, number> = {};
  customers.forEach((c) => {
    const src = c.source || "未設定";
    sourceCounts[src] = (sourceCounts[src] || 0) + 1;
  });
  const sourceEntries = Object.entries(sourceCounts).sort(
    (a, b) => b[1] - a[1]
  );
  const maxSourceCount = sourceEntries.length > 0 ? sourceEntries[0][1] : 1;

  // Days since contact helper
  const daysSince = (dateStr: string): number => {
    const then = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - then.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="px-4 py-4 space-y-6">
      {/* Section: Status Cards */}
      <section>
        <h2 className="text-base font-bold text-navy mb-3 flex items-center gap-2">
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          ステータス別
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {STATUS_ORDER.map((key) => {
            const info = STATUS_MAP[key];
            return (
              <button
                key={key}
                onClick={() => router.push(`/customers?status=${key}`)}
                className={`${info.bgColor} ${info.color} rounded-2xl p-3 min-h-[72px] flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform shadow-sm`}
              >
                <span className="text-2xl font-bold leading-none">
                  {info.label}
                </span>
                <span className="text-xs opacity-90">{info.meaning}</span>
                <span className="text-lg font-bold leading-none">
                  {statusCounts[key]}
                  <span className="text-xs font-normal ml-0.5">件</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Section: Overdue Warning */}
      {overdueCustomers.length > 0 && (
        <section>
          <h2 className="text-base font-bold text-red-600 mb-3 flex items-center gap-2">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
            期限超過
            <span className="text-sm font-normal text-red-500">
              ({overdueCustomers.length}件)
            </span>
          </h2>
          <div className="bg-red-50 border border-red-200 rounded-2xl overflow-hidden divide-y divide-red-100">
            {overdueCustomers.map((c) => (
              <button
                key={c.id}
                onClick={() => router.push(`/customers/${c.id}`)}
                className="w-full text-left px-4 py-3 min-h-[44px] hover:bg-red-100 active:bg-red-100 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm text-gray-900 truncate">
                      {c.name}
                    </p>
                    <p className="text-xs text-gray-600 mt-0.5 truncate">
                      {c.next_action || "アクション未設定"}
                    </p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-xs text-red-600 font-bold">
                      {c.next_action_date}
                    </p>
                    <p className="text-xs text-red-500 mt-0.5">
                      {daysSince(c.next_action_date!)}日超過
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Section: No Contact Warning */}
      {noContactCustomers.length > 0 && (
        <section>
          <h2 className="text-base font-bold text-yellow-700 mb-3 flex items-center gap-2">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            2週間以上未連絡
            <span className="text-sm font-normal text-yellow-600">
              ({noContactCustomers.length}件)
            </span>
          </h2>
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl overflow-hidden divide-y divide-yellow-100">
            {noContactCustomers.map((c) => (
              <button
                key={c.id}
                onClick={() => router.push(`/customers/${c.id}`)}
                className="w-full text-left px-4 py-3 min-h-[44px] hover:bg-yellow-100 active:bg-yellow-100 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm text-gray-900 truncate">
                      {c.name}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      最終連絡: {c.last_contact}
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    <span className="inline-block bg-yellow-200 text-yellow-800 text-xs font-bold px-2 py-1 rounded-full">
                      {daysSince(c.last_contact!)}日前
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Section: Source Statistics */}
      <section>
        <h2 className="text-base font-bold text-navy mb-3 flex items-center gap-2">
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          流入経路集計
        </h2>
        <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
          {sourceEntries.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-2">
              データなし
            </p>
          ) : (
            sourceEntries.map(([source, count]) => (
              <div key={source}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-700">{source}</span>
                  <span className="text-sm font-bold text-navy">
                    {count}件
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2.5">
                  <div
                    className="bg-navy h-2.5 rounded-full transition-all"
                    style={{
                      width: `${(count / maxSourceCount) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Section: Recent Journal Entries */}
      <section>
        <h2 className="text-base font-bold text-navy mb-3 flex items-center gap-2">
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            />
          </svg>
          最近のジャーナル
        </h2>
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden divide-y divide-gray-100">
          {journals.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">
              ジャーナルがありません
            </p>
          ) : (
            journals.map((j) => (
              <button
                key={j.id}
                onClick={() => router.push(`/customers/${j.customer_id}`)}
                className="w-full text-left px-4 py-3 min-h-[44px] hover:bg-gray-50 active:bg-gray-50 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 pt-0.5">
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                      {j.date}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-bold text-gray-900 truncate">
                        {j.customers?.name || "不明"}
                      </span>
                      <span className="flex-shrink-0 inline-block bg-navy/10 text-navy text-xs font-bold px-2 py-0.5 rounded-full">
                        {j.action_type}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 truncate">
                      {j.content.length > 50
                        ? j.content.substring(0, 50) + "..."
                        : j.content}
                    </p>
                  </div>
                  <div className="flex-shrink-0 pt-1">
                    <svg
                      className="w-4 h-4 text-gray-300"
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
              </button>
            ))
          )}
        </div>
      </section>

      {/* Total customer count */}
      <div className="text-center text-xs text-gray-400 pb-2">
        全顧客数: {customers.length}件
      </div>
    </div>
  );
}
