"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import StaffNav from "@/components/StaffNav";

export default function NewInterviewPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: "",
    age: "",
    spouseName: "",
    spouseAge: "",
    childrenCount: 0,
    children: [] as { name: string; age: string }[],
    purchasePurpose: "初めての購入",
    budgetMin: "",
    budgetMax: "",
    preferredArea: "",
    isPairMode: false,
  });
  const [sessionCreated, setSessionCreated] = useState(false);
  const [sessionId] = useState(() => `s-${Date.now()}`);

  const handleChildrenCountChange = (count: number) => {
    const children = Array.from({ length: count }, (_, i) => ({
      name: formData.children[i]?.name || "",
      age: formData.children[i]?.age || "",
    }));
    setFormData({ ...formData, childrenCount: count, children });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSessionCreated(true);
  };

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const staffUrl = `${baseUrl}/s/${sessionId}/staff`;
  const clientUrl = `${baseUrl}/s/${sessionId}/client`;

  if (sessionCreated) {
    return (
      <div className="min-h-screen bg-secondary-cream">
        <StaffNav />
        <main className="max-w-lg mx-auto px-4 py-8">
          <div className="card text-center mb-6">
            <div className="text-5xl mb-4">🎉</div>
            <h2 className="text-xl font-bold text-text-dark mb-2">
              面談セッションを作成しました
            </h2>
            <p className="text-text-medium text-sm mb-1">
              {formData.name} 様
            </p>
            {formData.isPairMode && (
              <span className="inline-block bg-accent-teal/10 text-accent-teal text-xs font-medium px-3 py-1 rounded-full">
                夫婦ペアモード
              </span>
            )}
          </div>

          {/* QRコード */}
          <div className="card mb-6">
            <h3 className="font-bold text-text-dark mb-3 text-center">
              お客さん用QRコード
            </h3>
            <div className="bg-white rounded-2xl p-6 flex flex-col items-center border-2 border-dashed border-gray-200">
              <div className="w-48 h-48 bg-gray-100 rounded-xl flex items-center justify-center mb-3">
                <div className="text-center">
                  <div className="text-4xl mb-2">📱</div>
                  <p className="text-xs text-text-light">QRコード</p>
                  <p className="text-[10px] text-text-light mt-1 break-all px-2">
                    {clientUrl}
                  </p>
                </div>
              </div>
              <p className="text-xs text-text-light text-center">
                iPadでこのQRコードを読み取ってください
              </p>
            </div>
          </div>

          {/* リンク */}
          <div className="space-y-3 mb-6">
            <div className="card-soft">
              <p className="label-text">スタッフ用URL</p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={staffUrl}
                  className="input-field text-xs flex-1"
                />
                <button
                  onClick={() => navigator.clipboard.writeText(staffUrl)}
                  className="btn-secondary text-xs px-3 py-2"
                >
                  コピー
                </button>
              </div>
            </div>
            <div className="card-soft">
              <p className="label-text">お客さん用URL</p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={clientUrl}
                  className="input-field text-xs flex-1"
                />
                <button
                  onClick={() => navigator.clipboard.writeText(clientUrl)}
                  className="btn-secondary text-xs px-3 py-2"
                >
                  コピー
                </button>
              </div>
            </div>
          </div>

          {/* アクションボタン */}
          <div className="space-y-3">
            <button
              onClick={() => router.push(`/s/${sessionId}/staff`)}
              className="btn-primary w-full text-center"
            >
              面談を開始する
            </button>
            <button
              onClick={() => router.push("/dashboard")}
              className="btn-secondary w-full text-center"
            >
              ダッシュボードに戻る
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary-cream">
      <StaffNav />
      <main className="max-w-lg mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-text-dark mb-1">
            新規面談セットアップ
          </h1>
          <p className="text-text-light text-sm">
            お客さんの基本情報を入力してください
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 基本情報 */}
          <div className="card">
            <h2 className="font-bold text-text-dark mb-4">基本情報</h2>
            <div className="space-y-3">
              <div>
                <label className="label-text">お名前 *</label>
                <input
                  type="text"
                  required
                  className="input-field"
                  placeholder="田中 太郎"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="label-text">年齢</label>
                <input
                  type="number"
                  className="input-field"
                  placeholder="35"
                  value={formData.age}
                  onChange={(e) =>
                    setFormData({ ...formData, age: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="label-text">購入目的</label>
                <select
                  className="input-field"
                  value={formData.purchasePurpose}
                  onChange={(e) =>
                    setFormData({ ...formData, purchasePurpose: e.target.value })
                  }
                >
                  <option>初めての購入</option>
                  <option>住み替え</option>
                  <option>投資</option>
                  <option>相続関連</option>
                </select>
              </div>
            </div>
          </div>

          {/* 家族構成 */}
          <div className="card">
            <h2 className="font-bold text-text-dark mb-4">家族構成</h2>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-text">配偶者名</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="田中 花子"
                    value={formData.spouseName}
                    onChange={(e) =>
                      setFormData({ ...formData, spouseName: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="label-text">配偶者年齢</label>
                  <input
                    type="number"
                    className="input-field"
                    placeholder="33"
                    value={formData.spouseAge}
                    onChange={(e) =>
                      setFormData({ ...formData, spouseAge: e.target.value })
                    }
                  />
                </div>
              </div>

              <div>
                <label className="label-text">お子さんの人数</label>
                <div className="flex gap-2">
                  {[0, 1, 2, 3, 4].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => handleChildrenCountChange(n)}
                      className={`w-10 h-10 rounded-xl font-medium transition-all ${
                        formData.childrenCount === n
                          ? "bg-primary-orange text-white"
                          : "bg-gray-100 text-text-medium hover:bg-gray-200"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {formData.children.map((child, i) => (
                <div key={i} className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label-text">
                      お子さん{i + 1}の名前
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="名前"
                      value={child.name}
                      onChange={(e) => {
                        const children = [...formData.children];
                        children[i] = { ...children[i], name: e.target.value };
                        setFormData({ ...formData, children });
                      }}
                    />
                  </div>
                  <div>
                    <label className="label-text">年齢</label>
                    <input
                      type="number"
                      className="input-field"
                      placeholder="5"
                      value={child.age}
                      onChange={(e) => {
                        const children = [...formData.children];
                        children[i] = { ...children[i], age: e.target.value };
                        setFormData({ ...formData, children });
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 希望条件 */}
          <div className="card">
            <h2 className="font-bold text-text-dark mb-4">希望条件（任意）</h2>
            <div className="space-y-3">
              <div>
                <label className="label-text">希望エリア</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="東京都世田谷区"
                  value={formData.preferredArea}
                  onChange={(e) =>
                    setFormData({ ...formData, preferredArea: e.target.value })
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-text">予算（下限・万円）</label>
                  <input
                    type="number"
                    className="input-field"
                    placeholder="3500"
                    value={formData.budgetMin}
                    onChange={(e) =>
                      setFormData({ ...formData, budgetMin: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="label-text">予算（上限・万円）</label>
                  <input
                    type="number"
                    className="input-field"
                    placeholder="5000"
                    value={formData.budgetMax}
                    onChange={(e) =>
                      setFormData({ ...formData, budgetMax: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ペアモード */}
          <div className="card">
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                className={`w-12 h-7 rounded-full transition-all relative ${
                  formData.isPairMode ? "bg-accent-teal" : "bg-gray-200"
                }`}
                onClick={() =>
                  setFormData({ ...formData, isPairMode: !formData.isPairMode })
                }
              >
                <div
                  className={`w-5 h-5 bg-white rounded-full shadow absolute top-1 transition-all ${
                    formData.isPairMode ? "left-6" : "left-1"
                  }`}
                />
              </div>
              <div>
                <span className="font-medium text-text-dark">
                  夫婦ペアモード
                </span>
                <p className="text-xs text-text-light">
                  お二人それぞれにワークに回答いただけます
                </p>
              </div>
            </label>
          </div>

          <button
            type="submit"
            className="btn-primary w-full text-lg py-4"
            disabled={!formData.name}
          >
            セッションを作成する
          </button>
        </form>
      </main>
    </div>
  );
}
