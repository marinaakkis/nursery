"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, Button, EmptyState, ErrorState, InlineSuccess, Skeleton } from "@/ui";
import { formatPrice } from "../../catalog/filters";
import styles from "../warehouse.module.css";

type AssemblyOrder = {
  id: number;
  status: string;
  statusLabel: string;
  fulfillment: string;
  customerName: string;
  totalCents: number;
  slotDate: string | null;
  slotInterval: string | null;
  items: { plantName: string; quantity: number }[];
};

const TONE: Record<string, "neutral" | "progress" | "success"> = {
  new: "neutral",
  assembling: "progress",
  ready_for_pickup: "success",
  handed_to_delivery: "success",
};

/** Следующий шаг по матрице переходов: у самовывоза и доставки ветки разные. */
function nextSteps(order: AssemblyOrder): { next: string; label: string }[] {
  if (order.status === "new") return [{ next: "assembling", label: "Взять в сборку" }];
  if (order.status === "assembling") {
    return order.fulfillment === "pickup"
      ? [{ next: "ready_for_pickup", label: "Отметить собранным" }]
      : [{ next: "handed_to_delivery", label: "Передать в доставку" }];
  }
  if (order.status === "ready_for_pickup") return [{ next: "done", label: "Выдать покупателю" }];
  if (order.status === "handed_to_delivery") return [{ next: "done", label: "Отметить доставленным" }];
  return [];
}

export function AssemblyScreen() {
  const [orders, setOrders] = useState<AssemblyOrder[] | null>(null);
  const [denied, setDenied] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/orders/assembly", { signal: controller.signal })
      .then((r) => r.json())
      .then((payload) => {
        if (payload.ok) {
          setOrders(payload.data);
          setDenied(false);
          setFailed(false);
          return;
        }
        setOrders(null);
        setDenied(payload.error?.code === "forbidden");
        setFailed(payload.error?.code !== "forbidden");
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        console.error("склад: очередь не загрузилась", cause);
        setOrders(null);
        setFailed(true);
      });
    return () => controller.abort();
  }, [attempt]);

  async function move(orderId: number, next: string, label: string) {
    setBusy(orderId);
    setError("");
    setNotice("");
    try {
      const payload = await fetch("/api/orders/transition", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderId, next }),
      }).then((r) => r.json());

      if (!payload.ok) {
        setError(payload.error?.message ?? "Переход не прошёл");
        return;
      }
      setNotice(`Заказ №${orderId}: ${label.toLowerCase()}`);
      setAttempt((n) => n + 1);
    } catch (cause) {
      console.error("склад: переход не прошёл", cause);
      setError("Переход не прошёл. Попробуйте ещё раз.");
    } finally {
      setBusy(null);
    }
  }

  if (denied) {
    return (
      <EmptyState
        title="Очередь сборки"
        description="Переключите пользователя в шапке на Павла — заказы собирает склад."
        action={
          <Link href="/catalog">
            <Button variant="secondary">Пока в каталог</Button>
          </Link>
        }
      />
    );
  }

  if (failed) {
    return (
      <ErrorState
        message="Очередь не загрузилась. Попробуйте ещё раз — заказы на месте."
        action={
          <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
            Повторить
          </Button>
        }
      />
    );
  }

  if (orders === null) return <Skeleton variant="block" count={3} label="Загружаем очередь" />;

  if (orders.length === 0) {
    return (
      <EmptyState
        title="Собирать нечего"
        description="Все заказы выданы. Новый появится здесь сразу после оформления."
        action={<span className="muted">Очередь пуста</span>}
      />
    );
  }

  return (
    <>
      <p className={styles.intro}>
        Шаг определяется способом получения: у самовывоза ветка «готов к выдаче», у доставки —
        «передан в доставку». Другие переходы склад сделать не может.
      </p>

      {notice ? <InlineSuccess message={notice} /> : null}
      {error ? <ErrorState message={error} /> : null}

      {orders.map((order, index) => (
        <div className={styles.card} key={order.id}>
          <div className={styles.orderHead}>
            <strong>
              Заказ №{order.id} · {order.customerName}
            </strong>
            <Badge tone={TONE[order.status] ?? "neutral"}>{order.statusLabel}</Badge>
          </div>
          <p className="muted">
            {order.fulfillment === "pickup"
              ? "Самовывоз"
              : `Доставка${order.slotDate ? `, ${order.slotDate} ${order.slotInterval}` : ""}`}
            {" · "}
            {formatPrice(order.totalCents)}
          </p>
          <ul className={styles.orderItems}>
            {order.items.map((item) => (
              <li key={item.plantName}>
                {item.plantName} — {item.quantity} шт.
              </li>
            ))}
          </ul>
          <div className={styles.rowAction}>
            {nextSteps(order).map((step) => (
              <Button
                key={step.next}
                // Заливкой выделен только первый в очереди: пять primary-кнопок
                // на экране не показывают, с чего начинать.
                variant={index === 0 ? "primary" : "secondary"}
                loading={busy === order.id}
                onClick={() => move(order.id, step.next, step.label)}
              >
                {step.label}
              </Button>
            ))}
            <Link href={`/orders/${order.id}`}>
              <Button variant="ghost">Открыть заказ</Button>
            </Link>
          </div>
        </div>
      ))}
    </>
  );
}
