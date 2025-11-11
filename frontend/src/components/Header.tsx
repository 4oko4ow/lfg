import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { useAuth, type SocialProvider } from "../context/AuthContext";

const PROVIDERS: { id: SocialProvider; label: string }[] = [
  { id: "steam", label: "Steam" },
  { id: "discord", label: "Discord" },
  { id: "telegram", label: "Telegram" },
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
    <header className="w-full border-b border-zinc-800 bg-zinc-950 text-white">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link to={homePath} className="text-lg font-semibold tracking-wide">
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
                className="rounded border border-zinc-700 px-3 py-1 text-xs font-medium uppercase tracking-wide text-zinc-200 transition hover:border-blue-500 hover:text-blue-400"
              >
                {t("profile.link", "Профиль")}
              </Link>
              <button
                onClick={handleSignOut}
                className="rounded bg-zinc-800 px-3 py-1 text-xs font-medium uppercase tracking-wide text-zinc-200 transition hover:bg-zinc-700"
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
                  className="rounded bg-blue-600 px-3 py-1 text-xs font-semibold uppercase tracking-wide transition hover:bg-blue-500"
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
