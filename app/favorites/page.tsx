'use client';

import { useState, useEffect, useMemo } from 'react';
import { Recipe, IngredientPrice } from '@/types';
import RecipeCard from '@/components/RecipeCard';
import BottomNav from '@/components/BottomNav';
import { calculateRecipeCost } from '@/utils/recipeUtils';

export default function Favorites() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [prices, setPrices] = useState<IngredientPrice[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // お気に入りを読み込む
    const savedFavorites = localStorage.getItem('favorites');
    if (savedFavorites) {
      try {
        setFavorites(JSON.parse(savedFavorites));
      } catch (e) {
        console.error('Failed to parse favorites', e);
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

  const favoriteRecipes = useMemo(() => {
    return recipes.filter((recipe) => favorites.includes(recipe.id));
  }, [recipes, favorites]);

  const handleRemoveFavorite = (recipeId: string) => {
    const newFavorites = favorites.filter((id) => id !== recipeId);
    setFavorites(newFavorites);
    localStorage.setItem('favorites', JSON.stringify(newFavorites));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center pb-20">
        <div className="text-center">
          <div className="text-4xl mb-4">🍳</div>
          <p className="text-gray-600">読み込み中...</p>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 bg-background-light">
      <div className="max-w-md mx-auto px-4 py-6">
        {/* ヘッダー */}
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-primary-orange mb-2">
            お気に入り
          </h1>
          <p className="text-gray-600 text-sm">
            {favoriteRecipes.length}件のレシピが保存されています
          </p>
        </header>

        {/* レシピ一覧 */}
        {favoriteRecipes.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">❤️</div>
            <p className="text-gray-600 mb-2">お気に入りのレシピがありません</p>
            <p className="text-sm text-gray-500">
              レシピ詳細ページで❤️をタップして保存しましょう
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {favoriteRecipes.map((recipe) => (
              <div key={recipe.id} className="relative">
                <RecipeCard
                  recipe={recipe}
                  totalCost={calculateRecipeCost(recipe, prices)}
                />
                <button
                  onClick={() => handleRemoveFavorite(recipe.id)}
                  className="absolute top-2 right-2 bg-white/90 p-2 rounded-full shadow-lg z-10"
                  aria-label="お気に入りから削除"
                >
                  <span className="text-xl">❌</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}

