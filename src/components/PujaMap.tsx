"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { REGION_COLORS, city } from "../lib/pujas";
import type { Puja } from "../lib/types";

export default function PujaMap({
  pujas,
  className,
  route,
  center = [city.center.lat, city.center.lng],
  zoom = city.zoom,
}: {
  pujas: Puja[];
  className?: string;
  route?: { lat: number; lng: number; label: string; color?: string }[];
  center?: [number, number];
  zoom?: number;
}) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const routeRef = useRef<L.LayerGroup | null>(null);

  // create map once
  useEffect(() => {
    if (!divRef.current || mapRef.current) return;
    const map = L.map(divRef.current, {
      scrollWheelZoom: false,
      zoomAnimation: false, // avoid post-remove zoom-transition race (Leaflet _leaflet_pos error)
      fadeAnimation: false,
    }).setView(center, zoom);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 18,
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    routeRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      // tear down exactly once when component unmounts
      mapRef.current = null;
      layerRef.current = null;
      routeRef.current = null;
      map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // update markers when pujas change
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    pujas.forEach((p) => {
      const color = REGION_COLORS[p.region] ?? "#3388ff";
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:24px;height:24px;border-radius:50%;background:${color};border:2px solid #ffffff;box-shadow:0 2px 5px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;" title="${p.name}"><svg viewBox="0 0 100 100" width="16" height="16" fill="none" style="display:block;"><path d="M50 16 C46 26, 46 33, 50 41 C54 33, 54 26, 50 16 Z" fill="#ffd700" stroke="#ffd700" stroke-width="1"/><path d="M22 52 C30 40, 42 40, 48 52 C42 60, 30 60, 22 52 Z" stroke="white" stroke-width="4" fill="none"/><circle cx="35" cy="51" r="3.5" fill="white" stroke="none"/><path d="M78 52 C70 40, 58 40, 52 52 C58 60, 70 60, 78 52 Z" stroke="white" stroke-width="4" fill="none"/><circle cx="65" cy="51" r="3.5" fill="white" stroke="none"/><circle cx="42" cy="66" r="7" stroke="#ffd700" stroke-width="2.5" fill="none"/><circle cx="35" cy="66" r="1.5" fill="#ffd700" stroke="none"/></svg></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });
      L.marker([p.venue.lat, p.venue.lng], { icon })
        .bindPopup(
          `<strong>${p.name}</strong><br>${p.venue.name}, ${p.venue.city}<br>${p.dateLabel}<br><a href="/pujas/${p.id}/">View details →</a>`,
        )
        .addTo(layer);
    });
    const points = pujas.map((p) => [p.venue.lat, p.venue.lng] as [number, number]);
    if (points.length > 0) map.fitBounds(L.latLngBounds(points).pad(0.15));
  }, [pujas]);

  // update route when it changes
  useEffect(() => {
    const map = mapRef.current;
    const layer = routeRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    if (!route || route.length < 2) return;
    const latlngs = route.map((r) => [r.lat, r.lng] as [number, number]);
    L.polyline(latlngs, {
      color: "#b3231f",
      weight: 3,
      opacity: 0.75,
      dashArray: "8 6",
    }).addTo(layer);
    route.forEach((r, i) => {
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:24px;height:24px;border-radius:50%;background:${r.color ?? "#b3231f"};color:white;display:flex;align-items:center;justify-content:center;font:700 12px/1 sans-serif;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4)">${i + 1}</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });
      L.marker([r.lat, r.lng], { icon })
        .bindPopup(`<strong>Stop ${i + 1}</strong><br>${r.label}`)
        .addTo(layer);
    });
    map.fitBounds(L.latLngBounds(latlngs).pad(0.2));
  }, [route]);

  return (
    <div
      ref={divRef}
      className={className ?? "h-[420px] w-full rounded-2xl"}
    />
  );
}
