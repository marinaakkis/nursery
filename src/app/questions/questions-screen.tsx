"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, Button, EmptyState, ErrorState, Skeleton } from "@/ui";
import { AskForm } from "./ask-form";
import styles from "./questions.module.css";

type QuestionListItem = {
  id: number;
  status: string;
  statusLabel: string;
  plantName: string | null;
  preview: string;
  messageCount: number;
  hasPhoto: boolean;
};

type GardenPlant = { plantId: number; nameRu: string };
type Loadout = {
  key: string;
  items: QuestionListItem[] | null;
  plants: GardenPlant[];
  forbidden: boolean;
};

const TONE: Record<string, "neutral" | "progress" | "success"> = {
  new: "neutral",
  in_progress: "progress",
  answered: "success",
};

export function QuestionsScreen() {
  const [loadout, setLoadout] = useState<Loadout | null>(null);
  const [attempt, setAttempt] = useState(0);
  const requestKey = `questions#${attempt}`;

  useEffect(() => {
    const controller = new AbortController();
    const options = { signal: controller.signal };

    Promise.all([
      fetch("/api/consult/questions", options).then((r) => r.json()),
      fetch("/api/consult/my-plants", options).then((r) => r.json()),
    ])
      .then(([list, plants]) => {
        if (!list.ok) {
          setLoadout({
            key: requestKey,
            items: null,
            plants: [],
            forbidden: list.error?.code === "forbidden",
          });
          return;
        }
        setLoadout({
          key: requestKey,
          items: list.data,
          plants: plants.ok ? plants.data : [],
          forbidden: false,
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.error("вопросы: запрос не удался", error);
        setLoadout({ key: requestKey, items: null, plants: [], forbidden: false });
      });

    return () => controller.abort();
  }, [requestKey]);

  const settled = loadout?.key === requestKey ? loadout : null;

  if (settled === null) return <Skeleton variant="block" count={3} label="Загружаем вопросы" />;

  if (settled.forbidden) {
    return (
      <EmptyState
        title="Вопросы у каждого свои"
        description="Выберите покупателя в шапке — и здесь появится его переписка с агрономом."
        action={
          <Link href="/catalog">
            <Button variant="secondary">Пока в каталог</Button>
          </Link>
        }
      />
    );
  }

  if (settled.items === null) {
    return (
      <ErrorState
        message="Вопросы не открываются. Попробуйте ещё раз — переписка на месте."
        action={
          <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
            Повторить
          </Button>
        }
      />
    );
  }

  return (
    <>
      {settled.items.length === 0 ? (
        <EmptyState
          title="Вопросов пока нет"
          description="Если с растением что-то не так — сфотографируйте и опишите. Агроном ответит в этой же переписке."
          action={<span className="muted">Форма ниже</span>}
        />
      ) : (
        <>
          <p className={styles.intro}>Ответ приходит в переписку — уведомление придёт в продукт.</p>
          <div className={styles.list}>
            {settled.items.map((item) => (
              <Link className={styles.row} key={item.id} href={`/questions/${item.id}`}>
                <span className={styles.rowHead}>
                  <span className={styles.plant}>{item.plantName ?? "Общий вопрос"}</span>
                  <Badge tone={TONE[item.status] ?? "neutral"}>{item.statusLabel}</Badge>
                </span>
                <span className={styles.preview}>{item.preview}</span>
                <span className={styles.meta}>
                  <span>сообщений: {item.messageCount}</span>
                  {item.hasPhoto ? <span>с фото</span> : null}
                </span>
              </Link>
            ))}
          </div>
        </>
      )}

      <AskForm plants={settled.plants} />
    </>
  );
}
