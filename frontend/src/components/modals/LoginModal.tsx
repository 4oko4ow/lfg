import { useTranslation } from "react-i18next";
import { useAuth, type SocialProvider } from "../../context/AuthContext";
import { XMarkIcon } from "@heroicons/react/24/solid";

const PROVIDERS: {
  id: SocialProvider;
  label: string;
  brandColor: string;
  hoverColor: string;
  textColor: string;
}[] = [
  {
    id: "steam",
    label: "Steam",
    brandColor: "bg-[#171a21]",
    hoverColor: "hover:bg-[#1b2838]",
    textColor: "text-white",
  },
  {
    id: "discord",
    label: "Discord",
    brandColor: "bg-[#5865F2]",
    hoverColor: "hover:bg-[#4752C4]",
    textColor: "text-white",
  },
  {
    id: "telegram",
    label: "Telegram",
    brandColor: "bg-[#0088cc]",
    hoverColor: "hover:bg-[#006699]",
    textColor: "text-white",
  },
];

export default function LoginModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { signIn } = useAuth();

  const handleSignIn = (provider: SocialProvider) => {
    signIn(provider);
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900/95 backdrop-blur-md p-6 rounded-xl w-full max-w-md text-white shadow-2xl border border-zinc-700/50 animate-slideIn my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">
            {t("auth.sign_in_title", "Sign in")}
          </h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors p-1"
            aria-label={t("ui.close", "Close")}
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-zinc-400 mb-6">
          {t("auth.choose_provider", "Choose your preferred sign-in method:")}
        </p>

        <div className="space-y-3">
          {PROVIDERS.map((provider) => (
            <button
              key={provider.id}
              onClick={() => handleSignIn(provider.id)}
              className={`w-full ${provider.brandColor} ${provider.hoverColor} ${provider.textColor} border-0 rounded-lg px-6 py-3.5 font-semibold transition-all duration-200 flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-xl`}
              style={{
                fontFamily: provider.id === "discord" ? "Whitney, 'Helvetica Neue', Helvetica, Arial, sans-serif" : undefined,
              }}
            >
              <span className="text-lg font-bold">
                {t(`auth.sign_in_with_${provider.id}`, `Sign in with ${provider.label}`)}
              </span>
            </button>
          ))}
        </div>

        <button
          className="mt-4 w-full text-sm text-zinc-400 hover:text-white transition-colors duration-200 py-2"
          onClick={onClose}
        >
          {t("common.cancel", "Cancel")}
        </button>
      </div>
    </div>
  );
}

