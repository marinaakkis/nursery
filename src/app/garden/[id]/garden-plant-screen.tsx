"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge, Button, EmptyState, ErrorState, PlantPhoto, Skeleton } from "@/ui";
import { daysWord } from "../../catalog/filters";
import styles from "../garden.module.css";
import { humanDate, todayIso, whenWord } from "../format";

type CareEvent = {
  id: number;
  label: string;
  plannedOn: string;
  isDone: boolean;
  doneOn: string | null;
  overdue: boolean;
};

type Detail = {
  gardenPlantId: number;
  plantId: number;
  nameRu: string;
  nameLat: string;
  photoUrl: string | null;
  quantity: number;
  acquiredAt: string;
  rules: { type: string; label: string; periodDays: number; seasonOnly: boolean }[];
  upcoming: CareEvent[];
  history: CareEvent[];
};

type Loadout = { key: string; detail: Detail | null; missing: boolean };

export function GardenPlantScreen({ gardenPlantId }: { gardenPlantId: string }) {
  const [loadout, setLoadout] = useState<Loadout | null>(null);
  const router = useRouter();
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState<number | null>(null);
  const [actionError, setActionError] = useState("");
  const requestKey = `${gardenPlantId}#${attempt}`;
  const today = todayIso();

  useEffect(() => {
    const controller = new AbortController();

    fetch(`/api/garden/plant?id=${gardenPlantId}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((payload) => {
        if (payload.ok) {
          setLoadout({ key: requestKey, detail: payload.data, missing: false });
          return;
        }
        const code = payload.error?.code;
        setLoadout({
          key: requestKey,
          detail: null,
          missing: code === "not_found" || code === "forbidden",
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.error("растение сада: запрос не удался", error);
        setLoadout({ key: requestKey, detail: null, missing: false });
      });

    return () => controller.abort();
  }, [gardenPlantId, requestKey]);

  async function mark(event: CareEvent) {
    setBusy(event.id);
    setActionError("");
    try {
      const response = await fetch(`/api/garden/${event.isDone ? "care-undone" : "care-done"}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventId: event.id }),
      });
      const payload = await response.json();
      if (!payload.ok) {
        setActionError(payload.error?.message ?? "Не удалось изменить отметку");
        return;
      }
      setAttempt((n) => n + 1);
      // Счётчик напоминаний живёт в серверной шапке и сам о смене не узнает.
      router.refresh();
    } catch (error) {
      console.error("растение сада: отметка не прошла", error);
      setActionError("Отметка не сохранилась. Попробуйте ещё раз.");
    } finally {
      setBusy(null);
    }
  }

  const settled = loadout?.key === requestKey ? loadout : null;

  if (settled === null) return <Skeleton variant="block" count={4} label="Загружаем растение" />;

  if (settled.missing) {
    return (
      <EmptyState
        title="Этого растения в вашем саду нет"
        description="Возможно, оно у другого покупателя или в ссылке опечатка."
        action={
          <Link href="/garden">
            <Button variant="secondary">В мой сад</Button>
          </Link>
        }
      />
    );
  }

  if (settled.detail === null) {
    return (
      <ErrorState
        message="Карточка не открывается. Попробуйте ещё раз — отметки сохранены."
        action={
          <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
            Повторить
          </Button>
        }
      />
    );
  }

  const plant = settled.detail;

  return (
    <>
      <Link className={styles.tab} href="/garden">
        ← В мой сад
      </Link>

      <div className={`${styles.hero} ${styles.section}`}>
        <PlantPhoto name={plant.nameRu} photoUrl={plant.photoUrl} variant="thumb" />
        <span className={styles.heroBody}>
          <h1>{plant.nameRu}</h1>
          <span className={styles.latin}>{plant.nameLat}</span>
          <span className="muted">
            {plant.quantity > 1 ? `${plant.quantity} шт., ` : ""}в саду с {humanDate(plant.acquiredAt)}
          </span>
          <Link href={`/catalog/${plant.plantId}`}>Карточка в каталоге</Link>
        </span>
      </div>

      {actionError ? <ErrorState message={actionError} /> : null}

      <section className={styles.section}>
        <h2>Правила ухода</h2>
        {plant.rules.length === 0 ? (
          <p className="muted">У этого растения правил ухода не задано — событий не будет.</p>
        ) : (
          <ul className={styles.rules}>
            {plant.rules.map((rule) => (
              <li key={rule.type}>
                <span>
                  {rule.label}
                  {rule.seasonOnly ? " (в сезон)" : ""}
                </span>
                <span className={styles.rulePeriod}>
                  раз в {rule.periodDays} {daysWord(rule.periodDays)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.section}>
        <h2>Ближайшие дела</h2>
        {plant.upcoming.length === 0 ? (
          <p className="muted">Всё сделано — следующее появится после отметки.</p>
        ) : (
          plant.upcoming.slice(0, 6).map((event) => (
            <div
              className={`${styles.event} ${event.overdue ? styles.eventOverdue : ""}`}
              key={event.id}
            >
              <span className={styles.eventBody}>
                <span className={styles.eventWhat}>{event.label}</span>
                <span className={styles.eventPlant}>{humanDate(event.plannedOn)}</span>
                {event.overdue ? (
                  <Badge tone="warning">{whenWord(event.plannedOn, today)}</Badge>
                ) : null}
              </span>
              <Button
                variant="secondary"
                disabled={busy === event.id}
                onClick={() => mark(event)}
                aria-label={`Отметить выполненным: ${event.label}, ${humanDate(event.plannedOn)}`}
              >
                Готово
              </Button>
            </div>
          ))
        )}
      </section>

      <section className={styles.section}>
        <h2>История отметок</h2>
        {plant.history.length === 0 ? (
          <p className="muted">Пока ничего не отмечено. Первая отметка появится здесь.</p>
        ) : (
          plant.history.map((event) => (
            <div className={`${styles.event} ${styles.eventDone}`} key={event.id}>
              <span className={styles.eventBody}>
                <span className={styles.eventWhat}>{event.label}</span>
                <span className={styles.eventPlant}>
                  сделано {event.doneOn ? humanDate(event.doneOn) : "—"}
                  {event.doneOn && event.doneOn !== event.plannedOn
                    ? `, по плану ${humanDate(event.plannedOn)}`
                    : ""}
                </span>
              </span>
              <Button
                variant="ghost"
                disabled={busy === event.id}
                onClick={() => mark(event)}
                aria-label={`Снять отметку: ${event.label}`}
              >
                Отменить
              </Button>
            </div>
          ))
        )}
      </section>
    </>
  );
}
