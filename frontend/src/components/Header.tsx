import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { Users } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useOnlineCount } from "../context/OnlineCountContext";
import LoginModal from "./modals/LoginModal";
import { analytics } from "../utils/analytics";
export default function Header() {
  const { t } = useTranslation();
  const { profile, loading, signOut } = useAuth();
  const { onlineCount } = useOnlineCount();
  const navigate = useNavigate();
  const [showLoginModal, setShowLoginModal] = useState(false);

  const profilePath = "/profile";
  const homePath = "/";

  const displayName =
    profile?.displayName || t("profile.anonymous");

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate(homePath);
    } catch (error) {
      console.error(error);
      toast.error(t("auth.error"));
    }
  };

  return (
    <header className="w-full border-b border-zinc-800/50 bg-zinc-950/95 backdrop-blur-md text-white sticky top-0 z-40 shadow-lg shadow-zinc-900/50">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
        <div className="flex items-center gap-4 sm:gap-6">
          <Link
            to={homePath}
            className="text-base sm:text-lg font-bold tracking-tight hover:text-blue-400 transition-colors duration-200 flex-shrink-0"
          >
            FindParty
          </Link>
          <Link
            to="/communities"
            onClick={() => analytics.communitiesLinkClickHeader()}
            className="hidden sm:inline text-xs sm:text-sm text-zinc-400 hover:text-emerald-400 transition-colors duration-200"
          >
            Для сообществ
          </Link>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 text-sm flex-shrink-0">
          {onlineCount > 0 && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 backdrop-blur-sm">
              <div className="relative flex items-center justify-center w-2 h-2">
                <div className="absolute inset-0 bg-green-500/20 blur-md rounded-full"></div>
                <div className="relative h-2 w-2 rounded-full bg-green-500 border border-green-400/50"></div>
              </div>
              <div className="flex items-center gap-1.5">
                <Users className="h-4 w-4 text-green-400 flex-shrink-0" />
                <span className="text-sm font-semibold text-green-300 leading-tight">
                  {onlineCount}
                </span>
                <span className="text-xs text-green-400/80 font-medium leading-tight">
                  {t("hero.online_short")}
                </span>
              </div>
            </div>
          )}
          {loading ? (
            <span className="text-zinc-400 text-xs sm:text-sm">
              {t("auth.loading")}
            </span>
          ) : profile ? (
            <>
              <span className="hidden md:inline text-zinc-300 text-sm font-medium max-w-[120px] truncate">
                {displayName}
              </span>
              <Link
                to={profilePath}
                className="rounded-lg border border-zinc-700/60 px-2.5 sm:px-3 py-1.5 text-[10px] sm:text-xs font-semibold uppercase tracking-wide text-zinc-200 transition-all duration-200 hover:border-blue-500/60 hover:text-blue-400 hover:scale-105 active:scale-95 whitespace-nowrap"
              >
                {t("profile.link")}
              </Link>
              <button
                onClick={handleSignOut}
                className="rounded-lg bg-zinc-800/80 px-2.5 sm:px-3 py-1.5 text-[10px] sm:text-xs font-semibold uppercase tracking-wide text-zinc-200 transition-all duration-200 hover:bg-zinc-700/80 hover:scale-105 active:scale-95 whitespace-nowrap"
              >
                {t("auth.sign_out")}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setShowLoginModal(true)}
                className="rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white transition-all duration-200 hover:scale-105 active:scale-95 shadow-md hover:shadow-lg whitespace-nowrap"
              >
                {t("auth.sign_in")}
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
