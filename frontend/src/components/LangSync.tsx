// src/components/LangSync.tsx
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";

export default function LangSync() {
  const { i18n } = useTranslation();
  const location = useLocation();

  useEffect(() => {
    const pathLang = location.pathname.match(/^\/(en|ru)(\/|$)/i)?.[1]?.toLowerCase() || "en";
    if (i18n.language !== pathLang) {
      // i18next instance гарантированно есть — мы его создали в i18n.ts
      i18n.changeLanguage(pathLang);
      try { document.documentElement.lang = pathLang; } catch {}
      try { localStorage.setItem("lang", pathLang); } catch {}
    }
  }, [location.pathname, i18n]);

  return null;
}