import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import i18n from "../i18n";

/** Если путь ровно '/', перекидываем на '/<lang>' с учётом автодетекта */
export default function RedirectOnRoot() {
    const location = useLocation();
    const navigate = useNavigate();

    useEffect(() => {
        // только если реально корень без префикса
        if (location.pathname === "/" || location.pathname === "") {
            // 1) возьмём язык, который уже выбрал i18next (детектор)
            let lang = (i18n.language || "en").toLowerCase();
            // 2) подстрахуемся на случай нестандартных значений
            lang = lang.startsWith("ru") ? "ru" : "en";

            navigate(`/${lang}${location.search}`, { replace: true });
        }
    }, [location.pathname, location.search, navigate]);

    return null;
}