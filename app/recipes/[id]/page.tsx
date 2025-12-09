'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { Recipe, IngredientPrice } from '@/types';
import BottomNav from '@/components/BottomNav';
import { calculateRecipeCost } from '@/utils/recipeUtils';

export default function RecipeDetail() {
  const params = useParams();
  const router = useRouter();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
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
        const foundRecipe = recipesData.find(
          (r: Recipe) => r.id === params.id
        );
        if (foundRecipe) {
          setRecipe(foundRecipe);
        }
        setPrices(pricesData);
        setLoading(false);
      })
      .catch((error) => {
        console.error('Failed to load data', error);
        setLoading(false);
      });
  }, [params.id]);

  const toggleFavorite = () => {
    if (!recipe) return;

    const newFavorites = favorites.includes(recipe.id)
      ? favorites.filter((id) => id !== recipe.id)
      : [...favorites, recipe.id];

    setFavorites(newFavorites);
    localStorage.setItem('favorites', JSON.stringify(newFavorites));
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

  if (!recipe) {
    return (
      <div className="min-h-screen flex items-center justify-center pb-20">
        <div className="text-center">
          <div className="text-6xl mb-4">😕</div>
          <p className="text-gray-600 mb-4">レシピが見つかりませんでした</p>
          <button
            onClick={() => router.push('/')}
            className="bg-primary-orange text-white px-6 py-3 rounded-xl font-medium"
          >
            ホームに戻る
          </button>
        </div>
        <BottomNav />
      </div>
    );
  }

  const totalCost = calculateRecipeCost(recipe, prices);
  const isFavorite = favorites.includes(recipe.id);

  return (
    <div className="min-h-screen pb-20 bg-background-light">
      <div className="max-w-md mx-auto bg-white">
        {/* 画像 */}
        <div className="relative w-full h-64">
          <Image
            src={recipe.imageUrl}
            alt={recipe.title}
            fill
            className="object-cover"
            sizes="100vw"
          />
          <button
            onClick={() => router.push('/')}
            className="absolute top-4 left-4 bg-white/90 p-2 rounded-full shadow-lg"
            aria-label="戻る"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <button
            onClick={toggleFavorite}
            className="absolute top-4 right-4 bg-white/90 p-2 rounded-full shadow-lg"
            aria-label="お気に入り"
          >
            <span className="text-2xl">{isFavorite ? '❤️' : '🤍'}</span>
          </button>
        </div>

        {/* コンテンツ */}
        <div className="p-6">
          {/* タイトルと基本情報 */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              {recipe.title}
            </h1>
            <p className="text-gray-600 mb-4">{recipe.description}</p>
            
            <div className="flex flex-wrap gap-3 mb-4">
              <div className="bg-primary-orange/10 text-primary-orange px-4 py-2 rounded-full font-semibold">
                {totalCost}円
              </div>
              <div className="bg-primary-green/10 text-primary-green px-4 py-2 rounded-full font-semibold">
                {recipe.cookTimeMinutes}分
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              {recipe.tags.map((tag) => (
                <span
                  key={tag}
                  className="bg-primary-green/20 text-primary-green text-sm px-3 py-1 rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>

            {recipe.allergens.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm font-semibold text-red-700 mb-1">
                  アレルギー物質
                </p>
                <div className="flex flex-wrap gap-2">
                  {recipe.allergens.map((allergen) => (
                    <span
                      key={allergen}
                      className="bg-red-200 text-red-800 text-xs px-2 py-1 rounded"
                    >
                      {allergen}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 材料 */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center">
              <span className="mr-2">🥘</span>
              材料
            </h2>
            <ul className="space-y-2">
              {recipe.ingredients.map((ingredient, index) => (
                <li
                  key={index}
                  className="flex items-center justify-between py-2 border-b border-gray-100"
                >
                  <span className="text-gray-700">{ingredient.name}</span>
                  <span className="font-semibold text-gray-800">
                    {ingredient.amountText}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* 作り方 */}
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center">
              <span className="mr-2">👨‍🍳</span>
              作り方
            </h2>
            <ol className="space-y-4">
              {recipe.steps.map((step, index) => (
                <li key={index} className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary-orange text-white rounded-full flex items-center justify-center font-bold">
                    {index + 1}
                  </div>
                  <p className="flex-1 text-gray-700 leading-relaxed pt-1">
                    {step}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}

