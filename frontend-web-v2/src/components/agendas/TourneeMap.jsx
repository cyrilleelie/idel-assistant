import { useMemo, useEffect, useRef, useState } from 'react';
import { geocodeAddress, loader } from '../../utils/geocode';

const CARE_TYPE_LABELS = {
  soins_infirmiers: 'Soins infirmiers',
  prise_de_sang: 'Prise de sang',
  injection: 'Injection',
  pansement: 'Pansement',
  perfusion: 'Perfusion',
  toilette: 'Toilette',
  autre: 'Autre',
};

export default function TourneeMap({ appointments, patients, cabinetData, slotName }) {
  const [mapEl, setMapEl] = useState(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const directionsRendererRef = useRef(null);
  const infoWindowRef = useRef(null);

  const [geocoded, setGeocoded] = useState(() => new Map());
  const [geocoding, setGeocoding] = useState(false);

  const patientsMap = useMemo(() => {
    const m = new Map();
    for (const p of patients) m.set(p.id, p);
    return m;
  }, [patients]);

  const cabinetCoords = useMemo(() => {
    if (cabinetData?.lat && cabinetData?.lon) return [cabinetData.lat, cabinetData.lon];
    return null;
  }, [cabinetData]);

  // Geocode cabinet address if no coords
  useEffect(() => {
    if (cabinetCoords || !cabinetData?.address) return;
    let cancelled = false;
    geocodeAddress(cabinetData.address).then(coords => {
      if (!cancelled && coords) {
        setGeocoded(prev => { const next = new Map(prev); next.set('__cabinet__', coords); return next; });
      }
    });
    return () => { cancelled = true; };
  }, [cabinetCoords, cabinetData?.address]);

  const effectiveCabinetCoords = cabinetCoords || geocoded.get('__cabinet__') || null;

  const sorted = useMemo(
    () => [...appointments].sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [appointments],
  );

  // Geocode patient addresses that lack lat/lon
  useEffect(() => {
    const toGeocode = [];
    for (const appt of sorted) {
      if (appt._apiLocationType === 'office') continue;
      const patient = patientsMap.get(appt.patientId);
      if (!patient) continue;
      if (patient._apiLat != null && patient._apiLon != null) continue;
      if (geocoded.has(appt.patientId)) continue;
      if (patient.address) {
        toGeocode.push({ id: appt.patientId, address: patient.address });
      }
    }
    if (toGeocode.length === 0) return;

    let cancelled = false;
    setGeocoding(true);

    (async () => {
      for (const { id, address } of toGeocode) {
        if (cancelled) break;
        const coords = await geocodeAddress(address);
        if (!cancelled) {
          setGeocoded(prev => { const next = new Map(prev); next.set(id, coords); return next; });
        }
      }
      if (!cancelled) setGeocoding(false);
    })();

    return () => { cancelled = true; };
  }, [sorted, patientsMap, geocoded]);

  // Resolve coordinates for each appointment
  const points = useMemo(() => {
    return sorted.map((appt, idx) => {
      let lat = null, lon = null;
      if (appt._apiLocationType === 'office' && effectiveCabinetCoords) {
        [lat, lon] = effectiveCabinetCoords;
      } else {
        const patient = patientsMap.get(appt.patientId);
        if (patient) {
          if (patient._apiLat != null && patient._apiLon != null) {
            lat = patient._apiLat;
            lon = patient._apiLon;
          } else {
            const gc = geocoded.get(appt.patientId);
            if (gc) { [lat, lon] = gc; }
          }
        }
      }
      return { appt, idx: idx + 1, lat, lon };
    }).filter(p => p.lat != null && p.lon != null);
  }, [sorted, patientsMap, effectiveCabinetCoords, geocoded]);

  // Create Google Map when container mounts
  useEffect(() => {
    if (!mapEl) return;

    let cancelled = false;

    loader.importLibrary('maps').then(({ Map }) => {
      if (cancelled || !mapEl) return;
      const map = new Map(mapEl, {
        center: { lat: 46.6, lng: 2.5 },
        zoom: 6,
        mapId: 'TOURNEE_MAP',
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: 'cooperative',
      });
      mapInstanceRef.current = map;
    });

    return () => {
      cancelled = true;
      mapInstanceRef.current = null;
    };
  }, [mapEl]);

  // Update markers, directions route, and info windows when points change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Cleanup previous markers
    for (const m of markersRef.current) m.map = null;
    markersRef.current = [];
    if (directionsRendererRef.current) {
      directionsRendererRef.current.setMap(null);
      directionsRendererRef.current = null;
    }
    if (infoWindowRef.current) {
      infoWindowRef.current.close();
      infoWindowRef.current = null;
    }

    if (points.length === 0) return;

    let cancelled = false;

    loader.importLibrary('marker').then(({ AdvancedMarkerElement, PinElement }) => {
      if (cancelled || !mapInstanceRef.current) return;
      const currentMap = mapInstanceRef.current;
      const newMarkers = [];

      // Shared InfoWindow (only one open at a time)
      const infoWindow = new google.maps.InfoWindow();
      infoWindowRef.current = infoWindow;

      // Cabinet marker
      if (effectiveCabinetCoords) {
        const pin = new PinElement({
          background: '#059669',
          borderColor: '#fff',
          glyphColor: '#fff',
          glyph: 'C',
          scale: 1.2,
        });
        const marker = new AdvancedMarkerElement({
          map: currentMap,
          position: { lat: effectiveCabinetCoords[0], lng: effectiveCabinetCoords[1] },
          content: pin.element,
          title: 'Cabinet',
        });
        marker.addListener('click', () => {
          infoWindow.setContent(
            `<div style="font-family:system-ui;font-size:13px;line-height:1.4;min-width:140px">` +
            `<strong style="color:#059669">Cabinet</strong>` +
            (cabinetData?.name ? `<div>${cabinetData.name}</div>` : '') +
            (cabinetData?.address ? `<div style="color:#64748b;font-size:12px;margin-top:2px">${cabinetData.address}</div>` : '') +
            `</div>`
          );
          infoWindow.open({ anchor: marker, map: currentMap });
        });
        newMarkers.push(marker);
      }

      // Appointment markers with rich info windows
      for (const p of points) {
        const patient = patientsMap.get(p.appt.patientId);
        const careLabel = CARE_TYPE_LABELS[p.appt._apiCareType] || p.appt._apiCareType || '';
        const locLabel = p.appt._apiLocationType === 'office' ? 'Au cabinet' : 'À domicile';

        const pin = new PinElement({
          background: '#2563eb',
          borderColor: '#fff',
          glyphColor: '#fff',
          glyph: String(p.idx),
          scale: 1.0,
        });
        const marker = new AdvancedMarkerElement({
          map: currentMap,
          position: { lat: p.lat, lng: p.lon },
          content: pin.element,
          title: `${p.idx}. ${p.appt.patient || ''}`,
        });

        marker.addListener('click', () => {
          infoWindow.setContent(
            `<div style="font-family:system-ui;font-size:13px;line-height:1.5;min-width:180px;max-width:260px">` +
            `<strong style="font-size:14px">${p.idx}. ${p.appt.patient || 'Patient inconnu'}</strong>` +
            `<div style="margin-top:4px;display:flex;align-items:center;gap:4px;color:#2563eb;font-weight:600">${p.appt.startTime} – ${p.appt.endTime}</div>` +
            (careLabel ? `<div style="margin-top:2px;color:#475569">${careLabel}</div>` : '') +
            `<div style="margin-top:2px;font-size:12px;color:#64748b">${locLabel}</div>` +
            (patient?.address ? `<div style="margin-top:4px;font-size:12px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:4px">${patient.address}</div>` : '') +
            `</div>`
          );
          infoWindow.open({ anchor: marker, map: currentMap });
        });

        newMarkers.push(marker);
      }

      markersRef.current = newMarkers;

      // Build the route with Directions API (driving)
      const allStops = [];
      if (effectiveCabinetCoords) allStops.push({ lat: effectiveCabinetCoords[0], lng: effectiveCabinetCoords[1] });
      allStops.push(...points.map(p => ({ lat: p.lat, lng: p.lon })));
      if (effectiveCabinetCoords) allStops.push({ lat: effectiveCabinetCoords[0], lng: effectiveCabinetCoords[1] });

      if (allStops.length >= 2) {
        const origin = allStops[0];
        const destination = allStops[allStops.length - 1];
        const waypoints = allStops.slice(1, -1).map(loc => ({ location: loc, stopover: true }));

        const directionsService = new google.maps.DirectionsService();
        const directionsRenderer = new google.maps.DirectionsRenderer({
          map: currentMap,
          suppressMarkers: true,
          polylineOptions: {
            strokeColor: '#3b82f6',
            strokeOpacity: 0.7,
            strokeWeight: 4,
          },
        });
        directionsRendererRef.current = directionsRenderer;

        directionsService.route({
          origin,
          destination,
          waypoints,
          travelMode: google.maps.TravelMode.DRIVING,
        }).then(result => {
          if (!cancelled) directionsRenderer.setDirections(result);
        }).catch(() => {
          // Fallback: straight polyline if Directions API fails
          if (cancelled) return;
          const polyline = new google.maps.Polyline({
            path: allStops,
            strokeColor: '#3b82f6',
            strokeOpacity: 0.7,
            strokeWeight: 3,
            geodesic: true,
            map: currentMap,
          });
          directionsRendererRef.current = { setMap: (m) => polyline.setMap(m) };
        });
      }

      // Fit bounds
      const bounds = new google.maps.LatLngBounds();
      for (const p of points) bounds.extend({ lat: p.lat, lng: p.lon });
      if (effectiveCabinetCoords) bounds.extend({ lat: effectiveCabinetCoords[0], lng: effectiveCabinetCoords[1] });
      currentMap.fitBounds(bounds, 30);
      // Cap zoom after fitBounds settles (avoids over-zoom when points are close)
      const listener = currentMap.addListener('idle', () => {
        google.maps.event.removeListener(listener);
        if (currentMap.getZoom() > 16) currentMap.setZoom(16);
      });
    });

    return () => { cancelled = true; };
  }, [mapEl, points, effectiveCabinetCoords, patientsMap, cabinetData]);

  const hasPoints = points.length > 0;

  return (
    <div className="space-y-1">
      {slotName && (
        <div className="text-xs font-semibold text-slate-600 px-1">{slotName}</div>
      )}

      {!hasPoints && (
        <div className="flex flex-col items-center justify-center aspect-square bg-slate-50 rounded-lg border border-dashed border-slate-300 text-sm text-slate-400 gap-2">
          {geocoding ? (
            <>
              <div className="animate-spin h-5 w-5 border-2 border-blue-400 border-t-transparent rounded-full" />
              <span>Géocodage des adresses...</span>
            </>
          ) : (
            <span>Aucune coordonnée — vérifiez les adresses patients</span>
          )}
        </div>
      )}

      {hasPoints && (
        <div
          ref={setMapEl}
          className="rounded-lg overflow-hidden border border-slate-200 shadow-sm aspect-square"
        />
      )}
    </div>
  );
}
