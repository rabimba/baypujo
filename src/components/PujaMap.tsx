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
        html: `<div style="width:32px;height:42px;filter:drop-shadow(0 3px 6px rgba(0,0,0,0.4));cursor:pointer;display:block;" title="${p.name}"><svg viewBox="0 0 32 42" width="32" height="42" fill="none" style="display:block;"><path d="M16 0 C7.2 0, 0 7.2, 0 16 C0 27, 13.5 39.5, 16 42 C18.5 39.5, 32 27, 32 16 C32 7.2, 24.8 0, 16 0 Z" fill="${color}" stroke="#ffffff" stroke-width="2.5"/><path d="M16 6 C14.5 10, 14.5 13, 16 16 C17.5 13, 17.5 10, 16 6 Z" fill="#ffd700"/><path d="M7 19 C10 14, 14 14, 15.5 19 C14 22, 10 22, 7 19 Z" fill="#ffffff"/><circle cx="11.5" cy="18.8" r="1.3" fill="#1c1917"/><path d="M25 19 C22 14, 18 14, 16.5 19 C18 22, 22 22, 25 19 Z" fill="#ffffff"/><circle cx="20.5" cy="18.8" r="1.3" fill="#1c1917"/><circle cx="13.5" cy="24" r="2.8" stroke="#ffd700" stroke-width="1.3" fill="none"/><circle cx="10.7" cy="24" r="0.8" fill="#ffd700"/></svg></div>`,
        iconSize: [32, 42],
        iconAnchor: [16, 42],
        popupAnchor: [0, -40],
      });
      L.marker([p.venue.lat, p.venue.lng], { icon })
        .bindPopup(
          `<strong>${p.name}</strong><br>${p.venue.name}, ${p.venue.city}<br>${p.dateLabel}<br><a href="./${p.id}/" style="color:#b3231f;font-weight:600;text-decoration:underline;display:inline-block;margin-top:4px;">View details →</a>`,
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
