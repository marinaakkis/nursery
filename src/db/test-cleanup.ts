import { sql } from "drizzle-orm";
import { getDb } from "./client";

/**
 * Уборка служебных записей интеграционных тестов.
 *
 * Тесты создают растения, партии, пользователей и заказы в той же базе, где
 * лежат демо-данные. Раньше каждый файл убирал за собой сам, собирая
 * идентификаторы в массив, — и один раз это не сработало: шесть служебных
 * растений остались в каталоге и попали на экран покупателю.
 *
 * Две причины, обе устранены здесь:
 *
 * 1. Уборка шла одним списком операций. Первое же исключение — например,
 *    внешний ключ, о котором не подумали, — обрывало остальные, и часть
 *    записей оставалась. Теперь каждый шаг независим.
 * 2. Уборка опиралась на массив идентификаторов, собранный по ходу теста.
 *    Прерванный прогон терял массив вместе с процессом. Теперь удаление идёт
 *    по признаку в самих данных: служебная запись видна в базе, а не в памяти.
 */

/** Признак служебной записи. Символ редкий намеренно: демо-данные его не содержат. */
export const TEST_MARK = "⟦тест⟧";

/** Имя для служебной записи: `имя(«партия»)` → `⟦тест⟧ партия 1789…` */
export const testName = (what: string): string =>
  `${TEST_MARK} ${what} ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

/** Порядок важен: сначала то, что ссылается, потом то, на что ссылаются. */
const STEPS: { what: string; run: string }[] = [
  {
    what: "отметки ухода",
    run: `delete from care_events where garden_plant_id in (
            select gp.id from garden_plants gp join users u on u.id = gp.customer_id
            where u.name like $1)`,
  },
  { what: "сад", run: `delete from garden_plants where customer_id in (select id from users where name like $1)` },
  {
    what: "черновики ответов",
    run: `delete from answer_drafts where question_id in (
            select q.id from questions q join users u on u.id = q.customer_id where u.name like $1)`,
  },
  {
    what: "сообщения",
    run: `delete from messages where question_id in (
            select q.id from questions q join users u on u.id = q.customer_id where u.name like $1)`,
  },
  { what: "вопросы", run: `delete from questions where customer_id in (select id from users where name like $1)` },
  {
    what: "резервы",
    run: `delete from order_reservations where order_id in (
            select o.id from orders o join users u on u.id = o.customer_id where u.name like $1)`,
  },
  {
    what: "история статусов",
    run: `delete from order_status_history where order_id in (
            select o.id from orders o join users u on u.id = o.customer_id where u.name like $1)`,
  },
  {
    what: "позиции заказов",
    run: `delete from order_items where order_id in (
            select o.id from orders o join users u on u.id = o.customer_id where u.name like $1)`,
  },
  { what: "заказы", run: `delete from orders where customer_id in (select id from users where name like $1)` },
  { what: "корзины", run: `delete from cart_items where customer_id in (select id from users where name like $1)` },
  { what: "уведомления", run: `delete from notifications where user_id in (select id from users where name like $1)` },
  {
    what: "списания",
    run: `delete from write_offs where batch_id in (
            select b.id from batches b join plants p on p.id = b.plant_id where p.name_ru like $1)`,
  },
  { what: "факты спроса", run: `delete from demand_facts where plant_id in (select id from plants where name_ru like $1)` },
  { what: "позиции по служебным растениям", run: `delete from order_items where plant_id in (select id from plants where name_ru like $1)` },
  { what: "партии", run: `delete from batches where plant_id in (select id from plants where name_ru like $1)` },
  { what: "правила ухода", run: `delete from care_rules where plant_id in (select id from plants where name_ru like $1)` },
  { what: "сад по служебным растениям", run: `delete from garden_plants where plant_id in (select id from plants where name_ru like $1)` },
  { what: "растения", run: `delete from plants where name_ru like $1` },
  { what: "пользователи", run: `delete from users where name like $1` },
];

/**
 * Убирает все служебные записи. Каждый шаг в своём try: сбой одного не должен
 * оставлять мусор после остальных. Возвращает список шагов, которые не прошли.
 */
export async function cleanupTestRows(): Promise<string[]> {
  const db = getDb();
  const pattern = `${TEST_MARK}%`;
  const failed: string[] = [];

  for (const step of STEPS) {
    try {
      await db.execute(sql.raw(step.run.replace(/\$1/g, `'${pattern}'`)));
    } catch (error) {
      failed.push(step.what);
      console.error(`уборка теста: не удалось удалить ${step.what}`, error);
    }
  }
  return failed;
}

/** Сколько служебных записей осталось. Ноль — уборка отработала. */
export async function countTestRows(): Promise<{ plants: number; users: number }> {
  const db = getDb();
  const pattern = `${TEST_MARK}%`;
  const [plants] = await db.execute<{ n: number }>(
    sql.raw(`select count(*)::int as n from plants where name_ru like '${pattern}'`),
  );
  const [users] = await db.execute<{ n: number }>(
    sql.raw(`select count(*)::int as n from users where name like '${pattern}'`),
  );
  return { plants: Number(plants?.n ?? 0), users: Number(users?.n ?? 0) };
}
