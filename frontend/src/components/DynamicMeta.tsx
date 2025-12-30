import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/** распознаём язык из /:lang префикса */
function getLangFromPath(pathname: string): "ru" | "en" {
  const m = pathname.match(/^\/(en|ru)(\/|$)/i);
  return (m?.[1]?.toLowerCase() as "ru" | "en") || "ru";
}

/** Канонический origin (SSR-safe) */
function getOrigin() {
  if (typeof window !== "undefined") return window.location.origin;
  return "https://findparty.online";
}

/** Мета для главной страницы (когда нет ?game) */
const HOME_SEO: Record<"ru" | "en", { title: string; description: string }> = {
  ru: {
    title: "Ищу тиммейтов — FindParty Online | Топ кооп игры: CS2, Dota 2, Valorant, Apex",
    description:
      "Ищу тиммейтов для топовых кооп игр? FindParty — быстрый поиск команды для CS2, Dota 2, Valorant, Apex Legends, The Finals, Overwatch 2, Rust, Minecraft, Helldivers 2, Deep Rock Galactic, Lethal Company, Palworld и других популярных онлайн игр. Без регистрации, живой чат, всё бесплатно.",
  },
  en: {
    title: "Find Teammates — FindParty Online | Top Co-op Games: CS2, Dota 2, Valorant, Apex",
    description:
      "Looking for teammates for top co-op games? FindParty — quick teammate finder for CS2, Dota 2, Valorant, Apex Legends, The Finals, Overwatch 2, Rust, Minecraft, Helldivers 2, Deep Rock Galactic, Lethal Company, Palworld and other popular online games. Free, no registration.",
  },
};

/** Мульти-язычные тайтлы/описания для игр: ключ = slug из ?game */
const GAME_SEO: Record<
  "ru" | "en",
  Record<
    string,
    {
      title: string;
      description: string;
    }
  >
> = {
  ru: {
    repo: {
      title: "Ищу тиммейтов для игры REPO — FindParty",
      description:
        "Ищу тиммейтов для игры REPO? Найди пати по R.E.P.O за секунды. Всё бесплатно, без регистрации. Вступи или создай объявление прямо сейчас.",
    },
    dota2: {
      title: "Ищу пати в Dota 2 — С кем поиграть",
      description:
        "На FindParty легко найти команду по Dota 2. Создай или вступи — всё работает без регистрации.",
    },
    cs2: {
      title: "Ищу с кем поиграть в CS2 — Найди тиммейтов",
      description:
        "Ищу друзей в стим чтобы играть в кс 2? Найди тиммейтов для CS2 по интересам, с голосом и без регистрации. Быстро и удобно на FindParty.",
    },
    peak: {
      title: "Ищу пати в PEAK — Найди игроков на FindParty",
      description:
        "PEAK — отличная игра для кооператива. Найди пати за 10 секунд на FindParty.",
    },
    pubg: {
      title: "Найти пати в PUBG — Ищи тиммейтов",
      description:
        "Хочешь играть в PUBG с командой? Найди или создай пати прямо сейчас.",
    },
    rust: {
      title: "С кем поиграть в Rust — Найди выживших",
      description:
        "Rust требует слаженной игры — найди подходящую пати на FindParty.",
    },
    minecraft: {
      title: "Ищу игроков в Minecraft — Найди с кем поиграть",
      description:
        "Найди друзей для выживания, креатива, мини-игр или модов в Minecraft. Без регистрации.",
    },
    tarkov: {
      title: "Пати в Escape from Tarkov — Найди напарников",
      description:
        "Найди команду для Tarkov — голос, координация, опыт. Создай или вступи прямо сейчас.",
    },
    fortnite: {
      title: "С кем поиграть в Fortnite — Пати без регистрации",
      description:
        "Играешь в Fortnite? На FindParty легко найти команду без регистрации и ожидания.",
    },
    roblox: {
      title: "Ищу с кем поиграть в Roblox — Найди тиммейтов",
      description:
        "Roblox интереснее с друзьями — найди с кем поиграть в любимые режимы.",
    },
    valorant: {
      title: "Ищу пати в Valorant — Быстрый поиск тиммейтов",
      description:
        "Найди напарников для ранкеда в Valorant. Активное сообщество, чат, объявления.",
    },
    apex: {
      title: "Пати для Apex Legends — Найди с кем поиграть",
      description:
        "Apex лучше в команде — найди тиммейтов быстро и удобно на FindParty.",
    },
    thefinals: {
      title: "С кем поиграть в The Finals — FindParty",
      description:
        "The Finals — найди подходящую команду по интересам за пару кликов.",
    },
    marvelrivals: {
      title: "Marvel Rivals — Найди пати",
      description:
        "Создай пати или вступи в уже созданную команду в Marvel Rivals. Всё просто и бесплатно.",
    },
    deeprockgalactic: {
      title: "Deep Rock Galactic — Найди с кем копать",
      description:
        "Deep Rock Galactic требует слаженной команды. Найди своих гномов на FindParty.",
    },
    baldursgate3: {
      title: "С кем поиграть в Baldur's Gate 3 — Кооператив",
      description:
        "Ищешь с кем пройти BG3? На FindParty легко найти команду для совместного прохождения.",
    },
    abioticfactor: {
      title: "Abiotic Factor — Найди пати",
      description:
        "Собери кооп-команду для Abiotic Factor: выживание, исследования и крафт. Создай объявление или вступи сейчас.",
    },
    lethalcompany: {
      title: "Lethal Company — Ищу тиммейтов",
      description:
        "Найди состав для Lethal Company: кооперативные вылазки, связь и координация. Без регистрации.",
    },
    arcraiders: {
      title: "Ищу тиммейтов для Arc Raiders — FindParty",
      description:
        "Ищу тиммейтов для игры Arc Raiders? Найди пати для кооперативных рейдов и командной игры. Всё бесплатно, без регистрации. Создай объявление или вступи сейчас.",
    },
    lol: {
      title: "Ищу пати в League of Legends — Найди команду",
      description:
        "Ищешь команду для League of Legends? Найди тиммейтов для ранкеда, нормсов или клоша. Создай или вступи в пати за секунды. Без регистрации.",
    },
    overwatch2: {
      title: "Ищу тиммейтов в Overwatch 2 — FindParty",
      description:
        "Ищешь команду для Overwatch 2? Найди тиммейтов для ранкеда, быстрых матчей или аркады. Создай пати или вступи в готовую команду. Всё бесплатно.",
    },
    warzone: {
      title: "Ищу пати в Call of Duty: Warzone — Найди команду",
      description:
        "Ищешь команду для Warzone? Найди тиммейтов для рейдов, боевого зона или ресёрдженса. Создай или вступи в пати прямо сейчас. Без регистрации.",
    },
    r6siege: {
      title: "Ищу тиммейтов в Rainbow Six Siege — FindParty",
      description:
        "Ищешь команду для Rainbow Six Siege? Найди тиммейтов для ранкеда, казуала или неранкеда. Создай пати или вступи в готовую команду. Всё бесплатно.",
    },
    helldivers2: {
      title: "Ищу пати в Helldivers 2 — Найди команду",
      description:
        "Ищешь команду для Helldivers 2? Найди тиммейтов для кооперативных миссий и рейдов. Создай или вступи в пати за секунды. Без регистрации.",
    },
    palworld: {
      title: "Ищу тиммейтов в Palworld — FindParty",
      description:
        "Ищешь команду для Palworld? Найди тиммейтов для выживания, крафта и приключений. Создай пати или вступи в готовую команду. Всё бесплатно.",
    },
    destiny2: {
      title: "Ищу пати в Destiny 2 — Найди команду",
      description:
        "Ищешь команду для Destiny 2? Найди тиммейтов для рейдов, страйков, гамбита или PvP. Создай или вступи в пати прямо сейчас. Без регистрации.",
    },
    warframe: {
      title: "Ищу тиммейтов в Warframe — FindParty",
      description:
        "Ищешь команду для Warframe? Найди тиммейтов для миссий, рейдов или эйдолонов. Создай пати или вступи в готовую команду. Всё бесплатно.",
    },
    lostark: {
      title: "Ищу пати в Lost Ark — Найди команду",
      description:
        "Ищешь команду для Lost Ark? Найди тиммейтов для рейдов, данжей или PvP. Создай или вступи в пати за секунды. Без регистрации.",
    },
    seaofthieves: {
      title: "Ищу тиммейтов в Sea of Thieves — FindParty",
      description:
        "Ищешь команду для Sea of Thieves? Найди тиммейтов для пиратских приключений, рейдов и сокровищ. Создай пати или вступи в готовую команду. Всё бесплатно.",
    },
    phasmophobia: {
      title: "Ищу пати в Phasmophobia — Найди команду",
      description:
        "Ищешь команду для Phasmophobia? Найди тиммейтов для охоты на призраков и расследований. Создай или вступи в пати прямо сейчас. Без регистрации.",
    },
  },
  en: {
    repo: {
      title: "Find Teammates for R.E.P.O — FindParty",
      description:
        "Looking for teammates for R.E.P.O game? Find a R.E.P.O party in seconds. Free, no registration. Join or create a listing right now.",
    },
    dota2: {
      title: "Dota 2 LFG — Find a Party",
      description:
        "Easily find a Dota 2 team on FindParty. Create or join — no registration required.",
    },
    cs2: {
      title: "Find Teammates for CS2 — FindParty",
      description:
        "Looking for teammates to play CS2? Find CS2 teammates by playstyle, with or without voice. Fast and convenient on FindParty.",
    },
    peak: {
      title: "PEAK LFG — Find Players on FindParty",
      description:
        "PEAK is better in co-op. Find a party in 10 seconds on FindParty.",
    },
    pubg: {
      title: "PUBG LFG — Find a Squad",
      description:
        "Want to play PUBG with a squad? Join or create a party now.",
    },
    rust: {
      title: "Rust LFG — Find Survivors",
      description:
        "Rust needs coordination — find the right party on FindParty.",
    },
    minecraft: {
      title: "Minecraft LFG — Find Friends to Play",
      description:
        "Find players for survival, creative, mini-games or modded Minecraft. No registration.",
    },
    tarkov: {
      title: "Escape from Tarkov LFG — Find Teammates",
      description:
        "Find a Tarkov squad with voice and experience. Create or join instantly.",
    },
    fortnite: {
      title: "Fortnite LFG — Play Without Solo",
      description:
        "Playing Fortnite? Quickly find a squad without registration.",
    },
    roblox: {
      title: "Roblox LFG — Find People to Play",
      description:
        "Roblox is better with friends — find teammates for your favorite modes.",
    },
    valorant: {
      title: "Valorant LFG — Fast Teammate Finder",
      description:
        "Find ranked or casual teammates in Valorant. Active community, chat, listings.",
    },
    apex: {
      title: "Apex Legends LFG — Find a Squad",
      description:
        "Apex is better with a team — find teammates fast on FindParty.",
    },
    thefinals: {
      title: "The Finals LFG — Find a Team",
      description:
        "Find a like-minded squad for The Finals in a couple of clicks.",
    },
    marvelrivals: {
      title: "Marvel Rivals LFG — Find a Party",
      description:
        "Create a party or join an existing team in Marvel Rivals. Simple and free.",
    },
    deeprockgalactic: {
      title: "Deep Rock Galactic LFG — Find a Crew",
      description:
        "Deep Rock Galactic needs a synced crew. Find your dwarves on FindParty.",
    },
    baldursgate3: {
      title: "Baldur's Gate 3 Co‑op — Find Teammates",
      description:
        "Looking for BG3 co-op? Easily find a party for a joint playthrough.",
    },
    abioticfactor: {
      title: "Abiotic Factor LFG — Find a Co‑op Team",
      description:
        "Build a co‑op group for Abiotic Factor: survival, exploration, crafting. Create or join now.",
    },
    lethalcompany: {
      title: "Lethal Company LFG — Find Teammates",
      description:
        "Find a crew for Lethal Company: co‑op runs, voice comms and coordination. No registration.",
    },
    arcraiders: {
      title: "Find Teammates for Arc Raiders — FindParty",
      description:
        "Looking for teammates for Arc Raiders? Find a party for co-op raids and team play. Free, no registration. Create or join now on FindParty.",
    },
    lol: {
      title: "League of Legends LFG — Find a Team",
      description:
        "Looking for a League of Legends team? Find teammates for ranked, normals or clash. Create or join a party in seconds. No registration.",
    },
    overwatch2: {
      title: "Overwatch 2 LFG — Find Teammates",
      description:
        "Looking for an Overwatch 2 team? Find teammates for ranked, quick play or arcade. Create a party or join an existing team. Free.",
    },
    warzone: {
      title: "Call of Duty: Warzone LFG — Find a Squad",
      description:
        "Looking for a Warzone squad? Find teammates for raids, battle royale or resurgence. Create or join a party now. No registration.",
    },
    r6siege: {
      title: "Rainbow Six Siege LFG — Find Teammates",
      description:
        "Looking for a Rainbow Six Siege team? Find teammates for ranked, casual or unranked. Create a party or join an existing team. Free.",
    },
    helldivers2: {
      title: "Helldivers 2 LFG — Find a Squad",
      description:
        "Looking for a Helldivers 2 squad? Find teammates for co-op missions and raids. Create or join a party in seconds. No registration.",
    },
    palworld: {
      title: "Palworld LFG — Find Teammates",
      description:
        "Looking for a Palworld team? Find teammates for survival, crafting and adventures. Create a party or join an existing team. Free.",
    },
    destiny2: {
      title: "Destiny 2 LFG — Find a Team",
      description:
        "Looking for a Destiny 2 team? Find teammates for raids, strikes, gambit or PvP. Create or join a party now. No registration.",
    },
    warframe: {
      title: "Warframe LFG — Find Teammates",
      description:
        "Looking for a Warframe team? Find teammates for missions, raids or eidolons. Create a party or join an existing team. Free.",
    },
    lostark: {
      title: "Lost Ark LFG — Find a Team",
      description:
        "Looking for a Lost Ark team? Find teammates for raids, dungeons or PvP. Create or join a party in seconds. No registration.",
    },
    seaofthieves: {
      title: "Sea of Thieves LFG — Find Teammates",
      description:
        "Looking for a Sea of Thieves crew? Find teammates for pirate adventures, raids and treasure. Create a party or join an existing team. Free.",
    },
    phasmophobia: {
      title: "Phasmophobia LFG — Find a Team",
      description:
        "Looking for a Phasmophobia team? Find teammates for ghost hunting and investigations. Create or join a party now. No registration.",
    },
  },
};

export function DynamicMeta() {
  const location = useLocation();
  const lang = getLangFromPath(location.pathname);
  const params = new URLSearchParams(location.search);
  const raw = params.get("game")?.toLowerCase() || "";

  // корректируем ключи: слуги строго по твоей карте
  const knownSlugs = new Set([
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
    "abioticfactor",
    "lethalcompany",
    "arcraiders",
    "lol",
    "overwatch2",
    "warzone",
    "r6siege",
    "helldivers2",
    "palworld",
    "destiny2",
    "warframe",
    "lostark",
    "seaofthieves",
    "phasmophobia",
  ]);

  const game = knownSlugs.has(raw) ? raw : null;
  const seo = game ? GAME_SEO[lang][game] : HOME_SEO[lang];

  useEffect(() => {
    // <html lang>
    const html = document.documentElement;
    if (html) html.setAttribute("lang", lang);

    const { title, description } = seo;

    // Title
    document.title = title;

    // meta[name=description]
    let metaDesc = document.querySelector("meta[name='description']");
    if (!metaDesc) {
      metaDesc = document.createElement("meta");
      metaDesc.setAttribute("name", "description");
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute("content", description);

    // OG
    const ensure = (selector: string, attr: "name" | "property", attrValue: string) => {
      let el = document.querySelector<HTMLMetaElement>(selector);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, attrValue);
        document.head.appendChild(el);
      }
      return el;
    };

    const ogTitle = ensure("meta[property='og:title']", "property", "og:title");
    ogTitle.setAttribute("content", title);

    const ogDesc = ensure("meta[property='og:description']", "property", "og:description");
    ogDesc.setAttribute("content", description);

    const ogType = ensure("meta[property='og:type']", "property", "og:type");
    ogType.setAttribute("content", "website");

    const ogUrl = ensure("meta[property='og:url']", "property", "og:url");
    ogUrl.setAttribute("content", window.location.href);

    const ogImage = ensure("meta[property='og:image']", "property", "og:image");
    ogImage.setAttribute("content", `${getOrigin()}/og-image.png`);

    const ogImageWidth = ensure("meta[property='og:image:width']", "property", "og:image:width");
    ogImageWidth.setAttribute("content", "1200");

    const ogImageHeight = ensure("meta[property='og:image:height']", "property", "og:image:height");
    ogImageHeight.setAttribute("content", "630");

    const ogSiteName = ensure("meta[property='og:site_name']", "property", "og:site_name");
    ogSiteName.setAttribute("content", "FindParty");

    const ogLocale = ensure("meta[property='og:locale']", "property", "og:locale");
    ogLocale.setAttribute("content", lang === "ru" ? "ru_RU" : "en_US");

    // Twitter
    const twCard = ensure("meta[name='twitter:card']", "name", "twitter:card");
    twCard.setAttribute("content", "summary_large_image");

    const twTitle = ensure("meta[name='twitter:title']", "name", "twitter:title");
    twTitle.setAttribute("content", title);

    const twDesc = ensure("meta[name='twitter:description']", "name", "twitter:description");
    twDesc.setAttribute("content", description);

    const twImage = ensure("meta[name='twitter:image']", "name", "twitter:image");
    twImage.setAttribute("content", `${getOrigin()}/og-image.png`);

    // canonical + hreflang
    const origin = getOrigin();
    // вырезаем /en|/ru чтобы собрать alternate
    const pathNoLang = location.pathname.replace(/^\/(en|ru)/i, "");
    const canonicalHref = `${origin}/${lang}${pathNoLang}${location.search}`;

    let linkCanonical = document.querySelector<HTMLLinkElement>("link[rel='canonical']");
    if (!linkCanonical) {
      linkCanonical = document.createElement("link");
      linkCanonical.setAttribute("rel", "canonical");
      document.head.appendChild(linkCanonical);
    }
    linkCanonical.setAttribute("href", canonicalHref);

    const ensureLink = (hreflang: string, href: string) => {
      let el = document.querySelector<HTMLLinkElement>(`link[rel='alternate'][hreflang='${hreflang}']`);
      if (!el) {
        el = document.createElement("link");
        el.setAttribute("rel", "alternate");
        el.setAttribute("hreflang", hreflang);
        document.head.appendChild(el);
      }
      el.setAttribute("href", href);
    };

    ensureLink("en", `${origin}/en${pathNoLang}${location.search}`);
    ensureLink("ru", `${origin}/ru${pathNoLang}${location.search}`);
    ensureLink("x-default", `${origin}/en/`);
  }, [lang, location.pathname, location.search, seo]);

  return null;
}