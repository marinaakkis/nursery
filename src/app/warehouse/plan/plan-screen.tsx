"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, EmptyState, ErrorState, Skeleton } from "@/ui";
import { labelOf } from "../../catalog/filters";
import styles from "../warehouse.module.css";

type PlanRow = {
  plantId: number;
  plantName: string;
  plantingSeason: string;
  sold: number;
  rejected: number;
  inStock: number;
  recommended: number;
};

type Plan = { periodDays: number; since: string; rows: PlanRow[] };

export function PlanScreen() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [denied, setDenied] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/warehouse/plan", { signal: controller.signal })
      .then((r) => r.json())
      .then((payload) => {
        if (payload.ok) {
          setPlan(payload.data);
          setDenied(false);
          setFailed(false);
          return;
        }
        setPlan(null);
        setDenied(payload.error?.code === "forbidden");
        setFailed(payload.error?.code !== "forbidden");
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        console.error("склад: план не загрузился", cause);
        setPlan(null);
        setFailed(true);
      });
    return () => controller.abort();
  }, [attempt]);

  if (denied) {
    return (
      <EmptyState
        title="План закупок"
        description="Переключите пользователя в шапке на Павла — закупки планирует склад."
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
        message="План не посчитался. Попробуйте ещё раз — данные спроса на месте."
        action={
          <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
            Повторить
          </Button>
        }
      />
    );
  }

  if (plan === null) return <Skeleton variant="block" count={4} label="Считаем план" />;

  // Показываем только то, что действительно надо купить: список из тридцати
  // строк с нулями — не план, а таблица.
  const needed = plan.rows.filter((row) => row.recommended > 0);

  return (
    <>
      <p className={styles.formula}>
        Формула: <strong>продано за период + отказы из-за нехватки остатка − текущий остаток</strong>.
        Период — {plan.periodDays} дней, с {plan.since}. Прогноза здесь нет: ни сезонных
        коэффициентов, ни цен поставщиков. Число говорит, чего не хватило вчера, а не что будет завтра.
      </p>

      {needed.length === 0 ? (
        <EmptyState
          title="Закупать нечего"
          description="Остатков хватает на весь спрос за период. Загляните после следующей волны заказов."
          action={
            <Link href="/warehouse">
              <Button variant="secondary">К остаткам</Button>
            </Link>
          }
        />
      ) : (
        <div className={styles.scroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Растение</th>
                <th>Сезон посадки</th>
                <th className={styles.num}>Продано</th>
                <th className={styles.num}>Отказы</th>
                <th className={styles.num}>Остаток</th>
                <th className={styles.num}>Купить</th>
              </tr>
            </thead>
            <tbody>
              {needed.map((row) => (
                <tr key={row.plantId}>
                  <td>
                    <Link href={`/catalog/${row.plantId}`}>{row.plantName}</Link>
                  </td>
                  <td>{labelOf("season", row.plantingSeason)}</td>
                  <td className={styles.num}>{row.sold}</td>
                  <td className={styles.num}>{row.rejected}</td>
                  <td className={styles.num}>{row.inStock}</td>
                  <td className={`${styles.num} ${styles.need}`}>{row.recommended}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className={styles.intro}>
        Строк с нулевой потребностью в таблице нет: всего растений в каталоге {plan.rows.length},
        закупки требуют {needed.length}.
      </p>
    </>
  );
}
