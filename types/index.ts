// 食材の価格マスター（市場平均価格）
export interface IngredientPrice {
  id: string;
  name: string; // 例: "玉ねぎ"
  unitPrice: number; // 例: 50 (1個または単位あたりの円)
}

// レシピ内で使用する食材
export interface IngredientUsage {
  ingredientId: string;
  name: string;
  amountText: string; // 例: "1/2個"
}

// レシピ本体
export interface Recipe {
  id: string;
  title: string;
  description: string;
  imageUrl: string; // Unsplashなどのプレースホルダー画像を使用
  cookTimeMinutes: number; // 調理時間（分）
  tags: string[]; // 例: "主菜", "子供に人気"
  allergens: string[]; // 例: "小麦", "卵", "乳"
  ingredients: IngredientUsage[];
  steps: string[];
  // totalCost（合計費用）は、ingredients と unitPrice を掛け合わせて動的に計算する
}

