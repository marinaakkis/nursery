import Link from "next/link";
import { demoPlants } from "@/db/demo-plants";
import { ALL_PHOTOS, HOME_PHOTOS } from "@/lib/photo-credits";
import styles from "./credits.module.css";

export const metadata = { title: "Фотографии: авторы и лицензии" };

/** Русское название по латинскому: список ассортимента и словарь снимков
 *  ключуются одинаково — латынью, поэтому сопоставление однозначно. */
const PLANT_NAMES: Record<string, string> = Object.fromEntries(
  demoPlants.map((plant) => [plant.nameLat, plant.nameRu]),
);

/**
 * Одна страница на весь продукт вместо подписи под каждым снимком.
 *
 * Лицензии CC BY и CC BY-SA требуют указать автора — но не требуют делать
 * это на той же странице, где стоит снимок. Достаточно, чтобы указание было
 * доступно оттуда: ссылка «Фото и лицензии» стоит в подвале каждой страницы.
 * Так требование выполнено, а карточка растения не превращается в выходные
 * данные фотоальбома.
 */
export default function CreditsPage() {
  const plants = Object.entries(ALL_PHOTOS).sort(([a], [b]) => a.localeCompare(b));
  const home = Object.entries(HOME_PHOTOS);

  return (
    <main className="page pageWide">
      <h1>Фотографии: авторы и лицензии</h1>
      <p className={`${styles.lead} prose`}>
        Снимки взяты с Wikimedia Commons и используются на условиях указанных лицензий.
        Автор указан для каждого файла, ссылка ведёт на страницу файла с полным текстом
        лицензии. Если вы автор снимка и хотите, чтобы мы его убрали, напишите нам.
      </p>

      <h2>Растения</h2>
      <div className={styles.scroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Растение</th>
              <th>Автор</th>
              <th>Лицензия</th>
              <th>Источник</th>
            </tr>
          </thead>
          <tbody>
            {plants.map(([nameLat, photo]) => (
              <tr key={nameLat}>
                <td>
                  {PLANT_NAMES[nameLat] ?? "—"}
                  <br />
                  <span className={styles.latin}>{nameLat}</span>
                </td>
                <td>{photo.author}</td>
                <td>{photo.license}</td>
                <td>
                  <a href={photo.url} target="_blank" rel="noreferrer noopener">
                    файл на Commons
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className={styles.second}>Снимки главной страницы</h2>
      <div className={styles.scroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Снимок</th>
              <th>Автор</th>
              <th>Лицензия</th>
              <th>Источник</th>
            </tr>
          </thead>
          <tbody>
            {home.map(([key, photo]) => (
              <tr key={key}>
                <td>{photo.src.split("/").pop()}</td>
                <td>{photo.author}</td>
                <td>{photo.license}</td>
                <td>
                  <a href={photo.url} target="_blank" rel="noreferrer noopener">
                    файл на Commons
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className={styles.back}>
        <Link href="/catalog">← В каталог</Link>
      </p>
    </main>
  );
}
