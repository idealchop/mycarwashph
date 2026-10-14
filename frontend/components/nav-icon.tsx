import Image from "next/image";

/** Colourful 3D icon set (River UI kit assets/icons3d), used in side and bottom navs. */
export type Nav3DName =
  | "house" | "ticket" | "calendar" | "cash" | "people" | "chat" | "sparkle" | "sliders" | "document" | "receipt" | "car";

export function NavIcon3D({ name, size = 26 }: { name: Nav3DName; size?: number }) {
  return (
    <Image
      src={`/icons3d/${name}.png`}
      alt=""
      aria-hidden
      width={size}
      height={size}
      className="nav-icon-3d flex-none select-none"
      style={{ width: size, height: size }}
    />
  );
}
