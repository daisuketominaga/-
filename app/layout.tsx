import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "全裸の部屋 - 富永大介と友達",
  description:
    "真面目な話を、不真面目なテンションで。思考の実験場。",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased bg-brand-darker text-white">{children}</body>
    </html>
  );
}
