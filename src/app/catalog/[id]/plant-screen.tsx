"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ActionBar,
  Badge,
  Button,
  EmptyState,
  ErrorState,
  InlineSuccess,
  Skeleton,
} from "@/ui";
import { CARE_TYPE_LABEL, daysWord, formatPrice, labelOf } from "../filters";
import { CalendarIcon, DropIcon, SoilIcon, SunIcon, ZoneIcon } from "./icons";
import styles from "./plant.module.css";

type CareRule = { type: string; periodDays: number; seasonOnly: boolean };

type PlantCard = {
  id: number;
  nameRu: string;
  nameLat: string;
  description: string;
  light: string;
  minZone: number;
  plantingSeason: string;
  careLevel: string;
  soil: string;
  priceCents: number;
  isActive: boolean;
  careRules: CareRule[];
};

type Stock = { available: number; low: boolean };

/** Что загрузилось и для какой попытки. Фаза считается при рендере:
 *  «загружаем» — производное, а не эффект. */
type Loadout = { key: string; plant: PlantCard | null; stock: Stock | null; missing: boolean };

type AddState = "idle" | "sending" | "added" | "failed";

export function PlantScreen({ plantId }: { plantId: string }) {
  const [loadout, setLoadout] = useState<Loadout | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [add, setAdd] = useState<AddState>("idle");
  const [addError, setAddError] = useState("");
  const requestKey = `${plantId}#${attempt}`;

  useEffect(() => {
    const controller = new AbortController();
    const options = { signal: controller.signal };

    // Два запроса, а не один: наличие живёт в warehouse, карточка — в catalog,
    // и обращение catalog → warehouse замкнуло бы модули в цикл.
    Promise.all([
      fetch(`/api/catalog/plant?id=${plantId}`, options).then((r) => r.json()),
      fetch(`/api/warehouse/stock?plantId=${plantId}`, options).then((r) => r.json()),
    ])
      .then(([card, stock]) => {
        if (!card.ok) {
          setLoadout({ key: requestKey, plant: null, stock: null, missing: true });
          return;
        }
        setLoadout({
          key: requestKey,
          plant: card.data,
          stock: stock.ok ? stock.data : { available: 0, low: false },
          missing: false,
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.error("карточка растения: запрос не удался", error);
        setLoadout({ key: requestKey, plant: null, stock: null, missing: false });
      });

    return () => controller.abort();
  }, [plantId, requestKey]);

  const settled = loadout?.key === requestKey ? loadout : null;

  if (settled === null) return <Skeleton variant="block" count={4} label="Загружаем карточку" />;

  if (settled.missing) {
    return (
      <EmptyState
        title="Растение не найдено"
        description="Возможно, его убрали из каталога или в ссылке опечатка."
        action={
          <Link href="/catalog">
            <Button variant="secondary">В каталог</Button>
          </Link>
        }
      />
    );
  }

  if (settled.plant === null) {
    return (
      <ErrorState
        message="Карточка не открывается. Попробуйте ещё раз — данные не потеряются."
        action={
          <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
            Повторить
          </Button>
        }
      />
    );
  }

  const plant = settled.plant;
  const stock = settled.stock ?? { available: 0, low: false };
  const soldOut = stock.available === 0;
  const withdrawn = !plant.isActive;
  const canBuy = !soldOut && !withdrawn;

  const watering = plant.careRules.find((r) => r.type === "watering");

  async function addToCart() {
    setAdd("sending");
    setAddError("");
    try {
      const response = await fetch("/api/orders/cart-item", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plantId: plant.id, quantity: 1 }),
      });
      const payload = await response.json();
      if (!payload.ok) {
        setAdd("failed");
        setAddError(
          payload.error?.code === "forbidden"
            ? "Сначала выберите покупателя в шапке — корзина у каждого своя."
            : (payload.error?.message ?? "Не удалось положить в корзину"),
        );
        return;
      }
      setAdd("added");
    } catch (error) {
      console.error("не удалось положить в корзину", error);
      setAdd("failed");
      setAddError("Корзина не отвечает. Попробуйте ещё раз.");
    }
  }

  return (
    <>
      <Link className={styles.back} href="/catalog">
        ← В каталог
      </Link>

      <div className={`${styles.photo} ${canBuy ? "" : styles.dimmed}`}>фото</div>

      <h1>{plant.nameRu}</h1>
      <p className={styles.latin}>{plant.nameLat}</p>
      <p className={styles.price}>{formatPrice(plant.priceCents)}</p>

      <div className={styles.badgeRow}>
        {withdrawn ? (
          <Badge tone="neutral">Снято с продажи</Badge>
        ) : soldOut ? (
          <Badge tone="danger">Нет в наличии</Badge>
        ) : stock.low ? (
          <Badge tone="warning">Осталось {stock.available}</Badge>
        ) : (
          <Badge tone="success">Есть в наличии</Badge>
        )}
      </div>

      <ul className={styles.reqs}>
        <li>
          <SunIcon className={styles.reqIcon} />
          <span className={styles.reqName}>Свет</span>
          <span className={styles.reqValue}>{labelOf("light", plant.light)}</span>
        </li>
        <li>
          <ZoneIcon className={styles.reqIcon} />
          <span className={styles.reqName}>Зона</span>
          <span className={styles.reqValue}>{plant.minZone} и теплее</span>
        </li>
        <li>
          <DropIcon className={styles.reqIcon} />
          <span className={styles.reqName}>Полив</span>
          <span className={styles.reqValue}>
            {watering
              ? `раз в ${watering.periodDays} ${daysWord(watering.periodDays)}`
              : `уход ${labelOf("care", plant.careLevel).toLowerCase()}`}
          </span>
        </li>
        <li>
          <CalendarIcon className={styles.reqIcon} />
          <span className={styles.reqName}>Посадка</span>
          <span className={styles.reqValue}>{labelOf("season", plant.plantingSeason)}</span>
        </li>
        <li>
          <SoilIcon className={styles.reqIcon} />
          <span className={styles.reqName}>Почва</span>
          <span className={styles.reqValue}>{plant.soil}</span>
        </li>
      </ul>

      <section className={styles.about}>
        <h2>Описание</h2>
        <p>{plant.description}</p>
        <p className={styles.stub}>
          Фото — заглушка: загрузка изображений в демо не подключена.
        </p>
        {plant.careRules.length > 0 ? (
          <p className="muted">
            В календарь ухода попадёт:{" "}
            {plant.careRules
              .map((r) => `${(CARE_TYPE_LABEL[r.type] ?? r.type).toLowerCase()} раз в ${r.periodDays} ${daysWord(r.periodDays)}`)
              .join(", ")}
            .
          </p>
        ) : null}
      </section>

      {add === "added" ? (
        <div className={styles.added}>
          <InlineSuccess message={`${plant.nameRu} в корзине`} />
          <Link href="/cart">
            <Button variant="secondary">Перейти в корзину</Button>
          </Link>
        </div>
      ) : null}

      {add === "failed" ? <ErrorState message={addError} /> : null}

      <ActionBar>
        {canBuy ? (
          <>
            <span className={styles.barPrice}>{formatPrice(plant.priceCents)}</span>
            <Button fullWidth loading={add === "sending"} onClick={addToCart}>
              В корзину
            </Button>
          </>
        ) : (
          <Button fullWidth disabled>
            {withdrawn ? "Снято с продажи" : "Нет в наличии"}
          </Button>
        )}
      </ActionBar>
    </>
  );
}
