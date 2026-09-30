import { Suspense } from "react";
import RequireAuth from "@/components/RequireAuth";
import OrderWorkbench from "@/components/OrderWorkbench";
export default function Page() {
  return (
    <RequireAuth>
      <Suspense>
        <OrderWorkbench sale={false} />
      </Suspense>
    </RequireAuth>
  );
}
