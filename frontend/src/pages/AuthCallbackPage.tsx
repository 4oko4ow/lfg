import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";

const statusToMessageKey: Record<string, { key: string; type: "success" | "error" }> = {
  success: { key: "auth.success", type: "success" },
  discord_error: { key: "auth.error", type: "error" },
  steam_error: { key: "auth.error", type: "error" },
  session_error: { key: "auth.error", type: "error" },
  steam_conflict: { key: "auth.steam_conflict", type: "error" },
  telegram_error: { key: "auth.error", type: "error" },
  telegram_conflict: { key: "auth.telegram_conflict", type: "error" },
};

export default function AuthCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const { t } = useTranslation();

  useEffect(() => {
    const redirect = params.get("redirect") || "/en";
    const status = params.get("status") ?? "";
    const messageMeta = statusToMessageKey[status] ?? {
      key: "auth.error",
      type: "error",
    };

    const finalize = async () => {
      if (messageMeta.type === "success") {
        await refreshProfile();
        toast.success(t(messageMeta.key, "Вы успешно вошли"));
      } else if (status === "steam_conflict") {
        toast.error(
          t(
            messageMeta.key,
            "Этот Steam аккаунт уже привязан к другой учетной записи"
          )
        );
      } else if (status === "telegram_conflict") {
        toast.error(
          t(
            messageMeta.key,
            "Этот Telegram аккаунт уже привязан к другой учетной записи"
          )
        );
      } else {
        toast.error(t(messageMeta.key, "Не удалось авторизоваться"));
      }
      navigate(redirect, { replace: true });
    };

    void finalize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-[50vh] items-center justify-center text-white">
      <span className="text-sm text-zinc-300">
        {t("auth.loading", "Загрузка...")}
      </span>
    </div>
  );
}

