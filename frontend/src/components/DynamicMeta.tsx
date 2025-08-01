import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const GAME_SEO: Record<string, { title: string; description: string }> = {
    repo: {
        title: "С кем поиграть в R.E.P.O — Найди пати на FindParty",
        description: "Найди пати по R.E.P.O за секунды. Всё бесплатно, без регистрации. Вступи или создай объявление прямо сейчас.",
    },
    dota2: {
        title: "Ищу пати в Dota 2 — С кем поиграть",
        description: "На FindParty легко найти команду по Dota 2. Создай или вступи — всё работает без регистрации.",
    },
    cs2: {
        title: "С кем поиграть в CS2 — Найди тиммейтов",
        description: "Найди тиммейтов для CS2 по интересам, с голосом и без регистрации. Быстро и удобно.",
    },
    peak: {
        title: "Ищу пати в PEAK — Найди игроков на FindParty",
        description: "PEAK — отличная игра для кооператива. Найди пати за 10 секунд на FindParty.",
    },
    pubg: {
        title: "Найти пати в PUBG — Ищи тиммейтов",
        description: "Хочешь играть в PUBG с командой? Найди или создай пати прямо сейчас.",
    },
    rust: {
        title: "С кем поиграть в Rust — Найди выживших",
        description: "Rust требует слаженной игры — найди подходящую пати на FindParty.",
    },
    minecraft: {
        title: "Ищу игроков в Minecraft — Найди с кем поиграть",
        description: "Найди друзей для выживания или строительства в Minecraft. Без регистрации, всё просто.",
    },
    tarkov: {
        title: "Пати в Escape from Tarkov — Найди напарников",
        description: "Найди команду для Tarkov — голос, координация, опыт. Создай или вступи прямо сейчас.",
    },
    fortnite: {
        title: "С кем поиграть в Fortnite — Пати без регистрации",
        description: "Играешь в Fortnite? На FindParty легко найти команду без регистрации и ожидания.",
    },
    roblox: {
        title: "Ищу с кем поиграть в Roblox — Найди тиммейтов",
        description: "Roblox интереснее с друзьями — найди с кем поиграть в любимые режимы.",
    },
    valorant: {
        title: "Ищу пати в Valorant — Быстрый поиск тиммейтов",
        description: "Найди напарников для ранкеда в Valorant. Активное сообщество, чат, объявления.",
    },
    apex: {
        title: "Пати для Apex Legends — Найди с кем поиграть",
        description: "Apex лучше в команде — найди тиммейтов быстро и удобно на FindParty.",
    },
    thefinals: {
        title: "С кем поиграть в The Finals — FindParty",
        description: "The Finals — найди подходящую команду по интересам за пару кликов.",
    },
    marvelrivals: {
        title: "Marvel Rivals — Найди пати",
        description: "Создай пати или вступи в уже созданную команду в Marvel Rivals. Всё просто и бесплатно.",
    },
    deeprock: {
        title: "Deep Rock Galactic — Найди с кем копать",
        description: "Deep Rock Galactic требует слаженной команды. Найди своих гномов на FindParty.",
    },
    baldursgate3: {
        title: "С кем поиграть в Baldur's Gate 3 — Кооператив",
        description: "Ищешь с кем пройти BG3? На FindParty легко найти команду для совместного прохождения.",
    },
};

export function DynamicMeta() {
    const location = useLocation();
    const params = new URLSearchParams(location.search);
    const raw = params.get("game")?.toLowerCase();
    const game = raw && GAME_SEO[raw] ? raw : null;
   

    useEffect(() => {
        if (game && GAME_SEO[game]) {
            const { title, description } = GAME_SEO[game];

            // Title
            document.title = title;

            // Meta description
            let metaDesc = document.querySelector("meta[name='description']");
            if (!metaDesc) {
                metaDesc = document.createElement("meta");
                metaDesc.setAttribute("name", "description");
                document.head.appendChild(metaDesc);
            }
            metaDesc.setAttribute("content", description);

            // Open Graph: title
            let ogTitle = document.querySelector("meta[property='og:title']");
            if (!ogTitle) {
                ogTitle = document.createElement("meta");
                ogTitle.setAttribute("property", "og:title");
                document.head.appendChild(ogTitle);
            }
            ogTitle.setAttribute("content", title);

            // Open Graph: description
            let ogDesc = document.querySelector("meta[property='og:description']");
            if (!ogDesc) {
                ogDesc = document.createElement("meta");
                ogDesc.setAttribute("property", "og:description");
                document.head.appendChild(ogDesc);
            }
            ogDesc.setAttribute("content", description);
        }
    }, [game]);

    return null;
}


