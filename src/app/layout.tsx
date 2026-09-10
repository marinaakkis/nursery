import type { ReactNode } from "react";
import "@/ui/tokens.css";
import { fontClassNames } from "./fonts";
import { Footer } from "./footer";
import { currentUser } from "@/lib/demo-user.server";
import { Header } from "./header";

/**
 * Все страницы рендерятся на запрос, а не на сборке. Данные в продукте живые:
 * каталог, остатки, корзина и заказы меняются каждую минуту, и пререндер отдал бы
 * снимок состояния на момент сборки образа.
 *
 * Практическая причина важнее: шапка ходит в базу за списком демо-пользователей,
 * а в контейнере сборки базы нет — пререндер «/» валил сборку целиком.
 * Разбор — memory/mistakes/2026-09-10-sborka-tolko-s-bazoy.md
 */
export const dynamic = "force-dynamic";

export const metadata = {
  title: { default: "Северный сад", template: "%s — Северный сад" },
  description:
    "Питомник в Ленинградской области: саженцы и рассада для зоны 3–4, календарь ухода и помощник по подбору",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  /*
   * Плотный режим включается ролью пользователя, а не маршрутом: раньше
   * data-ui стоял на пяти <main> и не охватывал ни шапку, ни подвал —
   * кладовщик видел витринный подвал с адресом самовывоза и часами работы.
   */
  const user = await currentUser().catch(() => null);
  const service = user?.role === "agronomist" || user?.role === "warehouse";

  return (
    <html lang="ru" className={fontClassNames}>
      <body data-ui={service ? "service" : undefined}>
        <Header />
        {children}
        <Footer />
      </body>
    </html>
  );
}
