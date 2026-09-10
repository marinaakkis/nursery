"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, Button, EmptyState, ErrorState, Field, Skeleton } from "@/ui";
import styles from "../questions.module.css";

type Message = {
  id: number;
  authorName: string;
  authorRole: "customer" | "agronomist" | "warehouse";
  body: string;
  photoUrl: string | null;
  createdAt: string;
};

type Detail = {
  id: number;
  status: string;
  statusLabel: string;
  customerName: string;
  plantId: number | null;
  plantName: string | null;
  messages: Message[];
};

type Loadout = { key: string; detail: Detail | null; denied: boolean };

const TONE: Record<string, "neutral" | "progress" | "success"> = {
  new: "neutral",
  in_progress: "progress",
  answered: "success",
};

const ROLE_WORD: Record<string, string> = {
  customer: "покупатель",
  agronomist: "агроном",
  warehouse: "склад",
};

const when = (iso: string): string =>
  new Date(iso).toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

export function ThreadScreen({ questionId }: { questionId: string }) {
  const [loadout, setLoadout] = useState<Loadout | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const requestKey = `${questionId}#${attempt}`;

  useEffect(() => {
    const controller = new AbortController();

    fetch(`/api/consult/question?questionId=${questionId}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((payload) => {
        if (payload.ok) {
          setLoadout({ key: requestKey, detail: payload.data, denied: false });
          return;
        }
        const code = payload.error?.code;
        setLoadout({
          key: requestKey,
          detail: null,
          denied: code === "not_found" || code === "forbidden",
        });
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        console.error("переписка: запрос не удался", cause);
        setLoadout({ key: requestKey, detail: null, denied: false });
      });

    return () => controller.abort();
  }, [questionId, requestKey]);

  async function send() {
    if (reply.trim().length === 0) return;
    setSending(true);
    setError("");
    try {
      const response = await fetch("/api/consult/message", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ questionId: Number(questionId), text: reply }),
      });
      const payload = await response.json();
      if (!payload.ok) {
        setError(payload.error?.message ?? "Сообщение не отправилось");
        return;
      }
      setReply("");
      setAttempt((n) => n + 1);
    } catch (cause) {
      console.error("сообщение не отправилось", cause);
      setError("Сообщение не ушло. Попробуйте ещё раз — текст сохранён.");
    } finally {
      setSending(false);
    }
  }

  const settled = loadout?.key === requestKey ? loadout : null;

  if (settled === null) return <Skeleton variant="block" count={3} label="Загружаем переписку" />;

  if (settled.denied) {
    return (
      <EmptyState
        title="Этой переписки у вас нет"
        description="Возможно, вопрос задан другим покупателем или в ссылке опечатка."
        action={
          <Link href="/questions">
            <Button variant="secondary">К моим вопросам</Button>
          </Link>
        }
      />
    );
  }

  if (settled.detail === null) {
    return (
      <ErrorState
        message="Переписка не открывается. Попробуйте ещё раз — сообщения сохранены."
        action={
          <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
            Повторить
          </Button>
        }
      />
    );
  }

  const question = settled.detail;

  return (
    <>
      <Link className={styles.stub} href="/questions">
        ← Ко всем вопросам
      </Link>

      <h1>{question.plantName ?? "Общий вопрос"}</h1>
      <p className={styles.meta}>
        <Badge tone={TONE[question.status] ?? "neutral"}>{question.statusLabel}</Badge>
        {question.plantId ? <Link href={`/catalog/${question.plantId}`}>Карточка растения</Link> : null}
      </p>

      <div className={styles.thread}>
        {question.messages.map((message) => (
          <article
            className={`${styles.message} ${message.authorRole === "agronomist" ? styles.mine : ""}`}
            key={message.id}
          >
            <p className={styles.author}>
              <span>
                {message.authorName} · {ROLE_WORD[message.authorRole]}
              </span>
              <span className={styles.when}>{when(message.createdAt)}</span>
            </p>
            <p className={styles.body}>{message.body}</p>
            {message.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- файл из тома загрузок, а не из public
              <img className={styles.photo} src={message.photoUrl} alt="Фото к вопросу" />
            ) : null}
          </article>
        ))}
      </div>

      <div className={styles.form}>
        <Field id="reply" label="Дополнить вопрос" hint="Агроном увидит сообщение в этой же переписке">
          {(control) => (
            <textarea
              {...control}
              className={styles.textarea}
              value={reply}
              onChange={(event) => setReply(event.target.value)}
            />
          )}
        </Field>
        {error ? <ErrorState message={error} /> : null}
        <Button loading={sending} disabled={reply.trim().length === 0} onClick={send}>
          Отправить
        </Button>
      </div>
    </>
  );
}
