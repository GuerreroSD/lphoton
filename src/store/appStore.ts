import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { isPlatformAvailable } from "../lib/accounts";
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
  linkedPlatforms: Platform[];
  lightModePref: LightModePreference;
  theme: Theme;
  filters: LibraryFilters;

  // Sesión actual
  games: Game[];
  libraryStatus: "idle" | "loading" | "ready" | "error";
  /** Sincronización en segundo plano (después de pintar la caché). */
  syncing: boolean;
  syncWarning: string | null;
  searchOpen: boolean;
  query: string;

  setUsername: (username: string | null) => void;
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
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      username: null,
      linkedPlatforms: [],
      lightModePref: "ask",
      theme: "dark",
      filters: NO_FILTERS,

      games: [],
      libraryStatus: "idle",
      syncing: false,
      syncWarning: null,
      searchOpen: false,
      query: "",

      setUsername: (username) => set({ username }),
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
        linkedPlatforms: s.linkedPlatforms,
        lightModePref: s.lightModePref,
        theme: s.theme,
        filters: s.filters,
      }),
    },
  ),
);
