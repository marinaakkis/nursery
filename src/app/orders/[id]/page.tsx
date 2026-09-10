import { OrderScreen } from "./order-screen";

export const metadata = { title: "Заказ" };

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className="page">
      <h1>Заказ №{id}</h1>
      <OrderScreen orderId={id} />
    </main>
  );
}
