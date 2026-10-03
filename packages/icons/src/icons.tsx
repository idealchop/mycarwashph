"use client";
import { Graphic, type GraphicProps } from "./Graphic";
import type { GraphicName } from "./raw";
import type { IconName } from "./presets";

function make(name: GraphicName, displayName: string) {
  const C = (props: GraphicProps) => <Graphic name={name} {...props} />;
  C.displayName = displayName;
  return C;
}

/** Iridescent soap bubbles. Good for washing, cleaning or "fresh" services. */
export const BubblesIcon = make("bubbles", "BubblesIcon");
/** Canister vacuum with hose. */
export const VacuumIcon = make("vacuum", "VacuumIcon");
/** Gold and lilac sparkles. Premium, detail or polish services. */
export const SparkleIcon = make("sparkle", "SparkleIcon");
/** Tyre with alloy rim. */
export const TyreIcon = make("tyre", "TyreIcon");
/** Water drop. */
export const DropIcon = make("drop", "DropIcon");
/** Small side-view car. */
export const CarIcon = make("car", "CarIcon");
/** Chat / SMS bubble. */
export const ChatIcon = make("chat", "ChatIcon");
/** Shield with check (verification, security). */
export const ShieldIcon = make("shield", "ShieldIcon");
/** Glossy success check. */
export const CheckIcon = make("check", "CheckIcon");
/** Gold peso coin (money, payment). */
export const CoinIcon = make("coin", "CoinIcon");
/** A single soap bubble for decoration. */
export const BubbleGraphic = make("bubble", "BubbleGraphic");


/** Render a 3D-style icon by name, e.g. from data. */
export function Icon3D({ name, ...props }: GraphicProps & { name: IconName }) {
  return <Graphic name={name} {...props} />;
}
