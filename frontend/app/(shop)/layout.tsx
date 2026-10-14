import { ShopShell } from "@/components/shop/shop-shell";
import { ShopProvider } from "@/lib/shop-context";

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <ShopProvider>
      <ShopShell>{children}</ShopShell>
    </ShopProvider>
  );
}
