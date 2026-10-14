
export type LatLng = { latitude: number; longitude: number };

/** A provider / place marker. `render` lets each app draw its own pin (3D icon, label pill, ...). */
export type RiverMapPin<T = unknown> = {
  id: string;
  coords: LatLng;
  /** Optional label (used by the default pin as a tooltip) */
  title?: string;
  /** App-specific payload passed back to renderPin */
  data?: T;
};

export type RouteInfo = {
  km: number;
  minutes: number;
  /** 'road' = routed by the OSRM-compatible server; 'straight' = fallback line */
  mode: 'road' | 'straight';
  geometry: [number, number][];
};

export type RiverMapHandle = {
  /** Fit the camera to the user plus every pin (or fitCoords) */
  fitAll: () => void;
  /** Centre on the user's location */
  locate: (zoom?: number) => void;
  /** Underlying MapLibre map, for advanced use */
  getMap: () => import('maplibre-gl').Map | null;
};

export type Padding = { top: number; right: number; bottom: number; left: number };


