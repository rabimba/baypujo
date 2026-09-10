/* Shared config for verify-* e2e scripts — city-driven. */
import { readFileSync } from "node:fs";
import path from "node:path";

export function cityConfig() {
  const env = process.env.PB_CITY;
  const cityId =
    env ??
    (JSON.parse(
      readFileSync(path.join(process.cwd(), "site.config.json"), "utf-8"),
    ).city);
  const city = JSON.parse(
    readFileSync(
      path.join(process.cwd(), "data", "cities", cityId, "city.json"),
      "utf-8",
    ),
  );
  return { cityId, ...city };
}

/** Serve root for GH-Pages sim, e.g. http://localhost:3000/baypujo */
export function baseUrl(city) {
  const port = process.env.VERIFY_PORT ?? "3000";
  const base = process.env.PB_BASE_PATH ?? `/${city.repoName}`;
  return `http://localhost:${port}${base}`;
}

/** A plausible in-metro geolocation fix for the browser context. */
export function inMetroGeo(city) {
  return { latitude: city.center.lat, longitude: city.center.lng };
}
