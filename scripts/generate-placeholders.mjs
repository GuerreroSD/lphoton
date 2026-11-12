// Genera portadas (600×900) y banners hero (1600×620) de muestra en public/placeholders/.
// Son SVG livianos creados a partir de la paleta de LPhoton: no se descarga arte con copyright.
// Uso: node scripts/generate-placeholders.mjs

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const games = JSON.parse(readFileSync(join(root, "src/mock/mock-games.json"), "utf8"));
const outDir = join(root, "public/placeholders");
mkdirSync(outDir, { recursive: true });

// Paleta de la guía de estilos (los SVG son assets, no componentes).
const PALETTE = {
  primary: "#B636C7",
  accent: "#00F0FF",
  alert: "#FF007F",
  deep: "#4A1550",
  dark: "#2D1B36",
  light: "#DBC5DD",
};
const GLOW_PAIRS = [
  [PALETTE.alert, PALETTE.accent],
  [PALETTE.accent, PALETTE.primary],
  [PALETTE.primary, PALETTE.alert],
  [PALETTE.alert, PALETTE.primary],
  [PALETTE.accent, PALETTE.alert],
];

const escapeXml = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Separa "Resident Evil Requiem" en ["RESIDENT EVIL", "REQUIEM"].
function titleLines(title) {
  const upper = title.toUpperCase();
  const prefix = "RESIDENT EVIL";
  if (upper.startsWith(prefix)) {
    const rest = upper.slice(prefix.length).replace(/^[:\s]+/, "").trim();
    return rest ? [prefix, rest] : [prefix];
  }
  return [upper];
}

function defs(id, [c1, c2], w, h) {
  return `<defs>
    <linearGradient id="bg-${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${PALETTE.deep}"/>
      <stop offset="0.55" stop-color="${PALETTE.dark}"/>
      <stop offset="1" stop-color="#120a17"/>
    </linearGradient>
    <radialGradient id="g1-${id}" cx="0.3" cy="0.3" r="0.55">
      <stop offset="0" stop-color="${c1}" stop-opacity="0.75"/>
      <stop offset="1" stop-color="${c1}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="g2-${id}" cx="0.8" cy="0.75" r="0.5">
      <stop offset="0" stop-color="${c2}" stop-opacity="0.55"/>
      <stop offset="1" stop-color="${c2}" stop-opacity="0"/>
    </radialGradient>
    <pattern id="lines-${id}" width="${w}" height="14" patternUnits="userSpaceOnUse">
      <rect width="${w}" height="1" fill="#ffffff" opacity="0.04"/>
    </pattern>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg-${id})"/>
  <rect width="${w}" height="${h}" fill="url(#g1-${id})"/>
  <rect width="${w}" height="${h}" fill="url(#g2-${id})"/>
  <rect width="${w}" height="${h}" fill="url(#lines-${id})"/>`;
}

function cover(game, i) {
  const [w, h] = [600, 900];
  const lines = titleLines(game.title);
  const year = game.releaseYear;
  const text = lines
    .map((line, n) => {
      const size = n === 0 ? 54 : line.length > 14 ? 40 : 64;
      const y = 640 + n * 76;
      const fill = n === 0 ? PALETTE.light : PALETTE.accent;
      return `<text x="44" y="${y}" font-family="Chakra Petch, Bahnschrift, Arial Narrow, sans-serif" font-weight="700" font-size="${size}" fill="${fill}" letter-spacing="2">${escapeXml(line)}</text>`;
    })
    .join("\n  ");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  ${defs(game.id, GLOW_PAIRS[i % GLOW_PAIRS.length], w, h)}
  <rect x="44" y="584" width="64" height="6" fill="${PALETTE.alert}"/>
  ${text}
  <text x="44" y="830" font-family="Montserrat, Segoe UI, sans-serif" font-weight="600" font-size="22" fill="${PALETTE.light}" opacity="0.8">${year} · PORTADA DE MUESTRA</text>
</svg>
`;
}

function hero(game, i) {
  const [w, h] = [1600, 620];
  // Sin título: la ficha lo escribe sobre el banner, como con el arte real de las tiendas.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  ${defs(`${game.id}-hero`, GLOW_PAIRS[(i + 2) % GLOW_PAIRS.length], w, h)}
  <text x="${w - 64}" y="72" text-anchor="end" font-family="Montserrat, Segoe UI, sans-serif" font-weight="600" font-size="22" fill="${PALETTE.light}" opacity="0.7">IMAGEN DE MUESTRA</text>
</svg>
`;
}

games.forEach((game, i) => {
  writeFileSync(join(outDir, `${game.id}-cover.svg`), cover(game, i));
  writeFileSync(join(outDir, `${game.id}-hero.svg`), hero(game, i));
});

console.log(`Generados ${games.length * 2} placeholders en public/placeholders/`);
