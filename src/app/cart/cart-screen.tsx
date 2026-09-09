"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ActionBar, Button, EmptyState, ErrorState, Skeleton } from "@/ui";
import { formatPrice } from "../catalog/filters";
import styles from "./cart.module.css";

type CartLine = {
  plantId: number;
  nameRu: string;
  nameLat: string;
  quantity: number;
  priceCents: number;
  sumCents: number;
};

type Cart = { lines: CartLine[]; totalCents: number };
type Loadout = { key: string; cart: Cart | null; forbidden: boolean };

export function CartScreen() {
  const [loadout, setLoadout] = useState<Loadout | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [busyPlant, setBusyPlant] = useState<number | null>(null);
  const [actionError, setActionError] = useState("");
  const requestKey = `cart#${attempt}`;

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/orders/cart", { signal: controller.signal })
      .then((r) => r.json())
      .then((payload) => {
        if (payload.ok) {
          setLoadout({ key: requestKey, cart: payload.data, forbidden: false });
          return;
        }
        setLoadout({
          key: requestKey,
          cart: null,
          forbidden: payload.error?.code === "forbidden",
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.error("корзина: запрос не удался", error);
        setLoadout({ key: requestKey, cart: null, forbidden: false });
      });

    return () => controller.abort();
  }, [requestKey]);

  /** Все изменения корзины возвращают её целиком — состояние берём из ответа,
   *  а не пересчитываем на экране: иначе итог разъедется с сервером. */
  const send = useCallback(
    async (action: string, body: Record<string, number>, plantId: number) => {
      setBusyPlant(plantId);
      setActionError("");
      try {
        const response = await fetch(`/api/orders/${action}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        const payload = await response.json();
        if (!payload.ok) {
          setActionError(payload.error?.message ?? "Не удалось изменить корзину");
          return;
        }
        setLoadout({ key: requestKey, cart: payload.data, forbidden: false });
      } catch (error) {
        console.error("корзина: изменение не прошло", error);
        setActionError("Корзина не отвечает. Попробуйте ещё раз.");
      } finally {
        setBusyPlant(null);
      }
    },
    [requestKey],
  );

  const settled = loadout?.key === requestKey ? loadout : null;

  if (settled === null) return <Skeleton variant="block" count={3} label="Загружаем корзину" />;

  if (settled.forbidden) {
    return (
      <EmptyState
        title="Не выбран покупатель"
        description="Корзина у каждого покупателя своя. Выберите пользователя в шапке — она появится."
        action={
          <Link href="/catalog">
            <Button variant="secondary">Пока в каталог</Button>
          </Link>
        }
      />
    );
  }

  if (settled.cart === null) {
    return (
      <ErrorState
        message="Корзина не открывается. Попробуйте ещё раз — состав не потеряется."
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
        title="В корзине пусто"
        description="Соберите заказ из каталога — фильтры помогут отобрать растения под ваш участок."
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
      <p className={styles.intro}>Проверьте состав и количество перед оформлением.</p>

      <div className={styles.lines}>
        {cart.lines.map((line) => (
          <div className={styles.line} key={line.plantId}>
            <span className={styles.name}>
              <Link href={`/catalog/${line.plantId}`}>{line.nameRu}</Link>
            </span>
            <span className={styles.latin}>{line.nameLat}</span>
            <span className="muted">{formatPrice(line.priceCents)} за штуку</span>

            <div className={styles.controls}>
              <span className={styles.stepper}>
                <Button
                  variant="secondary"
                  aria-label={`Уменьшить количество: ${line.nameRu}`}
                  disabled={busyPlant === line.plantId || line.quantity <= 1}
                  onClick={() =>
                    send("cart-qty", { plantId: line.plantId, quantity: line.quantity - 1 }, line.plantId)
                  }
                >
                  −
                </Button>
                <span className={styles.count} aria-live="polite">
                  {line.quantity}
                </span>
                <Button
                  variant="secondary"
                  aria-label={`Увеличить количество: ${line.nameRu}`}
                  disabled={busyPlant === line.plantId || line.quantity >= 99}
                  onClick={() =>
                    send("cart-qty", { plantId: line.plantId, quantity: line.quantity + 1 }, line.plantId)
                  }
                >
                  +
                </Button>
              </span>
              <span className={styles.sum}>{formatPrice(line.sumCents)}</span>
            </div>

            <Button
              variant="ghost"
              disabled={busyPlant === line.plantId}
              onClick={() => send("cart-remove", { plantId: line.plantId }, line.plantId)}
            >
              Убрать из корзины
            </Button>
          </div>
        ))}
      </div>

      {actionError ? <ErrorState message={actionError} /> : null}

      <div className={styles.total}>
        <span>Итого</span>
        <span className={styles.totalValue}>{formatPrice(cart.totalCents)}</span>
      </div>

      <ActionBar>
        <span className={styles.barTotal}>{formatPrice(cart.totalCents)}</span>
        <Link className={styles.barAction} href="/checkout">
          <Button fullWidth>Оформить</Button>
        </Link>
      </ActionBar>
    </>
  );
}
