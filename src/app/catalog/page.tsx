import { Suspense } from "react";
import { Skeleton } from "@/ui";
import { CatalogScreen } from "./catalog-screen";

export const metadata = { title: "Каталог" };

export default function CatalogPage() {
  return (
    <main className="page">
      <h1>Каталог</h1>
      {/* useSearchParams требует границы Suspense: до неё показываем ту же форму,
          что и сам экран во время запроса. */}
      <Suspense fallback={<Skeleton variant="card" count={4} label="Загружаем каталог" />}>
        <CatalogScreen />
      </Suspense>
    </main>
  );
}
