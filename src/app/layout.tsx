import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "YomuMogu - Разговорная практика японского с Anki",
  description: "Практикуйте свои слова из Anki с помощью искусственного интеллекта Gemini",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className={`${nunito.variable}`}>
        {children}
      </body>
    </html>
  );
}
