import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { PrimaryButton, TextButton } from "../components/Button";
import { PlatformBadges } from "../components/PlatformBadge";
import { Toast } from "../components/Toast";
import { addFix, deleteFix, fixCounts, listFixes, pcgamingwikiUrl, validateFix, voteFix } from "../lib/community";
import { errorMessage, openExternal } from "../lib/tauri";
import { useAppStore } from "../store/appStore";
import { matchesQuery, useLibrary } from "../store/useLibrary";
import { FIX_KIND_LABELS, type CommunityFix, type FixKind, type Game } from "../types";
import styles from "./Forums.module.css";

/** Foros / Comunidad (RF4, §6.6): enlace a PCGamingWiki + soluciones propias ordenadas por votos. */
export function Forums() {
  const { status, alphabetical } = useLibrary();
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState("");
  const [counts, setCounts] = useState<Record<string, number>>({});

  const refreshCounts = useCallback(() => {
    fixCounts()
      .then(setCounts)
      .catch(() => setCounts({}));
  }, []);
  useEffect(refreshCounts, [refreshCounts]);

  const selectedId = params.get("juego") ?? alphabetical[0]?.game.id ?? null;
  const selected = alphabetical.find((e) => e.game.id === selectedId) ?? alphabetical[0];

  // El fondo de la app toma el arte del juego elegido.
  const selectedGameId = selected?.game.id;
  useEffect(() => {
    if (selectedGameId) useAppStore.getState().setActiveGame(selectedGameId);
  }, [selectedGameId]);
  const list = alphabetical.filter((e) => matchesQuery(e.game, filter));

  return (
    <div className={styles.forums}>
      <aside className={styles.sidebar} aria-label="Juegos">
        <h1 className={styles.heading}>Foros</h1>
        <label htmlFor="forum-filter" className="visually-hidden">
          Buscar juego
        </label>
        <input
          id="forum-filter"
          className={styles.filter}
          type="search"
          placeholder="Buscar juego…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
        <ul className={styles.list}>
          {list.map(({ game }) => (
            <li key={game.id}>
              <button
                type="button"
                className={styles.item}
                aria-current={game.id === selected?.game.id ? "true" : undefined}
                onClick={() => setParams({ juego: game.id }, { replace: true })}
              >
                <span className={styles.itemTitle}>{game.title}</span>
                {counts[game.id] ? <span className={styles.count}>{counts[game.id]}</span> : null}
              </button>
            </li>
          ))}
        </ul>
        {status === "ready" && list.length === 0 && <p className={styles.empty}>No hay juegos que coincidan.</p>}
      </aside>

      <section className={styles.content} aria-live="polite">
        {selected ? (
          <GameCommunity key={selected.game.id} game={selected.game} platforms={selected.platforms} onChange={refreshCounts} />
        ) : (
          <p className={styles.empty}>{status === "ready" ? "Vincula una plataforma para ver tus juegos aquí." : "Cargando…"}</p>
        )}
      </section>
    </div>
  );
}

function GameCommunity({
  game,
  platforms,
  onChange,
}: {
  game: Game;
  platforms: Game["sources"][number]["platform"][];
  onChange: () => void;
}) {
  const [fixes, setFixes] = useState<CommunityFix[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const load = useCallback(() => {
    listFixes(game.id)
      .then((list) => {
        setFixes(list);
        setError(null);
      })
      .catch((err) => setError(errorMessage(err, "No pudimos cargar las soluciones.")));
  }, [game.id]);
  useEffect(load, [load]);

  const run = async (action: () => Promise<void>) => {
    try {
      await action();
      load();
      onChange();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <div className={styles.game}>
      <header className={styles.gameHeader}>
        <div>
          <h2 className={styles.gameTitle}>{game.title}</h2>
          <PlatformBadges platforms={platforms} />
        </div>
        <PrimaryButton onClick={() => void openExternal(pcgamingwikiUrl(game))}>
          Ver soluciones y mods en PCGamingWiki →
        </PrimaryButton>
      </header>

      <div className={styles.sectionHeader}>
        <h3 className={styles.subtitle}>Mis soluciones y mods</h3>
        {!formOpen && <TextButton onClick={() => setFormOpen(true)}>+ Agregar solución</TextButton>}
      </div>

      {formOpen && (
        <FixForm
          gameId={game.id}
          onCancel={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false);
            load();
            onChange();
          }}
        />
      )}

      {error && (
        <Toast tone="error">
          {error}
        </Toast>
      )}

      {fixes && fixes.length === 0 && !formOpen && (
        <p className={styles.empty}>
          Aún no guardas soluciones para este juego. Cuando encuentres un arreglo o un mod que te sirva (por ejemplo en
          PCGamingWiki), agrégalo aquí y vota los que más te ayudaron.
        </p>
      )}

      <ol className={styles.fixes}>
        {fixes?.map((fix) => (
          <FixCard
            key={fix.id}
            fix={fix}
            onVote={(delta) => run(() => voteFix(fix.id, delta))}
            onDelete={() => run(() => deleteFix(fix.id))}
          />
        ))}
      </ol>
    </div>
  );
}

function FixCard({ fix, onVote, onDelete }: { fix: CommunityFix; onVote: (d: 1 | -1) => void; onDelete: () => void }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <li className={styles.fix}>
      <div className={styles.votes} aria-label={`${fix.votes} ${Math.abs(fix.votes) === 1 ? "voto" : "votos"}`}>
        <button type="button" className={styles.vote} onClick={() => onVote(1)} aria-label="Votar a favor" title="Me sirvió">
          ▲
        </button>
        <span className={styles.voteCount}>{fix.votes}</span>
        <button type="button" className={styles.vote} onClick={() => onVote(-1)} aria-label="Votar en contra" title="No me sirvió">
          ▼
        </button>
      </div>
      <div className={styles.fixBody}>
        <span className={`${styles.kind} ${fix.kind === "mod" ? styles.kindMod : ""}`}>{FIX_KIND_LABELS[fix.kind]}</span>
        <h4 className={styles.fixTitle}>{fix.title}</h4>
        {fix.description && <p className={styles.fixDescription}>{fix.description}</p>}
        <div className={styles.fixActions}>
          {fix.url && <TextButton onClick={() => void openExternal(fix.url!)}>Abrir enlace →</TextButton>}
          {confirming ? (
            <span className={styles.confirm}>
              ¿Eliminar?{" "}
              <button type="button" className={styles.danger} onClick={onDelete}>
                Sí
              </button>{" "}
              <button type="button" className={styles.plain} onClick={() => setConfirming(false)}>
                No
              </button>
            </span>
          ) : (
            <button type="button" className={styles.plain} onClick={() => setConfirming(true)}>
              Eliminar
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

function FixForm({ gameId, onCancel, onSaved }: { gameId: string; onCancel: () => void; onSaved: () => void }) {
  const [kind, setKind] = useState<FixKind>("fix");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const draft = useMemo(() => ({ gameId, kind, title, description, url: url || null }), [gameId, kind, title, description, url]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const problem = validateFix(draft);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    try {
      await addFix(draft);
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate>
      <div className={styles.kindPicker} role="radiogroup" aria-label="Tipo">
        {(Object.keys(FIX_KIND_LABELS) as FixKind[]).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={kind === k}
            className={styles.kindOption}
            onClick={() => setKind(k)}
          >
            {FIX_KIND_LABELS[k]}
          </button>
        ))}
      </div>
      <label className={styles.field}>
        <span className={styles.label}>Título</span>
        <input
          className={styles.input}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          placeholder="Ej.: Pantalla negra al iniciar"
          autoFocus
        />
      </label>
      <label className={styles.field}>
        <span className={styles.label}>Descripción</span>
        <textarea
          className={styles.textarea}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={2000}
          rows={3}
          placeholder="Qué hiciste y qué cambió."
        />
      </label>
      <label className={styles.field}>
        <span className={styles.label}>Enlace (opcional)</span>
        <input
          className={styles.input}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          maxLength={500}
          placeholder="https://"
          inputMode="url"
          spellCheck={false}
        />
      </label>
      {error && <Toast tone="error">{error}</Toast>}
      <div className={styles.formActions}>
        <PrimaryButton type="submit" disabled={saving}>
          {saving ? "Guardando…" : "Guardar"}
        </PrimaryButton>
        <TextButton onClick={onCancel}>Cancelar</TextButton>
      </div>
    </form>
  );
}
