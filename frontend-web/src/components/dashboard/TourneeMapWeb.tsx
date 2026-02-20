import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import type { MapData } from "@/types/models";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Fix Leaflet default icon issue with Vite bundler
delete (L.Icon.Default.prototype as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function createColoredIcon(color: string) {
  return L.divIcon({
    className: "custom-marker",
    html: `<div style="background-color:${color};width:24px;height:24px;border-radius:50%;border:3px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  });
}

function FitBounds({ stops }: { stops: MapData["stops"] }) {
  const map = useMap();
  const fitted = useRef(false);

  useEffect(() => {
    if (stops.length > 0 && !fitted.current) {
      const bounds = L.latLngBounds(stops.map((s) => [s.lat, s.lon]));
      map.fitBounds(bounds, { padding: [30, 30] });
      fitted.current = true;
    }
  }, [stops, map]);

  return null;
}

interface TourneeMapWebProps {
  mapData: MapData | null;
  isLoading: boolean;
}

export function TourneeMapWeb({ mapData, isLoading }: TourneeMapWebProps) {
  const stops = mapData?.stops ?? [];
  const center: [number, number] = mapData
    ? [mapData.center_lat, mapData.center_lon]
    : [47.2184, -1.5536]; // Nantes default

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Carte des visites</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="h-[400px] w-full">
          {isLoading ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Chargement de la carte...
            </div>
          ) : (
            <MapContainer
              center={center}
              zoom={12}
              className="h-full w-full"
              scrollWheelZoom
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <FitBounds stops={stops} />

              {stops.map((stop, index) => (
                <Marker
                  key={index}
                  position={[stop.lat, stop.lon]}
                  icon={createColoredIcon(stop.sector_color || "#3B82F6")}
                >
                  <Popup>
                    <strong>{stop.patient_name}</strong>
                    <br />
                    {stop.care_type} - {stop.time}
                    {stop.sector_name && (
                      <>
                        <br />
                        Secteur : {stop.sector_name}
                      </>
                    )}
                  </Popup>
                </Marker>
              ))}

              {stops.length > 1 && (
                <Polyline
                  positions={stops.map((s) => [s.lat, s.lon])}
                  color="#2563EB"
                  weight={3}
                  opacity={0.7}
                  dashArray="8"
                />
              )}
            </MapContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
