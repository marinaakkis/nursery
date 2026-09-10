"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, Button, EmptyState, ErrorState, Skeleton } from "@/ui";
import styles from "./warehouse.module.css";

type Batch = {
  id: number;
  plantId: number;
  plantName: string;
  receivedAt: string;
  quantity: number;
  remaining: number;
  supplier: string;
  writtenOff: number;
};

type Loadout = { key: string; batches: Batch[] | null; denied: boolean };

export function StockScreen() {
  const [loadout, setLoadout] = useState<Loadout | null>(null);
  const [attempt, setAttempt] = useState(0);
  const requestKey = `stock#${attempt}`;

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/warehouse/batches", { signal: controller.signal })
      .then((r) => r.json())
      .then((payload) => {
        setLoadout({
          key: requestKey,
          batches: payload.ok ? payload.data : null,
          denied: !payload.ok && payload.error?.code === "forbidden",
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.error("склад: остатки не загрузились", error);
        setLoadout({ key: requestKey, batches: null, denied: false });
      });
    return () => controller.abort();
  }, [requestKey]);

  const settled = loadout?.key === requestKey ? loadout : null;
  if (settled === null) return <Skeleton variant="block" count={4} label="Загружаем остатки" />;

  if (settled.denied) {
    return (
      <EmptyState
        title="Кабинет склада"
        description="Переключите пользователя в шапке на Павла — он ведёт остатки и сборку."
        action={
          <Link href="/catalog">
            <Button variant="secondary">Пока в каталог</Button>
          </Link>
        }
      />
    );
  }

  if (settled.batches === null) {
    return (
      <ErrorState
        message="Остатки не загрузились. Попробуйте ещё раз — партии на месте."
        action={
          <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
            Повторить
          </Button>
        }
      />
    );
  }

  if (settled.batches.length === 0) {
    return (
      <EmptyState
        title="Партий пока нет"
        description="Как только оформите первый приход, остатки появятся здесь."
        action={
          <Link href="/warehouse/batches">
            <Button>Оформить приход</Button>
          </Link>
        }
      />
    );
  }

  // Партии складываются по растению: карточка каталога показывает сумму,
  // а склад должен видеть и сумму, и из чего она состоит.
  const byPlant = new Map<number, { name: string; total: number; batches: Batch[] }>();
  for (const batch of settled.batches) {
    const entry = byPlant.get(batch.plantId) ?? { name: batch.plantName, total: 0, batches: [] };
    entry.total += batch.remaining;
    entry.batches.push(batch);
    byPlant.set(batch.plantId, entry);
  }

  return (
    <>
      <p className={styles.intro}>
        Остаток растения — сумма остатков его партий. Резерв под заказы уже вычтен.
      </p>
      <div className={styles.scroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Растение</th>
              <th className={styles.num}>Остаток</th>
              <th>Наличие</th>
              <th>Партии</th>
            </tr>
          </thead>
          <tbody>
            {[...byPlant.entries()].map(([plantId, entry]) => (
              <tr key={plantId}>
                <td>
                  <Link href={`/catalog/${plantId}`}>{entry.name}</Link>
                </td>
                <td className={styles.num}>{entry.total}</td>
                <td>
                  {entry.total === 0 ? (
                    <Badge tone="danger">нет</Badge>
                  ) : entry.total <= 3 ? (
                    <Badge tone="warning">мало</Badge>
                  ) : (
                    <Badge tone="success">есть</Badge>
                  )}
                </td>
                <td>
                  {entry.batches
                    .map((batch) => `${batch.receivedAt}: ${batch.remaining} из ${batch.quantity}`)
                    .join(" · ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={styles.intro}>
        Всего партий: {settled.batches.length}. Списано за всё время:{" "}
        {settled.batches.reduce((sum, batch) => sum + batch.writtenOff, 0)} шт.
      </p>
    </>
  );
}
