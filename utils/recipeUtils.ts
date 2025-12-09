import { Recipe, IngredientPrice, IngredientUsage } from '@/types';

// 食材価格マスターから価格を取得
export function getIngredientPrice(
  ingredientId: string,
  prices: IngredientPrice[]
): number {
  const price = prices.find((p) => p.id === ingredientId);
  return price?.unitPrice || 0;
}

// 数量テキストから数値を抽出（簡易版）
// 例: "1/2個" -> 0.5, "2個" -> 2, "200g" -> 1 (単位として扱う)
export function parseAmount(amountText: string): number {
  // "1/2" のような分数を処理
  const fractionMatch = amountText.match(/(\d+)\/(\d+)/);
  if (fractionMatch) {
    const numerator = parseFloat(fractionMatch[1]);
    const denominator = parseFloat(fractionMatch[2]);
    return numerator / denominator;
  }
  
  // "2個" のような整数を処理
  const numberMatch = amountText.match(/(\d+)/);
  if (numberMatch) {
    return parseFloat(numberMatch[1]);
  }
  
  // デフォルトは1として扱う
  return 1;
}

// レシピの合計費用を計算
export function calculateRecipeCost(
  recipe: Recipe,
  prices: IngredientPrice[]
): number {
  let totalCost = 0;
  
  recipe.ingredients.forEach((ingredient) => {
    const unitPrice = getIngredientPrice(ingredient.ingredientId, prices);
    const amount = parseAmount(ingredient.amountText);
    totalCost += unitPrice * amount;
  });
  
  return Math.round(totalCost);
}

// 食材名でレシピを検索
export function searchRecipesByIngredients(
  recipes: Recipe[],
  searchQuery: string
): Recipe[] {
  if (!searchQuery.trim()) {
    return recipes;
  }
  
  const searchTerms = searchQuery
    .split(',')
    .map((term) => term.trim().toLowerCase())
    .filter((term) => term.length > 0);
  
  return recipes.filter((recipe) => {
    const ingredientNames = recipe.ingredients.map((ing) =>
      ing.name.toLowerCase()
    );
    
    return searchTerms.some((term) =>
      ingredientNames.some((name) => name.includes(term))
    );
  });
}

// アレルギーでフィルタリング
export function filterByAllergens(
  recipes: Recipe[],
  excludedAllergens: string[]
): Recipe[] {
  if (excludedAllergens.length === 0) {
    return recipes;
  }
  
  return recipes.filter((recipe) => {
    return !recipe.allergens.some((allergen) =>
      excludedAllergens.includes(allergen)
    );
  });
}

// 調理時間でフィルタリング
export function filterByCookTime(
  recipes: Recipe[],
  maxMinutes: number | null
): Recipe[] {
  if (maxMinutes === null) {
    return recipes;
  }
  
  return recipes.filter((recipe) => recipe.cookTimeMinutes <= maxMinutes);
}

