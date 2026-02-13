"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { isLoggedIn, isAdmin } from "@/utils/auth";
import { addArticle } from "@/utils/storage";
import { Article } from "@/types";
import Header from "@/components/Header";

const CATEGORIES = [
  "才能・成長",
  "人間関係",
  "利他・愛",
  "キャリア・AI",
  "人間の魅力",
  "思考法",
];

export default function AdminPostPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [tags, setTags] = useState("");

  useEffect(() => {
    if (!isLoggedIn()) {
      router.push("/");
      return;
    }
    if (!isAdmin()) {
      router.push("/dashboard");
    }
  }, [router]);

  const handleSubmit = () => {
    if (!title.trim() || !content.trim()) return;

    const article: Article = {
      id: `article-${Date.now()}`,
      title: title.trim(),
      subtitle: subtitle.trim(),
      content: content.trim(),
      category,
      youtubeUrl: youtubeUrl.trim() || undefined,
      thumbnailUrl: "",
      author: "富永大介",
      createdAt: new Date().toISOString(),
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    };

    addArticle(article);
    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen bg-brand-darker">
      <Header />

      <main className="max-w-2xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-6">新しい講義を投稿</h1>

        <div className="space-y-4">
          {/* タイトル */}
          <div>
            <label className="block text-sm text-brand-muted mb-1">
              タイトル
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder='例: 第8回講義「〇〇」について'
              className="w-full px-4 py-3 bg-brand-card border border-brand-border rounded-lg text-white placeholder-brand-muted focus:outline-none focus:border-brand-accent transition-colors"
            />
          </div>

          {/* サブタイトル */}
          <div>
            <label className="block text-sm text-brand-muted mb-1">
              サブタイトル（一言まとめ）
            </label>
            <input
              type="text"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="例: 才能の開花 ＝ ぶつかった回数の掛け算"
              className="w-full px-4 py-3 bg-brand-card border border-brand-border rounded-lg text-white placeholder-brand-muted focus:outline-none focus:border-brand-accent transition-colors"
            />
          </div>

          {/* カテゴリ */}
          <div>
            <label className="block text-sm text-brand-muted mb-1">
              カテゴリ
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-3 bg-brand-card border border-brand-border rounded-lg text-white focus:outline-none focus:border-brand-accent transition-colors"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* YouTube URL */}
          <div>
            <label className="block text-sm text-brand-muted mb-1">
              参考動画URL（任意）
            </label>
            <input
              type="text"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="https://youtu.be/..."
              className="w-full px-4 py-3 bg-brand-card border border-brand-border rounded-lg text-white placeholder-brand-muted focus:outline-none focus:border-brand-accent transition-colors"
            />
          </div>

          {/* タグ */}
          <div>
            <label className="block text-sm text-brand-muted mb-1">
              タグ（カンマ区切り）
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="例: 才能, 成長, 行動"
              className="w-full px-4 py-3 bg-brand-card border border-brand-border rounded-lg text-white placeholder-brand-muted focus:outline-none focus:border-brand-accent transition-colors"
            />
          </div>

          {/* 本文 */}
          <div>
            <label className="block text-sm text-brand-muted mb-1">
              本文（全裸で書いてください）
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="ここに本音をぶちまけてください..."
              rows={15}
              className="w-full px-4 py-3 bg-brand-card border border-brand-border rounded-lg text-white placeholder-brand-muted focus:outline-none focus:border-brand-accent transition-colors resize-y"
            />
          </div>

          {/* 投稿ボタン */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={() => router.push("/dashboard")}
              className="flex-1 py-3 border border-brand-border text-brand-muted rounded-lg hover:text-white hover:border-white transition-colors"
            >
              キャンセル
            </button>
            <button
              onClick={handleSubmit}
              disabled={!title.trim() || !content.trim()}
              className="flex-1 py-3 bg-brand-accent text-white font-bold rounded-lg hover:bg-red-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              投稿する
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
