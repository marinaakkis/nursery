"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge, Button, EmptyState, ErrorState, InlineSuccess, Skeleton, Textarea } from "@/ui";
import styles from "./agronomist.module.css";

type QueueItem = {
  id: number;
  status: string;
  statusLabel: string;
  customerName: string;
  plantName: string | null;
  preview: string;
  hasPhoto: boolean;
  hasDraft: boolean;
};

type Message = {
  id: number;
  authorName: string;
  authorRole: string;
  body: string;
  photoUrl: string | null;
};

type Draft = { id: number; body: string; rationale: string; confidence: number };

type Detail = {
  id: number;
  statusLabel: string;
  status: string;
  customerName: string;
  plantId: number | null;
  plantName: string | null;
  messages: Message[];
  draft: Draft | null;
};

type Step = { tool: string; title: string; args: string; result: string };

const TONE: Record<string, "neutral" | "progress" | "success"> = {
  new: "neutral",
  in_progress: "progress",
  answered: "success",
};

export function AgronomistScreen({ initialQuestionId }: { initialQuestionId: number | null }) {
  const [queue, setQueue] = useState<QueueItem[] | null>(null);
  const [denied, setDenied] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [current, setCurrent] = useState<number | null>(null);
  // Вопрос из адреса открывается один раз; флаг в ref, а не в состоянии —
  // менять состояние из тела эффекта нельзя.
  const openedFromUrl = useRef(false);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const [askAbout, setAskAbout] = useState<string[]>([]);
  const [draftText, setDraftText] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [sent, setSent] = useState<string>("");

  const open = useCallback(async (questionId: number) => {
    setCurrent(questionId);
    setDetailLoading(true);
    setSteps([]);
    setAskAbout([]);
    setActionError("");
    setSent("");
    try {
      const payload = await fetch(`/api/consult/question?questionId=${questionId}`).then((r) => r.json());
      if (!payload.ok) {
        setDetail(null);
        setActionError(payload.error?.message ?? "Вопрос не открылся");
        return;
      }
      setDetail(payload.data);
      setDraftText(payload.data.draft?.body ?? "");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/consult/questions", { signal: controller.signal })
      .then((r) => r.json())
      .then((payload) => {
        if (payload.ok) {
          setQueue(payload.data);
          setDenied(false);
          setFailed(false);
          // Пришли по ссылке с номером вопроса — открываем его сразу.
          if (initialQuestionId !== null && !openedFromUrl.current) {
            openedFromUrl.current = true;
            void open(initialQuestionId);
          }
          return;
        }
        setQueue(null);
        setDenied(payload.error?.code === "forbidden");
        setFailed(payload.error?.code !== "forbidden");
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.error("очередь агронома: запрос не удался", error);
        setQueue(null);
        setFailed(true);
      });
    return () => controller.abort();
  }, [attempt, initialQuestionId, open]);


  async function act(action: "draft" | "approve" | "reject") {
    if (current === null) return;
    setBusy(true);
    setActionError("");
    try {
      const body: Record<string, unknown> = { questionId: current };
      if (action === "approve") body.editedText = draftText;

      const payload = await fetch(`/api/consult/${action}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => r.json());

      if (!payload.ok) {
        setActionError(payload.error?.message ?? "Не получилось");
        return;
      }

      // Перечитываем вопрос первым делом: open() сбрасывает трассу и подсказки,
      // поэтому результат текущего действия ставится после него, а не до.
      await open(current);
      setAttempt((n) => n + 1);

      if (action === "draft") {
        setSteps(payload.data.steps ?? []);
        setAskAbout(payload.data.askAbout ?? []);
        if (payload.data.draft) setDraftText(payload.data.draft.body);
        else setActionError(payload.data.refusal?.message ?? "Агент не взялся за разбор");
      }
      if (action === "approve") setSent("Ответ отправлен покупателю");
      if (action === "reject") {
        setDraftText("");
        setSent("Черновик отклонён — покупатель ничего не увидел");
      }
    } catch (error) {
      console.error("действие агронома не прошло", error);
      setActionError("Действие не прошло. Попробуйте ещё раз.");
    } finally {
      setBusy(false);
    }
  }

  if (denied) {
    return (
      <EmptyState
        title="Очередь видна агроному"
        description="Переключите пользователя в шапке на Ольгу — она отвечает на вопросы."
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
        message="Очередь не загрузилась. Попробуйте ещё раз — вопросы на месте."
        action={
          <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
            Повторить
          </Button>
        }
      />
    );
  }

  if (queue === null) return <Skeleton variant="block" count={4} label="Загружаем очередь" />;

  if (queue.length === 0) {
    return (
      <EmptyState
        title="Очередь пуста"
        description="Новые вопросы покупателей появятся здесь сразу после отправки."
        action={<span className="muted">Ждём вопросов</span>}
      />
    );
  }

  return (
    <div className={styles.layout}>
      <div className={styles.queue}>
        {queue.map((item) => (
          <button
            type="button"
            key={item.id}
            className={`${styles.item} ${current === item.id ? styles.itemCurrent : ""}`}
            onClick={() => open(item.id)}
            aria-current={current === item.id ? "true" : undefined}
          >
            <span className={styles.itemHead}>
              <span>{item.customerName}</span>
              <Badge tone={TONE[item.status] ?? "neutral"}>{item.statusLabel}</Badge>
            </span>
            <span className={styles.itemPreview}>{item.plantName ?? "Общий вопрос"}</span>
            <span className={styles.itemPreview}>{item.preview}</span>
            <span className={styles.itemPreview}>
              {item.hasPhoto ? "с фото · " : ""}
              {item.hasDraft ? "черновик готов" : "черновика нет"}
            </span>
          </button>
        ))}
      </div>

      <div>
        {current === null ? (
          <EmptyState
            title="Выберите вопрос"
            description="Слева очередь. Откройте вопрос — увидите переписку, фото и черновик агента."
            action={<span className="muted">Ничего не выбрано</span>}
          />
        ) : detailLoading ? (
          <Skeleton variant="block" count={3} label="Загружаем вопрос" />
        ) : detail === null ? (
          <ErrorState message={actionError || "Вопрос не открылся"} />
        ) : (
          <div className={styles.card}>
            <h2>{detail.plantName ?? "Общий вопрос"}</h2>
            <p className={styles.author}>
              {detail.customerName} · {detail.statusLabel}
              {detail.plantId ? (
                <>
                  {" · "}
                  <Link href={`/catalog/${detail.plantId}`}>карточка растения</Link>
                </>
              ) : null}
            </p>

            {detail.messages.map((message) => (
              <div className={styles.message} key={message.id}>
                <span className={styles.author}>
                  {message.authorName} · {message.authorRole === "customer" ? "покупатель" : "агроном"}
                </span>
                <p className={styles.body}>{message.body}</p>
                {message.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- файл из тома загрузок
                  <img className={styles.photo} src={message.photoUrl} alt="Фото к вопросу" />
                ) : null}
              </div>
            ))}

            <div className={styles.draft}>
              <p className={styles.draftHead}>
                <span>Черновик агента</span>
                {detail.draft ? (
                  <Badge tone="progress">уверенность {detail.draft.confidence} из 3</Badge>
                ) : null}
              </p>

              {detail.draft === null && steps.length === 0 ? (
                <>
                  <p className="muted">
                    Черновика ещё нет. Агент прочитает переписку и карточку растения и предложит
                    разбор — отправить его или нет, решаете вы.
                  </p>
                  <div className={styles.actions}>
                    <Button size="large" loading={busy} onClick={() => act("draft")}>
                      Подготовить черновик
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <label className="sr-only" htmlFor="draft-text">
                    Текст ответа покупателю
                  </label>
                  <Textarea
                    id="draft-text"
                    value={draftText}
                    onChange={(event) => setDraftText(event.target.value)}
                  />
                  <p className="muted">
                    Правьте прямо здесь: покупателю уйдёт то, что в этом поле, а не то, что
                    предложил агент.
                  </p>

                  {askAbout.length > 0 ? (
                    <>
                      <p className="muted">Агент советует уточнить:</p>
                      <ul className={styles.ask}>
                        {askAbout.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </>
                  ) : null}

                  <div className={styles.actions}>
                    <Button
                      size="large"
                      loading={busy}
                      disabled={draftText.trim().length === 0}
                      onClick={() => act("approve")}
                    >
                      Отправить покупателю
                    </Button>
                    <Button size="large" variant="secondary" loading={busy} onClick={() => act("draft")}>
                      Переписать заново
                    </Button>
                    <Button size="large" variant="ghost" loading={busy} onClick={() => act("reject")}>
                      Отклонить
                    </Button>
                  </div>
                </>
              )}

              {sent ? <InlineSuccess message={sent} /> : null}
              {actionError ? <ErrorState message={actionError} /> : null}

              {detail.draft || steps.length > 0 ? (
                <details className={styles.why}>
                  <summary className={styles.whyHead}>Что сделал агент и почему</summary>
                  {detail.draft ? <p className="muted">{detail.draft.rationale}</p> : null}
                  <ul className={styles.whyList}>
                    {steps.map((step, index) => (
                      <li key={index}>
                        <strong>{step.title}</strong>
                        <br />
                        <span className={styles.tool}>{step.tool}</span>
                        <br />
                        {step.args} → {step.result}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
