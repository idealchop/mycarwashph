"use client";

import { Input } from "@river-apps/ui";
import { useEffect, useId, useRef, useState } from "react";
import { getGoogle, loadGoogleMaps, mapsApiKey, PH_DEFAULT, type ShopLocationValue } from "@/lib/maps";

export function LocationPicker({
  address,
  location,
  onChange,
  disabled,
}: {
  address: string;
  location: ShopLocationValue | null;
  onChange: (next: { address: string; location: ShopLocationValue | null }) => void;
  disabled?: boolean;
}) {
  const hasKey = Boolean(mapsApiKey());
  const [mapsReady, setMapsReady] = useState(false);
  const [mapsFailed, setMapsFailed] = useState(false);
  const mapEl = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const markerRef = useRef<{ setPosition: (c: { lat: number; lng: number }) => void; getPosition: () => { lat: () => number; lng: () => number } | null } | null>(null);
  const mapRef = useRef<{ setCenter: (c: { lat: number; lng: number }) => void } | null>(null);
  const searchId = useId();

  useEffect(() => {
    if (!hasKey) return;
    let cancelled = false;
    void loadGoogleMaps().then((ok) => {
      if (cancelled) return;
      if (!ok) setMapsFailed(true);
      else setMapsReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [hasKey]);

  useEffect(() => {
    if (!mapsReady || !mapEl.current || !searchRef.current) return;
    const g = getGoogle();
    if (!g?.maps?.places) return;

    const center = location ?? PH_DEFAULT;
    const map = new g.maps.Map(mapEl.current, {
      center,
      zoom: location ? 16 : 12,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    });
    mapRef.current = map;
    const marker = new g.maps.Marker({
      map,
      position: center,
      draggable: true,
      title: "Shop location",
    });
    markerRef.current = marker;

    const syncFromLatLng = (lat: number, lng: number, formatted?: string | null, placeId?: string | null) => {
      onChange({
        address: formatted ?? address,
        location: {
          lat,
          lng,
          formattedAddress: (formatted ?? address) || null,
          placeId: placeId ?? location?.placeId ?? null,
        },
      });
    };

    marker.addListener("dragend", () => {
      const pos = marker.getPosition();
      if (!pos) return;
      syncFromLatLng(pos.lat(), pos.lng(), address || null, location?.placeId ?? null);
    });
    map.addListener("click", (e) => {
      const ll = e.latLng;
      if (!ll) return;
      marker.setPosition({ lat: ll.lat(), lng: ll.lng() });
      syncFromLatLng(ll.lat(), ll.lng(), address || null, location?.placeId ?? null);
    });

    const ac = new g.maps.places.Autocomplete(searchRef.current, {
      fields: ["geometry", "formatted_address", "place_id", "name"],
      componentRestrictions: { country: "ph" },
    });
    ac.addListener("place_changed", () => {
      const place = ac.getPlace();
      const loc = place.geometry?.location;
      if (!loc) return;
      const lat = loc.lat();
      const lng = loc.lng();
      const formatted = place.formatted_address ?? place.name ?? address;
      marker.setPosition({ lat, lng });
      map.setCenter({ lat, lng });
      onChange({
        address: formatted,
        location: { lat, lng, formattedAddress: formatted, placeId: place.place_id ?? null },
      });
    });

    return () => {
      g.maps.event.clearInstanceListeners(marker);
      g.maps.event.clearInstanceListeners(map);
      g.maps.event.clearInstanceListeners(ac);
    };
    // Intentionally mount once when Maps is ready; subsequent value sync is via props → marker in separate effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapsReady]);

  useEffect(() => {
    if (!location || !markerRef.current || !mapRef.current) return;
    markerRef.current.setPosition({ lat: location.lat, lng: location.lng });
    mapRef.current.setCenter({ lat: location.lat, lng: location.lng });
    // Only recenter when coordinates change; full `location` object identity flips often.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- lat/lng only
  }, [location?.lat, location?.lng]);

  if (!hasKey || mapsFailed) {
    return (
      <div className="flex flex-col gap-3">
        <Input
          label="Street address"
          placeholder="e.g. 123 Maginhawa St, Quezon City"
          value={address}
          disabled={disabled}
          onChange={(e) =>
            onChange({
              address: e.target.value,
              location: location
                ? { ...location, formattedAddress: e.target.value || null }
                : null,
            })
          }
        />
        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            label="Latitude"
            placeholder="14.5995"
            inputMode="decimal"
            disabled={disabled}
            value={location?.lat != null ? String(location.lat) : ""}
            onChange={(e) => {
              const lat = Number(e.target.value);
              if (!Number.isFinite(lat)) {
                onChange({ address, location: null });
                return;
              }
              onChange({
                address,
                location: {
                  lat,
                  lng: location?.lng ?? PH_DEFAULT.lng,
                  formattedAddress: address || null,
                  placeId: location?.placeId ?? null,
                },
              });
            }}
          />
          <Input
            label="Longitude"
            placeholder="120.9842"
            inputMode="decimal"
            disabled={disabled}
            value={location?.lng != null ? String(location.lng) : ""}
            onChange={(e) => {
              const lng = Number(e.target.value);
              if (!Number.isFinite(lng) || location?.lat == null) {
                return;
              }
              onChange({
                address,
                location: {
                  lat: location.lat,
                  lng,
                  formattedAddress: address || null,
                  placeId: location?.placeId ?? null,
                },
              });
            }}
          />
        </div>
        <p className="text-[12.5px] font-medium text-muted">
          Google Maps key not configured. Set <code className="font-mono">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> for Places
          autocomplete and a map pin. Lat/lng still save for River Mobile.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5" htmlFor={searchId}>
        <span className="text-[13px] font-bold">Search address (Philippines)</span>
        <input
          id={searchId}
          ref={searchRef}
          defaultValue={address}
          disabled={disabled || !mapsReady}
          placeholder={mapsReady ? "Start typing a street or landmark…" : "Loading Maps…"}
          className="h-12 w-full rounded-2xl border border-grey-200 bg-white px-4 text-[15px] font-medium outline-none focus:border-ink"
        />
      </label>
      <Input
        label="Street address (editable)"
        value={address}
        disabled={disabled}
        onChange={(e) =>
          onChange({
            address: e.target.value,
            location: location
              ? { ...location, formattedAddress: e.target.value || location.formattedAddress }
              : null,
          })
        }
      />
      <div ref={mapEl} className="h-[220px] w-full overflow-hidden rounded-2xl border border-grey-200 bg-grey-100 lg:h-[280px]" />
      <p className="text-[12.5px] font-medium text-muted">
        Drag the pin or tap the map. River Mobile uses this location to find your shop.
        {location ? (
          <>
            {" "}
            Pin: {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
          </>
        ) : null}
      </p>
    </div>
  );
}
