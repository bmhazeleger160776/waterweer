// Controleert de kustplaatsen waar de waterstand van een ander meetpunt komt dan de getijvoorspelling.
// Per kandidaat-meetpunt haalt het de gemeten waterstand van de afgelopen 24 uur op en vergelijkt
// die met het voorspelde getij van de plaats:
//  - beweegt het water ongeveer even ver op en neer als het getij? (anders: meer, sluis of polder)
//  - valt de meter bij eb niet droog? (dan blijft de laagste waarde lang hetzelfde)
// Het eerste meetpunt dat klopt wordt gekozen. Klopt er geen, dan krijgt de plaats geen waterstand.
//
// Gebruik:  node scripts/check-waterstanden.mjs              (alleen rapport)
//           node scripts/check-waterstanden.mjs --toepassen  (schrijft data/locaties.json)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LOC_PAD = path.join(ROOT, "data/locaties.json");
const locaties = JSON.parse(fs.readFileSync(LOC_PAD, "utf8"));
const nieuw = JSON.parse(fs.readFileSync(path.join(ROOT, "data/nieuwe-kustplaatsen.json"), "utf8"));
const TOEPASSEN = process.argv.includes("--toepassen");
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

const eind = new Date();
const begin = new Date(eind - 25 * 3600e3);

async function gemeten(code) {
  const res = await post("/OphalenWaarnemingen", {
    Locatie: { Code: code },
    AquoPlusWaarnemingMetadata: { AquoMetadata: { Compartiment: { Code: "OW" }, Grootheid: { Code: "WATHTE" }, ProcesType: "meting" } },
    Periode: { Begindatumtijd: iso(begin), Einddatumtijd: iso(eind) },
  });
  return metingen(res);
}
async function getijBereik(code) {
  const res = await post("/OphalenWaarnemingen", {
    Locatie: { Code: code },
    AquoPlusWaarnemingMetadata: { AquoMetadata: { Groepering: { Code: "GETETBRKD2" } } },
    Periode: { Begindatumtijd: iso(begin), Einddatumtijd: iso(eind) },
  });
  const v = metingen(res).map((m) => m.v);
  return v.length >= 3 ? Math.max(...v) - Math.min(...v) : null;
}

async function toets(code, bereikGetij) {
  let reeks;
  try { reeks = await gemeten(code); } catch (e) { return { ok: false, reden: `fout: ${e.message}` }; }
  if (reeks.length < 24) return { ok: false, reden: "te weinig metingen" };
  const v = reeks.map((m) => m.v);
  const min = Math.min(...v), max = Math.max(...v);
  const bereik = max - min;
  const verhouding = bereikGetij ? bereik / bereikGetij : null;
  const plat = v.filter((x) => x <= min + 3).length / v.length;
  const info = `bereik ${bereik} cm${verhouding ? ` (${Math.round(verhouding * 100)}% van getij)` : ""}`;
  if (plat > 0.2) return { ok: false, reden: `valt droog bij eb, ${info}` };
  if (verhouding !== null && verhouding < 0.6) return { ok: false, reden: `te weinig getij (meer/sluis?), ${info}` };
  if (verhouding !== null && verhouding > 1.5) return { ok: false, reden: `te veel beweging, ${info}` };
  return { ok: true, reden: info };
}

const teControleren = locaties.filter((l) => l.rws?.getij && l.rws?.waterstand && l.rws.waterstand.code !== l.rws.getij.code);
console.log(`${teControleren.length} plaatsen met waterstand van een ander meetpunt dan het getij.\n`);

const wijzigingen = [];
for (const l of teControleren) {
  let bereikGetij = null;
  try { bereikGetij = await getijBereik(l.rws.getij.code); } catch {}
  const kandidaten = [l.rws.waterstand, ...(nieuw.find((n) => n.slug === l.slug)?.kandidaten?.waterstand ?? [])]
    .filter((k, i, a) => a.findIndex((x) => x.code === k.code) === i && k.code !== l.rws.getij.code)
    .slice(0, 6);
  console.log(`${l.naam} (getij ${l.rws.getij.naam}, getijbereik ${bereikGetij ?? "?"} cm)`);
  let gekozen = null;
  for (const k of kandidaten) {
    const r = await toets(k.code, bereikGetij);
    console.log(`   ${r.ok ? "✓" : "✗"} ${k.naam} (${k.km} km): ${r.reden}`);
    if (r.ok) { gekozen = k; break; }
  }
  const huidig = l.rws.waterstand.code;
  if (!gekozen) {
    console.log(`   → geen betrouwbaar meetpunt: waterstand weghalen\n`);
    wijzigingen.push(`${l.naam}: waterstand weg (was ${l.rws.waterstand.naam})`);
    if (TOEPASSEN) delete l.rws.waterstand;
  } else if (gekozen.code !== huidig) {
    console.log(`   → wisselen naar ${gekozen.naam}\n`);
    wijzigingen.push(`${l.naam}: ${l.rws.waterstand.naam} → ${gekozen.naam}`);
    if (TOEPASSEN) l.rws.waterstand = { code: gekozen.code, naam: gekozen.naam, km: gekozen.km };
  } else console.log(`   → blijft zo\n`);
}

console.log(`\nSamenvatting (${wijzigingen.length} wijzigingen):\n${wijzigingen.map((w) => "  - " + w).join("\n") || "  geen"}`);
if (TOEPASSEN) {
  fs.writeFileSync(LOC_PAD, JSON.stringify(locaties, null, 2) + "\n");
  console.log("\ndata/locaties.json bijgewerkt.");
} else if (wijzigingen.length) console.log("\nDraai opnieuw met --toepassen om dit door te voeren.");
