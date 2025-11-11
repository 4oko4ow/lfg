import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { useAuth, type SocialProvider } from "../context/AuthContext";

const PROVIDERS: { 
  id: SocialProvider; 
  label: string;
  brandColor: string;
  hoverColor: string;
}[] = [
  { 
    id: "steam", 
    label: "Steam",
    brandColor: "from-[#171a21] to-[#1b2838]",
    hoverColor: "hover:from-[#1b2838] hover:to-[#2a475e]"
  },
  { 
    id: "discord", 
    label: "Discord",
    brandColor: "from-[#5865F2] to-[#4752C4]",
    hoverColor: "hover:from-[#4752C4] hover:to-[#3c45a5]"
  },
  { 
    id: "telegram", 
    label: "Telegram",
    brandColor: "from-[#0088cc] to-[#006699]",
    hoverColor: "hover:from-[#006699] hover:to-[#005580]"
  },
];

export default function Header({
  currentLang,
}: {
  currentLang: string;
}) {
  const { t } = useTranslation();
  const { profile, loading, signOut, signIn } = useAuth();
  const navigate = useNavigate();

  const profilePath = `/${currentLang}/profile`;
  const homePath = `/${currentLang}`;

  const displayName =
    profile?.displayName || t("profile.anonymous", "Игрок");

  const handleSignIn = async (provider: SocialProvider) => {
    try {
      signIn(provider);
    } catch (error) {
      console.error(error);
      toast.error(t("auth.error", "Не удалось авторизоваться"));
    }
  };

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
          LFG
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
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-zinc-400">
                {t("auth.sign_in_prompt", "Войти через:")}
              </span>
              {PROVIDERS.map((provider) => (
                <button
                  key={provider.id}
                  onClick={() => handleSignIn(provider.id)}
                  className={`rounded-lg bg-gradient-to-r ${provider.brandColor} ${provider.hoverColor} px-4 py-2 text-xs font-semibold text-white transition-all duration-200 hover:scale-105 active:scale-95 shadow-md hover:shadow-lg border border-white/10`}
                >
                  {provider.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
