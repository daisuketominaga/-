"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase";
import {
  STATUS_MAP,
  STATUS_ORDER,
  CUSTOMER_TYPES,
  STAFF_LIST,
  SOURCE_LIST,
  PROPERTY_TYPES,
  LOAN_STATUSES,
  CURRENT_STATUSES,
  SALE_REASONS,
  MEDIATION_TYPES,
} from "@/utils/constants";
import { StatusKey } from "@/types";
import { useRouter } from "next/navigation";

export default function NewCustomerPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  // Customer fields
  const [name, setName] = useState("");
  const [type, setType] = useState<string>("買主");
  const [status, setStatus] = useState<string>("E");
  const [staff, setStaff] = useState<string>("トミー");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [lineId, setLineId] = useState("");
  const [source, setSource] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [urgency, setUrgency] = useState("");
  const [nextActionDate, setNextActionDate] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [memo, setMemo] = useState("");

  // Buyer detail fields
  const [area, setArea] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [budget, setBudget] = useState("");
  const [loanStatus, setLoanStatus] = useState("");
  const [moveDate, setMoveDate] = useState("");
  const [conditions, setConditions] = useState("");

  // Seller detail fields
  const [address, setAddress] = useState("");
  const [landUse, setLandUse] = useState("");
  const [landArea, setLandArea] = useState("");
  const [buildingArea, setBuildingArea] = useState("");
  const [currentStatus, setCurrentStatus] = useState("");
  const [saleReason, setSaleReason] = useState("");
  const [assessedPrice, setAssessedPrice] = useState("");
  const [askingPrice, setAskingPrice] = useState("");
  const [mediationType, setMediationType] = useState("");
  const [mediationExpiry, setMediationExpiry] = useState("");
  const [reins, setReins] = useState("");

  const isBuyer = type === "買主" || type === "売買両方";
  const isSeller = type === "売主" || type === "売買両方";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);

    try {
      const supabase = createClient();

      const { data: customerData, error: customerError } = await supabase
        .from("customers")
        .insert({
          name: name.trim(),
          type,
          status,
          staff,
          phone: phone || null,
          email: email || null,
          line_id: lineId || null,
          source: source || null,
          source_name: sourceName || null,
          urgency: urgency || null,
          next_action_date: nextActionDate || null,
          next_action: nextAction || null,
          memo: memo || null,
        })
        .select("id")
        .single();

      if (customerError) throw customerError;
      const newId = customerData.id;

      if (isBuyer) {
        await supabase.from("buyer_details").insert({
          customer_id: newId,
          area: area || null,
          property_type: propertyType || null,
          budget: budget || null,
          loan_status: loanStatus || null,
          move_date: moveDate || null,
          conditions: conditions || null,
        });
      }

      if (isSeller) {
        await supabase.from("seller_details").insert({
          customer_id: newId,
          address: address || null,
          land_use: landUse || null,
          land_area: landArea || null,
          building_area: buildingArea || null,
          current_status: currentStatus || null,
          sale_reason: saleReason || null,
          assessed_price: assessedPrice || null,
          asking_price: askingPrice || null,
          mediation_type: mediationType || null,
          mediation_expiry: mediationExpiry || null,
          reins: reins || null,
        });
      }

      router.push(`/customers/${newId}`);
    } catch (err) {
      console.error("Error creating customer:", err);
      alert("登録に失敗しました。もう一度お試しください。");
      setSubmitting(false);
    }
  };

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

      <h2 className="text-xl font-bold text-gray-900 mb-4">新規顧客登録</h2>

      <form onSubmit={handleSubmit}>
        {/* Basic Info */}
        <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
          <h3 className="text-base font-bold text-gray-900 mb-3">基本情報</h3>

          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                氏名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full py-3 px-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy text-sm"
                placeholder="顧客名を入力"
              />
            </div>

            {/* Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                種別
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full py-3 px-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy text-sm bg-white"
              >
                {CUSTOMER_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ステータス
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full py-3 px-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy text-sm bg-white"
              >
                {STATUS_ORDER.map((key) => (
                  <option key={key} value={key}>
                    {key} - {STATUS_MAP[key].meaning}
                  </option>
                ))}
              </select>
            </div>

            {/* Staff */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                担当者
              </label>
              <select
                value={staff}
                onChange={(e) => setStaff(e.target.value)}
                className="w-full py-3 px-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy text-sm bg-white"
              >
                {STAFF_LIST.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                電話番号
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full py-3 px-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy text-sm"
                placeholder="090-1234-5678"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                メールアドレス
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full py-3 px-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy text-sm"
                placeholder="example@email.com"
              />
            </div>

            {/* LINE ID */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                LINE ID
              </label>
              <input
                type="text"
                value={lineId}
                onChange={(e) => setLineId(e.target.value)}
                className="w-full py-3 px-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy text-sm"
                placeholder="LINE ID"
              />
            </div>

            {/* Source */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                流入元
              </label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full py-3 px-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy text-sm bg-white"
              >
                <option value="">選択してください</option>
                {SOURCE_LIST.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {/* Source Name */}
            {source && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  紹介元名
                </label>
                <input
                  type="text"
                  value={sourceName}
                  onChange={(e) => setSourceName(e.target.value)}
                  className="w-full py-3 px-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy text-sm"
                  placeholder="紹介元の名前"
                />
              </div>
            )}

            {/* Urgency */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                緊急メモ
              </label>
              <textarea
                value={urgency}
                onChange={(e) => setUrgency(e.target.value)}
                rows={2}
                className="w-full py-3 px-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy text-sm resize-none"
                placeholder="緊急の連絡事項があれば入力"
              />
            </div>

            {/* Next Action Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                次回アクション日
              </label>
              <input
                type="date"
                value={nextActionDate}
                onChange={(e) => setNextActionDate(e.target.value)}
                className="w-full py-3 px-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy text-sm"
              />
            </div>

            {/* Next Action */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                次回アクション内容
              </label>
              <input
                type="text"
                value={nextAction}
                onChange={(e) => setNextAction(e.target.value)}
                className="w-full py-3 px-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy text-sm"
                placeholder="次回のアクション内容"
              />
            </div>

            {/* Memo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                メモ
              </label>
              <textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                rows={3}
                className="w-full py-3 px-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy text-sm resize-none"
                placeholder="自由メモ"
              />
            </div>
          </div>
        </div>

        {/* Buyer Details */}
        {isBuyer && (
          <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
            <h3 className="text-base font-bold text-gray-900 mb-3">
              買主情報
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  希望エリア
                </label>
                <input
                  type="text"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  className="w-full py-3 px-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy text-sm"
                  placeholder="例: 福岡市中央区"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  物件種別
                </label>
                <select
                  value={propertyType}
                  onChange={(e) => setPropertyType(e.target.value)}
                  className="w-full py-3 px-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy text-sm bg-white"
                >
                  <option value="">選択してください</option>
                  {PROPERTY_TYPES.map((pt) => (
                    <option key={pt} value={pt}>
                      {pt}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  予算
                </label>
                <input
                  type="text"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  className="w-full py-3 px-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy text-sm"
                  placeholder="例: 3000万円"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ローン状況
                </label>
                <select
                  value={loanStatus}
                  onChange={(e) => setLoanStatus(e.target.value)}
                  className="w-full py-3 px-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy text-sm bg-white"
                >
                  <option value="">選択してください</option>
                  {LOAN_STATUSES.map((ls) => (
                    <option key={ls} value={ls}>
                      {ls}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  引越し時期
                </label>
                <input
                  type="text"
                  value={moveDate}
                  onChange={(e) => setMoveDate(e.target.value)}
                  className="w-full py-3 px-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy text-sm"
                  placeholder="例: 2025年4月頃"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  条件
                </label>
                <textarea
                  value={conditions}
                  onChange={(e) => setConditions(e.target.value)}
                  rows={3}
                  className="w-full py-3 px-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy text-sm resize-none"
                  placeholder="希望条件を入力"
                />
              </div>
            </div>
          </div>
        )}

        {/* Seller Details */}
        {isSeller && (
          <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
            <h3 className="text-base font-bold text-gray-900 mb-3">
              売主情報
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  所在地
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full py-3 px-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy text-sm"
                  placeholder="物件の所在地"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  用途地域
                </label>
                <input
                  type="text"
                  value={landUse}
                  onChange={(e) => setLandUse(e.target.value)}
                  className="w-full py-3 px-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy text-sm"
                  placeholder="例: 第一種住居地域"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  土地面積
                </label>
                <input
                  type="text"
                  value={landArea}
                  onChange={(e) => setLandArea(e.target.value)}
                  className="w-full py-3 px-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy text-sm"
                  placeholder="例: 150m²"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  建物面積
                </label>
                <input
                  type="text"
                  value={buildingArea}
                  onChange={(e) => setBuildingArea(e.target.value)}
                  className="w-full py-3 px-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy text-sm"
                  placeholder="例: 100m²"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  現況
                </label>
                <select
                  value={currentStatus}
                  onChange={(e) => setCurrentStatus(e.target.value)}
                  className="w-full py-3 px-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy text-sm bg-white"
                >
                  <option value="">選択してください</option>
                  {CURRENT_STATUSES.map((cs) => (
                    <option key={cs} value={cs}>
                      {cs}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  売却理由
                </label>
                <select
                  value={saleReason}
                  onChange={(e) => setSaleReason(e.target.value)}
                  className="w-full py-3 px-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy text-sm bg-white"
                >
                  <option value="">選択してください</option>
                  {SALE_REASONS.map((sr) => (
                    <option key={sr} value={sr}>
                      {sr}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  査定価格
                </label>
                <input
                  type="text"
                  value={assessedPrice}
                  onChange={(e) => setAssessedPrice(e.target.value)}
                  className="w-full py-3 px-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy text-sm"
                  placeholder="例: 2500万円"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  売出価格
                </label>
                <input
                  type="text"
                  value={askingPrice}
                  onChange={(e) => setAskingPrice(e.target.value)}
                  className="w-full py-3 px-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy text-sm"
                  placeholder="例: 2800万円"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  媒介種別
                </label>
                <select
                  value={mediationType}
                  onChange={(e) => setMediationType(e.target.value)}
                  className="w-full py-3 px-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy text-sm bg-white"
                >
                  <option value="">選択してください</option>
                  {MEDIATION_TYPES.map((mt) => (
                    <option key={mt} value={mt}>
                      {mt}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  媒介期限
                </label>
                <input
                  type="date"
                  value={mediationExpiry}
                  onChange={(e) => setMediationExpiry(e.target.value)}
                  className="w-full py-3 px-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  レインズ
                </label>
                <input
                  type="text"
                  value={reins}
                  onChange={(e) => setReins(e.target.value)}
                  className="w-full py-3 px-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy text-sm"
                  placeholder="レインズ登録番号"
                />
              </div>
            </div>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting || !name.trim()}
          className="w-full bg-navy text-white py-3 rounded-lg font-bold text-base disabled:opacity-50 mb-8"
        >
          {submitting ? "登録中..." : "顧客を登録する"}
        </button>
      </form>
    </div>
  );
}
