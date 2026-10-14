"use client";

import { Button, Input } from "@river-apps/ui";
import { LocateFixed } from "lucide-react";
import { useState } from "react";
import { ShopMap } from "@/components/maps/shop-map";
import { inPhilippines, PH_DEFAULT, type ShopLocationValue } from "@/lib/maps";

const MAP_BOX = "h-[240px] w-full overflow-hidden rounded-2xl border border-grey-200 lg:h-[300px]";

/** Read-only shop map (staff, guests, anywhere the location is shown). */
export function ShopLocationMap({ location, address }: { location: ShopLocationValue | null; address?: string | null }) {
  if (!location) {
    return (
      <p className="rounded-2xl border border-dashed border-grey-200 px-4 py-6 text-center text-[13.5px] font-semibold text-muted">
        No map pin yet. The shop owner can set it in Settings.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <ShopMap position={location} className={MAP_BOX} />
      {address ? <p className="text-[13px] font-medium text-muted">{address}</p> : null}
    </div>
  );
}

/** Address + draggable River Maps pin. Saves lat/lng that River Mobile reads through /v1/shops/:id. */
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
  const [locating, setLocating] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  const setPin = (lat: number, lng: number) => {
    if (!inPhilippines(lat, lng)) {
      setHint("That pin is outside the Philippines. Move it to your shop.");
      return;
    }
    setHint(null);
    onChange({
      address,
      location: {
        lat: Number(lat.toFixed(6)),
        lng: Number(lng.toFixed(6)),
        formattedAddress: address || null,
        placeId: null,
      },
    });
  };

  const useMyLocation = () => {
    if (!("geolocation" in navigator)) {
      setHint("This browser can't share its location. Drag the pin instead.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocating(false);
        setPin(p.coords.latitude, p.coords.longitude);
      },
      () => {
        setLocating(false);
        setHint("Location permission was denied. Drag the pin to your shop.");
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

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
            location: location ? { ...location, formattedAddress: e.target.value || null } : null,
          })
        }
      />
      <div className="relative">
        <ShopMap
          position={location ?? (disabled ? null : PH_DEFAULT)}
          editable={!disabled}
          onMove={(p) => setPin(p.lat, p.lng)}
          className={MAP_BOX}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="secondary" disabled={disabled || locating} leadingIcon={<LocateFixed size={16} />} onClick={useMyLocation}>
          {locating ? "Locating…" : "Use my current location"}
        </Button>
        {location && !disabled ? (
          <Button type="button" size="sm" variant="ghost" onClick={() => onChange({ address, location: null })}>
            Remove pin
          </Button>
        ) : null}
      </div>
      <p className="text-[12.5px] font-medium text-muted">
        {disabled
          ? "Only the shop owner can move the pin."
          : "Drag the pin or tap the map (two fingers to pan on phones). River Mobile uses this pin to find your shop."}
        {location ? ` Pin: ${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}.` : " No pin saved yet."}
      </p>
      {hint ? <p role="status" className="text-[13px] font-semibold">{hint}</p> : null}
    </div>
  );
}
