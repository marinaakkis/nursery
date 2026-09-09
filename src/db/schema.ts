// Агрегатор схем для drizzle-kit: миграции генерируются по этому файлу.
// Сами таблицы живут в модулях — src/modules/<name>/schema.ts.
export * from "./shared-schema";
export * from "@/modules/catalog/schema";
export * from "@/modules/warehouse/schema";
export * from "@/modules/orders/schema";
export * from "@/modules/garden/schema";
export * from "@/modules/consult/schema";
