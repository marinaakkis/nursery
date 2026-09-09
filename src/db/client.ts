import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

// Подключение создаётся лениво: сборка не должна падать из-за отсутствия DATABASE_URL.
let sql: ReturnType<typeof postgres> | null = null;

export function getSql() {
  if (!sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL не задан");
    sql = postgres(url, { max: 5 });
  }
  return sql;
}

export function getDb() {
  return drizzle(getSql());
}
