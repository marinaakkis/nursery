"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  ActionBar,
  Button,
  Card,
  CardBody,
  CardPhoto,
  Chip,
  EmptyState,
  ErrorState,
  Sheet,
  Skeleton,
} from "@/ui";
import styles from "./catalog.module.css";
import {
  FACETS,
  formatPrice,
  labelOf,
  plantsWord,
  readSelection,
  toQuery,
  type FacetKey,
  type Selection,
} from "./filters";

type PlantListItem = {
  id: number;
  nameRu: string;
  nameLat: string;
  priceCents: number;
};

type Loaded = { total: number; items: PlantListItem[] };
/** Что уже загружено и для какого запроса. Фаза экрана не хранится отдельным
 *  состоянием: она вычисляется сравнением ключа — «загружаем» это производное,
 *  а не эффект. Разбор — memory/mistakes/2026-09-10-setstate-v-effekte.md. */
type Loadout = { key: string; data: Loaded | null };

export function CatalogScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const query = params.toString();
  const selection = readSelection(new URLSearchParams(query));
  const appliedCount = Object.keys(selection).length;

  const [loadout, setLoadout] = useState<Loadout | null>(null);
  const [attempt, setAttempt] = useState(0);
  const requestKey = `${query}#${attempt}`;
  const [sheetOpen, setSheetOpen] = useState(false);
  // Пока шит открыт, выбор живёт черновиком: фильтры применяются одним действием.
  const [draft, setDraft] = useState<Selection>(selection);

  useEffect(() => {
    const controller = new AbortController();

    fetch(`/api/catalog/plants?${query}`, { signal: controller.signal })
      .then((response) => response.json())
      .then((payload: { ok: boolean; data?: Loaded }) => {
        if (!payload.ok || !payload.data) throw new Error("catalog request failed");
        setLoadout({ key: requestKey, data: payload.data });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.error("catalog: не удалось загрузить выдачу", error);
        setLoadout({ key: requestKey, data: null });
      });

    return () => controller.abort();
  }, [query, requestKey]);

  const settled = loadout?.key === requestKey ? loadout : null;
  const loading = settled === null;
  const failed = settled !== null && settled.data === null;
  const result = settled?.data ?? null;

  const apply = useCallback(
    (next: Selection) => {
      const nextQuery = toQuery(next);
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
    },
    [pathname, router],
  );

  const removeFilter = (key: FacetKey) => {
    const next = { ...selection };
    delete next[key];
    apply(next);
  };

  const openSheet = () => {
    setDraft(selection);
    setSheetOpen(true);
  };

  /** Повторное нажатие снимает значение: в каждой группе выбирается одно. */
  const toggleDraft = (key: FacetKey, value: string) => {
    setDraft((current) => {
      const next = { ...current };
      if (next[key] === value) delete next[key];
      else next[key] = value;
      return next;
    });
  };

  return (
    <>
      <p className={styles.intro}>Подберите растения под свет, зону и сезон вашего участка.</p>

      <div className={styles.bar}>
        <Button variant="secondary" onClick={openSheet}>
          {appliedCount > 0 ? `Фильтры · ${appliedCount}` : "Фильтры"}
        </Button>

        {appliedCount > 0 ? (
          <div className={styles.applied}>
            {(Object.keys(selection) as FacetKey[]).map((key) => (
              <Chip
                key={key}
                removable
                removeLabel={`${FACETS.find((f) => f.key === key)?.subject} — ${labelOf(key, selection[key] as string).toLowerCase()}`}
                onRemove={() => removeFilter(key)}
              >
                {labelOf(key, selection[key] as string)}
              </Chip>
            ))}
          </div>
        ) : null}
      </div>

      {loading ? (
        <Skeleton variant="card" count={4} label="Загружаем каталог" />
      ) : null}

      {failed ? (
        <ErrorState
          message="Каталог не отвечает. Попробуйте ещё раз — фильтры сохранятся."
          action={
            <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
              Повторить
            </Button>
          }
        />
      ) : null}

      {result !== null && result.items.length === 0 ? (
        <EmptyState
          title="Под эти условия ничего нет"
          description={
            appliedCount > 0
              ? "Набор фильтров слишком узкий: под такой участок в продаже сейчас пусто. Снимите последний фильтр — выдача расширится."
              : "В каталоге сейчас нет активных растений. Загляните позже — поступления бывают каждую неделю."
          }
          action={
            appliedCount > 0 ? (
              <Button variant="secondary" onClick={() => apply({})}>
                Снять все фильтры
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
                Обновить
              </Button>
            )
          }
        />
      ) : null}

      {result !== null && result.items.length > 0 ? (
        <>
          <p className={styles.total}>
            {result.total} {plantsWord(result.total)}
          </p>
          <div className={styles.grid}>
            {result.items.map((plant) => (
              <Card key={plant.id} href={`/catalog/${plant.id}`}>
                <CardPhoto />
                <CardBody>
                  <span className={styles.name}>{plant.nameRu}</span>
                  <span className={styles.latin}>{plant.nameLat}</span>
                  <span className={styles.price}>{formatPrice(plant.priceCents)}</span>
                </CardBody>
              </Card>
            ))}
          </div>
        </>
      ) : null}

      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Фильтры"
        footer={
          <ActionBar>
            <Button
              fullWidth
              onClick={() => {
                apply(draft);
                setSheetOpen(false);
              }}
            >
              Показать растения
            </Button>
          </ActionBar>
        }
      >
        {FACETS.map((facet) => (
          <div className={styles.facet} key={facet.key}>
            <p className={styles.facetName}>{facet.title}</p>
            <div className={styles.chips}>
              {facet.options.map((option) => (
                <Chip
                  key={option.value}
                  pressed={draft[facet.key] === option.value}
                  onToggle={() => toggleDraft(facet.key, option.value)}
                >
                  {option.label}
                </Chip>
              ))}
            </div>
          </div>
        ))}
      </Sheet>
    </>
  );
}
