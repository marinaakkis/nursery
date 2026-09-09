"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, Button, EmptyState, ErrorState, Skeleton } from "@/ui";
import { formatPrice } from "../catalog/filters";
import styles from "./orders.module.css";
import { formatWhen, STATUS_TONE } from "./status";

type OrderSummary = {
  id: number;
  status: string;
  statusLabel: string;
  fulfillment: string;
  totalCents: number;
  createdAt: string;
  itemCount: number;
};

type Loadout = { key: string; orders: OrderSummary[] | null; forbidden: string | null };

export function OrdersScreen() {
  const [loadout, setLoadout] = useState<Loadout | null>(null);
  const [attempt, setAttempt] = useState(0);
  const requestKey = `orders#${attempt}`;

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/orders/list", { signal: controller.signal })
      .then((r) => r.json())
      .then((payload) => {
        setLoadout({
          key: requestKey,
          orders: payload.ok ? payload.data : null,
          // Сообщение берём у сервера: он различает «пользователь не выбран»
          // и «эта роль сюда не ходит», а экран снаружи их не отличит.
          forbidden:
            !payload.ok && payload.error?.code === "forbidden" ? payload.error.message : null,
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.error("список заказов: запрос не удался", error);
        setLoadout({ key: requestKey, orders: null, forbidden: null });
      });

    return () => controller.abort();
  }, [requestKey]);

  const settled = loadout?.key === requestKey ? loadout : null;

  if (settled === null) return <Skeleton variant="block" count={3} label="Загружаем заказы" />;

  if (settled.forbidden !== null) {
    return (
      <EmptyState
        title="Заказы недоступны"
        description={`${settled.forbidden}. Заказы видит только покупатель, и у каждого они свои.`}
        action={
          <Link href="/catalog">
            <Button variant="secondary">Пока в каталог</Button>
          </Link>
        }
      />
    );
  }

  if (settled.orders === null) {
    return (
      <ErrorState
        message="Список заказов не открывается. Попробуйте ещё раз."
        action={
          <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
            Повторить
          </Button>
        }
      />
    );
  }

  if (settled.orders.length === 0) {
    return (
      <EmptyState
        title="Заказов пока нет"
        description="Здесь появятся заказы со статусом и составом — как только оформите первый."
        action={
          <Link href="/catalog">
            <Button>В каталог</Button>
          </Link>
        }
      />
    );
  }

  return (
    <>
      <p className={styles.intro}>Свежие заказы сверху. Статус меняется по ходу сборки.</p>
      <div className={styles.list}>
        {settled.orders.map((order) => (
          <Link className={styles.row} href={`/orders/${order.id}`} key={order.id}>
            <span className={styles.rowHead}>
              <span className={styles.number}>Заказ №{order.id}</span>
              <Badge tone={STATUS_TONE[order.status] ?? "neutral"}>{order.statusLabel}</Badge>
            </span>
            <span className="muted">
              {formatWhen(order.createdAt)} ·{" "}
              {order.fulfillment === "pickup" ? "самовывоз" : "доставка"}
            </span>
            <span className={styles.rowFoot}>
              <span className="muted">{order.itemCount} шт.</span>
              <span className={styles.sum}>{formatPrice(order.totalCents)}</span>
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}
