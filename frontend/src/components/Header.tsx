import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import LoginModal from "./modals/LoginModal";

export default function Header({
  currentLang,
}: {
  currentLang: string;
}) {
  const { t } = useTranslation();
  const { profile, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [showLoginModal, setShowLoginModal] = useState(false);

  const profilePath = `/${currentLang}/profile`;
  const homePath = `/${currentLang}`;

  const displayName =
    profile?.displayName || t("profile.anonymous", "Игрок");

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate(homePath);
    } catch (error) {
      console.error(error);
      toast.error(t("auth.error", "Не удалось авторизоваться"));
    }
  };

  return (
    <header className="w-full border-b border-zinc-800/50 bg-zinc-950/80 backdrop-blur-sm text-white sticky top-0 z-40 shadow-sm">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link to={homePath} className="text-lg font-semibold tracking-wide hover:text-blue-400 transition-colors duration-200">
          FindParty
        </Link>
        <div className="flex items-center gap-3 text-sm">
          {loading ? (
            <span className="text-zinc-400">
              {t("auth.loading", "Загрузка...")}
            </span>
          ) : profile ? (
            <>
              <span className="hidden text-zinc-300 sm:inline">{displayName}</span>
              <Link
                to={profilePath}
                className="rounded-lg border border-zinc-700 px-3 py-1 text-xs font-medium uppercase tracking-wide text-zinc-200 transition-all duration-200 hover:border-blue-500 hover:text-blue-400 hover:scale-105 active:scale-95"
              >
                {t("profile.link", "Профиль")}
              </Link>
              <button
                onClick={handleSignOut}
                className="rounded-lg bg-zinc-800 px-3 py-1 text-xs font-medium uppercase tracking-wide text-zinc-200 transition-all duration-200 hover:bg-zinc-700 hover:scale-105 active:scale-95"
              >
                {t("auth.sign_out", "Выйти")}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setShowLoginModal(true)}
                className="rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:scale-105 active:scale-95 shadow-md hover:shadow-lg"
              >
                {t("auth.sign_in", "Sign in")}
              </button>
              {showLoginModal && (
                <LoginModal onClose={() => setShowLoginModal(false)} />
              )}
            </>
          )}
        </div>
      </div>
    </header>
  );
}
