import type { Metadata } from "next";

import { AppNav } from "@/src/components/app-nav";
import { AppStateProvider } from "@/src/components/app-state-provider";

import "./globals.css";

export const metadata: Metadata = {
  title: "로또 피커",
  description: "데이터 기반 확률 생성 모델",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="min-h-dvh bg-[var(--app-bg)] text-slate-900 antialiased">
        <AppStateProvider>
          <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-4 py-5 sm:px-6">
            <header className="relative z-20 pb-5">
              <AppNav />
            </header>
            <main className="flex-1 pb-8">{children}</main>
          </div>
        </AppStateProvider>
      </body>
    </html>
  );
}
