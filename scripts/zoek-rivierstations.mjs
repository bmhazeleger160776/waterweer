// Zoekt voor de plaatsen in data/nieuwe-rivierplaatsen.json het dichtstbijzijnde
// RWS-meetpunt met actuele waterstand (WATHTE, meting) en zet ze in data/locaties.json.
//
// Gebruik: node scripts/zoek-rivierstations.mjs
// Draai het daarna gerust nog eens: bestaande plaatsen worden bijgewerkt, niet dubbel toegevoegd.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LOC_PAD = path.join(ROOT, "data/locaties.json");
const NIEUW = JSON.parse(fs.readFileSync(path.join(ROOT, "data/nieuwe-rivierplaatsen.json"), "utf8"));
const locaties = JSON.parse(fs.readFileSync(LOC_PAD, "utf8"));
const BASE = "https://ddapi20-waterwebservices.rijkswaterstaat.nl";
const MAX_KM = 5;

async function post(pad, body, timeout = 300_000) {
  let fout;
  for (let poging = 0; poging < 3; poging++) {
    try {
      const res = await fetch(BASE + pad, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeout),
      });
      const tekst = await res.text();
      if (res.ok) return tekst.trim() ? JSON.parse(tekst) : {};
      fout = `HTTP ${res.status}: ${tekst.slice(0, 200)}`;
      if ([400, 404, 422].includes(res.status)) break;
    } catch (e) { fout = e.message; }
    await new Promise((r) => setTimeout(r, 1500 * (poging + 1)));
  }
  throw new Error(fout);
}
const get = (o, ...keys) => {
  if (!o || typeof o !== "object") return undefined;
  const lower = Object.fromEntries(Object.entries(o).map(([k, v]) => [k.toLowerCase(), v]));
  for (const k of keys) if (k.toLowerCase() in lower) return lower[k.toLowerCase()];
};
const code = (o, veld) => { const v = get(o, veld); return String((v && typeof v === "object" ? get(v, "Code") : v) ?? ""); };
const mid = (o, prefix) => { for (const [k, v] of Object.entries(o)) { const kl = k.toLowerCase(); if (kl.startsWith(prefix) && kl.endsWith("messageid")) return v; } };
const km = (a, b) => {
  const R = 6371, r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
const latlon = (l) => {
  const lat = Number(get(l, "Lat")), lon = Number(get(l, "Lon"));
  if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
  const x = Number(get(l, "X")), y = Number(get(l, "Y"));
  if (Math.abs(x) <= 180 && Math.abs(y) <= 90) return { lat: y, lon: x };
  return null; // andere stelsels slaan we over
};

async function laatste(stationCode) {
  const body = {
    AquoPlusWaarnemingMetadataLijst: [{ AquoMetadata: { Compartiment: { Code: "OW" }, Grootheid: { Code: "WATHTE" }, ProcesType: "meting" } }],
    LocatieLijst: [{ Code: stationCode }],
  };
  const res = await post("/ONLINEWAARNEMINGENSERVICES/OphalenLaatsteWaarnemingen", body, 60_000);
  let beste = null;
  for (const w of get(res, "WaarnemingenLijst") ?? [])
    for (const m of get(w, "MetingenLijst") ?? []) {
      const t = get(m, "Tijdstip"), v = get(get(m, "Meetwaarde") ?? {}, "Waarde_Numeriek");
      if (t && typeof v === "number" && v > -9000 && v < 9000 && (!beste || t > beste.t)) beste = { t, v };
    }
  return beste;
}

async function verwachtingDagen(stationCode) {
  const nu = Date.now();
  const res = await post("/ONLINEWAARNEMINGENSERVICES/OphalenWaarnemingen", {
    Locatie: { Code: stationCode },
    AquoPlusWaarnemingMetadata: { AquoMetadata: { Compartiment: { Code: "OW" }, Grootheid: { Code: "WATHTE" }, ProcesType: "verwachting" } },
    Periode: { Begindatumtijd: new Date(nu).toISOString().replace("Z", "+00:00"), Einddatumtijd: new Date(nu + 14 * 864e5).toISOString().replace("Z", "+00:00") },
  }, 90_000);
  let laatst = null;
  for (const w of get(res, "WaarnemingenLijst") ?? []) for (const m of get(w, "MetingenLijst") ?? []) { const t = get(m, "Tijdstip"); if (t && (!laatst || t > laatst)) laatst = t; }
  return laatst ? Math.round((Date.parse(laatst) - nu) / 864e5 * 10) / 10 : 0;
}

console.log("Catalogus ophalen (kan een minuut duren)...");
const cat = await post("/METADATASERVICES/OphalenCatalogus", { CatalogusFilter: { Grootheden: true, Compartimenten: true, Groeperingen: true, ProcesTypes: true } });
const metas = new Map((get(cat, "AquoMetadataLijst") ?? []).map((m) => [mid(m, "aquometadata"), m]));
const locs = new Map((get(cat, "LocatieLijst") ?? []).map((l) => [mid(l, "locatie"), l]));
const stations = new Map();
for (const k of get(cat, "AquoMetadataLocatieLijst") ?? []) {
  const m = metas.get(mid(k, "aquometadata")), l = locs.get(mid(k, "locatie"));
  if (!m || !l) continue;
  const ok = code(m, "Compartiment") === "OW" && code(m, "Grootheid") === "WATHTE" && !code(m, "Groepering")
    && ["", "meting"].includes(String(get(m, "ProcesType") ?? "").toLowerCase());
  const pos = ok && latlon(l);
  if (pos) stations.set(get(l, "Code"), { code: get(l, "Code"), naam: get(l, "Naam"), ...pos });
}
console.log(`${stations.size} meetpunten met waterstand gevonden.\n`);

const inGebruik = new Set(locaties.map((l) => l.rws?.waterstand?.code).filter(Boolean));
const regels = [];
for (const p of NIEUW) {
  const bestaand = locaties.find((l) => l.slug === p.slug);
  const kandidaten = [...stations.values()]
    .map((s) => ({ ...s, km: km(p, s) }))
    .filter((s) => s.km <= MAX_KM && (!inGebruik.has(s.code) || bestaand?.rws?.waterstand?.code === s.code))
    .sort((a, b) => a.km - b.km)
    .slice(0, 6);
  let gekozen = null, reden = "geen meetpunt binnen " + MAX_KM + " km";
  for (const s of kandidaten) {
    try {
      const l = await laatste(s.code);
      if (l && Date.now() - Date.parse(l.t) < 12 * 3600e3) { gekozen = { ...s, laatste: l }; break; }
      reden = "geen actuele meting";
    } catch (e) { reden = e.message.slice(0, 60); }
  }
  if (!gekozen) { regels.push(`  -  ${p.naam.padEnd(13)} OVERGESLAGEN (${reden})`); continue; }
  inGebruik.add(gekozen.code);
  const entry = {
    slug: p.slug, naam: p.naam, type: "rivier", rivier: p.rivier, regio: "Rivieren", regioSlug: "rivieren",
    lat: p.lat, lon: p.lon,
    rws: { waterstand: { code: gekozen.code, naam: gekozen.naam, km: Math.round(gekozen.km * 10) / 10 } },
    intro: p.intro,
  };
  if (bestaand) Object.assign(bestaand, entry); else locaties.push(entry);
  let vw = "geen verwachting";
  try { const d = await verwachtingDagen(gekozen.code); if (d > 0) vw = `verwachting ${d} dagen`; } catch {}
  regels.push(`  ✓  ${p.naam.padEnd(13)} ${gekozen.naam} (${entry.rws.waterstand.km} km) · ${Math.round(gekozen.laatste.v)} cm NAP · ${vw}`);
}

// "In de buurt": de drie dichtstbijzijnde rivier-/meerplaatsen
const rivieren = locaties.filter((l) => !l.rws?.getij && l.rws?.waterstand);
for (const l of rivieren) l.dichtbij = rivieren.filter((o) => o !== l).sort((a, b) => km(l, a) - km(l, b)).slice(0, 3).map((o) => o.slug);

for (const slug of ["lobith", "nijmegen", "deventer"]) {
  const l = locaties.find((x) => x.slug === slug);
  if (!l?.rws?.waterstand?.code) continue;
  let vw = "geen verwachting";
  try { const d = await verwachtingDagen(l.rws.waterstand.code); if (d > 0) vw = `verwachting ${d} dagen`; } catch (e) { vw = "fout: " + e.message.slice(0, 50); }
  regels.push(`  ·  ${l.naam.padEnd(13)} (bestaand) ${vw}`);
}

fs.writeFileSync(LOC_PAD, JSON.stringify(locaties, null, 2) + "\n");
console.log(regels.join("\n"));
console.log(`\nKlaar: data/locaties.json bijgewerkt (${regels.filter((r) => r.includes("✓")).length} plaatsen).`);
