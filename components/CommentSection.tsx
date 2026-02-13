"use client";

import { useState } from "react";
import { Comment } from "@/types";
import { addComment, getCommentsByArticle } from "@/utils/storage";
import { getCurrentUser } from "@/utils/auth";

function formatCommentDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function CommentSection({ articleId }: { articleId: string }) {
  const [comments, setComments] = useState<Comment[]>(() =>
    getCommentsByArticle(articleId)
  );
  const [text, setText] = useState("");
  const user = getCurrentUser();

  const handleSubmit = () => {
    if (!text.trim() || !user) return;

    const comment: Comment = {
      id: Date.now().toString(),
      articleId,
      authorName: user.name,
      content: text.trim(),
      createdAt: new Date().toISOString(),
    };
    addComment(comment);
    setComments(getCommentsByArticle(articleId));
    setText("");
  };

  return (
    <div className="mt-8">
      <h3 className="text-lg font-bold mb-4">
        コメント ({comments.length})
      </h3>

      {/* 入力欄 */}
      <div className="mb-6">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-brand-accent flex items-center justify-center text-xs font-bold flex-shrink-0">
            {user?.name?.charAt(0) || "?"}
          </div>
          <div className="flex-1">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="コメントを追加... （否定禁止、上乗せ推奨！）"
              className="w-full bg-transparent border-b border-brand-border text-white placeholder-brand-muted text-sm py-2 resize-none focus:outline-none focus:border-brand-accent transition-colors"
              rows={2}
            />
            <div className="flex justify-end mt-2 gap-2">
              {text.trim() && (
                <button
                  onClick={() => setText("")}
                  className="px-3 py-1.5 text-sm text-brand-muted hover:text-white transition-colors rounded-full"
                >
                  キャンセル
                </button>
              )}
              <button
                onClick={handleSubmit}
                disabled={!text.trim()}
                className="px-4 py-1.5 bg-brand-accent text-white text-sm rounded-full disabled:opacity-30 disabled:cursor-not-allowed hover:bg-red-600 transition-colors"
              >
                コメント
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* コメント一覧 */}
      <div className="space-y-4">
        {comments.length === 0 ? (
          <p className="text-brand-muted text-sm text-center py-8">
            まだコメントはありません。最初のコメントを残してみよう！
          </p>
        ) : (
          comments.map((c) => (
            <div key={c.id} className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-brand-card flex items-center justify-center text-xs font-bold flex-shrink-0 border border-brand-border">
                {c.authorName.charAt(0)}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium">{c.authorName}</span>
                  <span className="text-xs text-brand-muted">
                    {formatCommentDate(c.createdAt)}
                  </span>
                </div>
                <p className="text-sm text-gray-300 whitespace-pre-wrap">
                  {c.content}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
