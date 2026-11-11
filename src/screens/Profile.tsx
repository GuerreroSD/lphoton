import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { TextButton } from "../components/Button";
import { PlatformBadge, PlatformBadges } from "../components/PlatformBadge";
import { totalPlaytimeMinutes } from "../lib/library";
import { useAppStore } from "../store/appStore";
import { useLibrary } from "../store/useLibrary";
import { PLATFORM_NAMES, type Platform } from "../types";
import { SectionPage } from "./Page";
import page from "./Page.module.css";
import styles from "./Profile.module.css";

function formatHours(minutes: number): string {
  if (minutes > 0 && minutes < 60) return "< 1 h";
  return `${Math.round(minutes / 60).toLocaleString("es-CL")} h`;
}

/** Perfil (§6.7): nombre, plataformas, total de juegos y horas sumadas de todas las tiendas. */
export function Profile() {
  const linked = useAppStore((s) => s.linkedPlatforms);
  const { entries } = useLibrary();
  const minutes = entries.reduce((sum, e) => sum + totalPlaytimeMinutes(e.game), 0);
  const installed = entries.filter((e) => e.game.sources.some((s) => s.installed)).length;

  const byPlatform = linked.map((platform) => {
    const sources = entries.flatMap((e) => e.game.sources.filter((s) => s.platform === platform));
    return {
      platform,
      games: sources.length,
      installed: sources.filter((s) => s.installed).length,
      minutes: sources.reduce((sum, s) => sum + s.playtimeMinutes, 0),
    };
  });

  const topPlayed = entries
    .map((e) => ({ game: e.game, minutes: totalPlaytimeMinutes(e.game) }))
    .filter((e) => e.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, 5);

  return (
    <SectionPage title="Perfil">
      <UsernameField />

      <dl className={page.stats}>
        <div className={page.stat}>
          <dt>Plataformas</dt>
          <dd>
            <PlatformBadges platforms={linked} />
          </dd>
        </div>
        <div className={page.stat}>
          <dt>Juegos</dt>
          <dd>{entries.length}</dd>
        </div>
        <div className={page.stat}>
          <dt>Instalados</dt>
          <dd>{installed}</dd>
        </div>
        <div className={page.stat}>
          <dt>Horas jugadas</dt>
          <dd>{formatHours(minutes)}</dd>
        </div>
      </dl>

      <section className={page.section} aria-labelledby="profile-platforms">
        <h2 id="profile-platforms" className={page.subtitle}>
          Por plataforma
        </h2>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Plataforma</th>
              <th scope="col">Juegos</th>
              <th scope="col">Instalados</th>
              <th scope="col">Horas</th>
            </tr>
          </thead>
          <tbody>
            {byPlatform.map((row) => (
              <tr key={row.platform}>
                <th scope="row">
                  <span className={styles.platformCell}>
                    <PlatformBadge platform={row.platform} />
                    {PLATFORM_NAMES[row.platform as Platform]}
                  </span>
                </th>
                <td>{row.games}</td>
                <td>{row.installed}</td>
                <td>{formatHours(row.minutes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className={styles.note}>
          Un juego que tienes en dos tiendas cuenta una vez en el total y una vez en cada tienda.
        </p>
      </section>

      <section className={page.section} aria-labelledby="profile-top">
        <h2 id="profile-top" className={page.subtitle}>
          Más jugados
        </h2>
        {topPlayed.length === 0 ? (
          <p className={styles.note}>Aún no hay horas de juego registradas.</p>
        ) : (
          <ol className={styles.top}>
            {topPlayed.map(({ game, minutes: m }, i) => (
              <li key={game.id}>
                <Link to={`/juego/${game.id}`} className={styles.topItem}>
                  <span className={styles.rank}>{i + 1}</span>
                  <span className={styles.topTitle}>{game.title}</span>
                  <span className={styles.topHours}>{formatHours(m)}</span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>
    </SectionPage>
  );
}

function UsernameField() {
  const username = useAppStore((s) => s.username);
  const setUsername = useAppStore((s) => s.setUsername);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(username ?? "");

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const clean = draft.trim();
    if (clean) setUsername(clean.slice(0, 40));
    setEditing(false);
  };

  if (!editing) {
    return (
      <div className={styles.nameRow}>
        <span className={styles.name}>{username ?? "Invitado"}</span>
        <TextButton
          onClick={() => {
            setDraft(username ?? "");
            setEditing(true);
          }}
        >
          Cambiar nombre
        </TextButton>
      </div>
    );
  }

  return (
    <form className={styles.nameRow} onSubmit={onSubmit}>
      <label htmlFor="profile-name" className="visually-hidden">
        Nombre
      </label>
      <input
        id="profile-name"
        className={styles.input}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
        maxLength={40}
        autoFocus
        autoComplete="off"
        spellCheck={false}
      />
      <TextButton type="submit">Guardar</TextButton>
      <TextButton onClick={() => setEditing(false)}>Cancelar</TextButton>
    </form>
  );
}
