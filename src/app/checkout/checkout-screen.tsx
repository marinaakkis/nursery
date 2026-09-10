"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActionBar, Button, EmptyState, ErrorState, Field, PlantPhoto, Skeleton } from "@/ui";
import { formatPrice } from "../catalog/filters";
import styles from "./checkout.module.css";

type CartLine = { plantId: number; nameRu: string; photoUrl: string | null; quantity: number; sumCents: number };
type Cart = { lines: CartLine[]; totalCents: number };
type Slot = {
  id: number;
  slotDate: string;
  interval: string;
  capacity: number;
  taken: number;
  isFull: boolean;
};

type Loadout = { key: string; cart: Cart | null; slots: Slot[]; forbidden: string | null };
type ShortItem = { plantId: number; requested: number; available: number };

const dayFormat = new Intl.DateTimeFormat("ru-RU", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

function formatDay(iso: string): string {
  // Дата без времени: часовой пояс единый, покупатель выбирает «день», не момент.
  const [year, month, day] = iso.split("-").map(Number);
  return dayFormat.format(new Date(year, month - 1, day));
}

export function CheckoutScreen() {
  const router = useRouter();
  const [loadout, setLoadout] = useState<Loadout | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [method, setMethod] = useState<"pickup" | "delivery">("pickup");
  const [slotId, setSlotId] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<{ message: string; short: ShortItem[] } | null>(null);
  const requestKey = `checkout#${attempt}`;

  /** Один ключ на попытку оформления: двойное нажатие «Подтвердить» отдаёт
   *  тот же заказ, а не создаёт второй. Живёт в ref и заполняется в обработчике:
   *  Date.now() и Math.random() в рендере запрещены, а useMemo не хранилище —
   *  он вправе пересчитать и выдать другой ключ. */
  const idempotencyKey = useRef("");

  useEffect(() => {
    const controller = new AbortController();
    const options = { signal: controller.signal };

    Promise.all([
      fetch("/api/orders/cart", options).then((r) => r.json()),
      fetch("/api/orders/slots", options).then((r) => r.json()),
    ])
      .then(([cart, slots]) => {
        if (!cart.ok) {
          setLoadout({
            key: requestKey,
            cart: null,
            slots: [],
            // Сообщение от сервера: «не выбран» и «не та роль» — разные случаи.
            forbidden: cart.error?.code === "forbidden" ? cart.error.message : null,
          });
          return;
        }
        setLoadout({
          key: requestKey,
          cart: cart.data,
          slots: slots.ok ? slots.data : [],
          forbidden: null,
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.error("оформление: запрос не удался", error);
        setLoadout({ key: requestKey, cart: null, slots: [], forbidden: null });
      });

    return () => controller.abort();
  }, [requestKey]);

  const settled = loadout?.key === requestKey ? loadout : null;

  const byDay = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const slot of settled?.slots ?? []) {
      const list = map.get(slot.slotDate) ?? [];
      list.push(slot);
      map.set(slot.slotDate, list);
    }
    return [...map.entries()];
  }, [settled]);

  if (settled === null) return <Skeleton variant="block" count={3} label="Готовим оформление" />;

  if (settled.forbidden !== null) {
    return (
      <EmptyState
        title="Оформление недоступно"
        description={`${settled.forbidden}. Заказ оформляется от лица покупателя.`}
        action={
          <Link href="/cart">
            <Button variant="secondary">В корзину</Button>
          </Link>
        }
      />
    );
  }

  if (settled.cart === null) {
    return (
      <ErrorState
        message="Оформление не открывается. Попробуйте ещё раз — корзина не потеряется."
        action={
          <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
            Повторить
          </Button>
        }
      />
    );
  }

  const cart = settled.cart;

  if (cart.lines.length === 0) {
    return (
      <EmptyState
        title="Сначала выберите растения"
        description="Оформление откроется, как только в корзине появится хотя бы одна позиция."
        action={
          <Link href="/catalog">
            <Button>В каталог</Button>
          </Link>
        }
      />
    );
  }

  const needsSlot = method === "delivery" && slotId === null;

  async function confirm() {
    if (!idempotencyKey.current) {
      idempotencyKey.current = `checkout-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    }
    setSending(true);
    setFailure(null);
    try {
      const body =
        method === "delivery"
          ? { method: "delivery", slotId, idempotencyKey: idempotencyKey.current }
          : { method: "pickup", idempotencyKey: idempotencyKey.current };

      const response = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json();

      if (!payload.ok) {
        setFailure({
          message: payload.error?.message ?? "Заказ не создан",
          short: (payload.error?.details as { short?: ShortItem[] })?.short ?? [],
        });
        setSending(false);
        return;
      }
      router.push(`/orders/${payload.data.orderId}`);
    } catch (error) {
      console.error("оформление: заказ не создан", error);
      setFailure({ message: "Не удалось оформить заказ. Попробуйте ещё раз.", short: [] });
      setSending(false);
    }
  }

  const nameOf = (plantId: number) =>
    cart.lines.find((l) => l.plantId === plantId)?.nameRu ?? `растение №${plantId}`;

  return (
    <>
      <section className={styles.section}>
        <h2>Способ получения</h2>
        <div className={styles.methods} role="radiogroup" aria-label="Способ получения">
          <label className={styles.method}>
            <input
              type="radio"
              name="fulfillment"
              value="pickup"
              checked={method === "pickup"}
              onChange={() => setMethod("pickup")}
            />
            <span className={styles.methodText}>
              <span>Самовывоз</span>
              <span className={styles.methodHint}>Забрать в питомнике, когда заказ соберут</span>
            </span>
          </label>

          <label className={styles.method}>
            <input
              type="radio"
              name="fulfillment"
              value="delivery"
              checked={method === "delivery"}
              onChange={() => setMethod("delivery")}
            />
            <span className={styles.methodText}>
              <span>Доставка в слот</span>
              <span className={styles.methodHint}>Выберите день и интервал ниже</span>
            </span>
          </label>
        </div>
      </section>

      {method === "delivery" ? (
        <section className={styles.section}>
          <Field
            id="slot-group"
            label="Дата и интервал"
            hint="Демо-расписание: три интервала в день, вместимость слота — 5 заказов"
            required
            error={needsSlot ? "Выберите слот — без него доставку не оформить" : undefined}
          >
            {(control) => (
              <div id={control.id} aria-describedby={control["aria-describedby"]}>
                {byDay.length === 0 ? (
                  <p className="muted">Свободных слотов нет. Выберите самовывоз.</p>
                ) : (
                  byDay.map(([date, slots]) => (
                    <div className={styles.day} key={date}>
                      <p className={styles.dayName}>{formatDay(date)}</p>
                      <div className={styles.slots}>
                        {slots.map((slot) => (
                          <label className={styles.slot} key={slot.id}>
                            <input
                              type="radio"
                              name="slot"
                              value={slot.id}
                              disabled={slot.isFull}
                              checked={slotId === slot.id}
                              onChange={() => setSlotId(slot.id)}
                            />
                            <span>{slot.interval}</span>
                            {slot.isFull ? <span>· занят</span> : null}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </Field>
        </section>
      ) : null}

      <section className={styles.section}>
        <h2>Заказ</h2>
        <div className={styles.summary}>
          {cart.lines.map((line) => (
            <span className={styles.summaryLine} key={line.plantId}>
              <span className={styles.summaryWhat}>
                <PlantPhoto photoUrl={line.photoUrl} name={line.nameRu} variant="thumb" />
                <span>
                  {line.nameRu} · {line.quantity} шт.
                </span>
              </span>
              <span>{formatPrice(line.sumCents)}</span>
            </span>
          ))}
        </div>

        <div className={styles.summaryTotal}>
          <span>Итого</span>
          <span>{formatPrice(cart.totalCents)}</span>
        </div>

        <p className={styles.payStub}>
          Тестовый платёж — оплата не списывается. Заказ создаётся сразу, деньги
          не участвуют.
        </p>
      </section>

      {failure ? (
        <div className={styles.errorBlock}>
          <ErrorState
            message={
              failure.short.length > 0
                ? `Не хватает остатка: ${failure.short
                    .map((s) => `${nameOf(s.plantId)} — просили ${s.requested}, есть ${s.available}`)
                    .join("; ")}. Корзина сохранена.`
                : failure.message
            }
            action={
              <Link href="/cart">
                <Button variant="secondary">Вернуться в корзину</Button>
              </Link>
            }
          />
        </div>
      ) : null}

      <ActionBar>
        <span className={styles.barTotal}>{formatPrice(cart.totalCents)}</span>
        <Button fullWidth loading={sending} disabled={needsSlot} onClick={confirm}>
          Подтвердить заказ
        </Button>
      </ActionBar>
    </>
  );
}
