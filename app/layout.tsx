import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ライフデザイン面談 | イチエン不動産",
  description:
    "物件を探す前に、人生を探す。あなたの価値観を一緒に見つける面談体験。",
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
      <body className="antialiased min-h-screen">{children}</body>
    </html>
  );
}
