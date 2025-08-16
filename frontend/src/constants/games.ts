// src/constants/games.ts
export const GAME_SLUGS = [
  "repo",
  "dota2",
  "cs2",
  "peak",
  "pubg",
  "rust",
  "minecraft",
  "tarkov",
  "fortnite",
  "roblox",
  "valorant",
  "apex",
  "thefinals",
  "marvelrivals",
  "deeprockgalactic",
  "baldursgate3",
  "lethalcompany",
  "abioticfactor",
  "gta5online"
] as const;

export type GameSlug = typeof GAME_SLUGS[number];

export const SLUG_TO_FALLBACK_NAME: Record<GameSlug, string> = {
  repo: "R.E.P.O",
  dota2: "Dota 2",
  cs2: "CS2",
  peak: "PEAK",
  pubg: "PUBG",
  rust: "Rust",
  minecraft: "Minecraft",
  tarkov: "Tarkov",
  fortnite: "Fortnite",
  roblox: "Roblox",
  valorant: "Valorant",
  apex: "Apex",
  thefinals: "The Finals",
  marvelrivals: "Marvel Rivals",
  deeprockgalactic: "Deep Rock Galactic",
  baldursgate3: "Baldurs Gate 3",
  lethalcompany: "Lethal Company",
  abioticfactor: "Abiotic Factor",
  gta5online: "GTA 5 Online"

};

// i18n‑совместимый тип: t(key, { defaultValue })
export type TLike = (key: string, opts?: { defaultValue?: string }) => string;

export function getGameName(slug: string, t: TLike): string {
  const key = `games.${slug}.name`;
  const fallback = SLUG_TO_FALLBACK_NAME[slug as GameSlug] ?? slug.replace(/-/g, " ");
  return t(key, { defaultValue: fallback });
}

// ЕДИНАЯ точка получения списка игр: [{ slug, name }]
export function getGames(t: TLike): { slug: GameSlug; name: string }[] {
  return GAME_SLUGS.map((slug) => ({ slug, name: getGameName(slug, t) }));
}

// Утилиты, если нужны
export function nameToSlugMap(games: { slug: GameSlug; name: string }[]) {
  return Object.fromEntries(games.map((g) => [g.name.toLowerCase(), g.slug])) as Record<
    string,
    GameSlug
  >;
}