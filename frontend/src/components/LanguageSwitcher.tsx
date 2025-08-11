import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";

function getPathWithoutLangPrefix(pathname: string) {
    return pathname.replace(/^\/(en|ru)(?=\/|$)/i, "");
}

export default function LanguageSwitcher() {
    const { i18n, t } = useTranslation();
    const location = useLocation();
    const navigate = useNavigate();

    const current = (location.pathname.match(/^\/(en|ru)(\/|$)/i)?.[1]?.toLowerCase() || i18n.language || "en")
        .startsWith("ru")
        ? "ru"
        : "en";

    const switchTo = useCallback(
        (newLang: "en" | "ru") => {
            if (newLang === current) return;

            // обновим i18n и <html lang>
            i18n.changeLanguage(newLang);
            try { document.documentElement.lang = newLang; } catch { }
            try { localStorage.setItem("lang", newLang); } catch { }

            // соберём новый путь: /<lang><path без префикса>?<query>
            const tail = getPathWithoutLangPrefix(location.pathname);
            const url = `/${newLang}${tail}${location.search}`;
            navigate(url, { replace: false });
        },
        [current, i18n, location.pathname, location.search, navigate]
    );

    const btnBase =
        "px-2.5 py-1 rounded-lg text-xs font-medium border transition";
    const active = "bg-blue-600 text-white border-blue-600";
    const idle =
        "bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700";

    return (
        <div className="flex items-center gap-1">
            <span className="text-xs text-zinc-400 mr-1">
                {t("ui.language", "Language")}:
            </span>
            <button
                className={`${btnBase} ${current === "en" ? active : idle}`}
                onClick={() => switchTo("en")}
                aria-pressed={current === "en"}
            >
                EN
            </button>
            <button
                className={`${btnBase} ${current === "ru" ? active : idle}`}
                onClick={() => switchTo("ru")}
                aria-pressed={current === "ru"}
            >
                RU
            </button>
        </div>
    );
}