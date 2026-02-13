"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { isLoggedIn } from "@/utils/auth";
import { getArticleById, initializeWithSeedData } from "@/utils/storage";
import { SEED_ARTICLES } from "@/data/seedArticles";
import { Article } from "@/types";
import Header from "@/components/Header";
import CommentSection from "@/components/CommentSection";

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /youtu\.be\/([^?&]+)/,
    /youtube\.com\/watch\?v=([^&]+)/,
    /youtube\.com\/embed\/([^?&]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function formatFullDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

export default function ArticleDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [article, setArticle] = useState<Article | null>(null);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.push("/");
      return;
    }
    initializeWithSeedData(SEED_ARTICLES);
    const id = params.id as string;
    const found = getArticleById(id);
    if (found) {
      setArticle(found);
    }
  }, [router, params]);

  if (!article) {
    return (
      <div className="min-h-screen bg-brand-darker">
        <Header />
        <div className="flex items-center justify-center py-20">
          <p className="text-brand-muted">読み込み中...</p>
        </div>
      </div>
    );
  }

  const videoId = article.youtubeUrl
    ? extractYouTubeId(article.youtubeUrl)
    : null;

  return (
    <div className="min-h-screen bg-brand-darker">
      <Header />

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* 戻るボタン */}
        <button
          onClick={() => router.push("/dashboard")}
          className="text-brand-muted hover:text-white text-sm mb-4 transition-colors"
        >
          &larr; 一覧に戻る
        </button>

        {/* YouTube埋め込み */}
        {videoId && (
          <div className="aspect-video mb-6 rounded-xl overflow-hidden bg-black">
            <iframe
              src={`https://www.youtube.com/embed/${videoId}`}
              title={article.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full"
            />
          </div>
        )}

        {/* タイトル */}
        <h1 className="text-2xl font-bold mb-2">{article.title}</h1>
        <p className="text-brand-muted text-sm mb-4">{article.subtitle}</p>

        {/* メタ情報 */}
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-brand-border">
          <div className="w-10 h-10 bg-brand-accent rounded-full flex items-center justify-center text-sm font-bold">
            {article.author.charAt(0)}
          </div>
          <div>
            <p className="text-sm font-medium">{article.author}</p>
            <p className="text-xs text-brand-muted">
              {formatFullDate(article.createdAt)}
            </p>
          </div>
          <div className="ml-auto flex gap-2">
            {article.tags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 bg-brand-card border border-brand-border rounded text-xs text-brand-muted"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* 本文 */}
        <div className="bg-brand-card rounded-xl p-6 border border-brand-border mb-6">
          <div className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
            {article.content}
          </div>
        </div>

        {/* コメントセクション */}
        <CommentSection articleId={article.id} />
      </main>
    </div>
  );
}
