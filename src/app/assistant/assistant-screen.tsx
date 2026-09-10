"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, EmptyState, ErrorState, Field, InlineSuccess, Input, Skeleton } from "@/ui";
import type { AgentAnswer } from "@/agent/runner";
import { formatPrice } from "../catalog/filters";
import { askAgent, confirmAddToCart } from "./actions";
import styles from "./assistant.module.css";

type Turn = {
  id: number;
  request: string;
  answer: AgentAnswer | null;
  failure: string | null;
  /** Что выбрано галочками для добавления; заполняется до подтверждения. */
  chosen: number[];
  added: { count: number; totalCents: number } | null;
  addError: string | null;
};

const EXAMPLES = [
  "тень, глина, север, цветение всё лето, без ухода по будням",
  "солнечный участок в Подмосковье, сажать весной",
  "полутень, зона 5, готов ухаживать",
];

export function AssistantScreen() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const [busyTurn, setBusyTurn] = useState<number | null>(null);

  async function send(text: string) {
    const request = text.trim();
    if (request.length === 0) return;

    const id = turns.length + 1;
    setDraft("");
    setThinking(true);
    setTurns((prev) => [
      ...prev,
      { id, request, answer: null, failure: null, chosen: [], added: null, addError: null },
    ]);

    const result = await askAgent(request);
    setThinking(false);
    setTurns((prev) =>
      prev.map((turn) =>
        turn.id === id
          ? result.ok
            ? {
                ...turn,
                answer: result.answer,
                chosen: result.answer.suggestions.map((s) => s.plantId),
              }
            : { ...turn, failure: result.message }
          : turn,
      ),
    );
  }

  function toggle(turnId: number, plantId: number) {
    setTurns((prev) =>
      prev.map((turn) =>
        turn.id === turnId
          ? {
              ...turn,
              chosen: turn.chosen.includes(plantId)
                ? turn.chosen.filter((id) => id !== plantId)
                : [...turn.chosen, plantId],
            }
          : turn,
      ),
    );
  }

  /** Необратимое — только отсюда: обработчик кнопки, не текст запроса. */
  async function addChosen(turn: Turn) {
    setBusyTurn(turn.id);
    const result = await confirmAddToCart(turn.chosen);
    setBusyTurn(null);
    setTurns((prev) =>
      prev.map((t) =>
        t.id === turn.id
          ? result.ok
            ? {
                ...t,
                added: { count: result.added, totalCents: result.totalCents },
                addError: null,
                answer: t.answer
                  ? {
                      ...t.answer,
                      steps: [
                        ...t.answer.steps,
                        {
                          tool: "orders.add_to_cart",
                          title: "Положил в корзину",
                          args: result.step.args,
                          result: result.step.result,
                        },
                      ],
                    }
                  : t.answer,
              }
            : { ...t, addError: result.message }
          : t,
      ),
    );
  }

  return (
    <>
      <p className={styles.intro}>
        Опишите участок словами — агент подберёт растения по каталогу и объяснит, почему эти.
        Заказ он не оформляет: в корзину кладёт только по вашей кнопке.
      </p>

      {turns.length === 0 && !thinking ? (
        <EmptyState
          title="Расскажите про участок"
          description="Сколько света, какая зона или регион, сколько времени на уход. Можно одной фразой — агент разберёт её на условия."
          action={
            <div className={styles.actions}>
              {EXAMPLES.map((example) => (
                <Button key={example} variant="secondary" onClick={() => send(example)}>
                  {example}
                </Button>
              ))}
            </div>
          }
        />
      ) : null}

      <div className={styles.feed}>
        {turns.map((turn) => (
          <div key={turn.id}>
            <p className={styles.mine}>
              <span className={styles.who}>вы</span>
              {turn.request}
            </p>

            <div className={styles.theirs}>
              <span className={styles.who}>агент подбора</span>

              {turn.answer === null && turn.failure === null ? (
                <Skeleton variant="text" count={2} label="Агент подбирает растения" />
              ) : null}

              {turn.failure !== null ? (
                <ErrorState
                  message={turn.failure}
                  action={
                    <Button variant="secondary" onClick={() => send(turn.request)}>
                      Повторить
                    </Button>
                  }
                />
              ) : null}

              {turn.answer !== null ? (
                <>
                  <p className={styles.text}>{turn.answer.message}</p>
                  {turn.answer.hint ? <p className={styles.hint}>{turn.answer.hint}</p> : null}

                  {turn.answer.suggestions.length > 0 ? (
                    <>
                      <div className={styles.picks}>
                        {turn.answer.suggestions.map((pick) => (
                          <label className={styles.pick} key={pick.plantId}>
                            <input
                              type="checkbox"
                              checked={turn.chosen.includes(pick.plantId)}
                              onChange={() => toggle(turn.id, pick.plantId)}
                              aria-label={`Взять: ${pick.nameRu}`}
                            />
                            <span className={styles.pickBody}>
                              <span className={styles.pickName}>
                                <Link href={`/catalog/${pick.plantId}`}>{pick.nameRu}</Link>
                              </span>
                              <span className={styles.pickLatin}>{pick.nameLat}</span>
                              <span className={styles.pickWhy}>{pick.why}</span>
                              <span className={styles.pickPrice}>
                                {formatPrice(pick.priceCents)} · в наличии {pick.available}
                              </span>
                            </span>
                          </label>
                        ))}
                      </div>

                      <div className={styles.actions}>
                        {turn.added === null ? (
                          <Button
                            loading={busyTurn === turn.id}
                            disabled={turn.chosen.length === 0}
                            onClick={() => addChosen(turn)}
                          >
                            Добавить в корзину · {turn.chosen.length}
                          </Button>
                        ) : (
                          <>
                            <InlineSuccess
                              message={`В корзине ${turn.added.count} шт. на ${formatPrice(turn.added.totalCents)}`}
                            />
                            <Link href="/checkout">
                              <Button variant="secondary">Перейти к оформлению</Button>
                            </Link>
                          </>
                        )}
                        {turn.addError ? <ErrorState message={turn.addError} /> : null}
                      </div>
                    </>
                  ) : null}

                  {turn.answer.steps.length > 0 ? (
                    <details className={styles.trace}>
                      <summary className={styles.traceHead}>
                        Что сделал агент — {turn.answer.steps.length} шаг(ов)
                      </summary>
                      <ul className={styles.traceList}>
                        {turn.answer.steps.map((step, index) => (
                          <li key={`${step.tool}-${index}`}>
                            <div>{step.title}</div>
                            <div className={styles.tool}>{step.tool}</div>
                            <div className="muted">
                              {step.args} → {step.result}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                </>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          send(draft);
        }}
      >
        <Field id="agent-request" label="Что подобрать" required>
          {(control) => (
            <Input
              {...control}
              value={draft}
              placeholder="тень, зона 4, без ухода"
              onChange={(event) => setDraft(event.target.value)}
            />
          )}
        </Field>
        <Button type="submit" loading={thinking} disabled={draft.trim().length === 0}>
          Спросить агента
        </Button>
      </form>

      <p className={styles.stub}>
        Подбор считается правилами на сервере, без обращения к внешней модели —
        так демо работает одинаково и без сети.
      </p>
    </>
  );
}
