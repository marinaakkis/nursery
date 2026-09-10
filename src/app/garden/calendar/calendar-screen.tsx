"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Badge, Button, EmptyState, ErrorState, Skeleton } from "@/ui";
import styles from "../garden.module.css";
import { eventsWord, humanDate, shiftIso, todayIso, weekdayOf, whenWord } from "../format";

type CareEvent = {
  id: number;
  gardenPlantId: number;
  nameRu: string;
  label: string;
  plannedOn: string;
  isDone: boolean;
  doneOn: string | null;
  overdue: boolean;
};

type Loaded = { events: CareEvent[]; dueCount: number };
type Loadout = { key: string; data: Loaded | null; forbidden: boolean };

export function CalendarScreen() {
  const today = todayIso();
  const [weekStart, setWeekStart] = useState(today);
  const [loadout, setLoadout] = useState<Loadout | null>(null);
  const router = useRouter();
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState<number | null>(null);
  const [actionError, setActionError] = useState("");

  const weekEnd = shiftIso(weekStart, 6);
  const requestKey = `${weekStart}#${attempt}`;

  useEffect(() => {
    const controller = new AbortController();

    fetch(`/api/garden/calendar?from=${weekStart}&to=${weekEnd}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((payload) => {
        if (payload.ok) {
          setLoadout({ key: requestKey, data: payload.data, forbidden: false });
          return;
        }
        setLoadout({ key: requestKey, data: null, forbidden: payload.error?.code === "forbidden" });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.error("календарь: запрос не удался", error);
        setLoadout({ key: requestKey, data: null, forbidden: false });
      });

    return () => controller.abort();
  }, [weekStart, weekEnd, requestKey]);

  /** Отметка возвращает не список, а факт — поэтому после неё перечитываем неделю:
   *  выполнение порождает следующее событие, и его нужно показать. */
  const toggle = useCallback(async (event: CareEvent) => {
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
      console.error("календарь: отметка не прошла", error);
      setActionError("Отметка не сохранилась. Попробуйте ещё раз.");
    } finally {
      setBusy(null);
    }
  }, [router]);

  const settled = loadout?.key === requestKey ? loadout : null;

  if (settled === null) return <Skeleton variant="block" count={4} label="Загружаем календарь" />;

  if (settled.forbidden) {
    return (
      <EmptyState
        title="Календарь у каждого свой"
        description="Выберите покупателя в шапке — и здесь появятся его дела по уходу."
        action={
          <Link href="/catalog">
            <Button variant="secondary">Пока в каталог</Button>
          </Link>
        }
      />
    );
  }

  if (settled.data === null) {
    return (
      <ErrorState
        message="Календарь не открывается. Попробуйте ещё раз — отметки сохранены."
        action={
          <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
            Повторить
          </Button>
        }
      />
    );
  }

  const { events } = settled.data;
  const overdue = events.filter((event) => event.overdue);
  const week = Array.from({ length: 7 }, (_, index) => shiftIso(weekStart, index));
  const inWeek = events.filter((event) => !event.overdue);

  const markButton = (event: CareEvent) => (
    <Button
      variant={event.isDone ? "ghost" : "secondary"}
      disabled={busy === event.id}
      onClick={() => toggle(event)}
      aria-label={`${event.isDone ? "Снять отметку" : "Отметить выполненным"}: ${event.label}, ${event.nameRu}`}
    >
      {event.isDone ? "Отменить" : "Готово"}
    </Button>
  );

  if (events.length === 0) {
    return (
      <>
        <WeekNav weekStart={weekStart} today={today} onMove={setWeekStart} />
        <EmptyState
          title="На этой неделе дел нет"
          description="Календарь строится из правил ухода купленных растений. Пусто — значит, всё сделано или растений пока нет."
          action={
            <Link href="/garden">
              <Button variant="secondary">К растениям</Button>
            </Link>
          }
        />
      </>
    );
  }

  return (
    <>
      <WeekNav weekStart={weekStart} today={today} onMove={setWeekStart} />

      {actionError ? <ErrorState message={actionError} /> : null}

      {overdue.length > 0 ? (
        <section className={styles.overdueBlock}>
          <h2 className={styles.overdueTitle}>
            Просрочено: {overdue.length} {eventsWord(overdue.length)}
          </h2>
          {overdue.map((event) => (
            <div className={`${styles.event} ${styles.eventOverdue}`} key={event.id}>
              <span className={styles.eventBody}>
                <span className={styles.eventWhat}>{event.label}</span>
                <span className={styles.eventPlant}>{event.nameRu}</span>
                <Badge tone="warning">{whenWord(event.plannedOn, today)}</Badge>
              </span>
              {markButton(event)}
            </div>
          ))}
        </section>
      ) : null}

      <div className={styles.week}>
      {week.map((day) => {
        const ofDay = inWeek.filter((event) => event.plannedOn === day);
        return (
          <section className={styles.day} key={day}>
            <h2 className={styles.dayName}>
              {humanDate(day)}{" "}
              <span className={styles.dayWeekday}>
                {day === today ? "сегодня" : weekdayOf(day)}
              </span>
            </h2>
            {ofDay.length === 0 ? (
              <p className={styles.dayEmpty}>Свободно</p>
            ) : (
              ofDay.map((event) => (
                <div
                  className={`${styles.event} ${event.isDone ? styles.eventDone : ""}`}
                  key={event.id}
                >
                  <span className={styles.eventBody}>
                    <span className={styles.eventWhat}>{event.label}</span>
                    <span className={styles.eventPlant}>{event.nameRu}</span>
                  </span>
                  {markButton(event)}
                </div>
              ))
            )}
          </section>
        );
      })}
      </div>
    </>
  );
}

function WeekNav({
  weekStart,
  today,
  onMove,
}: {
  weekStart: string;
  today: string;
  onMove: (iso: string) => void;
}) {
  return (
    <div className={styles.weekHead}>
      <Button variant="secondary" onClick={() => onMove(shiftIso(weekStart, -7))}>
        ← Прошлая неделя
      </Button>
      {/* Период между стрелками: без него после нажатия непонятно, где ты. */}
      <span className={styles.weekTitle}>
        {humanDate(weekStart)} — {humanDate(shiftIso(weekStart, 6))}
      </span>
      {weekStart === today ? null : (
        <Button variant="ghost" onClick={() => onMove(today)}>
          Сегодня
        </Button>
      )}
      <Button variant="secondary" onClick={() => onMove(shiftIso(weekStart, 7))}>
        Следующая неделя →
      </Button>
    </div>
  );
}
