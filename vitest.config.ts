import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    /*
     * Файлы идут последовательно. Интеграционные тесты работают против одной
     * базы: при параллельном запуске уборка одного файла сносит данные другого,
     * а проверки на гонку за остатком перестают быть воспроизводимыми.
     * Скорость здесь дешевле правдивости.
     */
    fileParallelism: false,
  },
});
