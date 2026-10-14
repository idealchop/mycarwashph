
/**
 * River's self-hosted web map: MapLibre GL JS + one PMTiles archive read with HTTP range requests.
 * Generic: no app imports. Apps pass pins, user location, optional route target and a style URL.
 */
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import * as maplibregl from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import { DefaultPin, DefaultUserDot, Marker } from './Marker';
import { useRoute } from './Route';
import { toLngLat } from './geo';
import { OSRM_DEMO_URL, RIVER_THEME } from './theme';
import type { LatLng, Padding, RiverMapHandle, RiverMapPin, RouteInfo } from './types';

let protocolAdded = false;
function ensurePmtilesProtocol() {
  if (protocolAdded) return;
  maplibregl.addProtocol('pmtiles', new Protocol().tile);
  protocolAdded = true;
}

function preconnect(styleUrl: string) {
  if (typeof document === 'undefined') return;
  try {
    const origin = new URL(styleUrl).origin;
    if (document.querySelector(`link[rel="preconnect"][href="${origin}"]`)) return;
    const l = document.createElement('link');
    l.rel = 'preconnect';
    l.href = origin;
    l.crossOrigin = 'anonymous';
    document.head.appendChild(l);
  } catch {
    // relative or bad URL: MapLibre reports it
  }
}

export type RiverMapProps<T = unknown> = {
  /** River style JSON URL (e.g. RIVER_STYLE_URL_V2026_10) or an inline style object */
  styleUrl: string | maplibregl.StyleSpecification;
  /** User's location: map centre, route origin and blue dot. Omit to hide the dot. */
  user?: LatLng | null;
  /** Initial centre when there is no user location (defaults to Metro Manila) */
  center?: LatLng;
  zoom?: number;
  pins?: RiverMapPin<T>[];
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  /** Custom pin renderer; defaults to a teal teardrop */
  renderPin?: (pin: RiverMapPin<T>, selected: boolean) => ReactNode;
  renderUser?: () => ReactNode;
  /** Draw a driving route from `user` to this point */
  routeTo?: LatLng | null;
  /** OSRM-compatible /route/v1/driving base URL. Default = public OSRM demo (testing only!). null = straight line. */
  routingUrl?: string | null;
  onRouteInfo?: (info: RouteInfo | null) => void;
  /** Points the camera fits to (defaults to user + all pins) */
  fitCoords?: LatLng[];
  /** Space kept clear by overlays when fitting */
  padding?: Partial<Padding>;
  /** 'cooperative' needs two fingers / ctrl+scroll (for maps inside scrolling pages) */
  gestures?: 'greedy' | 'cooperative';
  /** URL of maplibre-gl-worker (needed by bundlers like Metro that can't bundle the module worker) */
  workerUrl?: string;
  /** Show MapLibre's compact attribution control. If false, credit OSM/Protomaps elsewhere (e.g. Credits page). */
  attribution?: boolean;
  colors?: Partial<typeof RIVER_THEME>;
  className?: string;
  style?: CSSProperties;
  children?: (map: maplibregl.Map) => ReactNode;
};

const MANILA: LatLng = { latitude: 14.5995, longitude: 120.9842 };

function RiverMapInner<T>(props: RiverMapProps<T>, ref: React.ForwardedRef<RiverMapHandle>) {
  const {
    styleUrl,
    user,
    center,
    zoom = 14,
    pins = [],
    selectedId = null,
    onSelect,
    renderPin,
    renderUser,
    routeTo,
    routingUrl = OSRM_DEMO_URL,
    onRouteInfo,
    fitCoords,
    gestures = 'greedy',
    workerUrl,
    attribution = true,
    className,
    style,
    children,
  } = props;
  const theme = { ...RIVER_THEME, ...props.colors };
  const pad: Padding = { top: 40, right: 40, bottom: 40, left: 40, ...props.padding };

  const divRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const [ready, setReady] = useState(false);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const fitTo = useMemo(
    () => [...(user ? [user] : []), ...(fitCoords ?? pins.map((p) => p.coords))],
    [user, pins, fitCoords],
  );
  const fitRef = useRef<() => void>(() => undefined);
  fitRef.current = () => {
    if (!map || fitTo.length < 2) return;
    const b = new maplibregl.LngLatBounds(toLngLat(fitTo[0]), toLngLat(fitTo[0]));
    fitTo.forEach((c) => b.extend(toLngLat(c)));
    const cam = map.cameraForBounds(b, { padding: pad, maxZoom: 16 });
    if (cam) map.easeTo({ ...cam, zoom: Math.floor(cam.zoom ?? 14), duration: 400 });
  };

  useImperativeHandle(
    ref,
    () => ({
      fitAll: () => fitRef.current(),
      locate: (z = 15) => user && map?.easeTo({ center: toLngLat(user), zoom: z }),
      getMap: () => map,
    }),
    [map, user],
  );

  useEffect(() => {
    if (!divRef.current) return;
    ensurePmtilesProtocol();
    if (workerUrl) maplibregl.setWorkerUrl(workerUrl);
    if (typeof styleUrl === 'string') preconnect(styleUrl);
    const m = new maplibregl.Map({
      container: divRef.current,
      style: styleUrl,
      center: toLngLat(user ?? center ?? MANILA),
      zoom,
      attributionControl: attribution ? { compact: true } : false,
      cooperativeGestures: gestures === 'cooperative',
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
    });
    m.touchZoomRotate.disableRotation();
    m.on('click', () => onSelectRef.current?.(null));
    // Fade tiles in once the first frame is drawn; pins appear immediately
    const canvas = m.getCanvas();
    canvas.style.opacity = '0';
    canvas.style.transition = 'opacity 350ms ease-out';
    const reveal = () => (canvas.style.opacity = '1');
    const safety = setTimeout(reveal, 2500);
    m.once('load', () => {
      setReady(true);
      reveal();
    });
    setMap(m);
    const ro = new ResizeObserver(() => m.resize());
    ro.observe(divRef.current);
    return () => {
      clearTimeout(safety);
      ro.disconnect();
      m.remove();
      setMap(null);
      setReady(false);
    };
    // Style / gestures are fixed per mount; remount (key) to change them
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fitKey = fitTo.map((c) => `${c.latitude.toFixed(5)},${c.longitude.toFixed(5)}`).join('|');
  useEffect(() => {
    if (!map || routeTo) return;
    const t = setTimeout(() => fitRef.current(), 120);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, fitKey]);

  useRoute(map, ready, {
    from: user ?? center ?? MANILA,
    to: user ? routeTo : null,
    routingUrl,
    color: theme.teal,
    casing: theme.routeCasing,
    padding: { ...pad, top: pad.top + 36, right: pad.right + 8, left: pad.left + 8 },
    onInfo: onRouteInfo,
  });

  return (
    <div className={className} style={{ position: 'relative', overflow: 'hidden', background: theme.placeholder, ...style }}>
      <div ref={divRef} style={{ position: 'absolute', inset: 0 }} data-testid="river-map" />
      {map ? (
        <>
          {user ? (
            <Marker map={map} position={user} anchor="center" zIndex={1}>
              {renderUser ? renderUser() : <DefaultUserDot color={theme.userDot} />}
            </Marker>
          ) : null}
          {pins.map((p) => {
            const on = p.id === selectedId;
            return (
              <Marker key={`${p.id}-${on ? 1 : 0}`} map={map} position={p.coords} zIndex={on ? 10 : 2}>
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectRef.current?.(p.id);
                  }}
                >
                  {renderPin ? renderPin(p, on) : <DefaultPin selected={on} title={p.title} color={on ? theme.tealDark : theme.teal} />}
                </div>
              </Marker>
            );
          })}
          {children?.(map)}
        </>
      ) : null}
    </div>
  );
}

export const RiverMap = forwardRef(RiverMapInner) as <T = unknown>(
  p: RiverMapProps<T> & { ref?: React.Ref<RiverMapHandle> },
) => ReturnType<typeof RiverMapInner>;


