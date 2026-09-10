import Image from "next/image";
import Link from "next/link";
import { Button } from "@/ui";
import { HOME_PHOTOS } from "@/lib/photo-credits";
import styles from "./home.module.css";
import { InStock } from "./in-stock";

const TILES = [
  { name: "Для тени", note: "Северная сторона, под деревьями", href: "/catalog?light=shade" },
  { name: "Для солнца", note: "Открытое место, южный склон", href: "/catalog?light=sun" },
  { name: "Без ухода", note: "Полить раз в две недели — и всё", href: "/catalog?care=low" },
  { name: "Цветёт долго", note: "С июля до заморозков", href: "/catalog?care=medium" },
];

const STEPS = [
  {
    title: "Выбрать",
    text: "Отберите растения фильтрами или опишите участок словами — помощник подберёт сам и объяснит выбор.",
  },
  {
    title: "Получить",
    text: "Самовывоз из питомника в Юкках или доставка в выбранный интервал. Оплата при получении.",
  },
  {
    title: "Ухаживать",
    text: "После покупки растения попадают в «Мой сад» с календарём: когда полить, когда подкормить, когда обрезать.",
  },
];

const FACTS = [
  {
    number: "Зона 3–4",
    text: "Мы не продаём то, что у нас не зимует. Каждое растение в каталоге пережило зиму на наших полях, а не только в описании поставщика.",
  },
  {
    number: "9 лет",
    text: "Столько мы выращиваем под Петербургом. За это время из ассортимента вылетело всё, что требовало укрытия каждый ноябрь.",
  },
  {
    number: "Своя школка",
    text: "Саженцы доращиваем сами, а не перепродаём с юга. Растение из южного питомника в первую же зиму теряет половину прироста.",
  },
];

/** Подпись к снимку: CC BY и CC BY-SA требуют указания автора. */
export default function HomePage() {
  const hero = HOME_PHOTOS.garden;
  const seedling = HOME_PHOTOS.seedling;
  const greenhouse = HOME_PHOTOS.greenhouse;

  return (
    <main className={styles.wide}>
      <section className={styles.hero}>
        <Image
          className={styles.heroPhoto}
          src={hero.src}
          alt="Ряды саженцев в питомнике"
          fill
          sizes="(max-width: 1120px) 100vw, 1120px"
          priority
        />
        {/* Текст лежит на плотной подложке: контраст поверх снимка иначе не гарантирован. */}
        <div className={styles.heroText}>
          <h1 className={styles.heroTitle}>Растения, которые переживут нашу зиму</h1>
          <p className={styles.heroLead}>
            Питомник в Ленинградской области. Саженцы и рассада для зоны 3–4 — с календарём
            ухода и помощником, который подберёт набор под ваш участок.
          </p>
          <div className={styles.heroActions}>
            <Link href="/assistant">
              <Button size="large">Подобрать растения с помощником</Button>
            </Link>
            <Link href="/catalog">
              <Button size="large" variant="secondary">
                В каталог
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h2>С чего начать</h2>
        <div className={styles.tiles}>
          {TILES.map((tile) => (
            <Link className={styles.tile} href={tile.href} key={tile.name}>
              <span className={styles.tileName}>{tile.name}</span>
              <span className={styles.tileNote}>{tile.note}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2>Сейчас в наличии</h2>
          <Link className={styles.more} href="/catalog">
            Весь каталог
          </Link>
        </div>
        <InStock />
      </section>

      <section className={styles.section}>
        <h2>Как это работает</h2>
        <div className={styles.split}>
          <div>
            <div className={styles.splitPhoto}>
              <Image
                src={seedling.src}
                alt="Руки высаживают саженец в землю"
                fill
                sizes="(max-width: 700px) 100vw, 40vw"
              />
            </div>
          </div>
          <ol className={styles.steps}>
          {STEPS.map((step, index) => (
            <li className={styles.step} key={step.title}>
              <span className={styles.stepNumber} aria-hidden="true">
                {index + 1}
              </span>
              <p className={styles.stepTitle}>{step.title}</p>
              <p className={styles.stepText}>{step.text}</p>
            </li>
            ))}
          </ol>
        </div>
      </section>

      <section className={styles.section}>
        {/* Вопрос агроному ушёл из шапки: это не раздел, куда ходят каждый день,
            а действие по случаю. Здесь оно на своём месте — рядом с рассказом
            о том, как всё устроено. */}
        <div className={styles.ask}>
          <div>
            <h2>Есть вопрос к агроному?</h2>
            <p className={styles.askText}>
              Пришлите фото и опишите, что происходит с растением. Ответит живой агроном —
              помощник только готовит ему разбор.
            </p>
          </div>
          <Link className={styles.askAction} href="/questions">
            <Button size="large">Задать вопрос</Button>
          </Link>
        </div>
      </section>

      <section className={styles.section}>
        <h2>Почему мы</h2>
        {/* Фото во всю ширину, три факта строкой под ним: столбиком справа
            они читались как подпись к снимку, а не как самостоятельный довод. */}
        <div className={styles.splitPhoto}>
          <Image
            src={greenhouse.src}
            alt="Оранжерея Ботанического института в Петербурге"
            fill
            sizes="(max-width: 900px) 100vw, 900px"
          />
        </div>
        <ul className={styles.facts}>
          {FACTS.map((fact) => (
            <li className={styles.fact} key={fact.number}>
              <p className={styles.factNumber}>{fact.number}</p>
              <p className={styles.stepText}>{fact.text}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
