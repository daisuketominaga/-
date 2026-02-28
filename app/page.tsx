"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary-cream">
      <div className="text-center">
        <div className="w-16 h-16 bg-primary-orange rounded-2xl flex items-center justify-center text-white font-display font-bold text-2xl mx-auto mb-4">
          1¥
        </div>
        <p className="text-text-medium">読み込み中...</p>
      </div>
    </div>
  );
}
