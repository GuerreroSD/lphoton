import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { isPlatformAvailable, type SteamAccount } from "../lib/accounts";
import { getCachedLibrary, syncLibrary } from "../lib/library";
import { errorMessage } from "../lib/tauri";
import type { Game, LightModePreference, Platform, Theme } from "../types";

/** Filtros del panel izquierdo de la biblioteca (§6.2). */
export interface LibraryFilters {
  /** Vacío = todas las plataformas vinculadas. */
  platforms: Platform[];
  installedOnly: boolean;
  recentOnly: boolean;
}

export const NO_FILTERS: LibraryFilters = { platforms: [], installedOnly: false, recentOnly: false };

// localStorage puede fallar (modo privado, almacenamiento bloqueado): nunca romper la app.
const safeStorage: StateStorage = {
  getItem: (name) => {
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value);
    } catch {
      /* sin persistencia */
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name);
    } catch {
      /* sin persistencia */
    }
  },
};

interface AppState {
  // Persistido
  username: string | null;
  /** Cuenta de Steam con la que se inició sesión (null: perfil local). */
  steamAccount: SteamAccount | null;
  linkedPlatforms: Platform[];
  lightModePref: LightModePreference;
  theme: Theme;
  filters: LibraryFilters;
  /** Plataformas cuyo aviso "Encontramos juegos de…" el usuario descartó. */
  dismissedPlatformHints: Platform[];

  // Sesión actual
  games: Game[];
  libraryStatus: "idle" | "loading" | "ready" | "error";
  /** Sincronización en segundo plano (después de pintar la caché). */
  syncing: boolean;
  syncWarning: string | null;
  searchOpen: boolean;
  query: string;
  /** Juego activo: su arte tiñe el fondo y su portada lleva el brillo de neón. */
  activeGameId: string | null;

  setUsername: (username: string | null) => void;
  signInWithSteam: (account: SteamAccount) => void;
  /** Cierra la sesión: vuelve a la pantalla de inicio (las plataformas siguen vinculadas). */
  signOut: () => void;
  setPlatformLinked: (platform: Platform, linked: boolean) => void;
  setLightModePref: (pref: LightModePreference) => void;
  setTheme: (theme: Theme) => void;
  loadLibrary: () => Promise<void>;
  /** Vuelve a sincronizar (p. ej. tras guardar la API key). */
  refreshLibrary: () => Promise<void>;
  openSearch: () => void;
  closeSearch: () => void;
  setQuery: (query: string) => void;
  togglePlatformFilter: (platform: Platform) => void;
  setFilters: (filters: Partial<LibraryFilters>) => void;
  dismissPlatformHint: (platform: Platform) => void;
  setActiveGame: (id: string | null) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      username: null,
      steamAccount: null,
      linkedPlatforms: [],
      lightModePref: "ask",
      theme: "dark",
      filters: NO_FILTERS,
      dismissedPlatformHints: [],

      games: [],
      libraryStatus: "idle",
      syncing: false,
      syncWarning: null,
      searchOpen: false,
      query: "",
      activeGameId: null,

      setUsername: (username) => set({ username }),
      signInWithSteam: (account) => set({ steamAccount: account, username: account.name }),
      signOut: () => set({ steamAccount: null, username: null }),
      setPlatformLinked: (platform, linked) =>
        set((s) => ({
          linkedPlatforms: linked
            ? Array.from(new Set([...s.linkedPlatforms, platform]))
            : s.linkedPlatforms.filter((p) => p !== platform),
        })),
      setLightModePref: (lightModePref) => set({ lightModePref }),
      setTheme: (theme) => set({ theme }),

      // RNF7: primero se pinta la caché (sin red) y después se sincroniza.
      loadLibrary: async () => {
        if (get().libraryStatus !== "idle") return;
        set({ libraryStatus: "loading" });
        try {
          const games = await getCachedLibrary();
          set({ games, libraryStatus: "ready" });
        } catch (err) {
          set({ libraryStatus: "error", syncWarning: errorMessage(err) });
          return;
        }
        void get().refreshLibrary();
      },

      refreshLibrary: async () => {
        if (get().syncing) return;
        set({ syncing: true });
        try {
          const { games, warning } = await syncLibrary();
          set((s) => ({
            // Si la sincronización no trajo nada (p. ej. Steam no está), se conserva la caché.
            games: games.length > 0 ? games : s.games,
            libraryStatus: "ready",
            syncWarning: warning,
          }));
        } catch (err) {
          set({ syncWarning: `Error al sincronizar con Steam. ${errorMessage(err)}` });
        } finally {
          set({ syncing: false });
        }
      },

      openSearch: () => set({ searchOpen: true }),
      closeSearch: () => set({ searchOpen: false, query: "" }),
      setQuery: (query) => set({ query }),
      togglePlatformFilter: (platform) =>
        set((s) => ({
          filters: {
            ...s.filters,
            platforms: s.filters.platforms.includes(platform)
              ? s.filters.platforms.filter((p) => p !== platform)
              : [...s.filters.platforms, platform],
          },
        })),
      setFilters: (filters) => set((s) => ({ filters: { ...s.filters, ...filters } })),
      dismissPlatformHint: (platform) =>
        set((s) => ({ dismissedPlatformHints: Array.from(new Set([...s.dismissedPlatformHints, platform])) })),
      setActiveGame: (activeGameId) => set({ activeGameId }),
    }),
    {
      name: "lphoton-settings",
      storage: createJSONStorage(() => safeStorage),
      // En la app de escritorio solo cuentan las plataformas ya implementadas
      // (el modo demo del navegador comparte este almacenamiento en desarrollo).
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<AppState>;
        return {
          ...current,
          ...saved,
          linkedPlatforms: (saved.linkedPlatforms ?? []).filter(isPlatformAvailable),
          filters: { ...NO_FILTERS, ...saved.filters },
        };
      },
      partialize: (s) => ({
        username: s.username,
        steamAccount: s.steamAccount,
        linkedPlatforms: s.linkedPlatforms,
        lightModePref: s.lightModePref,
        theme: s.theme,
        filters: s.filters,
        dismissedPlatformHints: s.dismissedPlatformHints,
      }),
    },
  ),
);

// Pasar el cursor por encima de varias portadas camino a otra no debe cambiar el
// fondo en cada una: el juego se activa solo si el cursor se queda un momento.
const ACTIVATE_DELAY_MS = 110;
let activateTimer: ReturnType<typeof setTimeout> | undefined;

export function activateGameSoon(id: string) {
  clearTimeout(activateTimer);
  if (useAppStore.getState().activeGameId === id) return;
  activateTimer = setTimeout(() => useAppStore.getState().setActiveGame(id), ACTIVATE_DELAY_MS);
}

export function cancelActivateGame() {
  clearTimeout(activateTimer);
}
