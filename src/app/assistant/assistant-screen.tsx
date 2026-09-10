"use client";

import Link from "next/link";
import { useState } from "react";
import {
  BrandMark,
  Button,
  Chip,
  Checkbox,
  ErrorState,
  InlineSuccess,
  Input,
  PlantPhoto,
  Skeleton,
} from "@/ui";
import type { AgentAnswer } from "@/agent/runner";
import { formatPrice } from "../catalog/filters";
import { askAgent, confirmAddToCart, confirmCreateOrder } from "./actions";
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
  /** Ключ одной попытки оформления: живёт до успеха, два нажатия дают один заказ. */
  orderKey: string | null;
  ordered: number | null;
  orderError: string | null;
};

/* Короткие: это подсказки ввода, а не готовые запросы. Длинная фраза
   в чипе не помещается на телефоне и читается как чужой текст. */
const EXAMPLES = ["тень и глина", "солнце, без ухода", "полутень, зона 4"];

export function AssistantScreen({ canAsk }: { canAsk: boolean }) {
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
      {
        id,
        request,
        answer: null,
        failure: null,
        chosen: [],
        added: null,
        addError: null,
        orderKey: null,
        ordered: null,
        orderError: null,
      },
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
                // Ключ рождается здесь, в обработчике ответа, а не при отрисовке:
                // при перерисовке он обязан остаться прежним.
                orderKey:
                  result.answer.kind === "checkout"
                    ? `agent-${id}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
                    : null,
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
  async function placeOrder(turn: Turn) {
    if (!turn.orderKey) return;
    setBusyTurn(turn.id);
    const result = await confirmCreateOrder(turn.orderKey);
    setBusyTurn(null);
    setTurns((prev) =>
      prev.map((t) =>
        t.id === turn.id
          ? result.ok
            ? {
                ...t,
                ordered: result.orderId,
                orderError: null,
                answer: t.answer
                  ? {
                      ...t.answer,
                      steps: [
                        ...t.answer.steps,
                        {
                          tool: "orders.create_order",
                          title: "Создал заказ",
                          args: result.step.args,
                          result: result.step.result,
                        },
                      ],
                    }
                  : t.answer,
              }
            : { ...t, orderError: result.message }
          : t,
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
    <div className={styles.chat}>
      {!canAsk ? (
        <div className={styles.warning} role="status">
          <strong>Помощник работает от лица покупателя.</strong> Выберите покупателя
          в шапке — кружок справа вверху, — и поле ввода разблокируется. Подбор идёт
          по его саду и его корзине, поэтому без покупателя он бессмыслен.
        </div>
      ) : null}

      <div className={styles.chatHead}>
        <span className={styles.chatTitle}>
          <BrandMark size={18} />
          AI-помощник
        </span>
        <span className={styles.chatNote}>
          Подбирает по каталогу. Заказ не оформляет — только по вашей кнопке.
        </span>
      </div>

      <div className={styles.feed}>
        {turns.length === 0 && !thinking ? (
          <div className={styles.theirs}>
            <span className={styles.avatarRow}>
              <span className={styles.avatar}>
                <BrandMark size={18} />
              </span>
              <span className={styles.who}>AI-помощник</span>
            </span>
            <p className={styles.hello}>
              Расскажите про участок: сколько света, какая зона или регион, сколько
              времени на уход. Можно одной фразой — я разберу её на условия и покажу,
              как понял.
            </p>
          </div>
        ) : null}

        {turns.map((turn) => (
          <div key={turn.id}>
            <p className={styles.mine}>
              <span className={styles.who}>вы</span>
              {turn.request}
            </p>

            <div className={styles.theirs}>
              <span className={styles.avatarRow}>
                <span className={styles.avatar}>
                  <BrandMark size={18} />
                </span>
                <span className={styles.who}>помощник по подбору</span>
              </span>

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
                          <span className={styles.pick} key={pick.plantId}>
                            <Checkbox
                              checked={turn.chosen.includes(pick.plantId)}
                              onChange={() => toggle(turn.id, pick.plantId)}
                              aria-label={`Взять: ${pick.nameRu}`}
                            >
                              <span className="sr-only">{pick.nameRu}</span>
                            </Checkbox>
                            <PlantPhoto
                              name={pick.nameRu}
                              photoUrl={pick.photoUrl}
                              variant="thumb"
                            />
                            <span className={styles.pickBody}>
                              <span className={styles.pickName}>
                                <Link href={`/catalog/${pick.plantId}`}>{pick.nameRu}</Link>
                              </span>
                              <span className={styles.pickLatin}>{pick.nameLat}</span>
                              <span className={styles.pickWhy}>{pick.why}</span>
                              {pick.relaxedBy ? (
                                <span className={styles.relaxed}>
                                  не точное совпадение: допущено «{pick.relaxedBy}»
                                </span>
                              ) : null}
                              <span className={styles.pickPrice}>
                                {formatPrice(pick.priceCents)} · в наличии {pick.available}
                              </span>
                            </span>
                          </span>
                        ))}
                      </div>

                      <div className={styles.actions}>
                        {turn.added === null ? (
                          <Button
                            size="large"
                            fullWidth
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
                              <Button size="large" variant="secondary">
                                Перейти к оформлению
                              </Button>
                            </Link>
                          </>
                        )}
                        {turn.addError ? <ErrorState message={turn.addError} /> : null}
                      </div>
                    </>
                  ) : null}

                  {turn.answer.kind === "checkout" && turn.answer.checkout ? (
                    <>
                      <ul className={styles.summary}>
                        {turn.answer.checkout.lines.map((line) => (
                          <li key={line.nameRu}>
                            <span>
                              {line.nameRu}
                              {line.quantity > 1 ? ` · ${line.quantity} шт.` : ""}
                            </span>
                            <span className={styles.summarySum}>{formatPrice(line.sumCents)}</span>
                          </li>
                        ))}
                        <li className={styles.summaryTotal}>
                          <span>Итого, самовывоз</span>
                          <span>{formatPrice(turn.answer.checkout.totalCents)}</span>
                        </li>
                      </ul>

                      <div className={styles.actions}>
                        {turn.ordered === null ? (
                          <>
                            <Button
                              size="large"
                              fullWidth
                              loading={busyTurn === turn.id}
                              onClick={() => placeOrder(turn)}
                            >
                              Подтвердить заказ
                            </Button>
                            <p className="muted">
                              Оплата тестовая, деньги не списываются. Заказ создастся только
                              по этой кнопке.
                            </p>
                          </>
                        ) : (
                          <>
                            <InlineSuccess message={`Заказ №${turn.ordered} создан`} />
                            <Link href={`/orders/${turn.ordered}`}>
                              <Button size="large" variant="secondary">
                                Открыть заказ
                              </Button>
                            </Link>
                          </>
                        )}
                        {turn.orderError ? <ErrorState message={turn.orderError} /> : null}
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

      <div className={styles.composer}>
        {/* Примеры — чипами над полем: показать, на каком языке с ним говорить,
            дешевле, чем объяснить это словами. Внутри пузыря им не место:
            это не реплика, а подсказка ввода. */}
        {turns.length === 0 ? (
          <div className={styles.examples}>
            {EXAMPLES.map((example) => (
              <Chip key={example} pressed={false} onToggle={() => send(example)}>
                {example}
              </Chip>
            ))}
          </div>
        ) : null}

        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault();
            send(draft);
          }}
        >
          <label className="sr-only" htmlFor="agent-request">
            Что подобрать
          </label>
          <Input
            id="agent-request"
            value={draft}
            disabled={!canAsk}
            placeholder={canAsk ? "тень, зона 4, без ухода" : "сначала выберите покупателя в шапке"}
            onChange={(event) => setDraft(event.target.value)}
          />
          <Button type="submit" loading={thinking} disabled={!canAsk || draft.trim().length === 0}>
            Отправить
          </Button>
        </form>
      </div>

    </div>
  );
}
