import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Patient, Sector } from "@/types/models";

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
    html: `<div style="background-color:${color};width:20px;height:20px;border-radius:50%;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -10],
  });
}

function FitBounds({ patients }: { patients: Patient[] }) {
  const map = useMap();
  const fitted = useRef(false);

  useEffect(() => {
    const withCoords = patients.filter((p) => p.lat && p.lon);
    if (withCoords.length > 0 && !fitted.current) {
      const bounds = L.latLngBounds(
        withCoords.map((p) => [p.lat!, p.lon!])
      );
      map.fitBounds(bounds, { padding: [30, 30] });
      fitted.current = true;
    }
  }, [patients, map]);

  return null;
}

interface SectorMapProps {
  patients: Patient[];
  sectors: Sector[];
}

export function SectorMap({ patients, sectors }: SectorMapProps) {
  const sectorMap = new Map(sectors.map((s) => [s.id, s]));
  const withCoords = patients.filter((p) => p.lat && p.lon);
  const defaultCenter: [number, number] = [47.2184, -1.5536]; // Nantes

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Carte des secteurs</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="h-[500px] w-full">
          <MapContainer
            center={defaultCenter}
            zoom={12}
            className="h-full w-full"
            scrollWheelZoom
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FitBounds patients={withCoords} />

            {withCoords.map((patient) => {
              const sector = patient.sector_id
                ? sectorMap.get(patient.sector_id)
                : undefined;
              const color = sector?.color || "#94A3B8";

              return (
                <Marker
                  key={patient.id}
                  position={[patient.lat!, patient.lon!]}
                  icon={createColoredIcon(color)}
                >
                  <Popup>
                    <strong>
                      {patient.last_name} {patient.first_name}
                    </strong>
                    <br />
                    {patient.city}
                    {sector && (
                      <>
                        <br />
                        Secteur : {sector.name}
                      </>
                    )}
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>
      </CardContent>
    </Card>
  );
}
