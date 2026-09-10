/** @type {import('next').NextConfig} */
const nextConfig = {
  // standalone — чтобы в образ уезжал минимальный рантайм без dev-зависимостей
  output: "standalone",
  images: {
    // Фото уже ужаты до 1200px и качества 80 при загрузке — оптимизатору нечего
    // добавить. Зато он требует sharp, которого в alpine-образе может не оказаться,
    // и режет качество списком разрешённых значений. Отдаём файлы как есть.
    unoptimized: true,
  },
};

export default nextConfig;
