import { useEffect, useMemo } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";

import RedirectOnRoot from "./components/RedirectOnRoot";
import LangSync from "./components/LangSync";
import Header from "./components/Header";
import PartyFeedPage from "./pages/PartyFeedPage";
import ProfilePage from "./pages/ProfilePage";
import AuthCallbackPage from "./pages/AuthCallbackPage";

function App() {
  const location = useLocation();
  const { i18n } = useTranslation();

  useEffect(() => {
    const pathLang =
      location.pathname.match(/^\/(en|ru)(\/|$)/i)?.[1]?.toLowerCase() || "en";
    if (i18n.language !== pathLang) {
      i18n.changeLanguage(pathLang);
      document.documentElement.lang = pathLang;
      try {
        localStorage.setItem("lang", pathLang);
      } catch {
        // ignore storage errors
      }
    }
  }, [location.pathname, i18n]);

  const currentLang = useMemo(
    () =>
      location.pathname.match(/^\/(en|ru)(\/|$)/i)?.[1]?.toLowerCase() || "en",
    [location.pathname]
  );

  return (
    <>
      <RedirectOnRoot />
      <LangSync />
      <Header currentLang={currentLang} />
      <Routes>
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/:lang/profile" element={<ProfilePage />} />
        <Route path="/:lang/*" element={<PartyFeedPage />} />
        <Route
          path="*"
          element={<Navigate to={`/${currentLang}`} replace />}
        />
      </Routes>
    </>
  );
}

export default App;
