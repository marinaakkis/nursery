import type { ReactNode } from "react";
import "@/ui/tokens.css";
import { fontClassNames } from "./fonts";
import { Footer } from "./footer";
import { Header } from "./header";

export const metadata = {
  title: { default: "Северный сад", template: "%s — Северный сад" },
  description:
    "Питомник в Ленинградской области: саженцы и рассада для зоны 3–4, календарь ухода и помощник по подбору",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru" className={fontClassNames}>
      <body>
        <Header />
        {children}
        <Footer />
      </body>
    </html>
  );
}
