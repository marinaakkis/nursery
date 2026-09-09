/** @type {import('next').NextConfig} */
const nextConfig = {
  // standalone — чтобы в образ уезжал минимальный рантайм без dev-зависимостей
  output: "standalone",
};

export default nextConfig;
