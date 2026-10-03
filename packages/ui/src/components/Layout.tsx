import type { ReactNode } from "react";
import { cn } from "../cn";
import { Badge } from "./Badge";

/* ---------------- LogoMark ---------------- */
export interface LogoMarkProps { size?: number; children?: ReactNode; className?: string }
/** Black rounded square for an app mark. Pass a white glyph as children. */
export function LogoMark({ size = 36, children, className }: LogoMarkProps) {
  return (
    <span
      aria-hidden
      className={cn("inline-flex flex-none items-center justify-center bg-ink shadow-[inset_0_1px_0_rgba(255,255,255,.18),0_4px_10px_-4px_rgba(10,10,10,.5)] [&>svg]:size-[60%]", className)}
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.32) }}
    >
      {children}
    </span>
  );
}

/* ---------------- Sidebar ---------------- */
export interface NavItem {
  key: string;
  label: string;
  icon: ReactNode;
  href?: string;
  /** Notification count shown as a black badge. */
  badge?: number;
}
export interface SidebarProps {
  brand: ReactNode;
  items: NavItem[];
  activeKey?: string;
  /** Promo or status card pinned near the bottom. */
  footer?: ReactNode;
  /** Low-emphasis links at the very bottom (Help, Settings). */
  secondaryItems?: NavItem[];
  label?: string;
  className?: string;
}

function NavLink({ item, active }: { item: NavItem; active?: boolean }) {
  return (
    <a
      href={item.href ?? "#"}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-[46px] items-center gap-3 rounded-control px-3.5 text-[14.5px] font-semibold transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
        active ? "bg-ink text-on-ink shadow-raised" : "text-grey-500 hover:bg-grey-100 hover:text-ink",
      )}
    >
      {item.icon}
      <span className="flex-1 truncate">{item.label}</span>
      {item.badge ? <Badge variant={active ? "inverse" : "solid"} className="h-[22px] min-w-[22px] justify-center px-1.5 text-[11.5px] font-extrabold">{item.badge}</Badge> : null}
    </a>
  );
}

/** Light sidebar with logo, icon menu and a black pill for the active item. */
export function Sidebar({ brand, items, activeKey, footer, secondaryItems, label = "Main", className }: SidebarProps) {
  return (
    <aside className={cn("flex w-sidebar flex-none flex-col border-r border-line bg-surface px-4 pb-[18px] pt-[22px]", className)}>
      <div className="px-2">{brand}</div>
      <nav aria-label={label} className="mt-7 flex flex-col gap-1">
        {items.map((it) => <NavLink key={it.key} item={it} active={it.key === activeKey} />)}
      </nav>
      {footer ? <div className="mt-auto pt-10">{footer}</div> : <div className="mt-auto" />}
      {secondaryItems?.length ? (
        <nav aria-label="Secondary" className="mt-2.5 flex flex-col gap-1">
          {secondaryItems.map((it) => <NavLink key={it.key} item={it} active={it.key === activeKey} />)}
        </nav>
      ) : null}
    </aside>
  );
}

/* ---------------- Topbar ---------------- */
export interface TopbarProps {
  /** Avatar shown before the title (mobile greeting style). */
  leading?: ReactNode;
  /** Small grey line above the title, e.g. "Good morning". */
  eyebrow?: ReactNode;
  title: ReactNode;
  /** Grey line under the title (desktop). */
  subtitle?: ReactNode;
  /** Right side: search, notifications, profile. */
  actions?: ReactNode;
  /** "page" = big desktop heading; "greeting" = compact mobile header. */
  variant?: "page" | "greeting";
  className?: string;
}

export function Topbar({ leading, eyebrow, title, subtitle, actions, variant = "page", className }: TopbarProps) {
  const greet = variant === "greeting";
  return (
    <header className={cn("flex items-center justify-between gap-4", greet ? "h-16 px-5" : "", className)}>
      <div className="flex min-w-0 items-center gap-[11px]">
        {leading}
        <div className="flex min-w-0 flex-col leading-[1.2]">
          {eyebrow ? <span className="text-[12.5px] font-semibold text-muted">{eyebrow}</span> : null}
          {greet ? (
            <b className="truncate text-[17px] font-extrabold tracking-[-0.01em]">{title}</b>
          ) : (
            <h1 className="truncate text-[28px] font-extrabold leading-[1.15] tracking-[-0.03em]">{title}</h1>
          )}
          {subtitle ? <p className="mt-0.5 text-[14px] font-semibold text-muted">{subtitle}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-none items-center gap-3">{actions}</div> : null}
    </header>
  );
}

/* ---------------- MobileTabBar ---------------- */
export interface MobileTabBarProps {
  items: NavItem[];
  activeKey: string;
  /** "fixed" for real pages, "absolute" inside a device frame or container. */
  position?: "fixed" | "absolute" | "static";
  label?: string;
  className?: string;
}

/** Floating white bottom bar. The active tab becomes a black pill with its label. */
export function MobileTabBar({ items, activeKey, position = "fixed", label = "Main", className }: MobileTabBarProps) {
  return (
    <nav
      aria-label={label}
      className={cn(
        "z-40 flex h-tabbar items-center justify-between rounded-card bg-surface px-2.5 shadow-float",
        position === "fixed" && "fixed inset-x-4 bottom-[max(22px,env(safe-area-inset-bottom))]",
        position === "absolute" && "absolute inset-x-4 bottom-[22px]",
        className,
      )}
    >
      {items.map((it) => {
        const on = it.key === activeKey;
        return (
          <a
            key={it.key}
            href={it.href ?? "#"}
            aria-current={on ? "page" : undefined}
            aria-label={on ? undefined : it.label}
            className={cn(
              "relative flex h-[46px] min-w-[46px] items-center justify-center gap-2 rounded-tile transition-colors",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
              on ? "bg-ink px-[18px] text-[14px] font-bold text-on-ink" : "px-3 text-subtle hover:text-ink",
            )}
          >
            {it.icon}
            {on ? <span>{it.label}</span> : null}
            {!on && it.badge ? <Badge variant="count" className="absolute right-0.5 top-0.5" aria-hidden>{it.badge}</Badge> : null}
          </a>
        );
      })}
    </nav>
  );
}

/* ---------------- AppShell ---------------- */
export interface AppShellProps {
  /** Shown from the `lg` breakpoint up. */
  sidebar?: ReactNode;
  /** Shown below the `lg` breakpoint. */
  mobileTabBar?: ReactNode;
  children: ReactNode;
  className?: string;
  mainClassName?: string;
}

/** Responsive frame: sidebar on desktop, floating tab bar on phones. Mobile-first. */
export function AppShell({ sidebar, mobileTabBar, children, className, mainClassName }: AppShellProps) {
  return (
    <div className={cn("flex min-h-dvh bg-canvas text-ink", className)}>
      {sidebar ? <div className="hidden lg:flex">{sidebar}</div> : null}
      <main className={cn("min-w-0 flex-1 pb-28 lg:pb-0", mainClassName)}>{children}</main>
      {mobileTabBar ? <div className="lg:hidden">{mobileTabBar}</div> : null}
    </div>
  );
}

/* ---------------- SectionHeader ---------------- */
/** Bold section title with optional grey note or link on the right. */
export function SectionHeader({ title, aside, className, as: As = "h3" }: { title: ReactNode; aside?: ReactNode; className?: string; as?: "h2" | "h3" }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3", className)}>
      <As className="text-[19px] font-extrabold tracking-[-0.02em]">{title}</As>
      {aside ? <span className="text-[13.5px] font-semibold text-muted">{aside}</span> : null}
    </div>
  );
}
