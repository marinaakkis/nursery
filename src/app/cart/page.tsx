import { CartScreen } from "./cart-screen";

export const metadata = { title: "Корзина — Питомник растений" };

export default function CartPage() {
  return (
    <main className="page">
      <h1>Корзина</h1>
      <CartScreen />
    </main>
  );
}
