'use client';

import { useState, useEffect } from 'react';
import BottomNav from '@/components/BottomNav';

export default function Settings() {
  const [selectedAllergens, setSelectedAllergens] = useState<string[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    // ローカルストレージからアレルギー設定を読み込む
    const savedAllergens = localStorage.getItem('excludedAllergens');
    if (savedAllergens) {
      try {
        setSelectedAllergens(JSON.parse(savedAllergens));
      } catch (e) {
        console.error('Failed to parse saved allergens', e);
      }
    }
    setHasLoaded(true);
  }, []);

  useEffect(() => {
    if (hasLoaded) {
      localStorage.setItem('excludedAllergens', JSON.stringify(selectedAllergens));
    }
  }, [selectedAllergens, hasLoaded]);

  const allergenOptions = ['小麦', '卵', '乳'];

  const handleAllergenToggle = (allergen: string) => {
    setSelectedAllergens((prev) =>
      prev.includes(allergen)
        ? prev.filter((a) => a !== allergen)
        : [...prev, allergen]
    );
  };

  const handleClearFavorites = () => {
    if (confirm('お気に入りをすべて削除しますか？')) {
      localStorage.removeItem('favorites');
      alert('お気に入りを削除しました');
    }
  };

  return (
    <div className="min-h-screen pb-20 bg-background-light">
      <div className="max-w-md mx-auto px-4 py-6">
        {/* ヘッダー */}
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-primary-orange mb-2">
            設定
          </h1>
          <p className="text-gray-600 text-sm">
            アプリの設定を変更できます
          </p>
        </header>

        {/* アレルギー設定 */}
        <div className="bg-white rounded-2xl shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">
            アレルギー除外設定
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            除外したいアレルギー物質を選択してください。選択したアレルギーを含むレシピは検索結果から除外されます。
          </p>
          <div className="space-y-2">
            {allergenOptions.map((allergen) => {
              const isSelected = selectedAllergens.includes(allergen);
              return (
                <label
                  key={allergen}
                  className="flex items-center p-3 rounded-lg border-2 cursor-pointer transition-colors hover:bg-gray-50"
                  style={{
                    borderColor: isSelected ? '#FF9F1C' : '#e5e7eb',
                    backgroundColor: isSelected ? '#FFF8F0' : 'transparent',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleAllergenToggle(allergen)}
                    className="w-5 h-5 text-primary-orange rounded focus:ring-primary-orange"
                  />
                  <span className="ml-3 text-gray-700 font-medium">
                    {allergen}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        {/* データ管理 */}
        <div className="bg-white rounded-2xl shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">
            データ管理
          </h2>
          <button
            onClick={handleClearFavorites}
            className="w-full bg-red-500 text-white py-3 rounded-xl font-medium hover:bg-red-600 transition-colors"
          >
            お気に入りをすべて削除
          </button>
        </div>

        {/* アプリ情報 */}
        <div className="bg-white rounded-2xl shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">
            アプリについて
          </h2>
          <div className="space-y-2 text-sm text-gray-600">
            <p>
              <strong>EasyCook Kids</strong>
            </p>
            <p>バージョン: 1.0.0</p>
            <p className="mt-4">
              毎日の献立作りを簡単に。手持ちの食材から子供が喜ぶ料理を提案します。
            </p>
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}

