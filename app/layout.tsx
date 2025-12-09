import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EasyCook Kids - 子供が喜ぶレシピ検索",
  description: "手持ちの食材から子供が喜ぶ料理を提案するWebアプリ",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}

