// ユーザー
export interface User {
  id: string;
  name: string;
  agreedToCharter: boolean;
  agreedAt: string; // ISO date
  isAdmin: boolean;
}

// 記事
export interface Article {
  id: string;
  title: string;
  subtitle: string;
  content: string;
  category: string;
  youtubeUrl?: string;
  thumbnailUrl: string;
  author: string;
  createdAt: string; // ISO date
  tags: string[];
}

// コメント
export interface Comment {
  id: string;
  articleId: string;
  authorName: string;
  content: string;
  createdAt: string; // ISO date
}
