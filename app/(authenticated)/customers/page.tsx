"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { createClient } from "@/utils/supabase";
import { Customer, StatusKey } from "@/types";
import {
  STATUS_MAP,
  STATUS_ORDER,
  CUSTOMER_TYPES,
  STAFF_LIST,
} from "@/utils/constants";
import { useRouter, useSearchParams } from "next/navigation";

type TypeFilter = (typeof CUSTOMER_TYPES)[number] | "all";
type StaffFilter = (typeof STAFF_LIST)[number] | "all";

export default function CustomersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [journalCounts, setJournalCounts] = useState<Record<string, number>>(
    {}
  );
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusKey | "all">(
    () => {
      const param = searchParams.get("status");
      if (param && STATUS_ORDER.includes(param as StatusKey)) {
        return param as StatusKey;
      }
      return "all";
    }
  );
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [staffFilter, setStaffFilter] = useState<StaffFilter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    const { data: customersData } = await supabase
      .from("customers")
      .select("*")
      .order("created_at", { ascending: false });

    const { data: journalData } = await supabase
      .from("journal")
      .select("customer_id");

    if (customersData) {
      setCustomers(customersData as Customer[]);
    }

    if (journalData) {
      const counts: Record<string, number> = {};
      journalData.forEach((j: { customer_id: string }) => {
        counts[j.customer_id] = (counts[j.customer_id] || 0) + 1;
      });
      setJournalCounts(counts);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const today = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      if (searchText) {
        const query = searchText.toLowerCase();
        const nameMatch = c.name.toLowerCase().includes(query);
        const idMatch = c.id.toLowerCase().includes(query);
        if (!nameMatch && !idMatch) return false;
      }
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (typeFilter !== "all" && c.type !== typeFilter) return false;
      if (staffFilter !== "all" && c.staff !== staffFilter) return false;
      return true;
    });
  }, [customers, searchText, statusFilter, typeFilter, staffFilter]);

  const handleDelete = async (customerId: string) => {
    const confirmed = window.confirm(
      "この顧客を削除しますか？関連するジャーナルもすべて削除されます。"
    );
    if (!confirmed) return;

    const supabase = createClient();
    await supabase.from("customers").delete().eq("id", customerId);

    setExpandedId(null);
    fetchData();
  };

  const typeBadgeStyle = (type: string) => {
    switch (type) {
      case "買主":
        return "border-blue-500 text-blue-600";
      case "売主":
        return "border-green-500 text-green-600";
      case "売買両方":
        return "border-purple-500 text-purple-600";
      default:
        return "border-gray-400 text-gray-500";
    }
  };

  if (loading) {
    return (
      <div className="px-4 py-4">
        <div className="flex items-center justify-center py-20">
          <div className="text-gray-400 text-sm">読み込み中...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-4 pb-32">
      {/* Search Bar */}
      <div className="relative mb-3">
        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
          <svg
            className="w-4 h-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
        <input
          type="text"
          placeholder="顧客名・IDで検索"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 placeholder:text-gray-400"
        />
      </div>

      {/* Filters */}
      <div className="space-y-2 mb-4">
        {/* Status Filter */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => setStatusFilter("all")}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition min-h-[32px] ${
              statusFilter === "all"
                ? "bg-navy text-white"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            全ステータス
          </button>
          {STATUS_ORDER.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition min-h-[32px] ${
                statusFilter === s
                  ? `${STATUS_MAP[s].bgColor} ${STATUS_MAP[s].color}`
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {s}：{STATUS_MAP[s].meaning}
            </button>
          ))}
        </div>

        {/* Type + Staff Filters */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => setTypeFilter("all")}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition min-h-[32px] ${
              typeFilter === "all"
                ? "bg-navy text-white"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            全種別
          </button>
          {CUSTOMER_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition min-h-[32px] ${
                typeFilter === t
                  ? "bg-navy text-white"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {t}
            </button>
          ))}
          <div className="flex-shrink-0 w-px bg-gray-300 mx-1 self-stretch" />
          <button
            onClick={() => setStaffFilter("all")}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition min-h-[32px] ${
              staffFilter === "all"
                ? "bg-navy text-white"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            全担当
          </button>
          {STAFF_LIST.map((st) => (
            <button
              key={st}
              onClick={() => setStaffFilter(st)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition min-h-[32px] ${
                staffFilter === st
                  ? "bg-navy text-white"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      <div className="text-xs text-gray-400 mb-3">
        {filteredCustomers.length}件の顧客
      </div>

      {/* Customer Cards */}
      {filteredCustomers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <svg
            className="w-12 h-12 mb-3"
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
          <p className="text-sm">該当する顧客がいません</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredCustomers.map((customer) => {
            const isExpanded = expandedId === customer.id;
            const statusInfo = STATUS_MAP[customer.status];
            const jCount = journalCounts[customer.id] || 0;
            const isOverdue =
              customer.next_action_date && customer.next_action_date < today;

            return (
              <div
                key={customer.id}
                className="bg-white rounded-xl shadow-sm overflow-hidden"
              >
                {/* Card Body */}
                <button
                  onClick={() =>
                    setExpandedId(isExpanded ? null : customer.id)
                  }
                  className="w-full text-left px-4 py-3 min-h-[44px]"
                >
                  {/* Top row: Name + badges */}
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="font-bold text-base text-gray-900 truncate">
                      {customer.name}
                    </span>
                    <span
                      className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold ${statusInfo.bgColor} ${statusInfo.color}`}
                    >
                      {statusInfo.label}
                    </span>
                    <span
                      className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium border ${typeBadgeStyle(customer.type)}`}
                    >
                      {customer.type}
                    </span>
                  </div>

                  {/* Info row */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                    <span>{customer.staff}</span>
                    {customer.source && <span>{customer.source}</span>}
                    {customer.next_action_date && (
                      <span className={isOverdue ? "text-red-500 font-medium" : ""}>
                        次回：{customer.next_action_date}
                      </span>
                    )}
                    {jCount > 0 && (
                      <span className="bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded text-[10px]">
                        記録 {jCount}件
                      </span>
                    )}
                  </div>

                  {/* Urgency memo */}
                  {customer.urgency && (
                    <div className="mt-1.5 text-xs text-orange-600 bg-orange-50 rounded px-2 py-1 line-clamp-2">
                      {customer.urgency}
                    </div>
                  )}
                </button>

                {/* Expanded actions */}
                {isExpanded && (
                  <div className="px-4 pb-3 pt-1 border-t border-gray-100">
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() =>
                          router.push(`/customers/${customer.id}`)
                        }
                        className="flex items-center gap-1 px-3 py-2 bg-navy text-white text-xs font-medium rounded-lg min-h-[44px] min-w-[44px] transition active:opacity-80"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                          />
                        </svg>
                        詳細
                      </button>
                      <button
                        onClick={() =>
                          router.push(`/customers/${customer.id}/edit`)
                        }
                        className="flex items-center gap-1 px-3 py-2 bg-gray-100 text-gray-700 text-xs font-medium rounded-lg min-h-[44px] min-w-[44px] transition active:opacity-80"
                      >
                        <svg
                          className="w-4 h-4"
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
                        編集
                      </button>
                      <button
                        onClick={() =>
                          router.push(
                            `/journal/new?customer_id=${customer.id}`
                          )
                        }
                        className="flex items-center gap-1 px-3 py-2 bg-gray-100 text-gray-700 text-xs font-medium rounded-lg min-h-[44px] min-w-[44px] transition active:opacity-80"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 4v16m8-8H4"
                          />
                        </svg>
                        記録追加
                      </button>
                      {customer.phone && (
                        <button
                          onClick={() => {
                            window.location.href = `tel:${customer.phone}`;
                          }}
                          className="flex items-center gap-1 px-3 py-2 bg-green-50 text-green-700 text-xs font-medium rounded-lg min-h-[44px] min-w-[44px] transition active:opacity-80"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                            />
                          </svg>
                          電話
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(customer.id)}
                        className="flex items-center gap-1 px-3 py-2 bg-red-50 text-red-600 text-xs font-medium rounded-lg min-h-[44px] min-w-[44px] transition active:opacity-80"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                        削除
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* FAB - New Customer */}
      <button
        onClick={() => router.push("/customers/new")}
        className="fixed bottom-24 right-4 bg-navy text-white px-5 py-3 rounded-full shadow-lg flex items-center gap-1.5 text-sm font-bold z-30 min-h-[44px] transition active:opacity-80 hover:bg-navy-light"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
            d="M12 4v16m8-8H4"
          />
        </svg>
        新規顧客
      </button>
    </div>
  );
}
