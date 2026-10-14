
import type { Feature } from 'geojson';
import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import { distanceKm, straightEta, toLngLat } from './geo';
import type { LatLng, Padding, RouteInfo } from './types';

const SRC = 'river-route';
const LAYERS = ['river-route-line', 'river-route-casing'];

/** Driving route from an OSRM-compatible /route/v1/driving endpoint; straight dashed line if it fails */
export function useRoute(
  map: maplibregl.Map | null,
  ready: boolean,
  opts: {
    from: LatLng;
    to: LatLng | null | undefined;
    routingUrl: string | null;
    color: string;
    casing: string;
    padding: Padding;
    onInfo?: (info: RouteInfo | null) => void;
  },
) {
  const onInfoRef = useRef(opts.onInfo);
  onInfoRef.current = opts.onInfo;
  const { from, to } = opts;
  const key = to ? `${from.latitude},${from.longitude}>${to.latitude},${to.longitude}|${opts.routingUrl}` : '';

  useEffect(() => {
    if (!map || !ready) return;
    if (!to) {
      onInfoRef.current?.(null);
      return;
    }
    let cancelled = false;
    const ctrl = new AbortController();

    const draw = (coords: [number, number][], straight: boolean) => {
      const data: Feature = { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } };
      const src = map.getSource(SRC) as maplibregl.GeoJSONSource | undefined;
      if (src) src.setData(data);
      else map.addSource(SRC, { type: 'geojson', data });
      for (const id of LAYERS) if (map.getLayer(id)) map.removeLayer(id);
      map.addLayer({
        id: 'river-route-casing',
        type: 'line',
        source: SRC,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': opts.casing, 'line-width': 9 },
      });
      map.addLayer({
        id: 'river-route-line',
        type: 'line',
        source: SRC,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': opts.color, 'line-width': 5, ...(straight ? { 'line-dasharray': [1.5, 1.5] } : {}) },
      });
      const b = new maplibregl.LngLatBounds(coords[0], coords[0]);
      coords.forEach((c) => b.extend(c));
      map.fitBounds(b, { padding: opts.padding, maxZoom: 16, duration: 400 });
    };

    const fallback = () => {
      const coords = [toLngLat(from), toLngLat(to)];
      draw(coords, true);
      const km = distanceKm(from, to);
      onInfoRef.current?.({ km, minutes: straightEta(km), mode: 'straight', geometry: coords });
    };

    if (!opts.routingUrl) fallback();
    else
      fetch(`${opts.routingUrl}/${from.longitude},${from.latitude};${to.longitude},${to.latitude}?overview=full&geometries=geojson`, {
        signal: ctrl.signal,
      })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`routing ${r.status}`))))
        .then((j) => {
          if (cancelled) return;
          const route = j?.routes?.[0];
          if (!route) throw new Error('no route');
          const coords = route.geometry.coordinates as [number, number][];
          draw(coords, false);
          onInfoRef.current?.({
            km: route.distance / 1000,
            minutes: Math.max(1, Math.round(route.duration / 60)),
            mode: 'road',
            geometry: coords,
          });
        })
        .catch(() => {
          if (!cancelled) fallback();
        });

    return () => {
      cancelled = true;
      ctrl.abort();
      for (const id of LAYERS) if (map.getLayer(id)) map.removeLayer(id);
      if (map.getSource(SRC)) map.removeSource(SRC);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, ready, key]);
}


