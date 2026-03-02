"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/utils/supabase";
import { Customer, BuyerDetail, SellerDetail, Journal, StatusKey } from "@/types";
import { STATUS_MAP, REACTION_TYPES } from "@/utils/constants";
import { useRouter, useParams } from "next/navigation";

const REACTION_COLORS: Record<string, string> = {
  "気に入った": "bg-reaction-liked text-white",
  "検討中": "bg-reaction-considering text-black",
  "却下": "bg-reaction-rejected text-white",
  "未確認": "bg-reaction-unchecked text-white",
};

function getBorderColor(journal: Journal): string {
  if (journal.property_name) return "border-l-journal-property";
  if (journal.value_change) return "border-l-journal-value";
  return "border-l-journal-normal";
}

export default function CustomerDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [buyerDetail, setBuyerDetail] = useState<BuyerDetail | null>(null);
  const [sellerDetail, setSellerDetail] = useState<SellerDetail | null>(null);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchJournals = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("journal")
      .select("*")
      .eq("customer_id", id)
      .order("date", { ascending: false });
    if (data) setJournals(data);
  }, [id]);

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();

      const { data: customerData } = await supabase
        .from("customers")
        .select("*")
        .eq("id", id)
        .single();

      if (customerData) {
        setCustomer(customerData);

        if (
          customerData.type === "買主" ||
          customerData.type === "売買両方"
        ) {
          const { data: buyerData } = await supabase
            .from("buyer_details")
            .select("*")
            .eq("customer_id", id)
            .single();
          setBuyerDetail(buyerData);
        }

        if (
          customerData.type === "売主" ||
          customerData.type === "売買両方"
        ) {
          const { data: sellerData } = await supabase
            .from("seller_details")
            .select("*")
            .eq("customer_id", id)
            .single();
          setSellerDetail(sellerData);
        }
      }

      await fetchJournals();
      setLoading(false);
    }

    fetchData();
  }, [id, fetchJournals]);

  const handleDeleteJournal = async (journalId: number) => {
    if (!confirm("この記録を削除しますか？")) return;
    setDeletingId(journalId);
    const supabase = createClient();
    await supabase.from("journal").delete().eq("id", journalId);
    await fetchJournals();
    setDeletingId(null);
  };

  if (loading) {
    return (
      <div className="px-4 py-4">
        <div className="flex items-center justify-center py-20">
          <div className="text-gray-500">読み込み中...</div>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="px-4 py-4">
        <div className="flex items-center justify-center py-20">
          <div className="text-gray-500">顧客が見つかりません</div>
        </div>
      </div>
    );
  }

  const statusInfo = STATUS_MAP[customer.status as StatusKey];
  const isBuyer = customer.type === "買主" || customer.type === "売買両方";
  const isSeller = customer.type === "売主" || customer.type === "売買両方";

  return (
    <div className="px-4 py-4">
      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="flex items-center text-navy mb-4 text-sm font-medium"
      >
        <svg
          className="w-5 h-5 mr-1"
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
        戻る
      </button>

      {/* ① Basic Info */}
      <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-900">{customer.name}</h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span
                className={`inline-block px-2 py-0.5 text-xs font-bold rounded-full ${statusInfo.bgColor} ${statusInfo.color}`}
              >
                {statusInfo.label} - {statusInfo.meaning}
              </span>
              <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-navy text-white">
                {customer.type}
              </span>
              <span className="text-xs text-gray-500">
                担当: {customer.staff}
              </span>
            </div>
          </div>
          <button
            onClick={() => router.push(`/customers/${id}/edit`)}
            className="bg-navy text-white text-sm px-3 py-1.5 rounded-lg font-medium"
          >
            編集
          </button>
        </div>

        <div className="space-y-2 text-sm">
          {customer.phone && (
            <div className="flex items-center gap-2">
              <span className="text-gray-500 w-20 shrink-0">電話</span>
              <a
                href={`tel:${customer.phone}`}
                className="text-navy font-medium underline"
              >
                {customer.phone}
              </a>
            </div>
          )}
          {customer.email && (
            <div className="flex items-center gap-2">
              <span className="text-gray-500 w-20 shrink-0">メール</span>
              <span className="text-gray-900">{customer.email}</span>
            </div>
          )}
          {customer.line_id && (
            <div className="flex items-center gap-2">
              <span className="text-gray-500 w-20 shrink-0">LINE ID</span>
              <span className="text-gray-900">{customer.line_id}</span>
            </div>
          )}
          {customer.source && (
            <div className="flex items-center gap-2">
              <span className="text-gray-500 w-20 shrink-0">流入元</span>
              <span className="text-gray-900">
                {customer.source}
                {customer.source_name && ` / ${customer.source_name}`}
              </span>
            </div>
          )}
          {customer.urgency && (
            <div className="flex items-start gap-2">
              <span className="text-gray-500 w-20 shrink-0">緊急メモ</span>
              <span className="text-gray-900 whitespace-pre-wrap">
                {customer.urgency}
              </span>
            </div>
          )}
          {customer.last_contact && (
            <div className="flex items-center gap-2">
              <span className="text-gray-500 w-20 shrink-0">最終連絡</span>
              <span className="text-gray-900">{customer.last_contact}</span>
            </div>
          )}
          {(customer.next_action_date || customer.next_action) && (
            <div className="flex items-start gap-2">
              <span className="text-gray-500 w-20 shrink-0">次回</span>
              <span className="text-gray-900">
                {customer.next_action_date && (
                  <span className="font-medium">{customer.next_action_date}</span>
                )}
                {customer.next_action_date && customer.next_action && " / "}
                {customer.next_action}
              </span>
            </div>
          )}
        </div>

        {customer.memo && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-xs text-gray-500 mb-1">メモ</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">
              {customer.memo}
            </p>
          </div>
        )}
      </div>

      {/* ② Buyer Details */}
      {isBuyer && buyerDetail && (
        <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
          <h3 className="text-base font-bold text-gray-900 mb-3">
            買主情報
          </h3>
          <div className="space-y-2 text-sm">
            {buyerDetail.area && (
              <div className="flex items-center gap-2">
                <span className="text-gray-500 w-28 shrink-0">希望エリア</span>
                <span className="text-gray-900">{buyerDetail.area}</span>
              </div>
            )}
            {buyerDetail.property_type && (
              <div className="flex items-center gap-2">
                <span className="text-gray-500 w-28 shrink-0">物件種別</span>
                <span className="text-gray-900">{buyerDetail.property_type}</span>
              </div>
            )}
            {buyerDetail.budget && (
              <div className="flex items-center gap-2">
                <span className="text-gray-500 w-28 shrink-0">予算</span>
                <span className="text-gray-900">{buyerDetail.budget}</span>
              </div>
            )}
            {buyerDetail.loan_status && (
              <div className="flex items-center gap-2">
                <span className="text-gray-500 w-28 shrink-0">ローン状況</span>
                <span className="text-gray-900">{buyerDetail.loan_status}</span>
              </div>
            )}
            {buyerDetail.move_date && (
              <div className="flex items-center gap-2">
                <span className="text-gray-500 w-28 shrink-0">引越し時期</span>
                <span className="text-gray-900">{buyerDetail.move_date}</span>
              </div>
            )}
            {buyerDetail.conditions && (
              <div className="flex items-start gap-2">
                <span className="text-gray-500 w-28 shrink-0">条件</span>
                <span className="text-gray-900 whitespace-pre-wrap">
                  {buyerDetail.conditions}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ③ Seller Details */}
      {isSeller && sellerDetail && (
        <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
          <h3 className="text-base font-bold text-gray-900 mb-3">
            売主情報
          </h3>
          <div className="space-y-2 text-sm">
            {sellerDetail.address && (
              <div className="flex items-start gap-2">
                <span className="text-gray-500 w-28 shrink-0">所在地</span>
                <span className="text-gray-900">{sellerDetail.address}</span>
              </div>
            )}
            {sellerDetail.land_use && (
              <div className="flex items-center gap-2">
                <span className="text-gray-500 w-28 shrink-0">用途地域</span>
                <span className="text-gray-900">{sellerDetail.land_use}</span>
              </div>
            )}
            {sellerDetail.land_area && (
              <div className="flex items-center gap-2">
                <span className="text-gray-500 w-28 shrink-0">土地面積</span>
                <span className="text-gray-900">{sellerDetail.land_area}</span>
              </div>
            )}
            {sellerDetail.building_area && (
              <div className="flex items-center gap-2">
                <span className="text-gray-500 w-28 shrink-0">建物面積</span>
                <span className="text-gray-900">{sellerDetail.building_area}</span>
              </div>
            )}
            {sellerDetail.current_status && (
              <div className="flex items-center gap-2">
                <span className="text-gray-500 w-28 shrink-0">現況</span>
                <span className="text-gray-900">{sellerDetail.current_status}</span>
              </div>
            )}
            {sellerDetail.sale_reason && (
              <div className="flex items-center gap-2">
                <span className="text-gray-500 w-28 shrink-0">売却理由</span>
                <span className="text-gray-900">{sellerDetail.sale_reason}</span>
              </div>
            )}
            {sellerDetail.assessed_price && (
              <div className="flex items-center gap-2">
                <span className="text-gray-500 w-28 shrink-0">査定価格</span>
                <span className="text-gray-900">{sellerDetail.assessed_price}</span>
              </div>
            )}
            {sellerDetail.asking_price && (
              <div className="flex items-center gap-2">
                <span className="text-gray-500 w-28 shrink-0">売出価格</span>
                <span className="text-gray-900">{sellerDetail.asking_price}</span>
              </div>
            )}
            {sellerDetail.mediation_type && (
              <div className="flex items-center gap-2">
                <span className="text-gray-500 w-28 shrink-0">媒介種別</span>
                <span className="text-gray-900">{sellerDetail.mediation_type}</span>
              </div>
            )}
            {sellerDetail.mediation_expiry && (
              <div className="flex items-center gap-2">
                <span className="text-gray-500 w-28 shrink-0">媒介期限</span>
                <span className="text-gray-900">{sellerDetail.mediation_expiry}</span>
              </div>
            )}
            {sellerDetail.reins && (
              <div className="flex items-center gap-2">
                <span className="text-gray-500 w-28 shrink-0">レインズ</span>
                <span className="text-gray-900">{sellerDetail.reins}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ④ Journal Timeline */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold text-gray-900">対応履歴</h3>
          <button
            onClick={() =>
              router.push(`/journal/new?customer_id=${id}`)
            }
            className="bg-navy text-white text-sm px-3 py-1.5 rounded-lg font-medium"
          >
            ＋ 記録を追加
          </button>
        </div>

        {journals.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 shadow-sm text-center text-gray-400 text-sm">
            対応履歴はまだありません
          </div>
        ) : (
          <div className="space-y-3">
            {journals.map((journal) => (
              <div
                key={journal.id}
                className={`bg-white rounded-2xl shadow-sm border-l-4 ${getBorderColor(
                  journal
                )} overflow-hidden`}
              >
                <div className="p-4">
                  {/* Header */}
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-900">
                      {journal.date}
                    </span>
                    <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
                      {journal.action_type}
                    </span>
                    {journal.reaction && (
                      <span
                        className={`inline-block px-2 py-0.5 text-xs font-bold rounded-full ${
                          REACTION_COLORS[journal.reaction] ||
                          "bg-gray-200 text-gray-700"
                        }`}
                      >
                        {journal.reaction}
                      </span>
                    )}
                  </div>

                  {/* Content */}
                  {journal.content && (
                    <p className="text-sm text-gray-700 whitespace-pre-wrap mb-2">
                      {journal.content}
                    </p>
                  )}

                  {/* Property Section */}
                  {journal.property_name && (
                    <div className="bg-orange-50 rounded-lg p-3 mb-2 text-sm space-y-1">
                      <div className="font-medium text-gray-900">
                        <span className="mr-1">&#127968;</span>
                        {journal.property_name}
                        {journal.property_address && (
                          <span className="text-gray-500 text-xs ml-2">
                            {journal.property_address}
                          </span>
                        )}
                      </div>
                      {(journal.property_price ||
                        journal.property_land_area ||
                        journal.property_building_area) && (
                        <div className="text-gray-600">
                          <span className="mr-1">&#128176;</span>
                          {journal.property_price && (
                            <span className="mr-3">{journal.property_price}</span>
                          )}
                          {journal.property_land_area && (
                            <span className="mr-3">
                              土地 {journal.property_land_area}
                            </span>
                          )}
                          {journal.property_building_area && (
                            <span>建物 {journal.property_building_area}</span>
                          )}
                        </div>
                      )}
                      {journal.explanation && (
                        <div className="text-gray-600">
                          <span className="mr-1">&#128172;</span>
                          {journal.explanation}
                        </div>
                      )}
                      {journal.fit_memo && (
                        <div className="text-gray-600">
                          合致度: {journal.fit_memo}
                        </div>
                      )}
                      {journal.reaction_detail && (
                        <div className="text-gray-600">
                          → {journal.reaction_detail}
                        </div>
                      )}
                      {journal.materials && (
                        <div className="text-gray-600">
                          <span className="mr-1">&#128206;</span>
                          {journal.materials}
                        </div>
                      )}
                      {journal.proposal_link && (
                        <a
                          href={journal.proposal_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block mt-1 text-navy font-medium text-xs underline"
                        >
                          提案ページを開く
                        </a>
                      )}
                    </div>
                  )}

                  {/* Value Change Section */}
                  {journal.value_change && (
                    <div className="bg-purple-50 rounded-lg p-3 mb-2 text-sm space-y-1">
                      <div className="text-gray-700">
                        <span className="mr-1">&#128161;</span>
                        {journal.value_change}
                      </div>
                      {journal.next_hint && (
                        <div className="text-gray-600">
                          <span className="mr-1">&#127919;</span>
                          {journal.next_hint}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-3 mt-2 pt-2 border-t border-gray-100">
                    <button
                      onClick={() =>
                        router.push(`/journal/${journal.id}/edit`)
                      }
                      className="text-xs text-navy font-medium"
                    >
                      編集
                    </button>
                    <button
                      onClick={() => handleDeleteJournal(journal.id)}
                      disabled={deletingId === journal.id}
                      className="text-xs text-red-500 font-medium disabled:opacity-50"
                    >
                      {deletingId === journal.id ? "削除中..." : "削除"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
