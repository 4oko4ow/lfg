'use client';

import { useState } from "react";
import { analytics } from "@/lib/utils/analytics";
import { useTranslation } from "react-i18next";

const buildBackendUrl = (path: string): string => {
  const rawBackendBaseUrl = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "").trim();
  const backendBaseUrl = rawBackendBaseUrl.endsWith("/")
    ? rawBackendBaseUrl.slice(0, -1)
    : rawBackendBaseUrl;
  if (!path.startsWith("/")) {
    throw new Error(`Backend paths must start with '/': ${path}`);
  }
  if (!backendBaseUrl) {
    return path;
  }
  return `${backendBaseUrl}${path}`;
};

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
      const response = await fetch(buildBackendUrl("/api/games/suggest"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ game: value }),
      });

      if (!response.ok) {
        throw new Error("Failed to suggest game");
      }

      analytics.suggestGame(value);
      setSubmitted(true);
    } catch (error) {
      console.error("Error suggesting game:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[9999] animate-fadeIn" onClick={onClose}>
      <div
        className="bg-zinc-900/95 backdrop-blur-md p-6 rounded-xl w-full max-w-sm text-white shadow-2xl border border-zinc-700/50 animate-slideIn"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <span className="text-pink-500">✨</span>
          {t("suggest_game.title")}
        </h2>

        {submitted ? (
          <div className="text-center py-4">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-500/20 mb-3">
              <span className="text-2xl">✓</span>
            </div>
            <p className="text-green-400 text-sm font-medium">
              {t("suggest_game.thanks")}
            </p>
          </div>
        ) : (
          <>
            <input
              className="w-full p-3 bg-zinc-800/50 border border-zinc-700 rounded-lg text-sm text-white mb-4 transition-colors hover:border-zinc-600"
              placeholder={t("suggest_game.placeholder")}
              value={game}
              onChange={(e) => setGame(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
            <button
              className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 disabled:from-zinc-700 disabled:to-zinc-700 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 shadow-lg hover:shadow-blue-500/50 active:scale-95 disabled:opacity-50"
              onClick={submit}
              disabled={!game.trim() || saving}
            >
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  {t("common.saving")}
                </span>
              ) : (
                t("suggest_game.submit")
              )}
            </button>
          </>
        )}

        <button
          className="mt-4 w-full text-sm text-zinc-400 hover:text-white transition-colors duration-200 py-2"
          onClick={onClose}
        >
          {t("common.close")}
        </button>
      </div>
    </div>
  );
};

export default SuggestGameModal;
