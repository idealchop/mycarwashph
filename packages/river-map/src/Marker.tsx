
import { useEffect, useMemo, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import * as maplibregl from 'maplibre-gl';
import { toLngLat } from './geo';
import type { LatLng } from './types';

/** Renders any React node as a MapLibre marker */
export function Marker({
  map,
  position,
  anchor = 'bottom',
  zIndex = 2,
  children,
}: {
  map: maplibregl.Map;
  position: LatLng;
  anchor?: maplibregl.PositionAnchor;
  zIndex?: number;
  children: ReactNode;
}) {
  const el = useMemo(() => document.createElement('div'), []);
  useEffect(() => {
    el.style.zIndex = String(zIndex);
  }, [el, zIndex]);
  useEffect(() => {
    const mk = new maplibregl.Marker({ element: el, anchor }).setLngLat(toLngLat(position)).addTo(map);
    return () => {
      mk.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, el, anchor, position.latitude, position.longitude]);
  return createPortal(children, el);
}

export function DefaultPin({ selected, title, color }: { selected: boolean; title?: string; color: string }) {
  const s = selected ? 40 : 30;
  return (
    <div title={title} style={{ width: s, height: s, cursor: 'pointer', transition: 'width 120ms, height 120ms' }}>
      <svg viewBox="0 0 24 24" width={s} height={s} aria-hidden>
        <path
          d="M12 2C7.6 2 4 5.5 4 9.9 4 15.6 12 22 12 22s8-6.4 8-12.1C20 5.5 16.4 2 12 2z"
          fill={color}
          stroke="#fff"
          strokeWidth={1.5}
        />
        <circle cx={12} cy={10} r={3.2} fill="#fff" />
      </svg>
    </div>
  );
}

export function DefaultUserDot({ color }: { color: string }) {
  return (
    <div
      style={{
        width: 16,
        height: 16,
        borderRadius: 8,
        background: color,
        border: '3px solid #fff',
        boxShadow: `0 0 0 8px ${color}33, 0 1px 4px rgba(0,0,0,0.3)`,
      }}
    />
  );
}


