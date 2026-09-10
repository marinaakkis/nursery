import { CheckoutScreen } from "./checkout-screen";

export const metadata = { title: "Оформление" };

export default function CheckoutPage() {
  return (
    <main className="page pageForm">
      <h1>Оформление</h1>
      <CheckoutScreen />
    </main>
  );
}
