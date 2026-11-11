import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { getLibrary } from "../lib/library";
import type { Game, LightModePreference, Platform, Theme } from "../types";

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

  // Sesión actual
  games: Game[];
  libraryStatus: "idle" | "loading" | "ready" | "error";
  searchOpen: boolean;
  query: string;

  setUsername: (username: string | null) => void;
  setPlatformLinked: (platform: Platform, linked: boolean) => void;
  setLightModePref: (pref: LightModePreference) => void;
  setTheme: (theme: Theme) => void;
  loadLibrary: () => Promise<void>;
  openSearch: () => void;
  closeSearch: () => void;
  setQuery: (query: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      username: null,
      linkedPlatforms: [],
      lightModePref: "ask",
      theme: "dark",

      games: [],
      libraryStatus: "idle",
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

      loadLibrary: async () => {
        if (get().libraryStatus === "loading" || get().libraryStatus === "ready") return;
        set({ libraryStatus: "loading" });
        try {
          const games = await getLibrary();
          set({ games, libraryStatus: "ready" });
        } catch {
          set({ libraryStatus: "error" });
        }
      },

      openSearch: () => set({ searchOpen: true }),
      closeSearch: () => set({ searchOpen: false, query: "" }),
      setQuery: (query) => set({ query }),
    }),
    {
      name: "lphoton-settings",
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({
        username: s.username,
        linkedPlatforms: s.linkedPlatforms,
        lightModePref: s.lightModePref,
        theme: s.theme,
      }),
    },
  ),
);

/** Juegos visibles según las plataformas vinculadas (una plataforma desvinculada no aporta juegos). */
export function selectVisibleGames(state: Pick<AppState, "games" | "linkedPlatforms">): Game[] {
  return state.games.filter((g) => g.sources.some((s) => state.linkedPlatforms.includes(s.platform)));
}
