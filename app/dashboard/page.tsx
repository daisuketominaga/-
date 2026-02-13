"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { isLoggedIn } from "@/utils/auth";
import { getArticles, initializeWithSeedData } from "@/utils/storage";
import { SEED_ARTICLES } from "@/data/seedArticles";
import { Article } from "@/types";
import Header from "@/components/Header";
import ArticleCard from "@/components/ArticleCard";
import CategoryFilter from "@/components/CategoryFilter";

export default function DashboardPage() {
  const router = useRouter();
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("すべて");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!isLoggedIn()) {
      router.push("/");
      return;
    }
    initializeWithSeedData(SEED_ARTICLES);
    setArticles(getArticles());
  }, [router]);

  const filteredArticles = useMemo(() => {
    let result = articles;

    if (selectedCategory !== "すべて") {
      result = result.filter((a) => a.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.subtitle.toLowerCase().includes(q) ||
          a.content.toLowerCase().includes(q) ||
          a.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    return result;
  }, [articles, selectedCategory, searchQuery]);

  return (
    <div className="min-h-screen bg-brand-darker">
      <Header />

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* 検索 */}
        <div className="mb-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="講義を検索..."
            className="w-full max-w-md px-4 py-2.5 bg-brand-card border border-brand-border rounded-full text-white placeholder-brand-muted text-sm focus:outline-none focus:border-brand-accent transition-colors"
          />
        </div>

        {/* カテゴリフィルター */}
        <div className="mb-6">
          <CategoryFilter
            selected={selectedCategory}
            onSelect={setSelectedCategory}
          />
        </div>

        {/* 記事グリッド（YouTube風） */}
        {filteredArticles.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-brand-muted text-lg mb-2">
              記事が見つかりません
            </p>
            <p className="text-brand-muted text-sm">
              別のカテゴリやキーワードで検索してみてください
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredArticles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
