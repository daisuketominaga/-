"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase";
import { useRouter } from "next/navigation";
import { ExportData } from "@/types";

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [userEmail, setUserEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const loadUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.email) {
        setUserEmail(user.email);
      }
      setLoading(false);
    };
    loadUser();
  }, []);

  const handleExport = async () => {
    setExporting(true);
    setMessage(null);

    try {
      const { data: customers } = await supabase.from("customers").select("*");
      const { data: buyer_details } = await supabase.from("buyer_details").select("*");
      const { data: seller_details } = await supabase.from("seller_details").select("*");
      const { data: journal } = await supabase.from("journal").select("*");

      const exportData: ExportData = {
        customers: customers || [],
        buyer_details: buyer_details || [],
        seller_details: seller_details || [],
        journal: journal || [],
        exported_at: new Date().toISOString(),
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ichien-crm-backup-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);

      setMessage({ type: "success", text: "エクスポートが完了しました" });
    } catch {
      setMessage({ type: "error", text: "エクスポートに失敗しました" });
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset file input so the same file can be selected again
    e.target.value = "";

    setMessage(null);

    try {
      const text = await file.text();
      const importData: ExportData = JSON.parse(text);

      // Validate structure
      if (
        !importData.customers ||
        !importData.buyer_details ||
        !importData.seller_details ||
        !importData.journal
      ) {
        setMessage({
          type: "error",
          text: "無効なファイル形式です。正しいバックアップファイルを選択してください。",
        });
        return;
      }

      const confirmed = window.confirm(
        "既存のデータをすべて上書きしますか？この操作は元に戻せません。"
      );
      if (!confirmed) return;

      setImporting(true);

      // Delete in order (foreign key constraints)
      await supabase.from("journal").delete().neq("id", 0);
      await supabase.from("buyer_details").delete().neq("customer_id", "");
      await supabase.from("seller_details").delete().neq("customer_id", "");
      await supabase.from("customers").delete().neq("id", "");

      // Insert in order
      if (importData.customers.length) {
        const { error } = await supabase.from("customers").insert(importData.customers);
        if (error) throw error;
      }
      if (importData.buyer_details.length) {
        const { error } = await supabase.from("buyer_details").insert(importData.buyer_details);
        if (error) throw error;
      }
      if (importData.seller_details.length) {
        const { error } = await supabase.from("seller_details").insert(importData.seller_details);
        if (error) throw error;
      }
      if (importData.journal.length) {
        const { error } = await supabase.from("journal").insert(importData.journal);
        if (error) throw error;
      }

      setMessage({ type: "success", text: "インポートが完了しました" });
    } catch {
      setMessage({
        type: "error",
        text: "インポートに失敗しました。ファイルの形式を確認してください。",
      });
    } finally {
      setImporting(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
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
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
        <h2 className="text-lg font-bold text-gray-900">設定</h2>
      </div>

      {message && (
        <div
          className={`mb-4 p-3 rounded-lg text-sm ${
            message.type === "success"
              ? "bg-green-50 border border-green-200 text-green-700"
              : "bg-red-50 border border-red-200 text-red-600"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* User Info */}
      <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
        <h3 className="text-sm font-bold text-gray-700 mb-3">アカウント情報</h3>
        <div className="flex items-center">
          <div className="w-10 h-10 bg-navy rounded-full flex items-center justify-center mr-3">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
          </div>
          <div>
            <p className="text-sm text-gray-500">メールアドレス</p>
            <p className="text-sm font-medium text-gray-900">{userEmail}</p>
          </div>
        </div>
      </div>

      {/* JSON Export */}
      <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
        <h3 className="text-sm font-bold text-gray-700 mb-2">データエクスポート</h3>
        <p className="text-xs text-gray-500 mb-3">
          全てのデータをJSON形式でダウンロードします。バックアップとしてご利用ください。
        </p>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="w-full py-3 bg-navy text-white font-bold rounded-lg hover:bg-navy-light active:bg-navy-dark transition disabled:opacity-50"
        >
          {exporting ? "エクスポート中..." : "データをエクスポート"}
        </button>
      </div>

      {/* JSON Import */}
      <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
        <h3 className="text-sm font-bold text-gray-700 mb-2">データインポート</h3>
        <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-xs text-amber-700">
            既存データを上書きします。事前にエクスポートすることをお勧めします。
          </p>
        </div>
        <label
          className={`block w-full py-3 text-center font-bold rounded-lg border-2 border-navy text-navy transition cursor-pointer ${
            importing
              ? "opacity-50 cursor-not-allowed"
              : "hover:bg-navy hover:text-white active:bg-navy-dark active:text-white"
          }`}
        >
          {importing ? "インポート中..." : "データをインポート"}
          <input
            type="file"
            accept=".json"
            onChange={handleImport}
            disabled={importing}
            className="hidden"
          />
        </label>
      </div>

      {/* Logout */}
      <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
        <button
          onClick={handleLogout}
          className="w-full py-3 bg-red-500 text-white font-bold rounded-lg hover:bg-red-600 active:bg-red-700 transition"
        >
          ログアウト
        </button>
      </div>
    </div>
  );
}
