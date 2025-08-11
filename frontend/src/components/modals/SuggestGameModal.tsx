import { useState } from "react";
import { supabase } from "../../supabaseClient";
import { analytics } from "../../utils/analytics";
import { useTranslation } from "react-i18next";

const SuggestGameModal = ({ onClose }: { onClose: () => void }) => {
  const { t } = useTranslation();
  const [game, setGame] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const value = game.trim();
    if (!value || saving) return;
    setSaving(true);
    try {
      await supabase.from("suggested_games").insert({ game: value });
      analytics.suggestGame(value);
      setSubmitted(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-zinc-900 p-6 rounded-lg w-full max-w-sm text-white">
        <h2 className="text-lg font-bold mb-2">
          {t("suggest_game.title", "Предложить игру")}
        </h2>

        {submitted ? (
          <div className="text-green-400 text-sm">
            {t("suggest_game.thanks", "Спасибо! Мы учтём твоё предложение.")}
          </div>
        ) : (
          <>
            <input
              className="w-full p-2 bg-zinc-800 rounded-md text-sm text-white mb-4"
              placeholder={t(
                "suggest_game.placeholder",
                "Введи название игры"
              )}
              value={game}
              onChange={(e) => setGame(e.target.value)}
            />
            <button
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white px-4 py-2 rounded-md text-sm transition"
              onClick={submit}
              disabled={!game.trim() || saving}
            >
              {saving
                ? t("common.saving", "Сохранение…")
                : t("suggest_game.submit", "Отправить")}
            </button>
          </>
        )}

        <button
          className="mt-4 text-sm text-zinc-400 hover:text-white"
          onClick={onClose}
        >
          {t("common.close", "Закрыть")}
        </button>
      </div>
    </div>
  );
};

export default SuggestGameModal;