"use client";

import { useRouter } from "next/navigation";
import { Article } from "@/types";

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

function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    "才能・成長": "bg-blue-600",
    "人間関係": "bg-purple-600",
    "利他・愛": "bg-pink-600",
    "キャリア・AI": "bg-green-600",
    "人間の魅力": "bg-orange-600",
    "思考法": "bg-yellow-600",
  };
  return colors[category] || "bg-gray-600";
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "今日";
  if (diffDays === 1) return "昨日";
  if (diffDays < 7) return `${diffDays}日前`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}週間前`;
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

export default function ArticleCard({ article }: { article: Article }) {
  const router = useRouter();
  const videoId = article.youtubeUrl
    ? extractYouTubeId(article.youtubeUrl)
    : null;

  const thumbnailUrl = videoId
    ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
    : null;

  return (
    <div
      className="article-card group"
      onClick={() => router.push(`/articles/${article.id}`)}
    >
      {/* サムネイル */}
      <div className="relative aspect-video bg-brand-dark overflow-hidden">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={article.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-brand-accent/20 to-brand-dark">
            <div className="text-center px-4">
              <div className="text-4xl mb-2 opacity-60">
                {article.category === "思考法" ? "💭" : "📝"}
              </div>
              <p className="text-xs text-brand-muted line-clamp-2">
                {article.subtitle}
              </p>
            </div>
          </div>
        )}
        {/* カテゴリバッジ */}
        <div className="absolute top-2 left-2">
          <span
            className={`${getCategoryColor(article.category)} px-2 py-0.5 text-xs rounded text-white`}
          >
            {article.category}
          </span>
        </div>
      </div>

      {/* テキスト */}
      <div className="p-3">
        <h3 className="font-bold text-sm line-clamp-2 mb-1">
          {article.title}
        </h3>
        <p className="text-xs text-brand-muted mb-2 line-clamp-2">
          {article.subtitle}
        </p>
        <div className="flex items-center gap-2 text-xs text-brand-muted">
          <span>{article.author}</span>
          <span>-</span>
          <span>{formatDate(article.createdAt)}</span>
        </div>
      </div>
    </div>
  );
}
