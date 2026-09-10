"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button, EmptyState, ErrorState, Field, InlineSuccess, Input, Select, Skeleton } from "@/ui";
import styles from "../warehouse.module.css";

type Batch = {
  id: number;
  plantId: number;
  plantName: string;
  receivedAt: string;
  quantity: number;
  remaining: number;
  supplier: string;
  writtenOff: number;
};

type Plant = { id: number; nameRu: string };

export function BatchesScreen() {
  const [batches, setBatches] = useState<Batch[] | null>(null);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [denied, setDenied] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const [plantId, setPlantId] = useState("");
  const [quantity, setQuantity] = useState("10");
  const [supplier, setSupplier] = useState("Питомник «Лесной»");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const [writeOffFor, setWriteOffFor] = useState<number | null>(null);
  const [writeOffQty, setWriteOffQty] = useState("1");
  const [writeOffReason, setWriteOffReason] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const options = { signal: controller.signal };
    Promise.all([
      fetch("/api/warehouse/batches", options).then((r) => r.json()),
      fetch("/api/catalog/plants", options).then((r) => r.json()),
    ])
      .then(([list, catalog]) => {
        if (!list.ok) {
          setBatches(null);
          setDenied(list.error?.code === "forbidden");
          setFailed(list.error?.code !== "forbidden");
          return;
        }
        setBatches(list.data);
        setDenied(false);
        setFailed(false);
        setPlants(catalog.ok ? catalog.data.items.map((p: { id: number; nameRu: string }) => p) : []);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        console.error("склад: партии не загрузились", cause);
        setBatches(null);
        setFailed(true);
      });
    return () => controller.abort();
  }, [attempt]);

  const send = useCallback(async (action: string, body: Record<string, unknown>, success: string) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const payload = await fetch(`/api/warehouse/${action}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => r.json());

      if (!payload.ok) {
        setError(payload.error?.message ?? "Не получилось");
        return false;
      }
      setNotice(success);
      setAttempt((n) => n + 1);
      return true;
    } catch (cause) {
      console.error("склад: действие не прошло", cause);
      setError("Действие не прошло. Попробуйте ещё раз.");
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  if (denied) {
    return (
      <EmptyState
        title="Кабинет склада"
        description="Переключите пользователя в шапке на Павла — приход и списание ведёт он."
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
        message="Партии не загрузились. Попробуйте ещё раз."
        action={
          <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
            Повторить
          </Button>
        }
      />
    );
  }

  if (batches === null) return <Skeleton variant="block" count={4} label="Загружаем партии" />;

  return (
    <>
      <div className={styles.form}>
        <h2>Приход партии</h2>
        <div className={styles.formRow}>
          <Field id="receive-plant" label="Растение" required>
            {(control) => (
              <Select
                {...control}
                value={plantId}
                onChange={(event) => setPlantId(event.target.value)}
              >
                <option value="">Выберите растение</option>
                {plants.map((plant) => (
                  <option key={plant.id} value={plant.id}>
                    {plant.nameRu}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field id="receive-qty" label="Количество" required>
            {(control) => (
              <Input
                {...control}
                type="number"
                min="1"
                inputMode="numeric"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
              />
            )}
          </Field>
          <Field id="receive-supplier" label="Поставщик" required>
            {(control) => (
              <Input
                {...control}
                value={supplier}
                onChange={(event) => setSupplier(event.target.value)}
              />
            )}
          </Field>
        </div>
        <Button
          loading={busy}
          disabled={plantId === ""}
          onClick={() =>
            send(
              "receive",
              { plantId: Number(plantId), quantity: Number(quantity), supplier },
              "Партия принята — остаток вырос",
            )
          }
        >
          Принять партию
        </Button>
        <p className="muted">Новая партия приходит полной: остаток равен количеству.</p>
      </div>

      {notice ? <InlineSuccess message={notice} /> : null}
      {error ? <ErrorState message={error} /> : null}

      {batches.length === 0 ? (
        <EmptyState
          title="Партий пока нет"
          description="Оформите первый приход — он появится в таблице и сразу попадёт в остатки."
          action={<span className="muted">Форма выше</span>}
        />
      ) : (
        <div className={styles.scroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Растение</th>
                <th>Поступила</th>
                <th>Поставщик</th>
                <th className={styles.num}>Завезено</th>
                <th className={styles.num}>Остаток</th>
                <th className={styles.num}>Списано</th>
                <th>Списание</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((batch) => (
                <tr key={batch.id}>
                  <td>{batch.plantName}</td>
                  <td>{batch.receivedAt}</td>
                  <td>{batch.supplier}</td>
                  <td className={styles.num}>{batch.quantity}</td>
                  <td className={styles.num}>{batch.remaining}</td>
                  <td className={styles.num}>{batch.writtenOff}</td>
                  <td>
                    <Button
                      variant="secondary"
                      disabled={batch.remaining === 0}
                      onClick={() => {
                        setWriteOffFor(batch.id);
                        setWriteOffQty("1");
                        setWriteOffReason("");
                        setError("");
                      }}
                      aria-label={`Списать из партии ${batch.plantName} от ${batch.receivedAt}`}
                    >
                      Списать
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {writeOffFor !== null ? (
        <div className={styles.form}>
          <h2>Списание из партии №{writeOffFor}</h2>
          <div className={styles.formRow}>
            <Field id="wo-reason" label="Причина" hint="Останется в журнале списаний" required>
              {(control) => (
                <Input
                  {...control}
                  value={writeOffReason}
                  onChange={(event) => setWriteOffReason(event.target.value)}
                  placeholder="подмёрзли при перевозке"
                />
              )}
            </Field>
            <Field id="wo-qty" label="Количество" required>
              {(control) => (
                <Input
                  {...control}
                  type="number"
                  min="1"
                  inputMode="numeric"
                  value={writeOffQty}
                  onChange={(event) => setWriteOffQty(event.target.value)}
                />
              )}
            </Field>
          </div>
          <div className={styles.rowAction}>
            <Button
              loading={busy}
              disabled={writeOffReason.trim().length < 3}
              onClick={async () => {
                const done = await send(
                  "write-off",
                  {
                    batchId: writeOffFor,
                    quantity: Number(writeOffQty),
                    reason: writeOffReason,
                  },
                  "Списано — остаток пересчитан",
                );
                if (done) setWriteOffFor(null);
              }}
            >
              Списать
            </Button>
            <Button variant="ghost" onClick={() => setWriteOffFor(null)}>
              Отмена
            </Button>
          </div>
          <p className="muted">
            Больше остатка списать нельзя: склад откажет и объяснит, сколько есть.
          </p>
        </div>
      ) : null}
    </>
  );
}
