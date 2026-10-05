export type ShopLocationValue = {
  lat: number;
  lng: number;
  formattedAddress: string | null;
  placeId: string | null;
};

export function mapsApiKey(): string | undefined {
  const k = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
  return k || undefined;
}

type MapsWindow = Window & {
  google?: {
    maps: {
      Map: new (el: HTMLElement, opts: object) => {
        setCenter: (c: { lat: number; lng: number }) => void;
        addListener: (event: string, fn: (e: { latLng?: { lat: () => number; lng: () => number } }) => void) => void;
      };
      Marker: new (opts: object) => {
        setPosition: (c: { lat: number; lng: number }) => void;
        getPosition: () => { lat: () => number; lng: () => number } | null;
        addListener: (event: string, fn: () => void) => void;
      };
      LatLngBounds: new () => { extend: (c: { lat: number; lng: number }) => void };
      places: {
        Autocomplete: new (
          input: HTMLInputElement,
          opts: object,
        ) => {
          addListener: (event: string, fn: () => void) => void;
          getPlace: () => {
            geometry?: { location?: { lat: () => number; lng: () => number } };
            formatted_address?: string;
            place_id?: string;
            name?: string;
          };
        };
      };
      event: { clearInstanceListeners: (t: object) => void };
    };
  };
  __mcwMapsPromise?: Promise<void>;
};

/** Loads Maps JS + Places once. No-op when the public API key is missing. */
export function loadGoogleMaps(): Promise<boolean> {
  const key = mapsApiKey();
  if (!key) return Promise.resolve(false);
  const w = window as MapsWindow;
  if (w.google?.maps?.places) return Promise.resolve(true);
  if (!w.__mcwMapsPromise) {
    w.__mcwMapsPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places&region=PH&language=en`;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("Failed to load Google Maps"));
      document.head.appendChild(s);
    });
  }
  return w.__mcwMapsPromise.then(() => true).catch(() => false);
}

export function getGoogle() {
  return (window as MapsWindow).google;
}

/** Default pin: Quezon City / Metro Manila. */
export const PH_DEFAULT = { lat: 14.5995, lng: 120.9842 };
