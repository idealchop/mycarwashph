"use client";
import { a11yProps, renderMarkup, useGraphicPrefix, type GraphicProps } from "./Graphic";
import { RAW } from "./raw";

export type CarColor = "blue" | "black" | "silver";

export interface CarIllustrationProps extends GraphicProps {
  /** Body paint. Default "blue". */
  color?: CarColor;
  /** Soap foam on the roof. Default true. */
  foam?: boolean;
  /** Floating bubbles and water drops. Default true. */
  bubbles?: boolean;
}

/** Glossy side-view car with soap foam, bubbles and droplets (viewBox 400×230). `size` sets the width. */
export function CarIllustration({ color = "blue", foam = true, bubbles = true, size = 400, title, style, ...rest }: CarIllustrationProps) {
  const prefix = useGraphicPrefix();
  const g = RAW[`car-${color}`];
  let markup = g.markup;
  if (!foam) markup = markup.replace(/<!--foam-->[\s\S]*?<!--\/foam-->/, "");
  if (!bubbles) markup = markup.replace(/<!--bubbles-->[\s\S]*?<!--\/bubbles-->/, "");
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={g.viewBox}
      width={size}
      style={{ display: "block", overflow: "visible", flex: "none", ...style }}
      {...a11yProps(title)}
      {...rest}
      dangerouslySetInnerHTML={{ __html: renderMarkup(markup, prefix) }}
    />
  );
}
