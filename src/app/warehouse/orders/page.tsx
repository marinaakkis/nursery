import { WarehouseNav } from "../nav";
import { AssemblyScreen } from "./assembly-screen";

export const metadata = { title: "Склад — очередь сборки" };

export default function AssemblyPage() {
  return (
    <main className="page" data-ui="service">
      <h1>Очередь сборки</h1>
      <WarehouseNav current="/warehouse/orders" />
      <AssemblyScreen />
    </main>
  );
}
