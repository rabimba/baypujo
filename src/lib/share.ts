import type { PlanResult } from "./planner";
import { hmToMin, minToHm } from "./planner";
import { fmtDateLong, tithiBn } from "./pujas";
import { city } from "./city-data";

export interface ShareContext {
  date: string;
  startTime: string;
  endTime: string;
  dwellMin: number;
  result: PlanResult;
  originLabel?: string;
  /** Origin coords for the mini route sketch. */
  originLat?: number;
  originLng?: number;
}

/** Attribution line appended to every shared text. */
export function brandLine(siteUrl?: string): string {
  const host = (siteUrl ?? "").replace(/^https?:\/\//, "").replace(/\/+$/, "");
  return host
    ? `— planned on ${city.brand} (${host})`
    : `— planned on ${city.brand}`;
}

/** Full itinerary text — WhatsApp / native share / clipboard.
 *  Always carries the brand attribution line. */
export function buildShareText(ctx: ShareContext, siteUrl?: string): string {
  const { date, startTime, endTime, dwellMin, result } = ctx;
  const L: string[] = [];
  L.push(`${city.brandBn} — Pujo Parikrama Plan`);
  L.push(
    `${tithiBn(date) ? tithiBn(date) + " · " : ""}${fmtDateLong(date)}`,
  );
  L.push(
    `Free ${startTime}–${endTime} · ${dwellMin} min per pujo` +
      (ctx.originLabel ? ` · from ${ctx.originLabel}` : ""),
  );
  L.push("");
  if (result.stops.length === 0) {
    L.push("No pujas fit this window — open the planner to tweak it.");
  } else {
    result.stops.forEach((s, i) => {
      const visitStart = minToHm(Math.max(s.arrive, hmToMin(startTime)));
      L.push(`${i + 1}. ${s.puja.name}`);
      L.push(
        `    ${visitStart}–${minToHm(s.depart)} · ${s.puja.venue.name}, ${s.puja.venue.city}`,
      );
      if (i > 0) L.push(`    ↳ ~${s.driveFromPrevMin} min drive from previous`);
      if (s.events.length > 0) {
        L.push(
          `    ধরুন: ${s.events.map((e) => e.title).join(", ").slice(0, 90)}`,
        );
      }
    });
    const h = Math.floor(result.totalDriveMin / 60);
    const m = result.totalDriveMin % 60;
    L.push("");
    L.push(
      `${result.stops.length} pujas · ${Math.round(result.totalDriveMi)} mi · ` +
        `${h}h${m ? ` ${m}m` : ""} driving`,
    );
    if (result.skipped.length > 0) {
      L.push(`Skipped ${result.skipped.length} (closing times / window)`);
    }
  }
  L.push(brandLine(siteUrl));
  return L.join("\n");
}

/** Compact one-line-per-stop text for SMS length limits.
 *  Brand line kept short so it survives carrier truncation. */
export function buildShareTextCompact(ctx: ShareContext, siteUrl?: string): string {
  const { date, startTime, result } = ctx;
  const head = `পুজো পরিক্রমা ${fmtDateLong(date)}`;
  if (result.stops.length === 0)
    return `${head} — no pujas fit yet\n${brandLine(siteUrl)}`;
  const rows = result.stops.map((s, i) => {
    const visitStart = minToHm(Math.max(s.arrive, hmToMin(startTime)));
    return `${i + 1}. ${visitStart}-${minToHm(s.depart)} ${s.puja.name} (${s.puja.venue.city})`;
  });
  return [head, ...rows, brandLine(siteUrl)].join("\n");
}

export interface ShareParams {
  date: string;
  start: string;
  end: string;
  dwell: number;
  must: string[];
  lat?: number;
  lng?: number;
  label?: string;
}

/** Query string that prefills the planner on someone else's device. */
export function buildShareQuery(p: ShareParams): string {
  const sp = new URLSearchParams();
  sp.set("date", p.date);
  sp.set("start", p.start);
  sp.set("end", p.end);
  sp.set("dwell", String(p.dwell));
  if (p.must.length > 0) sp.set("must", p.must.join(","));
  if (p.lat != null && p.lng != null) {
    sp.set("lat", p.lat.toFixed(5));
    sp.set("lng", p.lng.toFixed(5));
  }
  if (p.label) sp.set("label", p.label);
  return sp.toString();
}

export function parseShareQuery(
  sp: URLSearchParams,
): ShareParams | null {
  const date = sp.get("date");
  if (!date) return null;
  const lat = sp.get("lat");
  const lng = sp.get("lng");
  return {
    date,
    start: sp.get("start") ?? "10:00",
    end: sp.get("end") ?? "20:00",
    dwell: Number(sp.get("dwell") ?? "60") || 60,
    must: (sp.get("must") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    ...(lat && lng
      ? { lat: Number(lat), lng: Number(lng) }
      : {}),
    ...(sp.get("label") ? { label: sp.get("label")! } : {}),
  };
}

const C = {
  sindoor: "#b3231f",
  sindoorDark: "#8c1714",
  sindoorDeep: "#6f100e",
  kash: "#f5e9d0",
  pandal: "#fdf6ec",
  dhunuchi: "#c47f2e",
  sona: "#e8b64c",
  ink: "#2b1d16",
  gray: "#6b625c",
};

const BN_FONT =
  '"Noto Sans Bengali", "Bengali Sangam MN", "Bangla MN", "Nirmala UI", system-ui, sans-serif';
const UI_FONT =
  'system-ui, -apple-system, "Segoe UI", "Helvetica Neue", sans-serif';

function roundRect(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function wrapText(
  g: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxW: number,
  lineH: number,
): number {
  const words = text.split(" ");
  let line = "";
  let yy = y;
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (g.measureText(test).width > maxW && line) {
      g.fillText(line, x, yy);
      yy += lineH;
      line = w;
    } else {
      line = test;
    }
  }
  if (line) {
    g.fillText(line, x, yy);
    yy += lineH;
  }
  return yy;
}

/** Eight-petal shiuli flower mark (site logo), centered at cx,cy. */
function drawShiuliMark(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  color: string,
) {
  g.fillStyle = color;
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    g.beginPath();
    g.arc(cx + r * 0.62 * Math.cos(a), cy + r * 0.62 * Math.sin(a), r * 0.3, 0, Math.PI * 2);
    g.fill();
  }
  g.beginPath();
  g.arc(cx, cy, r * 0.24, 0, Math.PI * 2);
  g.fill();
}

/** Durga-eye motif for the footer brand strip. */
function drawEyeMark(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  color: string,
) {
  const h = w * 0.42;
  g.save();
  g.strokeStyle = color;
  g.fillStyle = "transparent";
  g.lineWidth = Math.max(1.5, w * 0.035);
  g.beginPath();
  g.moveTo(cx - w / 2, cy);
  g.bezierCurveTo(cx - w * 0.25, cy - h, cx + w * 0.25, cy - h, cx + w / 2, cy);
  g.bezierCurveTo(cx + w * 0.25, cy + h, cx - w * 0.25, cy + h, cx - w / 2, cy);
  g.stroke();
  g.beginPath();
  g.arc(cx, cy, h * 0.42, 0, Math.PI * 2);
  g.stroke();
  g.beginPath();
  g.arc(cx, cy, h * 0.18, 0, Math.PI * 2);
  g.fillStyle = color;
  g.fill();
  g.restore();
}

/**
 * Draws a branded plan card (header, stops, mini route map, totals)
 * and returns the canvas — for PNG download / native image share.
 * Branding (logo mark, site name, URL) appears in header and footer on
 * every card so shares are always attributable.
 */
export async function drawPlanCanvas(
  ctx: ShareContext,
  siteUrl?: string,
): Promise<HTMLCanvasElement> {
  if (typeof document !== "undefined" && document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // font loading optional
    }
  }
  const { date, startTime, endTime, dwellMin, result } = ctx;
  const W = 900;
  const pad = 48;
  const headerH = 168;
  const infoH = 54;
  const mapH = result.stops.length > 0 ? 200 : 0;
  const stopH = 108;
  const footerH = 84;
  const H =
    headerH +
    infoH +
    mapH +
    Math.max(result.stops.length, 1) * stopH +
    (result.skipped.length > 0 ? 40 : 0) +
    footerH;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext("2d")!;
  g.fillStyle = C.pandal;
  g.fillRect(0, 0, W, H);

  // header band
  const grad = g.createLinearGradient(0, 0, W, headerH);
  grad.addColorStop(0, C.sindoorDeep);
  grad.addColorStop(0.45, C.sindoor);
  grad.addColorStop(1, "#d23c33");
  g.fillStyle = grad;
  g.fillRect(0, 0, W, headerH);
  g.strokeStyle = "rgba(232,182,76,.45)";
  g.lineWidth = 1.5;
  roundRect(g, 12, 12, W - 24, headerH - 24, 18);
  g.stroke();

  g.textBaseline = "alphabetic";

  // header brand lockup: shiuli mark + পুজো পরিক্রমা + wordmark + URL
  drawShiuliMark(g, pad + 26, 62, 34, C.sona);
  g.fillStyle = C.pandal;
  g.font = `700 42px ${BN_FONT}`;
  g.fillText("পুজো পরিক্রমা", pad + 66, 74);
  g.fillStyle = C.sona;
  g.font = `600 19px ${UI_FONT}`;
  g.fillText("BAY AREA PUJO PARIKRAMA · DURGA PUJA 2026 GUIDE", pad + 67, 104);
  // right-aligned site URL (source attribution)
  const brandUrl = (siteUrl ?? "bayareapujo.parikrama").replace(/^https?:\/\//, "").replace(/\/+$/, "");
  g.font = `600 16px ${UI_FONT}`;
  g.textAlign = "right";
  g.fillStyle = C.sona;
  g.fillText(brandUrl, W - pad, 74);
  drawEyeMark(g, W - pad - g.measureText(brandUrl).width - 34, 68, 44, "rgba(232,182,76,.85)");
  g.textAlign = "left";
  g.fillStyle = "rgba(253,246,236,.92)";
  g.font = `600 24px ${UI_FONT}`;
  g.fillText(
    `${tithiBn(date) ? tithiBn(date) + " · " : ""}${fmtDateLong(date)}`,
    pad,
    140,
  );

  // info row
  let y = headerH + 34;
  g.fillStyle = C.ink;
  g.font = `500 17px ${UI_FONT}`;
  g.fillText(
    `Free ${startTime}–${endTime}  ·  ${dwellMin} min per pujo` +
      (ctx.originLabel ? `  ·  from ${ctx.originLabel}` : ""),
    pad,
    y,
  );

  // mini route map
  if (mapH > 0 && result.stops.length > 0) {
    y += 24;
    const mX = pad;
    const mY = y;
    const mW = W - pad * 2;
    const mH = mapH - 32;
    g.fillStyle = C.kash;
    roundRect(g, mX, mY, mW, mH, 14);
    g.fill();
    g.strokeStyle = "rgba(196,127,46,.4)";
    g.stroke();

    // project lat/lng of origin + stops into the box (linear, padded)
    const pts = [
      ...(ctx.originLat != null && ctx.originLng != null
        ? [{ lat: ctx.originLat, lng: ctx.originLng, n: null as number | null }]
        : []),
      ...result.stops.map((s, i) => ({
        lat: s.puja.venue.lat,
        lng: s.puja.venue.lng,
        n: i + 1,
      })),
    ];
    const lats = pts.map((p) => p.lat);
    const lngs = pts.map((p) => p.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const spanLat = maxLat - minLat || 0.01;
    const spanLng = maxLng - minLng || 0.01;
    const inset = 28;
    const px = (p: { lat: number; lng: number }) => ({
      x:
        mX +
        inset +
        ((p.lng - minLng) / spanLng) * (mW - inset * 2),
      y:
        mY +
        mH -
        inset -
        ((p.lat - minLat) / spanLat) * (mH - inset * 2),
    });

    // dashed route
    const coords = pts.map(px);
    g.save();
    g.strokeStyle = C.sindoor;
    g.lineWidth = 2.5;
    g.setLineDash([7, 6]);
    g.beginPath();
    coords.forEach((c, i) => (i ? g.lineTo(c.x, c.y) : g.moveTo(c.x, c.y)));
    g.stroke();
    g.restore();

    // start pin + numbered stop pins
    coords.forEach((c, i) => {
      const n = pts[i].n;
      g.beginPath();
      g.arc(c.x, c.y, n ? 13 : 8, 0, Math.PI * 2);
      g.fillStyle = n ? C.sindoor : C.ink;
      g.fill();
      g.strokeStyle = C.pandal;
      g.lineWidth = 2.5;
      g.stroke();
      if (n) {
        g.fillStyle = "#fff";
        g.font = `700 12px ${UI_FONT}`;
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText(String(n), c.x, c.y + 0.5);
        g.textAlign = "left";
        g.textBaseline = "alphabetic";
      }
    });
    g.fillStyle = C.gray;
    g.font = `400 13px ${UI_FONT}`;
    g.fillText("route sketch (not to scale)", mX + 12, mY + mH - 10);
    y += mH + 8;
  }

  // stops
  y += 22;
  result.stops.forEach((s, i) => {
    // number circle
    g.fillStyle = C.sindoor;
    g.beginPath();
    g.arc(pad + 16, y - 6, 16, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#fff";
    g.font = `700 15px ${UI_FONT}`;
    g.textAlign = "center";
    g.fillText(String(i + 1), pad + 16, y - 1);
    g.textAlign = "left";

    const x = pad + 48;
    g.fillStyle = C.ink;
    g.font = `700 21px ${UI_FONT}`;
    const nameLines = wrapText(g, s.puja.name, x, y, W - pad - x, 26);
    g.fillStyle = C.gray;
    g.font = `400 16px ${UI_FONT}`;
    const visitStart = minToHm(Math.max(s.arrive, hmToMin(startTime)));
    let yy = nameLines + 2;
    g.fillText(
      `${visitStart} – ${minToHm(s.depart)}  ·  ${s.puja.venue.name}, ${s.puja.venue.city}`,
      x,
      yy,
    );
    yy += 24;
    if (i > 0) {
      g.fillStyle = "#a39a92";
      g.fillText(`↳ ~${s.driveFromPrevMin} min drive from previous`, x, yy);
      yy += 22;
    }
    if (s.events.length > 0) {
      g.fillStyle = C.dhunuchi;
      g.font = `500 15px ${BN_FONT}`;
      yy = wrapText(
        g,
        `ধরুন: ${s.events.map((e) => e.title).join(", ").slice(0, 90)}`,
        x,
        yy,
        W - pad - x,
        21,
      );
    }
    y += stopH;
  });
  if (result.stops.length === 0) {
    g.fillStyle = C.gray;
    g.font = `500 19px ${UI_FONT}`;
    g.fillText("No pujas fit this window yet.", pad, y);
    y += stopH;
  }

  if (result.skipped.length > 0) {
    g.fillStyle = "#a39a92";
    g.font = `400 15px ${UI_FONT}`;
    g.fillText(
      `Skipped ${result.skipped.length} pujas (closing times / window)`,
      pad,
      y,
    );
    y += 40;
  }

  // footer band
  const fy = H - footerH;
  g.fillStyle = C.ink;
  g.fillRect(0, fy, W, footerH);
  g.fillStyle = C.kash;
  g.font = `600 18px ${UI_FONT}`;
  const hh = Math.floor(result.totalDriveMin / 60);
  const mm = result.totalDriveMin % 60;
  g.fillText(
    `${result.stops.length} pujas  ·  ${Math.round(result.totalDriveMi)} mi  ·  ` +
      `${hh}h${mm ? ` ${mm}m` : ""} on the road`,
    pad,
    fy + 34,
  );
  g.fillStyle = C.sona;
  g.font = `700 17px ${BN_FONT}`;
  g.fillText("শুভ পূজা! শুভ দুর্গাপূজা ২০২৬", pad, fy + 64);
  // attribution: planned on <site>
  g.textAlign = "right";
  g.fillStyle = C.kash;
  g.font = `500 14px ${UI_FONT}`;
  g.fillText(`planned on ${brandUrl}`, W - pad, fy + 64);
  drawShiuliMark(g, W - pad - g.measureText(`planned on ${brandUrl}`).width - 26, fy + 58, 14, "rgba(232,182,76,.8)");
  g.textAlign = "left";

  return canvas;
}
