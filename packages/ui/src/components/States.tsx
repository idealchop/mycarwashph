import type { HTMLAttributes, ReactNode } from "react";
import { BubbleGraphic, CheckIcon } from "@river-apps/icons";
import { cn } from "../cn";

export interface SuccessStateProps {
  title: ReactNode;
  description?: ReactNode;
  /** Defaults to the glossy 3D check. */
  icon?: ReactNode;
  /** Floating soap bubbles around the icon. Default true. */
  decorations?: boolean;
  children?: ReactNode;
  className?: string;
}

/** Big, friendly confirmation visual: glossy check, soft neutral halo, floating bubbles. */
export function SuccessState({ title, description, icon, decorations = true, children, className }: SuccessStateProps) {
  return (
    <div role="status" className={cn("flex flex-col items-center text-center", className)}>
      <div className="relative flex h-[200px] w-full max-w-[360px] items-center justify-center">
        <i aria-hidden className="absolute size-[190px] rounded-full bg-[radial-gradient(circle,rgba(10,10,10,.07),rgba(10,10,10,0)_68%)]" />
        {decorations ? (
          <>
            <BubbleGraphic size={28} className="absolute left-[56px] top-[38px]" />
            <BubbleGraphic size={36} className="absolute right-[34px] top-[44px]" />
            <BubbleGraphic size={18} className="absolute right-[78px] top-[146px]" />
            <BubbleGraphic size={20} className="absolute left-[82px] top-[138px]" />
          </>
        ) : null}
        <span className="relative z-10">{icon ?? <CheckIcon size={128} />}</span>
      </div>
      <h1 className="mt-1.5 text-[29px] font-extrabold tracking-[-0.03em]">{title}</h1>
      {description ? <p className="mt-1 text-[15px] font-medium text-muted">{description}</p> : null}
      {children}
    </div>
  );
}

export interface EmptyStateProps {
  illustration?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

/** Friendly empty state with an illustration and one action. */
export function EmptyState({ illustration, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center rounded-card border border-dashed border-grey-300 bg-surface px-6 py-8 text-center", className)}>
      {illustration ? <div className="mb-4 flex items-center justify-center">{illustration}</div> : null}
      <h3 className="text-[19px] font-extrabold tracking-[-0.02em]">{title}</h3>
      {description ? <p className="mt-1 max-w-[280px] text-[14px] font-medium text-muted">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/** Discreet "Sample data" pill for demos, mockups and seeded accounts. */
export function SampleDataTag({ className, children = "Sample data", ...rest }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={cn("inline-flex items-center rounded-pill border border-[#E6E6EA] bg-surface/75 px-2 py-0.5 text-[10.5px] font-semibold leading-[1.3] text-muted", className)} {...rest}>
      {children}
    </span>
  );
}

/** White floating info chip, e.g. over an illustration. */
export function FloatingCard({ icon, title, subtitle, className }: { icon?: ReactNode; title: ReactNode; subtitle?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center gap-[9px] rounded-tile bg-surface/92 py-2 pl-2 pr-3 shadow-popover", className)}>
      {icon}
      <span className="flex flex-col leading-[1.2]">
        <b className="text-[13px]">{title}</b>
        {subtitle ? <small className="text-[11.5px] font-semibold text-muted">{subtitle}</small> : null}
      </span>
    </div>
  );
}

/** Monospace reference text: plates, order numbers, ticket ids. */
export function MonoText({ className, inverse, ...rest }: HTMLAttributes<HTMLSpanElement> & { inverse?: boolean }) {
  return <span className={cn("font-mono font-medium tracking-[0.01em]", inverse && "rounded-sm bg-ink px-2.5 py-1.5 font-semibold tracking-[0.04em] text-on-ink", className)} {...rest} />;
}
