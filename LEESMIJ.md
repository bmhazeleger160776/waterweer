# waterweer.nl – prototype

Eén volledig werkende locatiepagina (`/getijden/vlissingen`) met getijcurve, hoog- en laagwatertijden voor 7 dagen, watertemperatuur, waterstand ten opzichte van de voorspelling, FAQ en gestructureerde data. Gebouwd met Astro als statische site.

## Lokaal draaien

```
npm install
npm run sample-data   # voorbeelddata (gesimuleerd getij), werkt zonder internet
npm run fetch-data    # óf echte data van Rijkswaterstaat
npm run dev           # open http://localhost:4321/getijden/vlissingen
```

Met voorbeelddata staat er een oranje melding op de pagina. Die verdwijnt zodra `fetch-data` echte data heeft opgehaald.

## Hoe het werkt

| Onderdeel | Bestand |
| --- | --- |
| Locaties en hun RWS-meetpunten | `data/locaties.json` (vul aan vanuit `koppeltabel.csv`) |
| Data ophalen (getij 8 dagen, laatste temperatuur en waterstand) | `scripts/fetch-rws.mjs` → `data/metingen/<slug>.json` |
| Locatiepagina | `src/pages/getijden/[slug].astro` |
| Getijcurve | `src/components/GetijGrafiek.astro` |
| Sitemap, robots | `src/pages/sitemap.xml.js`, `public/robots.txt` |

- Mislukt het ophalen, dan blijft de laatste geldige data staan en breekt de build niet.
- Een nieuwe locatie = een regel in `locaties.json` met RWS-codes. De pagina wordt dan automatisch gemaakt.

## Elk uur bijwerken

`.github/workflows/elk-uur.yml` haalt elk uur nieuwe data op, bouwt de site in GitHub Actions en zet hem op Netlify. Zo verbruik je geen Netlify-buildminuten.

1. Zet het project in een GitHub-repository.
2. Maak in Netlify een (lege) site aan en koppel het domein waterweer.nl.
3. Zet in GitHub onder Settings → Secrets: `NETLIFY_SITE_ID` en `NETLIFY_AUTH_TOKEN`.

## Nog te checken met echte data

- Of meetpunt `VLISSGN` klopt voor getij, temperatuur en waterstand (volgt uit de koppeltabel).
- Of het getij onder grootheid `WATHTBRKD` staat; anders aanpassen in `GROOTHEID` in `fetch-rws.mjs`.
- Of de API-host nog `waterwebservices.rijkswaterstaat.nl` is.
