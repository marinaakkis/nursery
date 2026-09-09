import type { ReactNode } from "react";
import "@/ui/tokens.css";
import { Header } from "./header";

export const metadata = {
  title: "Питомник растений",
  description: "Каталог саженцев, заказы и календарь ухода",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <Header />
        {children}
      </body>
    </html>
  );
}
