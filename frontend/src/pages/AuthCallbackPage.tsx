import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { supabase } from "../supabaseClient";
import { useAuth } from "../context/AuthContext";

export default function AuthCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const { t } = useTranslation();

  useEffect(() => {
    const exchange = async () => {
      const redirect = params.get("redirect") || "/en";
      const url = window.location.href;
      const { error } = await supabase.auth.exchangeCodeForSession(url);
      if (error) {
        console.error(error);
        toast.error(t("auth.error", "Не удалось авторизоваться"));
        navigate(redirect, { replace: true });
        return;
      }
      await refreshUser();
      toast.success(t("auth.success", "Вы успешно вошли"));
      navigate(redirect, { replace: true });
    };

    void exchange();
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
