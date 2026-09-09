import type { ReactNode } from "react";
import "@/ui/tokens.css";

export const metadata = {
  title: "Питомник растений",
  description: "Каталог саженцев, заказы и календарь ухода",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
