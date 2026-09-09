import { CheckoutScreen } from "./checkout-screen";

export const metadata = { title: "Оформление — Питомник растений" };

export default function CheckoutPage() {
  return (
    <main className="page">
      <h1>Оформление</h1>
      <CheckoutScreen />
    </main>
  );
}
