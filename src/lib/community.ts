// Wrapper de Comunidad (RF4, §6.6).
// - Soluciones y mods propios por juego, ordenados por votos (SQLite en la app
//   de escritorio; localStorage en el modo demo del navegador).
// - Enlace a PCGamingWiki: se abre en el navegador del sistema. Su API
//   automática está detrás de un control anti-bots, así que no se consulta.

import type { CommunityFix, Game, NewFix } from "../types";
import { inTauri, invoke } from "./tauri";

/** Página del juego en PCGamingWiki (por AppID de Steam si existe; si no, búsqueda por título). */
export function pcgamingwikiUrl(game: Pick<Game, "title" | "sources">): string {
  const steam = game.sources.find((s) => s.platform === "steam");
  if (steam && /^\d+$/.test(steam.externalId)) {
    return `https://www.pcgamingwiki.com/api/appid.php?appid=${steam.externalId}`;
  }
  return `https://www.pcgamingwiki.com/w/index.php?search=${encodeURIComponent(game.title)}`;
}

/** Misma validación que community.rs, para avisar antes de enviar. */
export function validateFix(fix: NewFix): string | null {
  if (!fix.title.trim()) return "Escribe un título para la solución.";
  if (fix.title.trim().length > 120) return "El título puede tener hasta 120 caracteres.";
  if (fix.description.trim().length > 2000) return "La descripción puede tener hasta 2000 caracteres.";
  const url = fix.url?.trim();
  if (url && !/^https?:\/\/\S+$/i.test(url)) return "El enlace debe empezar con https:// (o http://).";
  return null;
}

// ── Modo demo (navegador) ───────────────────────────────────────────────

const DEMO_KEY = "lphoton-demo-fixes";

function readDemo(): CommunityFix[] {
  try {
    return JSON.parse(localStorage.getItem(DEMO_KEY) ?? "[]") as CommunityFix[];
  } catch {
    return [];
  }
}

function writeDemo(fixes: CommunityFix[]) {
  try {
    localStorage.setItem(DEMO_KEY, JSON.stringify(fixes));
  } catch {
    /* sin persistencia en el modo demo */
  }
}

const byVotes = (a: CommunityFix, b: CommunityFix) => b.votes - a.votes || b.createdAt - a.createdAt || b.id - a.id;

// ── API ─────────────────────────────────────────────────────────────────

export async function listFixes(gameId: string): Promise<CommunityFix[]> {
  if (inTauri) return invoke<CommunityFix[]>("list_fixes", { gameId });
  return readDemo().filter((f) => f.gameId === gameId).sort(byVotes);
}

export async function fixCounts(): Promise<Record<string, number>> {
  if (inTauri) return invoke<Record<string, number>>("fix_counts");
  return readDemo().reduce<Record<string, number>>((acc, f) => ({ ...acc, [f.gameId]: (acc[f.gameId] ?? 0) + 1 }), {});
}

export async function addFix(fix: NewFix): Promise<void> {
  const clean: NewFix = { ...fix, title: fix.title.trim(), description: fix.description.trim(), url: fix.url?.trim() || null };
  const error = validateFix(clean);
  if (error) throw new Error(error);
  if (inTauri) {
    await invoke("add_fix", { fix: clean });
    return;
  }
  const all = readDemo();
  const id = all.reduce((max, f) => Math.max(max, f.id), 0) + 1;
  writeDemo([...all, { ...clean, id, votes: 0, createdAt: Math.floor(Date.now() / 1000) }]);
}

export async function voteFix(id: number, delta: 1 | -1): Promise<void> {
  if (inTauri) {
    await invoke("vote_fix", { id, delta });
    return;
  }
  writeDemo(readDemo().map((f) => (f.id === id ? { ...f, votes: f.votes + delta } : f)));
}

export async function deleteFix(id: number): Promise<void> {
  if (inTauri) {
    await invoke("delete_fix", { id });
    return;
  }
  writeDemo(readDemo().filter((f) => f.id !== id));
}
