"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { RiverMap, type LatLng } from "@river/map";
import { useEffect, useMemo, useRef, useState } from "react";
import { Marker as MlMarker, type Map as MlMap } from "maplibre-gl";
import { MAP_STYLE_URL, PH_DEFAULT } from "@/lib/maps";

const toLL = (p: { lat: number; lng: number }): LatLng => ({ latitude: p.lat, longitude: p.lng });

/** Black teardrop pin with a white car glyph (colour stays on icons only). */
function pinElement(): HTMLDivElement {
  const el = document.createElement("div");
  el.setAttribute("aria-label", "Shop location");
  el.style.cursor = "grab";
  el.innerHTML = `<svg width="40" height="48" viewBox="0 0 40 48" aria-hidden="true">
    <path d="M20 1C9.5 1 1 9.3 1 19.6 1 33.5 20 47 20 47s19-13.5 19-27.4C39 9.3 30.5 1 20 1z" fill="#0B0B0C" stroke="#fff" stroke-width="2"/>
    <path d="M12.5 22.5l1.7-4.6c.3-.8 1-1.4 1.9-1.4h7.8c.9 0 1.6.6 1.9 1.4l1.7 4.6v4.2h-2v1.6h-2.4v-1.6h-6.2v1.6h-2.4v-1.6h-2v-4.2zm2.6-.6h9.8l-1.1-3.2h-7.6l-1.1 3.2zm.6 3.1a1.1 1.1 0 100-2.2 1.1 1.1 0 000 2.2zm8.6 0a1.1 1.1 0 100-2.2 1.1 1.1 0 000 2.2z" fill="#fff"/>
  </svg>`;
  return el;
}

function DraggablePin({
  map,
  position,
  draggable,
  onMove,
}: {
  map: MlMap;
  position: { lat: number; lng: number };
  draggable: boolean;
  onMove?: (p: { lat: number; lng: number }) => void;
}) {
  const markerRef = useRef<MlMarker | null>(null);
  const onMoveRef = useRef(onMove);
  useEffect(() => {
    onMoveRef.current = onMove;
  }, [onMove]);

  useEffect(() => {
    const mk = new MlMarker({ element: pinElement(), anchor: "bottom", draggable })
      .setLngLat([position.lng, position.lat])
      .addTo(map);
    mk.on("dragend", () => {
      const ll = mk.getLngLat();
      onMoveRef.current?.({ lat: ll.lat, lng: ll.lng });
    });
    const onClick = (e: { lngLat: { lat: number; lng: number } }) => {
      if (!draggable) return;
      mk.setLngLat([e.lngLat.lng, e.lngLat.lat]);
      onMoveRef.current?.({ lat: e.lngLat.lat, lng: e.lngLat.lng });
    };
    map.on("click", onClick);
    markerRef.current = mk;
    return () => {
      map.off("click", onClick);
      mk.remove();
      markerRef.current = null;
    };
    // Recreate only when the map or drag mode changes; position syncs below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, draggable]);

  useEffect(() => {
    const mk = markerRef.current;
    if (!mk) return;
    const cur = mk.getLngLat();
    if (Math.abs(cur.lat - position.lat) > 1e-7 || Math.abs(cur.lng - position.lng) > 1e-7) {
      mk.setLngLat([position.lng, position.lat]);
      map.easeTo({ center: [position.lng, position.lat], duration: 300 });
    }
  }, [map, position.lat, position.lng]);

  return null;
}

/** If the River style/tiles can't load before first render, fall back to the text placeholder. */
function StyleErrorWatch({ map, onFail }: { map: MlMap; onFail: () => void }) {
  const onFailRef = useRef(onFail);
  useEffect(() => {
    onFailRef.current = onFail;
  }, [onFail]);
  useEffect(() => {
    const h = () => {
      if (!map.isStyleLoaded()) onFailRef.current();
    };
    map.on("error", h);
    return () => {
      map.off("error", h);
    };
  }, [map]);
  return null;
}

export default function ShopMapImpl({
  position,
  editable = false,
  onMove,
  className,
  zoom,
}: {
  position: { lat: number; lng: number } | null;
  editable?: boolean;
  onMove?: (p: { lat: number; lng: number }) => void;
  className?: string;
  zoom?: number;
}) {
  const [failed, setFailed] = useState(false);
  const pin = position ?? PH_DEFAULT;
  const center = useMemo(() => toLL(pin), [pin.lat, pin.lng]); // eslint-disable-line react-hooks/exhaustive-deps
  const supported = typeof window !== "undefined" && "WebGLRenderingContext" in window;

  if (!supported || failed) {
    return (
      <div className={`flex items-center justify-center bg-grey-100 text-center text-[13px] font-semibold text-muted ${className ?? ""}`}>
        Map unavailable on this device. The address and pin below still save.
      </div>
    );
  }

  return (
    <RiverMap
      className={className}
      styleUrl={MAP_STYLE_URL}
      center={center}
      zoom={zoom ?? (position ? 16 : 12)}
      gestures="cooperative"
      routingUrl={null}
      colors={{ placeholder: "#F2F2F4" }}
    >
      {(map) => (
        <>
          <StyleErrorWatch map={map} onFail={() => setFailed(true)} />
          {position || editable ? <DraggablePin map={map} position={pin} draggable={editable} onMove={onMove} /> : null}
        </>
      )}
    </RiverMap>
  );
}
