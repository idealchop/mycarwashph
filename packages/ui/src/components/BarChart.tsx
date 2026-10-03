import { cn } from "../cn";

export interface BarDatum { label: string; value: number }

export interface BarChartProps {
  data: BarDatum[];
  /** Index of the black highlighted bar (e.g. the peak or current hour). Others are grey. */
  highlightIndex?: number;
  /** Tooltip text above the highlighted bar, e.g. "₱1,200". */
  tooltip?: string;
  width?: number;
  height?: number;
  /** Accessible summary, e.g. "Sales by hour, peak ₱1,200 at 9 AM". */
  ariaLabel: string;
  formatValue?: (v: number) => string;
  className?: string;
}

/** Rounded bar chart: grey bars, one black highlighted bar with a black tooltip. Pure SVG, no dependencies. */
export function BarChart({ data, highlightIndex, tooltip, width = 320, height = 108, ariaLabel, formatValue = String, className }: BarChartProps) {
  const n = Math.max(1, data.length);
  const gap = width / n;
  const bw = gap * 0.56;
  const max = Math.max(1, ...data.map((d) => d.value));
  const base = height - 22;
  const tw = tooltip ? Math.max(56, tooltip.length * 8 + 18) : 0;
  return (
    <svg
      role="img"
      aria-label={ariaLabel}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("block h-auto max-w-full", className)}
    >
      <desc>{data.map((d) => `${d.label}: ${formatValue(d.value)}`).join(", ")}</desc>
      {[0.33, 0.66].map((g) => {
        const y = base - (base - 30) * g;
        return <line key={g} x1={0} x2={width} y1={y} y2={y} stroke="#EEEEF1" strokeDasharray="3 4" />;
      })}
      {data.map((d, i) => {
        const bh = ((base - 34) * d.value) / max;
        const x = i * gap + (gap - bw) / 2;
        const y = base - bh;
        const on = i === highlightIndex;
        const cx = x + bw / 2;
        return (
          <g key={d.label + i}>
            <rect x={x} y={y} width={bw} height={bh} rx={Math.min(8, bw / 2, bh / 2)} fill={on ? "#0A0A0A" : "#E4E4E7"} />
            <text x={cx} y={height - 5} textAnchor="middle" fontSize={10.5} fontWeight={on ? 800 : 600} fill={on ? "#0A0A0A" : "#A1A1AA"}>{d.label}</text>
            {on && tooltip ? (
              <g aria-hidden>
                <rect x={cx - tw / 2} y={y - 36} width={tw} height={26} rx={9} fill="#0A0A0A" />
                <path d={`M${cx - 5} ${y - 10.5} L${cx} ${y - 5} L${cx + 5} ${y - 10.5} Z`} fill="#0A0A0A" />
                <text x={cx} y={y - 19} textAnchor="middle" fontSize={12} fontWeight={800} fill="#FFFFFF">{tooltip}</text>
              </g>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
