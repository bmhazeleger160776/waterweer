// Voegt de plaatsen uit data/nieuwe-kustplaatsen.json toe aan data/locaties.json.
// Per plaats en per thema (getij, waterstand, watertemperatuur) probeert het de kandidaat-
// meetpunten op volgorde en kiest het eerste meetpunt dat nu echt data levert.
// Ook vult het data/golf-kandidaten.json aan en werkt het "in de buurt" bij.
//
// Gebruik: node scripts/zoek-kustplaatsen.mjs
// Opnieuw draaien mag: bestaande plaatsen worden bijgewerkt, niet dubbel toegevoegd.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LOC_PAD = path.join(ROOT, "data/locaties.json");
const GK_PAD = path.join(ROOT, "data/golf-kandidaten.json");
const NIEUW = JSON.parse(fs.readFileSync(path.join(ROOT, "data/nieuwe-kustplaatsen.json"), "utf8"));
const locaties = JSON.parse(fs.readFileSync(LOC_PAD, "utf8"));
const kandidatenGolf = JSON.parse(fs.readFileSync(GK_PAD, "utf8"));
const BASE = "https://ddapi20-waterwebservices.rijkswaterstaat.nl/ONLINEWAARNEMINGENSERVICES";

const iso = (d) => d.toISOString().replace("Z", "+00:00");
async function post(pad, body) {
  let fout;
  for (let poging = 0; poging < 3; poging++) {
    try {
      const res = await fetch(BASE + pad, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60_000),
      });
      const tekst = await res.text();
      if (res.ok) return tekst.trim() ? JSON.parse(tekst) : {};
      if (res.status === 204) return {};
      fout = `HTTP ${res.status}`;
      if ([400, 404, 422].includes(res.status)) break;
    } catch (e) { fout = e.message; }
    await new Promise((r) => setTimeout(r, 1500 * (poging + 1)));
  }
  throw new Error(fout);
}
const metingen = (res) => (res?.WaarnemingenLijst ?? []).flatMap((w) => (w.MetingenLijst ?? []).map((m) => ({ t: m.Tijdstip, v: m.Meetwaarde?.Waarde_Numeriek })))
  .filter((m) => m.t && typeof m.v === "number" && m.v > -9000 && m.v < 9000);

const TOETS = {
  async getij(code) {
    const res = await post("/OphalenWaarnemingen", {
      Locatie: { Code: code },
      AquoPlusWaarnemingMetadata: { AquoMetadata: { Groepering: { Code: "GETETBRKD2" } } },
      Periode: { Begindatumtijd: iso(new Date()), Einddatumtijd: iso(new Date(Date.now() + 2 * 864e5)) },
    });
    const n = metingen(res).length;
    return n >= 4 ? `${n} hoog-/laagwaters in 2 dagen` : null;
  },
  async laatste(code, grootheid, maxUur) {
    const res = await post("/OphalenLaatsteWaarnemingen", {
      AquoPlusWaarnemingMetadataLijst: [{ AquoMetadata: { Compartiment: { Code: "OW" }, Grootheid: { Code: grootheid }, ProcesType: "meting" } }],
      LocatieLijst: [{ Code: code }],
    });
    const m = metingen(res).sort((a, b) => b.t.localeCompare(a.t))[0];
    return m && Date.now() - Date.parse(m.t) < maxUur * 3600e3 ? `${m.v} (${m.t.slice(0, 16)})` : null;
  },
  waterstand: (c) => TOETS.laatste(c, "WATHTE", 12),
  temperatuur: (c) => TOETS.laatste(c, "T", 48),
};

async function kies(thema, lijst) {
  for (const k of lijst) {
    try { const ok = await TOETS[thema](k.code); if (ok) return { ...k, ok }; } catch {}
  }
  return null;
}

const km = (a, b) => {
  const R = 6371, r = Math.PI / 180;
  const h = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lon - a.lon) * r) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

const regels = [];
let aantal = 0;
for (const p of NIEUW) {
  const getij = await kies("getij", p.kandidaten.getij);
  if (!getij) { regels.push(`  -  ${p.naam.padEnd(24)} OVERGESLAGEN: geen getijvoorspelling gevonden`); continue; }
  const waterstand = await kies("waterstand", [{ code: getij.code, naam: getij.naam, km: getij.km }, ...p.kandidaten.waterstand.filter((k) => k.code !== getij.code)]);
  const temperatuur = await kies("temperatuur", p.kandidaten.temperatuur);
  const rws = { getij: { code: getij.code, naam: getij.naam, km: getij.km } };
  if (temperatuur) rws.temperatuur = { code: temperatuur.code, naam: temperatuur.naam, km: temperatuur.km };
  if (waterstand) rws.waterstand = { code: waterstand.code, naam: waterstand.naam, km: waterstand.km };
  const entry = { slug: p.slug, naam: p.naam, type: p.type, regio: p.regio, regioSlug: p.regioSlug, lat: p.lat, lon: p.lon, rws, intro: p.intro };
  const bestaand = locaties.find((l) => l.slug === p.slug);
  if (bestaand) Object.assign(bestaand, entry); else locaties.push(entry);
  kandidatenGolf[p.slug] = p.golfwind;
  aantal++;
  regels.push(`  ✓  ${p.naam.padEnd(24)} getij ${getij.naam} (${getij.km} km) · water ${waterstand ? waterstand.naam : "–"} · temp ${temperatuur ? temperatuur.naam : "–"}`);
  console.log(regels.at(-1));
}

// "In de buurt" voor alle getijplaatsen opnieuw: de vier dichtstbijzijnde
const kust = locaties.filter((l) => l.rws?.getij && Number.isFinite(l.lat));
for (const l of kust) l.dichtbij = kust.filter((o) => o !== l).sort((a, b) => km(l, a) - km(l, b)).slice(0, 4).map((o) => o.slug);

fs.writeFileSync(LOC_PAD, JSON.stringify(locaties, null, 2) + "\n");
fs.writeFileSync(GK_PAD, JSON.stringify(kandidatenGolf, null, 2) + "\n");
console.log(`\nKlaar: ${aantal} van ${NIEUW.length} plaatsen toegevoegd of bijgewerkt in data/locaties.json.`);
console.log(regels.filter((r) => r.includes("OVERGESLAGEN")).join("\n"));
