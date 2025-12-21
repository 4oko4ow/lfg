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
  "terraria",
  "apex",
  "thefinals",
  "marvelrivals",
  "deeprockgalactic",
  "baldursgate3",
  "lethalcompany",
  "abioticfactor",
  "gta5online",
  "arcraiders",
  "lol",
  "overwatch2",
  "warzone",
  "r6siege",
  "rocketleague",
  "amongus",
  "phasmophobia",
  "seaofthieves",
  "deadbydaylight",
  "wow",
  "ffxiv",
  "genshin",
  "honkaistarrail",
  "palworld",
  "helldivers2",
  "destiny2",
  "warframe",
  "pathofexile",
  "diablo4",
  "lostark",
  "newworld",
  "guildwars2",
  "eso",
  "fallguys",
  "huntshowdown",
  "tf2",
  "codmw3",
  "bf2042",
  "haloinfinite"
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
  terraria: "Terraria",
  apex: "Apex",
  thefinals: "The Finals",
  marvelrivals: "Marvel Rivals",
  deeprockgalactic: "Deep Rock Galactic",
  baldursgate3: "Baldurs Gate 3",
  lethalcompany: "Lethal Company",
  abioticfactor: "Abiotic Factor",
  gta5online: "GTA 5 Online",
  arcraiders: "Arc Raiders",
  lol: "League of Legends",
  overwatch2: "Overwatch 2",
  warzone: "Call of Duty: Warzone",
  r6siege: "Rainbow Six Siege",
  rocketleague: "Rocket League",
  amongus: "Among Us",
  phasmophobia: "Phasmophobia",
  seaofthieves: "Sea of Thieves",
  deadbydaylight: "Dead by Daylight",
  wow: "World of Warcraft",
  ffxiv: "Final Fantasy XIV",
  genshin: "Genshin Impact",
  honkaistarrail: "Honkai: Star Rail",
  palworld: "Palworld",
  helldivers2: "Helldivers 2",
  destiny2: "Destiny 2",
  warframe: "Warframe",
  pathofexile: "Path of Exile",
  diablo4: "Diablo 4",
  lostark: "Lost Ark",
  newworld: "New World",
  guildwars2: "Guild Wars 2",
  eso: "Elder Scrolls Online",
  fallguys: "Fall Guys",
  huntshowdown: "Hunt: Showdown",
  tf2: "Team Fortress 2",
  codmw3: "Call of Duty: Modern Warfare III",
  bf2042: "Battlefield 2042",
  haloinfinite: "Halo Infinite"
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