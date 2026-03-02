"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase";

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace("/dashboard");
      } else {
        router.replace("/login");
      }
    });
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-navy">
      <div className="text-white text-center">
        <div className="text-2xl font-bold mb-2">イチエン不動産</div>
        <div className="text-sm opacity-70">読み込み中...</div>
      </div>
    </div>
  );
}
