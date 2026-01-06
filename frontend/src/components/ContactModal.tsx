// components/ContactModal.tsx
import { useEffect, useRef } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { analytics } from "../utils/analytics";
import { sendJoinParty } from "../ws/client";
import type { ContactMethod } from "../types";
import { StarIcon } from "@heroicons/react/20/solid";

const CONTACT_LABELS: Record<string, { key: string; defaultValue: string }> = {
  steam: { key: "contact.methods.steam", defaultValue: "Steam" },
  discord: { key: "contact.methods.discord", defaultValue: "Discord" },
  telegram: { key: "contact.methods.telegram", defaultValue: "Telegram" },
};

export default function ContactModal({
  contacts,
  onClose,
  partyId,
}: {
  contacts: ContactMethod[];
  partyId: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  // Флаг для отслеживания, было ли уже отправлено join для этого объявления
  const joinSentRef = useRef(false);
  const modalOpenTime = useRef(Date.now());
  const actionTaken = useRef(false);
  const game = useRef<string | null>(null);

  useEffect(() => {
    // Получаем game из sessionStorage (сохраняется при открытии модалки)
    const storedGame = sessionStorage.getItem(`contact_modal_game_${partyId}`);
    game.current = storedGame;

    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose, partyId]);

  // Сбрасываем флаг при закрытии модального окна
  useEffect(() => {
    return () => {
      joinSentRef.current = false;
      // Трекинг закрытия модалки
      const timeOpen = Date.now() - modalOpenTime.current;
      const gameName = game.current || "unknown";
      if (!actionTaken.current) {
        analytics.contactModalClosedWithoutAction(gameName, partyId, timeOpen);
        analytics.contactModalClosed(gameName, partyId, "none");
      }
    };
  }, []);

  const handleCopy = async (value: string) => {
    actionTaken.current = true;
    analytics.contactCopy();
    const gameName = game.current || "unknown";
    analytics.contactModalClosed(gameName, partyId, "copy");

    // Отправляем join только один раз при первом реальном действии
    if (!joinSentRef.current) {
      sendJoinParty(partyId);
      joinSentRef.current = true;
    }
    try {
      await navigator.clipboard.writeText(value);
      toast.success(t("ui.copied"), { duration: 5000 });
      onClose();
    } catch {
      toast.error(t("toasts.error"), { duration: 5000 });
    }
  };

  const handleOpen = (url: string) => {
    actionTaken.current = true;
    analytics.contactCopy();
    const gameName = game.current || "unknown";
    analytics.contactModalClosed(gameName, partyId, "copy");

    // Отправляем join только один раз при первом реальном действии
    if (!joinSentRef.current) {
      sendJoinParty(partyId);
      joinSentRef.current = true;
    }
    
    // Проверяем, что URL валидный
    if (!url || (!url.startsWith("http://") && !url.startsWith("https://"))) {
      console.error("[ContactModal] Invalid URL:", url);
      toast.error(t("contact.invalid_url", "Invalid URL"));
      return;
    }
    
    console.log("[ContactModal] Opening URL:", url);
    window.open(url, "_blank", "noopener");
    toast.success(t("contact.opened"), { duration: 4000 });
    onClose();
  };

  const handleClose = () => {
    const gameName = game.current || "unknown";
    if (!actionTaken.current) {
      analytics.contactModalClosed(gameName, partyId, "close");
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn" onClick={handleClose}>
      <div
        className="bg-zinc-900/95 backdrop-blur-md p-6 rounded-xl w-full max-w-md text-white space-y-4 shadow-2xl border border-zinc-700/50 animate-slideIn"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <span className="text-blue-500">📞</span>
          {t("contact.title")}
        </h2>
        {contacts.length === 0 ? (
          <p className="text-sm text-zinc-300 text-center py-4">
            {t("contact.no_methods")}
          </p>
        ) : (
          <div className="space-y-3">
            {contacts.map((contact) => {
              // Логирование для отладки
              if (process.env.NODE_ENV === "development") {
                console.log("[ContactModal] Contact:", {
                  type: contact.type,
                  handle: contact.handle,
                  url: contact.url,
                  hasUrl: !!contact.url,
                });
              }
              return (
              <div
                key={`${contact.type}-${contact.handle}`}
                className="rounded-lg border border-zinc-700/50 bg-zinc-800/50 backdrop-blur-sm p-4 hover:border-zinc-600 hover:bg-zinc-800/70 transition-all duration-200"
              >
                <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-zinc-300">
                  <span className="font-semibold text-white">
                    {
                      CONTACT_LABELS[contact.type]
                        ? t(
                          CONTACT_LABELS[contact.type].key,
                          CONTACT_LABELS[contact.type].defaultValue
                        )
                        : contact.type
                    }
                  </span>
                  <span className="break-all text-zinc-200">{contact.handle}</span>
                  {contact.preferred && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase text-blue-200 border border-blue-500/30">
                      <StarIcon className="h-3 w-3" />
                      {t("party.preferred")}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {contact.url && (
                    <button
                      onClick={() => handleOpen(contact.url as string)}
                      className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-sm rounded-lg font-medium transition-all duration-200 shadow-md hover:shadow-blue-500/50 active:scale-95"
                    >
                      {t("contact.open")}
                    </button>
                  )}
                  <button
                    onClick={() => handleCopy(contact.handle)}
                    className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-sm rounded-lg font-medium transition-all duration-200 active:scale-95"
                  >
                    {t("ui.copy_contact")}
                  </button>
                </div>
              </div>
            );
            })}
          </div>
        )}
        <div className="flex justify-end pt-2">
          <button
            onClick={handleClose}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-sm rounded-lg font-medium transition-all duration-200 active:scale-95"
          >
            {t("ui.close")}
          </button>
        </div>
      </div>
    </div>
  );
}