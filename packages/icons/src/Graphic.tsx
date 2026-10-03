"use client";
import { useId, type SVGProps } from "react";
import { RAW, type GraphicName } from "./raw";

export interface GraphicProps
  extends Omit<SVGProps<SVGSVGElement>, "children" | "dangerouslySetInnerHTML" | "viewBox" | "name"> {
  /** Rendered width and height in px (square icons) or width (illustrations). Default 40. */
  size?: number | string;
  /** Accessible label. When omitted the graphic is decorative (aria-hidden). */
  title?: string;
}

/** Makes a page-unique id prefix so gradients and filters never clash between copies. */
export function useGraphicPrefix(): string {
  return "ra" + useId().replace(/[^a-zA-Z0-9_-]/g, "");
}

export function a11yProps(title?: string) {
  return title
    ? ({ role: "img", "aria-label": title } as const)
    : ({ "aria-hidden": true, focusable: "false" } as const);
}

export function renderMarkup(markup: string, prefix: string): string {
  return markup.split("__P__").join(prefix);
}

/** Low-level renderer for any generated graphic by name. */
export function Graphic({ name, size = 40, title, style, ...rest }: GraphicProps & { name: GraphicName }) {
  const prefix = useGraphicPrefix();
  const g = RAW[name];
  const [, , w, h] = g.viewBox.split(" ").map(Number) as [number, number, number, number];
  const square = w === h;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={g.viewBox}
      width={size}
      height={square ? size : undefined}
      style={{ display: "block", overflow: "visible", flex: "none", ...style }}
      {...a11yProps(title)}
      {...rest}
      dangerouslySetInnerHTML={{ __html: (title ? `<title>${escapeXml(title)}</title>` : "") + renderMarkup(g.markup, prefix) }}
    />
  );
}

function escapeXml(s: string) {
  return s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!);
}
