import RequireAuth from "@/components/RequireAuth";
import Catalog from "@/components/Catalog";
export default function Page() {
  return (
    <RequireAuth>
      <Catalog product={false} />
    </RequireAuth>
  );
}
