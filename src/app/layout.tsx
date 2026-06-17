import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";
import { JpUIProvider } from "@/components/JpUIProvider";
import { JapanificationProvider } from "@/hooks/useJapanification";
import { DebugDrawer } from "@/components/DebugDrawer";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "YomuMogu — Разговорная практика японского с ИИ",
  description: "Учите японские слова из встроенной колоды и практикуйте их в диалоге с ИИ-тьютором. Опционально — синхронизация с Anki.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className={`${nunito.variable}`}>
        <JapanificationProvider>
          <JpUIProvider>
            {children}
            <DebugDrawer />
          </JpUIProvider>
        </JapanificationProvider>
      </body>
    </html>
  );
}
