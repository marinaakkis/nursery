/** Применение миграций из ./drizzle. Запускается при старте контейнера до сида. */
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { getDb, getSql } from "@/db/client";

async function run() {
  await migrate(getDb(), { migrationsFolder: "./drizzle" });
  console.log("миграции применены");
  await getSql().end();
}

run().catch(async (error) => {
  console.error("миграции упали:", error);
  await getSql().end();
  process.exit(1);
});
