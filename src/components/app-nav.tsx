"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "생성" },
  { href: "/history", label: "기록" },
  { href: "/qr", label: "QR 확인" },
];

export const AppNav = () => {
  const pathname = usePathname();

  return (
    <nav className="relative z-20 grid grid-cols-3 gap-2 rounded-[24px] bg-white/72 p-1.5 shadow-sm ring-1 ring-white/85 backdrop-blur">
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`relative z-10 rounded-[18px] px-4 py-3 text-center text-sm font-semibold transition ${
            pathname === item.href
              ? "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200 shadow-sm"
              : "text-slate-600 hover:bg-white/80 hover:text-slate-900"
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
};
