import type { ReactNode } from "react";
import { cn } from "../cn";
import { Badge } from "./Badge";
import { ListItem } from "./ListItem";

export interface QueueListItem {
  id: string;
  /** Avatar or IconTile. */
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Short value on the right, e.g. "8 min" (shown as a grey pill) or any node. */
  trailing?: ReactNode;
}

export interface QueueListProps {
  items: QueueListItem[];
  /** Accessible list name, e.g. "Waiting customers". */
  label: string;
  /** "pill" shows trailing text in a grey pill; "value" shows bold right-aligned text. */
  trailingStyle?: "pill" | "value";
  className?: string;
}

/** Ordered list of people or jobs waiting, with avatars and wait times. */
export function QueueList({ items, label, trailingStyle = "pill", className }: QueueListProps) {
  return (
    <ol aria-label={label} className={cn("flex flex-col", className)}>
      {items.map((it) => (
        <ListItem
          as="li"
          key={it.id}
          variant="row"
          leading={it.leading}
          title={it.title}
          subtitle={it.subtitle}
          trailing={
            typeof it.trailing === "string" && trailingStyle === "pill" ? <Badge variant="soft" className="text-[12.5px]">{it.trailing}</Badge> : it.trailing
          }
        />
      ))}
    </ol>
  );
}
