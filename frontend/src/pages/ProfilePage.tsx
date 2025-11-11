import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth, type SocialProvider } from "../context/AuthContext";
import {
  contactHandleToInput,
  normalizeContactHandle,
} from "../utils/contactHelpers";

const PROVIDERS: {
  id: SocialProvider;
  title: string;
  description: string;
  placeholder: string;
}[] = [
    {
      id: "steam",
      title: "Steam",
      description: "profile.steam_description",
      placeholder: "https://steamcommunity.com/id/username",
    },
    {
      id: "discord",
      title: "Discord",
      description: "profile.discord_description",
      placeholder: "username или @username",
    },
    {
      id: "telegram",
      title: "Telegram",
      description: "profile.telegram_description",
      placeholder: "@username",
    },
  ];

export default function ProfilePage() {
  const { lang } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const {
    profile,
    loading,
    contactHandles,
    linkProvider,
    updateContactHandle,
  } = useAuth();

  const [values, setValues] = useState<Record<SocialProvider, string>>({
    steam: "",
    discord: "",
    telegram: "",
  });

  useEffect(() => {
    setValues({
      steam: contactHandleToInput(contactHandles.steam),
      discord: contactHandleToInput(contactHandles.discord),
      telegram: contactHandleToInput(contactHandles.telegram),
    });
  }, [contactHandles]);

  useEffect(() => {
    // Only redirect if we've finished loading and there's no profile
    // Don't redirect while still loading
    if (loading === false && !profile) {
      navigate(`/${lang ?? "en"}`, { replace: true });
    }
  }, [profile, loading, lang, navigate]);

  const linkedProviders = useMemo(() => {
    const set = new Set<string>();
    profile?.identities.forEach((identity) => {
      if (identity.provider) set.add(identity.provider);
    });
    return set;
  }, [profile]);

  const handleLink = async (provider: SocialProvider) => {
    try {
      linkProvider(provider);
    } catch (error) {
      console.error(error);
      toast.error(t("auth.error", "Не удалось авторизоваться"));
    }
  };

  const handleSave = async (provider: SocialProvider) => {
    try {
      const handle = normalizeContactHandle(provider, values[provider]);
      await updateContactHandle(provider, handle);
      toast.success(t("profile.saved", "Сохранено"));
    } catch (error) {
      console.error(error);
      toast.error(t("toasts.error", "Что-то пошло не так"));
    }
  };

  if (loading || !profile) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-3xl items-center justify-center px-4 text-white">
        <span className="text-sm text-zinc-300">
          {t("auth.loading", "Загрузка...")}
        </span>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 text-white">
      <h1 className="mb-6 text-2xl font-semibold">
        {t("profile.title", "Ваш профиль")}
      </h1>
      <p className="mb-10 text-sm text-zinc-400">
        {t(
          "profile.description",
          "Подключите способы связи и настройте отображение контактов для объявлений."
        )}
      </p>

      <div className="space-y-6">
        {PROVIDERS.map((provider) => {
          const isLinked = linkedProviders.has(provider.id);
          return (
            <div
              key={provider.id}
              className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-5"
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold">{provider.title}</h2>
                  <p className="text-sm text-zinc-400">
                    {t(provider.description)}
                  </p>
                </div>
                <button
                  onClick={() => handleLink(provider.id)}
                  className="rounded border border-blue-500 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-300 transition hover:bg-blue-500/10"
                >
                  {isLinked
                    ? t("profile.relink", "Переподключить")
                    : t("profile.connect", "Подключить")}
                </button>
              </div>

              <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                {t("profile.contact_label", "Контакт для объявлений")}
              </label>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <input
                  disabled={!isLinked}
                  value={values[provider.id]}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, [provider.id]: e.target.value }))
                  }
                  placeholder={provider.placeholder}
                  className="w-full rounded-lg border border-zinc-700/50 bg-zinc-900/50 px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 transition-colors hover:border-zinc-600 hover:bg-zinc-900/70 disabled:cursor-not-allowed disabled:opacity-50"
                />
                <button
                  onClick={() => handleSave(provider.id)}
                  disabled={!isLinked}
                  className="rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2.5 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:opacity-50"
                >
                  {t("profile.save", "Сохранить")}
                </button>
              </div>
              {!isLinked && (
                <p className="mt-2 text-xs text-zinc-500">
                  {t(
                    "profile.link_required",
                    "Сначала подключите аккаунт, чтобы указать контакт."
                  )}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
