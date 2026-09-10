"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, Button, EmptyState, ErrorState, PlantPhoto, Skeleton } from "@/ui";
import styles from "./garden.module.css";
import { whenWord } from "./format";

type GardenPlant = {
  gardenPlantId: number;
  plantId: number;
  nameRu: string;
  nameLat: string;
  quantity: number;
  next: { label: string; plannedOn: string; overdue: boolean } | null;
  overdueCount: number;
};

type Loadout = { key: string; plants: GardenPlant[] | null; forbidden: boolean };

export function GardenScreen() {
  const [loadout, setLoadout] = useState<Loadout | null>(null);
  const [attempt, setAttempt] = useState(0);
  const requestKey = `garden#${attempt}`;

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/garden/plants", { signal: controller.signal })
      .then((r) => r.json())
      .then((payload) => {
        if (payload.ok) {
          setLoadout({ key: requestKey, plants: payload.data, forbidden: false });
          return;
        }
        setLoadout({
          key: requestKey,
          plants: null,
          forbidden: payload.error?.code === "forbidden",
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.error("сад: запрос не удался", error);
        setLoadout({ key: requestKey, plants: null, forbidden: false });
      });

    return () => controller.abort();
  }, [requestKey]);

  const settled = loadout?.key === requestKey ? loadout : null;

  if (settled === null) return <Skeleton variant="block" count={3} label="Загружаем сад" />;

  if (settled.forbidden) {
    return (
      <EmptyState
        title="Сад у каждого свой"
        description="Выберите покупателя в шапке — и здесь появятся его растения с календарём ухода."
        action={
          <Link href="/catalog">
            <Button variant="secondary">Пока в каталог</Button>
          </Link>
        }
      />
    );
  }

  if (settled.plants === null) {
    return (
      <ErrorState
        message="Сад не открывается. Попробуйте ещё раз — записи никуда не делись."
        action={
          <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
            Повторить
          </Button>
        }
      />
    );
  }

  if (settled.plants.length === 0) {
    return (
      <EmptyState
        title="Сад пуст"
        description="Всё начинается с каталога: купленные растения попадут сюда сами, вместе с календарём ухода."
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
      <p className={styles.intro}>
        {settled.plants.length === 1 ? "Одно растение" : `${settled.plants.length} растения`} под
        присмотром. Календарь строится из правил ухода — ничего заводить вручную не нужно.
      </p>

      <div className={styles.list}>
        {settled.plants.map((plant) => (
          <Link
            className={styles.row}
            key={plant.gardenPlantId}
            href={`/garden/${plant.gardenPlantId}`}
          >
            <PlantPhoto name={plant.nameRu} plantId={plant.plantId} variant="thumb" />
            <span className={styles.rowBody}>
              <span className={styles.name}>{plant.nameRu}</span>
              <span className={styles.latin}>{plant.nameLat}</span>
              {plant.quantity > 1 ? <span className="muted">{plant.quantity} шт.</span> : null}
              <span className={styles.next}>
                {plant.next ? (
                  plant.next.overdue ? (
                    <Badge tone="warning">
                      {plant.next.label}: {whenWord(plant.next.plannedOn)}
                    </Badge>
                  ) : (
                    <>
                      Следующее: {plant.next.label}, {whenWord(plant.next.plannedOn)}
                    </>
                  )
                ) : (
                  <span className={styles.nextNone}>Ближайших дел нет</span>
                )}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}
