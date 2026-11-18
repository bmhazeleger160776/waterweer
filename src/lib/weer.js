const BFT = [0.3, 1.6, 3.4, 5.5, 8.0, 10.8, 13.9, 17.2, 20.8, 24.5, 28.5, 32.7];
export const beaufort = (ms) => BFT.findIndex((g) => ms < g) === -1 ? 12 : BFT.findIndex((g) => ms < g);
const RICHT = ["noord", "noordoost", "oost", "zuidoost", "zuid", "zuidwest", "west", "noordwest"];
const KORT = ["N", "NO", "O", "ZO", "Z", "ZW", "W", "NW"];
export const richting = (gr) => RICHT[Math.round(((gr % 360) + 360) % 360 / 45) % 8];
export const richtingKort = (gr) => KORT[Math.round(((gr % 360) + 360) % 360 / 45) % 8];
export const golfMeter = (cm) => (cm / 100).toFixed(1).replace(".", ",") + " m";
export const golfOordeel = (cm) =>
  cm < 40 ? "Vrijwel vlakke zee."
  : cm < 80 ? "Kleine golven: geschikt voor beginnende surfers en suppers bij weinig wind."
  : cm < 150 ? "Goede golven om te surfen."
  : cm < 250 ? "Flinke golven: vooral voor ervaren surfers."
  : "Hoge golven en ruwe zee: blijf uit het water als je geen ervaren surfer bent.";
