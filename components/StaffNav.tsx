"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/dashboard", label: "ダッシュボード", icon: "📋" },
  { href: "/s/new", label: "新規面談", icon: "➕" },
];

export default function StaffNav() {
  const pathname = usePathname();

  return (
    <header className="bg-white/90 backdrop-blur-md border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-9 h-9 bg-primary-orange rounded-xl flex items-center justify-center text-white font-display font-bold text-sm">
            1¥
          </div>
          <div>
            <div className="font-display font-semibold text-text-dark text-sm leading-tight">
              イチエン不動産
            </div>
            <div className="text-[10px] text-text-light leading-tight">
              ライフデザイン面談
            </div>
          </div>
        </Link>
        <nav className="flex items-center gap-1">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? "bg-primary-orange/10 text-primary-orange"
                    : "text-text-medium hover:bg-gray-100"
                }`}
              >
                <span>{item.icon}</span>
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
