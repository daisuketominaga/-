'use client';

import { useState, useEffect, useMemo } from 'react';
import { Recipe, IngredientPrice } from '@/types';
import RecipeCard from '@/components/RecipeCard';
import SearchBar from '@/components/SearchBar';
import FilterChips from '@/components/FilterChips';
import BottomNav from '@/components/BottomNav';
import {
  searchRecipesByIngredients,
  filterByAllergens,
  filterByCookTime,
  calculateRecipeCost,
} from '@/utils/recipeUtils';

export default function Home() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [prices, setPrices] = useState<IngredientPrice[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAllergens, setSelectedAllergens] = useState<string[]>([]);
  const [selectedMaxTime, setSelectedMaxTime] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

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

    // データを読み込む
    Promise.all([
      fetch('/data/recipes.json').then((res) => res.json()),
      fetch('/data/ingredientPrices.json').then((res) => res.json()),
    ])
      .then(([recipesData, pricesData]) => {
        setRecipes(recipesData);
        setPrices(pricesData);
        setLoading(false);
      })
      .catch((error) => {
        console.error('Failed to load data', error);
        setLoading(false);
      });
  }, []);

  // アレルギー設定を保存
  useEffect(() => {
    localStorage.setItem('excludedAllergens', JSON.stringify(selectedAllergens));
  }, [selectedAllergens]);

  const filteredRecipes = useMemo(() => {
    let filtered = recipes;

    // 食材検索
    if (searchQuery.trim()) {
      filtered = searchRecipesByIngredients(filtered, searchQuery);
    }

    // アレルギーでフィルタリング
    filtered = filterByAllergens(filtered, selectedAllergens);

    // 調理時間でフィルタリング
    filtered = filterByCookTime(filtered, selectedMaxTime);

    return filtered;
  }, [recipes, searchQuery, selectedAllergens, selectedMaxTime]);

  const handleAllergenToggle = (allergen: string) => {
    setSelectedAllergens((prev) =>
      prev.includes(allergen)
        ? prev.filter((a) => a !== allergen)
        : [...prev, allergen]
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">🍳</div>
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 bg-background-light">
      <div className="max-w-md mx-auto px-4 py-6">
        {/* ヘッダー */}
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-primary-orange mb-2">
            EasyCook Kids
          </h1>
          <p className="text-gray-600 text-sm">
            食材を選んで、子供が喜ぶレシピを見つけよう！
          </p>
        </header>

        {/* 検索バー */}
        <div className="mb-6">
          <SearchBar onSearch={setSearchQuery} />
        </div>

        {/* フィルターチップ */}
        <div className="mb-6">
          <FilterChips
            selectedAllergens={selectedAllergens}
            onAllergenToggle={handleAllergenToggle}
            selectedMaxTime={selectedMaxTime}
            onTimeSelect={setSelectedMaxTime}
          />
        </div>

        {/* レシピ一覧 */}
        <div>
          {filteredRecipes.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🔍</div>
              <p className="text-gray-600 mb-2">レシピが見つかりませんでした</p>
              <p className="text-sm text-gray-500">
                別の食材や条件で検索してみてください
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-600 mb-4">
                {filteredRecipes.length}件のレシピが見つかりました
              </p>
              <div className="grid grid-cols-1 gap-4">
                {filteredRecipes.map((recipe) => (
                  <RecipeCard
                    key={recipe.id}
                    recipe={recipe}
                    totalCost={calculateRecipeCost(recipe, prices)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}

