"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase";
import { Customer } from "@/types";
import { ACTION_TYPES, REACTION_TYPES } from "@/utils/constants";
import { useRouter, useSearchParams } from "next/navigation";

export default function JournalNewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const customerId = searchParams.get("customer_id");
  const journalId = searchParams.get("journal_id");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Customer data
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState(customerId || "");
  const [customerName, setCustomerName] = useState("");

  // Required fields
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [actionType, setActionType] = useState<string>(ACTION_TYPES[0]);
  const [content, setContent] = useState("");

  // Property section
  const [propertyOpen, setPropertyOpen] = useState(false);
  const [propertyName, setPropertyName] = useState("");
  const [propertyAddress, setPropertyAddress] = useState("");
  const [propertyPrice, setPropertyPrice] = useState("");
  const [propertyLandArea, setPropertyLandArea] = useState("");
  const [propertyBuildingArea, setPropertyBuildingArea] = useState("");
  const [proposalLink, setProposalLink] = useState("");
  const [materials, setMaterials] = useState("");
  const [explanation, setExplanation] = useState("");
  const [reaction, setReaction] = useState("");
  const [reactionDetail, setReactionDetail] = useState("");
  const [fitMemo, setFitMemo] = useState("");

  // Value section
  const [valueOpen, setValueOpen] = useState(false);
  const [valueChange, setValueChange] = useState("");
  const [nextHint, setNextHint] = useState("");

  const supabase = createClient();

  const loadData = useCallback(async () => {
    try {
      // If customer_id is provided, fetch just that customer's name
      if (customerId) {
        const { data: customer } = await supabase
          .from("customers")
          .select("id, name")
          .eq("id", customerId)
          .single();
        if (customer) {
          setCustomerName(customer.name);
          setSelectedCustomerId(customer.id);
        }
      } else {
        // No customer pre-selected, load all customers for dropdown
        const { data: allCustomers } = await supabase
          .from("customers")
          .select("*")
          .order("name");
        if (allCustomers) {
          setCustomers(allCustomers);
          if (allCustomers.length > 0 && !selectedCustomerId) {
            setSelectedCustomerId(allCustomers[0].id);
          }
        }
      }

      // If editing, load existing journal
      if (journalId) {
        const { data: journal } = await supabase
          .from("journal")
          .select("*")
          .eq("id", journalId)
          .single();

        if (journal) {
          setSelectedCustomerId(journal.customer_id);
          setDate(journal.date);
          setActionType(journal.action_type);
          setContent(journal.content);
          setPropertyName(journal.property_name || "");
          setPropertyAddress(journal.property_address || "");
          setPropertyPrice(journal.property_price || "");
          setPropertyLandArea(journal.property_land_area || "");
          setPropertyBuildingArea(journal.property_building_area || "");
          setProposalLink(journal.proposal_link || "");
          setMaterials(journal.materials || "");
          setExplanation(journal.explanation || "");
          setReaction(journal.reaction || "");
          setReactionDetail(journal.reaction_detail || "");
          setFitMemo(journal.fit_memo || "");
          setValueChange(journal.value_change || "");
          setNextHint(journal.next_hint || "");

          // Auto-open sections if they have data
          const hasPropertyData =
            journal.property_name ||
            journal.property_address ||
            journal.property_price ||
            journal.property_land_area ||
            journal.property_building_area ||
            journal.proposal_link ||
            journal.materials ||
            journal.explanation ||
            journal.reaction ||
            journal.reaction_detail ||
            journal.fit_memo;

          const hasValueData = journal.value_change || journal.next_hint;

          if (hasPropertyData) setPropertyOpen(true);
          if (hasValueData) setValueOpen(true);

          // If editing and we don't have customer name yet, fetch it
          if (!customerId) {
            const { data: customer } = await supabase
              .from("customers")
              .select("id, name")
              .eq("id", journal.customer_id)
              .single();
            if (customer) {
              setCustomerName(customer.name);
            }
          }
        }
      }
    } catch {
      setError("データの読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, [customerId, journalId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!selectedCustomerId) {
      setError("顧客を選択してください");
      return;
    }
    if (!content.trim()) {
      setError("対応内容を入力してください");
      return;
    }

    setSaving(true);

    const formData = {
      customer_id: selectedCustomerId,
      date,
      action_type: actionType,
      content: content.trim(),
      property_name: propertyName || null,
      property_address: propertyAddress || null,
      property_price: propertyPrice || null,
      property_land_area: propertyLandArea || null,
      property_building_area: propertyBuildingArea || null,
      proposal_link: proposalLink || null,
      materials: materials || null,
      explanation: explanation || null,
      reaction: reaction || null,
      reaction_detail: reactionDetail || null,
      fit_memo: fitMemo || null,
      value_change: valueChange || null,
      next_hint: nextHint || null,
    };

    try {
      if (journalId) {
        const { error: updateError } = await supabase
          .from("journal")
          .update(formData)
          .eq("id", journalId);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from("journal")
          .insert(formData);
        if (insertError) throw insertError;
      }

      // Update customer's last_contact
      await supabase
        .from("customers")
        .update({ last_contact: date })
        .eq("id", selectedCustomerId);

      router.push(`/customers/${selectedCustomerId}`);
    } catch {
      setError("保存に失敗しました。もう一度お試しください。");
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="px-4 py-4">
      <div className="flex items-center mb-4">
        <button
          onClick={() => router.back()}
          className="mr-3 p-1 text-gray-600 hover:text-navy transition"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-lg font-bold text-gray-900">
          {journalId ? "対応記録を編集" : "対応記録を追加"}
        </h2>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Required Section */}
        <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
          <h3 className="text-sm font-bold text-gray-700 mb-3">基本情報</h3>

          {/* Customer selector */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-600 mb-1">
              顧客 <span className="text-red-500">*</span>
            </label>
            {customerId || journalId ? (
              <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-700">
                {customerName || selectedCustomerId}
              </div>
            ) : (
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy focus:border-navy outline-none bg-white"
                required
              >
                <option value="">顧客を選択...</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Date */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-600 mb-1">
              日付 <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy focus:border-navy outline-none"
              required
            />
          </div>

          {/* Action type */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-600 mb-1">
              対応種別 <span className="text-red-500">*</span>
            </label>
            <select
              value={actionType}
              onChange={(e) => setActionType(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy focus:border-navy outline-none bg-white"
              required
            >
              {ACTION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          {/* Content */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              対応内容 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="対応内容を記入..."
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy focus:border-navy outline-none resize-none"
              required
            />
          </div>
        </div>

        {/* Property Section (collapsible) */}
        <div className="bg-white rounded-2xl shadow-sm mb-4 overflow-hidden">
          <button
            type="button"
            onClick={() => setPropertyOpen(!propertyOpen)}
            className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 transition"
          >
            <span className="text-sm font-bold text-journal-property">
              {propertyOpen ? "物件紹介の記録" : "+ 物件紹介の記録を追加"}
            </span>
            <svg
              className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${
                propertyOpen ? "rotate-180" : ""
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <div
            className="transition-all duration-300 ease-in-out overflow-hidden"
            style={{
              maxHeight: propertyOpen ? "2000px" : "0px",
              opacity: propertyOpen ? 1 : 0,
            }}
          >
            <div className="px-4 pb-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">物件名</label>
                <input
                  type="text"
                  value={propertyName}
                  onChange={(e) => setPropertyName(e.target.value)}
                  placeholder="物件名・概要"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy focus:border-navy outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">所在地</label>
                <input
                  type="text"
                  value={propertyAddress}
                  onChange={(e) => setPropertyAddress(e.target.value)}
                  placeholder="所在地"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy focus:border-navy outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">価格</label>
                <input
                  type="text"
                  value={propertyPrice}
                  onChange={(e) => setPropertyPrice(e.target.value)}
                  placeholder="価格（例：4,200万円）"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy focus:border-navy outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">土地面積</label>
                  <input
                    type="text"
                    value={propertyLandArea}
                    onChange={(e) => setPropertyLandArea(e.target.value)}
                    placeholder="土地面積（例：110㎡）"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy focus:border-navy outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">建物面積</label>
                  <input
                    type="text"
                    value={propertyBuildingArea}
                    onChange={(e) => setPropertyBuildingArea(e.target.value)}
                    placeholder="建物面積（例：95㎡）"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy focus:border-navy outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">提案ページURL</label>
                <input
                  type="url"
                  value={proposalLink}
                  onChange={(e) => setProposalLink(e.target.value)}
                  placeholder="提案ページURL"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy focus:border-navy outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">提示した資料</label>
                <input
                  type="text"
                  value={materials}
                  onChange={(e) => setMaterials(e.target.value)}
                  placeholder="提示した資料（チラシ、査定書など）"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy focus:border-navy outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">説明メモ</label>
                <textarea
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  placeholder="伝えた内容・説明メモ"
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy focus:border-navy outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">顧客の反応</label>
                <select
                  value={reaction}
                  onChange={(e) => setReaction(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy focus:border-navy outline-none bg-white"
                >
                  <option value="">選択してください</option>
                  {REACTION_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">反応の詳細</label>
                <textarea
                  value={reactionDetail}
                  onChange={(e) => setReactionDetail(e.target.value)}
                  placeholder="反応の詳細"
                  rows={2}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy focus:border-navy outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">合致度メモ</label>
                <input
                  type="text"
                  value={fitMemo}
                  onChange={(e) => setFitMemo(e.target.value)}
                  placeholder="合致度メモ（例：立地◎ 価格○ 広さ△）"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy focus:border-navy outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Value Section (collapsible) */}
        <div className="bg-white rounded-2xl shadow-sm mb-4 overflow-hidden">
          <button
            type="button"
            onClick={() => setValueOpen(!valueOpen)}
            className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 transition"
          >
            <span className="text-sm font-bold text-journal-value">
              {valueOpen ? "価値観・気づき" : "+ 価値観・気づきを追加"}
            </span>
            <svg
              className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${
                valueOpen ? "rotate-180" : ""
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <div
            className="transition-all duration-300 ease-in-out overflow-hidden"
            style={{
              maxHeight: valueOpen ? "600px" : "0px",
              opacity: valueOpen ? 1 : 0,
            }}
          >
            <div className="px-4 pb-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  新たにわかったこと・心情の変化
                </label>
                <textarea
                  value={valueChange}
                  onChange={(e) => setValueChange(e.target.value)}
                  placeholder="新たにわかったこと・心情の変化"
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy focus:border-navy outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  次に活かすこと
                </label>
                <textarea
                  value={nextHint}
                  onChange={(e) => setNextHint(e.target.value)}
                  placeholder="次に活かすこと"
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy focus:border-navy outline-none resize-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={saving}
          className="w-full py-3 bg-navy text-white font-bold rounded-lg hover:bg-navy-light active:bg-navy-dark transition disabled:opacity-50"
        >
          {saving ? "保存中..." : journalId ? "更新する" : "保存する"}
        </button>
      </form>
    </div>
  );
}
