// Genera `latest.json` para el actualizador a partir del instalador firmado.
// Uso: node scripts/updater-manifest.mjs  (después de `npm run tauri build` con la clave de firma)
// Se sube al release de GitHub junto al instalador; LPhoton lo lee desde
// https://github.com/GuerreroSD/lphoton/releases/latest/download/latest.json
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const conf = JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8"));
const version = conf.version;
const file = `LPhoton_${version}_x64-setup.exe`;
const dir = join("src-tauri", "target", "release", "bundle", "nsis");
const signature = readFileSync(join(dir, `${file}.sig`), "utf8").trim();
const url = `https://github.com/GuerreroSD/lphoton/releases/download/v${version}/${file}`;

const changelog = readFileSync("CHANGELOG.md", "utf8");
const start = changelog.indexOf(`## [${version}]`);
const end = changelog.indexOf("\n## [", start + 1);
const notes = start >= 0 ? changelog.slice(changelog.indexOf("\n", start) + 1, end > 0 ? end : undefined).trim() : "";

const manifest = {
  version,
  notes,
  pub_date: new Date().toISOString(),
  platforms: {
    "windows-x86_64": { signature, url },
    "windows-x86_64-nsis": { signature, url },
  },
};
writeFileSync(join(dir, "latest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`latest.json listo para ${version} en ${dir}`);
