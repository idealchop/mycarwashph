import { EmptyState } from "@river-apps/ui";
import type { ReactNode } from "react";
import { Spinner } from "@/components/screen";

/** Consistent loading / error / empty blocks for shop pages. */
export function PageStatus({
  loading,
  error,
  empty,
  emptyTitle,
  emptyDescription,
  emptyIllustration,
  children,
}: {
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIllustration?: ReactNode;
  children?: ReactNode;
}) {
  if (error) {
    return (
      <p role="alert" className="mt-4 rounded-2xl border border-grey-200 bg-white px-4 py-3 text-[14px] font-semibold">
        {error}
      </p>
    );
  }
  if (loading) return <div className="mt-8"><Spinner label="Loading" /></div>;
  if (empty) {
    return (
      <EmptyState
        className="mt-8"
        illustration={emptyIllustration}
        title={emptyTitle ?? "Nothing here yet"}
        description={emptyDescription}
      />
    );
  }
  return <>{children}</>;
}
