import { OrdersScreen } from "./orders-screen";

export const metadata = { title: "Мои заказы — Питомник растений" };

export default function OrdersPage() {
  return (
    <main className="page">
      <h1>Мои заказы</h1>
      <OrdersScreen />
    </main>
  );
}
