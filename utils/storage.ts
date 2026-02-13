import { User, Article, Comment } from "@/types";

const KEYS = {
  USER: "zenra_user",
  ARTICLES: "zenra_articles",
  COMMENTS: "zenra_comments",
} as const;

// === ユーザー ===
export function getUser(): User | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(KEYS.USER);
  return raw ? JSON.parse(raw) : null;
}

export function saveUser(user: User): void {
  localStorage.setItem(KEYS.USER, JSON.stringify(user));
}

export function clearUser(): void {
  localStorage.removeItem(KEYS.USER);
}

// === 記事 ===
export function getArticles(): Article[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(KEYS.ARTICLES);
  return raw ? JSON.parse(raw) : [];
}

export function saveArticles(articles: Article[]): void {
  localStorage.setItem(KEYS.ARTICLES, JSON.stringify(articles));
}

export function addArticle(article: Article): void {
  const articles = getArticles();
  articles.unshift(article);
  saveArticles(articles);
}

export function getArticleById(id: string): Article | undefined {
  return getArticles().find((a) => a.id === id);
}

// === コメント ===
export function getComments(): Comment[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(KEYS.COMMENTS);
  return raw ? JSON.parse(raw) : [];
}

export function saveComments(comments: Comment[]): void {
  localStorage.setItem(KEYS.COMMENTS, JSON.stringify(comments));
}

export function getCommentsByArticle(articleId: string): Comment[] {
  return getComments().filter((c) => c.articleId === articleId);
}

export function addComment(comment: Comment): void {
  const comments = getComments();
  comments.push(comment);
  saveComments(comments);
}

// === 初期化 ===
export function isInitialized(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(KEYS.ARTICLES) !== null;
}

export function initializeWithSeedData(seedArticles: Article[]): void {
  if (!isInitialized()) {
    saveArticles(seedArticles);
    saveComments([]);
  }
}
