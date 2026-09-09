import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

// Линтуем только собственный код приложения: .githooks и scripts — файлы шаблона,
// их правила и стиль задаёт шаблон, править их нельзя.
const config = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "drizzle/**",
      "next-env.d.ts",
      ".githooks/**",
      "scripts/**",
      "templates/**",
    ],
  },
  ...coreWebVitals,
  ...typescript,
];

export default config;
