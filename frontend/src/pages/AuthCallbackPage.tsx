import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { analytics } from "../utils/analytics";

const STATUS_MESSAGES: Record<string, { key: string; type: "success" | "error" }> = {
  success: { key: "auth.success", type: "success" },
  discord_error: { key: "auth.error", type: "error" },
  discord_conflict: { key: "auth.discord_conflict", type: "error" },
  steam_error: { key: "auth.error", type: "error" },
  steam_conflict: { key: "auth.steam_conflict", type: "error" },
  session_error: { key: "auth.error", type: "error" },
  telegram_error: { key: "auth.error", type: "error" },
  telegram_conflict: { key: "auth.telegram_conflict", type: "error" },
};

function parseProvider(status: string, explicit: string | null): string {
  if (explicit) return explicit;
  const match = status.match(/^(discord|steam|telegram)/);
  return match ? match[1] : "unknown";
}

export default function AuthCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const { t } = useTranslation();

  useEffect(() => {
    const rawRedirect = params.get("redirect") || "/";
    const normalized = rawRedirect.replace(/^\/(en|ru)(?=\/|$)/i, "");
    const redirect = normalized === "" ? "/" : normalized;
    const status = params.get("status") ?? "";
    const provider = parseProvider(status, params.get("provider"));
    const meta = STATUS_MESSAGES[status] ?? { key: "auth.error", type: "error" };

    const finalize = async () => {
      if (meta.type === "success") {
        await refreshProfile();
        analytics.loginSuccess(provider);
        toast.success(t(meta.key));
      } else {
        const errorType = status.replace(`${provider}_`, "");
        analytics.loginError(provider, errorType);
        toast.error(t(meta.key));
      }
      navigate(redirect, { replace: true });
    };

    void finalize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-[50vh] items-center justify-center text-white">
      <div className="flex flex-col items-center gap-4">
        <div className="relative h-12 w-12">
          <div className="absolute inset-0 rounded-full border-4 border-zinc-700" />
          <div className="absolute inset-0 rounded-full border-4 border-blue-500 border-t-transparent animate-spin" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-medium text-white">{t("auth.loading")}</p>
          <p className="text-xs text-zinc-500">{t("auth.loading_hint", "Это займёт пару секунд")}</p>
        </div>
      </div>
    </div>
  );
}
