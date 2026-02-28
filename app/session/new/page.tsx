"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { createCustomer, createSession } from "@/lib/store";

export default function NewSessionPage() {
  const router = useRouter();
  const [step, setStep] = useState<"info" | "ready">("info");
  const [sessionId, setSessionId] = useState("");
  const [clientUrl, setClientUrl] = useState("");

  // フォーム状態
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [spouseName, setSpouseName] = useState("");
  const [spouseAge, setSpouseAge] = useState("");
  const [children, setChildren] = useState<{ name: string; age: string }[]>([]);
  const [purpose, setPurpose] = useState("");
  const [area, setArea] = useState("");

  const addChild = () => {
    setChildren([...children, { name: "", age: "" }]);
  };

  const updateChild = (
    index: number,
    field: "name" | "age",
    value: string
  ) => {
    const updated = [...children];
    updated[index][field] = value;
    setChildren(updated);
  };

  const removeChild = (index: number) => {
    setChildren(children.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const customer = createCustomer({
      name: name.trim(),
      age: age ? parseInt(age) : null,
      family: {
        ...(spouseName
          ? { spouse: { name: spouseName, age: parseInt(spouseAge) || 0 } }
          : {}),
        ...(children.length > 0
          ? {
              children: children
                .filter((c) => c.name)
                .map((c) => ({
                  name: c.name,
                  age: parseInt(c.age) || 0,
                })),
            }
          : {}),
      },
      purchase_purpose: purpose,
      budget_min: null,
      budget_max: null,
      preferred_area: area,
      status: "事前準備",
    });

    const session = createSession(customer.id);
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    const fullClientUrl = `${appUrl}/s/${session.id}/client`;

    setSessionId(session.id);
    setClientUrl(fullClientUrl);
    setStep("ready");
  };

  const startSession = () => {
    router.push(`/s/${sessionId}/staff`);
  };

  if (step === "ready") {
    return (
      <div className="min-h-screen bg-background-warm">
        <header className="bg-white border-b border-gray-100">
          <div className="max-w-lg mx-auto px-4 py-4">
            <h1 className="text-lg font-bold text-brand-navy">
              面談の準備完了
            </h1>
          </div>
        </header>

        <div className="max-w-lg mx-auto px-4 py-8">
          <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
            <h2 className="text-xl font-bold text-brand-navy mb-2">
              QRコードをお客様のiPadで読み取ってください
            </h2>
            <p className="text-text-muted text-sm mb-8">
              お客様がこのQRコードを読み取ると、価値観ワークの画面が表示されます
            </p>

            <div className="bg-white p-6 rounded-xl inline-block border-2 border-gray-100 mb-6">
              <QRCodeSVG value={clientUrl} size={220} level="M" />
            </div>

            <p className="text-xs text-text-muted mb-8 break-all">
              {clientUrl}
            </p>

            <button
              onClick={startSession}
              className="w-full bg-brand-navy text-white py-4 rounded-xl text-lg font-medium hover:bg-brand-navy-light transition-colors shadow-md"
            >
              面談を開始する
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-warm">
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => router.push("/dashboard")}
            className="text-text-muted hover:text-text-primary"
          >
            <svg
              className="w-6 h-6"
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
          </button>
          <h1 className="text-lg font-bold text-brand-navy">
            新規面談セットアップ
          </h1>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 基本情報 */}
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <h2 className="text-base font-bold text-brand-navy mb-4">
              お客様の基本情報
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-text-secondary mb-1">
                  お名前 <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="山田 太郎"
                  required
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-brand-navy focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1">
                  年齢
                </label>
                <input
                  type="number"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="35"
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-brand-navy focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1">
                  購入目的
                </label>
                <select
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-brand-navy focus:outline-none bg-white"
                >
                  <option value="">選択してください</option>
                  <option value="初めての購入">初めての購入</option>
                  <option value="住み替え">住み替え</option>
                  <option value="投資">投資</option>
                  <option value="相続関連">相続関連</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1">
                  希望エリア
                </label>
                <input
                  type="text"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  placeholder="横浜市、川崎市など"
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-brand-navy focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* 家族情報 */}
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <h2 className="text-base font-bold text-brand-navy mb-4">
              ご家族（任意）
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-text-secondary mb-1">
                    配偶者のお名前
                  </label>
                  <input
                    type="text"
                    value={spouseName}
                    onChange={(e) => setSpouseName(e.target.value)}
                    placeholder="花子"
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-brand-navy focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1">
                    年齢
                  </label>
                  <input
                    type="number"
                    value={spouseAge}
                    onChange={(e) => setSpouseAge(e.target.value)}
                    placeholder="33"
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-brand-navy focus:outline-none"
                  />
                </div>
              </div>

              {children.map((child, i) => (
                <div key={i} className="flex items-end gap-2">
                  <div className="flex-1">
                    <label className="block text-sm text-text-secondary mb-1">
                      お子様{i + 1}のお名前
                    </label>
                    <input
                      type="text"
                      value={child.name}
                      onChange={(e) => updateChild(i, "name", e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-brand-navy focus:outline-none"
                    />
                  </div>
                  <div className="w-20">
                    <label className="block text-sm text-text-secondary mb-1">
                      年齢
                    </label>
                    <input
                      type="number"
                      value={child.age}
                      onChange={(e) => updateChild(i, "age", e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-brand-navy focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeChild(i)}
                    className="pb-3 text-red-400 hover:text-red-600"
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
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              ))}

              <button
                type="button"
                onClick={addChild}
                className="text-brand-navy text-sm font-medium hover:text-brand-navy-light"
              >
                + お子様を追加
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-brand-navy text-white py-4 rounded-xl text-lg font-medium hover:bg-brand-navy-light transition-colors shadow-md"
          >
            面談を準備する
          </button>
        </form>
      </div>
    </div>
  );
}
