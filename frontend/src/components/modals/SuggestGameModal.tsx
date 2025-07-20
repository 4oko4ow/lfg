import { useState } from "react";
import { supabase } from "../../supabaseClient";
import { analytics } from "../../utils/analytics";


const SuggestGameModal = ({ onClose }: { onClose: () => void }) => {
  const [game, setGame] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const submit = async () => {
    if (!game.trim()) return;

    await supabase.from("suggested_games").insert({ game });
    analytics.suggestGame(game);
    setSubmitted(true);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-zinc-900 p-6 rounded-lg w-full max-w-sm">
        <h2 className="text-lg font-bold mb-2">Предложить игру</h2>
        {submitted ? (
          <div className="text-green-400 text-sm">Спасибо! Мы учтём твоё предложение.</div>
        ) : (
          <>
            <input
              className="w-full p-2 bg-zinc-800 rounded-md text-sm text-white mb-4"
              placeholder="Введи название игры"
              value={game}
              onChange={(e) => setGame(e.target.value)}
            />
            <button
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-md text-sm"
              onClick={submit}
            >
              Отправить
            </button>
          </>
        )}
        <button className="mt-4 text-sm text-zinc-400 hover:text-white" onClick={onClose}>
          Закрыть
        </button>
      </div>
    </div>
  );
};

export default SuggestGameModal;