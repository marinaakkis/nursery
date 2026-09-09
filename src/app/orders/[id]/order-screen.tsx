"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, Button, EmptyState, ErrorState, Sheet, Skeleton } from "@/ui";
import { formatPrice } from "../../catalog/filters";
import styles from "../orders.module.css";
import { formatSlot, formatWhen, STATUS_TONE, whatNext } from "../status";

type OrderView = {
  id: number;
  status: string;
  statusLabel: string;
  fulfillment: string;
  slot: { slotDate: string; interval: string } | null;
  totalCents: number;
  createdAt: string;
  items: { plantId: number; nameRu: string; quantity: number; priceCents: number }[];
  history: { toStatus: string; label: string; actorRole: string; at: string }[];
  nextStatuses: string[];
};

type Loadout = { key: string; order: OrderView | null; missing: boolean; forbidden: boolean };

export function OrderScreen({ orderId }: { orderId: string }) {
  const [loadout, setLoadout] = useState<Loadout | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const requestKey = `${orderId}#${attempt}`;

  useEffect(() => {
    const controller = new AbortController();

    fetch(`/api/orders/order?orderId=${orderId}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((payload) => {
        if (payload.ok) {
          setLoadout({ key: requestKey, order: payload.data, missing: false, forbidden: false });
          return;
        }
        setLoadout({
          key: requestKey,
          order: null,
          missing: payload.error?.code === "not_found",
          forbidden: payload.error?.code === "forbidden",
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.error("заказ: запрос не удался", error);
        setLoadout({ key: requestKey, order: null, missing: false, forbidden: false });
      });

    return () => controller.abort();
  }, [orderId, requestKey]);

  const settled = loadout?.key === requestKey ? loadout : null;

  if (settled === null) return <Skeleton variant="block" count={3} label="Загружаем заказ" />;

  if (settled.missing || settled.forbidden) {
    return (
      <EmptyState
        title={settled.forbidden ? "Заказ недоступен" : "Заказ не найден"}
        description={
          settled.forbidden
            ? "Этот заказ оформлен другим покупателем. Переключите пользователя в шапке или откройте свой список."
            : "Возможно, в ссылке опечатка — заказа с таким номером нет."
        }
        action={
          <Link href="/orders">
            <Button variant="secondary">Мои заказы</Button>
          </Link>
        }
      />
    );
  }

  if (settled.order === null) {
    return (
      <ErrorState
        message="Заказ не открывается. Попробуйте ещё раз — он никуда не делся."
        action={
          <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
            Повторить
          </Button>
        }
      />
    );
  }

  const order = settled.order;
  const slotText = formatSlot(order.slot);
  const canCancel = order.nextStatuses.includes("cancelled");
  // Каждый переход статуса пишет уведомление; создание заказа — нет.
  const notified = Math.max(order.history.length - 1, 0);

  async function cancel() {
    setCancelling(true);
    setCancelError("");
    try {
      const response = await fetch("/api/orders/transition", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderId: order.id, next: "cancelled" }),
      });
      const payload = await response.json();
      if (!payload.ok) {
        setCancelError(payload.error?.message ?? "Не удалось отменить заказ");
        setCancelling(false);
        return;
      }
      setConfirmOpen(false);
      setCancelling(false);
      setAttempt((n) => n + 1);
    } catch (error) {
      console.error("отмена заказа не прошла", error);
      setCancelError("Питомник не отвечает. Попробуйте ещё раз.");
      setCancelling(false);
    }
  }

  return (
    <>
      <div className={styles.head}>
        <Badge tone={STATUS_TONE[order.status] ?? "neutral"}>{order.statusLabel}</Badge>
        <span className="muted">от {formatWhen(order.createdAt)}</span>
      </div>

      <section className={styles.section}>
        <p className={styles.next}>{whatNext(order.status, order.fulfillment, slotText)}</p>
      </section>

      <section className={styles.section}>
        <h2>Получение</h2>
        <p>
          {order.fulfillment === "pickup"
            ? "Самовывоз из питомника"
            : `Доставка — ${slotText ?? "слот не выбран"}`}
        </p>
      </section>

      <section className={styles.section}>
        <h2>Состав</h2>
        <div className={styles.items}>
          {order.items.map((item) => (
            <span className={styles.item} key={item.plantId}>
              <span>
                {item.nameRu} · {item.quantity} шт.
              </span>
              <span>{formatPrice(item.priceCents * item.quantity)}</span>
            </span>
          ))}
          <span className={styles.total}>
            <span>Итого</span>
            <span>{formatPrice(order.totalCents)}</span>
          </span>
        </div>
        <p className={styles.stub}>
          Тестовый платёж — деньги не списывались.
        </p>
      </section>

      <section className={styles.section}>
        <h2>История</h2>
        <ul className={styles.history}>
          {order.history.map((step, index) => (
            <li key={`${step.at}-${index}`}>
              <span>{step.label}</span>
              <span className={styles.when}>{formatWhen(step.at)}</span>
            </li>
          ))}
        </ul>
        <p className={styles.stub}>
          <span className={styles.dot} aria-hidden="true" />
          <span>
            Уведомлений по заказу: {notified}. Это заглушка — запись остаётся внутри
            продукта, почта и push не подключены.
          </span>
        </p>
      </section>

      {cancelError ? <ErrorState message={cancelError} /> : null}

      {canCancel ? (
        <section className={styles.section}>
          <Button variant="secondary" onClick={() => setConfirmOpen(true)}>
            Отменить заказ
          </Button>
        </section>
      ) : (
        <p className="muted">
          {order.status === "cancelled"
            ? "Заказ уже отменён."
            : order.status === "done"
              ? "Заказ завершён — отменить его нельзя."
              : "Отменить этот заказ уже нельзя."}
        </p>
      )}

      <Sheet open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Отменить заказ?">
        <div className={styles.confirm}>
          <p>
            Растения вернутся в остаток питомника, а заказ получит статус «отменён».
            Вернуть его обратно будет нельзя — придётся оформить новый.
          </p>
          <Button variant="secondary" loading={cancelling} onClick={cancel}>
            Да, отменить заказ
          </Button>
          <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
            Оставить заказ
          </Button>
        </div>
      </Sheet>
    </>
  );
}
