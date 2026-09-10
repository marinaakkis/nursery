"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  ActionBar,
  Badge,
  Button,
  Card,
  CardBody,
  Chip,
  EmptyState,
  ErrorState,
  PlantPhoto,
  Sheet,
  Skeleton,
} from "@/ui";
import styles from "./catalog.module.css";
import { byStockThenName } from "./sort";
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
  photoUrl: string | null;
  priceCents: number;
};

type Stock = { plantId: number; available: number; low: boolean };

type Loaded = { total: number; items: PlantListItem[] };
/** Что уже загружено и для какого запроса. Фаза экрана не хранится отдельным
 *  состоянием: она вычисляется сравнением ключа — «загружаем» это производное,
 *  а не эффект. Разбор — memory/mistakes/2026-09-10-setstate-v-effekte.md. */
type Loadout = { key: string; data: Loaded | null; stock: Map<number, Stock> };

/** Бейдж наличия поверх подложки. У растения, которого хватает, бейджа нет:
 *  «есть в наличии» на каждой карточке — шум, а не информация. */
function stockBadge(stock: Stock | undefined) {
  if (!stock) return null;
  if (stock.available === 0) return <Badge tone="danger">Нет в наличии</Badge>;
  if (stock.low) return <Badge tone="warning">Осталось {stock.available}</Badge>;
  return null;
}

/** Группы чипов. Один и тот же список рисуется и в боковой панели на широком
 *  экране, и в шите на телефоне — отличается только тем, куда уходит нажатие. */
function FacetGroups({
  value,
  onToggle,
}: {
  value: Selection;
  onToggle: (key: FacetKey, option: string) => void;
}) {
  return (
    <>
      {FACETS.map((facet) => (
        <div className={styles.facet} key={facet.key}>
          <p className={styles.facetName}>{facet.title}</p>
          <div className={styles.chips}>
            {facet.options.map((option) => (
              <Chip
                key={option.value}
                pressed={value[facet.key] === option.value}
                onToggle={() => onToggle(facet.key, option.value)}
              >
                {option.label}
              </Chip>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}


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
      .then(async (payload: { ok: boolean; data?: Loaded }) => {
        if (!payload.ok || !payload.data) throw new Error("catalog request failed");
        const items = payload.data.items;

        // Остатки на всю выдачу одним запросом, а не по растению на карточку.
        const stock = new Map<number, Stock>();
        if (items.length > 0) {
          const ids = items.map((plant) => plant.id).join(",");
          const answer = await fetch(`/api/warehouse/stocks?plantIds=${ids}`, {
            signal: controller.signal,
          })
            .then((response) => response.json())
            .catch(() => ({ ok: false }));

          if (answer.ok) for (const row of answer.data as Stock[]) stock.set(row.plantId, row);
        }

        setLoadout({
          key: requestKey,
          // Порядок: сначала то, что можно купить, потом остатки, в конце
          // закончившееся; внутри группы — по алфавиту.
          data: {
            ...payload.data,
            items: byStockThenName(
              items.map((plant) => ({ ...plant, available: stock.get(plant.id)?.available })),
            ),
          },
          stock,
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.error("catalog: не удалось загрузить выдачу", error);
        setLoadout({ key: requestKey, data: null, stock: new Map() });
      });

    return () => controller.abort();
  }, [query, requestKey]);

  const settled = loadout?.key === requestKey ? loadout : null;
  const loading = settled === null;
  const failed = settled !== null && settled.data === null;
  const result = settled?.data ?? null;
  const stock = settled?.stock ?? new Map<number, Stock>();

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
      <p className={styles.intro}>Проверенный ассортимент для зоны 3–4. Отберите то, что приживётся именно у вас.</p>

      <div className={styles.layout}>
        <aside className={styles.panel} aria-label="Фильтры">
          <FacetGroups
            value={selection}
            onToggle={(key, option) => {
              // В панели фильтр применяется сразу: черновик и кнопка «Показать»
              // нужны шиту, который перекрывает выдачу, а панель её не прячет.
              const next: Selection = { ...selection };
              if (next[key] === option) delete next[key];
              else next[key] = option;
              apply(next);
            }}
          />
        </aside>

        <div className={styles.results}>
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
          title={appliedCount > 0 ? "Слишком узко" : "Каталог наполняется"}
          description={
            appliedCount > 0
              ? "Под такой участок в продаже сейчас пусто. Снимите одно условие — скорее всего, зону: она отсекает больше всего."
              : "Новая партия приезжает каждую неделю. Загляните через пару дней."
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
              <Card
                key={plant.id}
                href={`/catalog/${plant.id}`}
                dimmed={stock.get(plant.id)?.available === 0}
              >
                <PlantPhoto
                  photoUrl={plant.photoUrl}
                  name={plant.nameRu}
                  dimmed={stock.get(plant.id)?.available === 0}
                  overlay={stockBadge(stock.get(plant.id))}
                />
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

        </div>
      </div>

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
        <FacetGroups value={draft} onToggle={toggleDraft} />
      </Sheet>
    </>
  );
}
