"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, Button, Card, CardBody, EmptyState, ErrorState, PlantPhoto, Skeleton } from "@/ui";
import { formatPrice } from "./catalog/filters";
import styles from "./home.module.css";

type Plant = { id: number; nameRu: string; nameLat: string; photoUrl: string | null; priceCents: number };
type Stock = { plantId: number; available: number; low: boolean };
type Loadout = { key: string; plants: Plant[] | null; stock: Map<number, Stock> };

/** Шесть растений, которые прямо сейчас есть на складе. Своей выборки не делает:
 *  тот же catalog.search_plants и warehouse.get_stock_many, что и везде. */
export function InStock() {
  const [loadout, setLoadout] = useState<Loadout | null>(null);
  const [attempt, setAttempt] = useState(0);
  const requestKey = `home#${attempt}`;

  useEffect(() => {
    const controller = new AbortController();
    const options = { signal: controller.signal };

    fetch("/api/catalog/plants", options)
      .then((r) => r.json())
      .then(async (payload) => {
        if (!payload.ok) throw new Error("catalog failed");
        const items: Plant[] = payload.data.items;
        const ids = items.map((p) => p.id).join(",");
        const stocks = await fetch(`/api/warehouse/stocks?plantIds=${ids}`, options).then((r) =>
          r.json(),
        );
        const map = new Map<number, Stock>();
        if (stocks.ok) for (const row of stocks.data as Stock[]) map.set(row.plantId, row);
        setLoadout({ key: requestKey, plants: items, stock: map });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.error("главная: подборка не загрузилась", error);
        setLoadout({ key: requestKey, plants: null, stock: new Map() });
      });

    return () => controller.abort();
  }, [requestKey]);

  const settled = loadout?.key === requestKey ? loadout : null;

  if (settled === null) return <Skeleton variant="card" count={6} label="Загружаем подборку" />;

  if (settled.plants === null) {
    return (
      <ErrorState
        message="Не получилось показать, что есть в наличии. Каталог при этом работает."
        action={
          <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
            Повторить
          </Button>
        }
      />
    );
  }

  const available = settled.plants
    .filter((plant) => (settled.stock.get(plant.id)?.available ?? 0) > 0)
    .slice(0, 6);

  if (available.length === 0) {
    return (
      <EmptyState
        title="Всё разобрали"
        description="Новая партия приезжает каждую неделю. Загляните в каталог — там видно, что вернётся раньше."
        action={
          <Link href="/catalog">
            <Button variant="secondary">В каталог</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className={styles.grid}>
      {available.map((plant) => {
        const stock = settled.stock.get(plant.id);
        return (
          <Card key={plant.id} href={`/catalog/${plant.id}`}>
            <PlantPhoto
              photoUrl={plant.photoUrl}
              name={plant.nameRu}
              overlay={stock?.low ? <Badge tone="warning">Осталось {stock.available}</Badge> : null}
            />
            <CardBody>
              <span className={styles.name}>{plant.nameRu}</span>
              <span className={styles.price}>{formatPrice(plant.priceCents)}</span>
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}
