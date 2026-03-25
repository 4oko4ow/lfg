// components/ContactModal.tsx
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { analytics } from "../utils/analytics";
import { sendJoinParty } from "../ws/client";
import type { ContactMethod } from "../types";
import { StarIcon } from "@heroicons/react/20/solid";
import { PhoneIcon, UserIcon } from "@heroicons/react/24/outline";
import { normalizeDiscordUrl, extractSteamID64 } from "../utils/contactHelpers";

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
  const [copiedHandle, setCopiedHandle] = useState<string | null>(null);
  // Флаг для отслеживания, было ли уже отправлено join для этого объявления
  const joinSentRef = useRef(false);
  const actionTaken = useRef(false);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);

  // Сбрасываем флаг при закрытии модального окна
  useEffect(() => {
    return () => {
      joinSentRef.current = false;
      if (!actionTaken.current) {
        analytics.contactModalClosed(false);
      }
    };
  }, []);

  const handleCopy = async (value: string, contactType: string) => {
    actionTaken.current = true;
    analytics.contactCopied("unknown", contactType);
    analytics.contactModalClosed(true);

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

  const handleAddToDiscord = async (contact: ContactMethod) => {
    actionTaken.current = true;
    analytics.contactCopied("unknown", "discord");
    analytics.contactModalClosed(true);

    if (!joinSentRef.current) {
      sendJoinParty(partyId);
      joinSentRef.current = true;
    }

    try {
      await navigator.clipboard.writeText(contact.handle);
      toast.success(t("contact.discord_copied", "Никнейм скопирован — найди в Discord: Добавить друга"), { duration: 5000 });
      onClose();
    } catch {
      toast.error(t("toasts.error"), { duration: 5000 });
    }
  };

  const handleOpen = (url: string, contactType: string) => {
    actionTaken.current = true;
    analytics.contactCopied("unknown", contactType);
    analytics.contactModalClosed(true);

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
    if (!actionTaken.current) {
      analytics.contactModalClosed(false);
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
          <PhoneIcon className="w-5 h-5 text-blue-500" />
          {t("contact.title")}
        </h2>
        {contacts.length === 0 ? (
          <p className="text-sm text-zinc-300 text-center py-4">
            {t("contact.no_methods")}
          </p>
        ) : (
          <div className="space-y-3">
            {contacts.map((contact) => {
              // Нормализуем Discord URL (преобразуем старый формат в новый)
              // Не передаем providerId текущего пользователя - используем данные из контакта
              const normalizedUrl = normalizeDiscordUrl(
                contact,
                undefined
              );

              // Извлекаем SteamID64 для Steam контактов
              // Не передаем providerId текущего пользователя - используем данные из контакта
              const steamID64 = extractSteamID64(
                contact,
                undefined
              );

              // Логирование для отладки
              if (process.env.NODE_ENV === "development") {
                console.log("[ContactModal] Contact:", {
                  type: contact.type,
                  handle: contact.handle,
                  originalUrl: contact.url,
                  normalizedUrl: normalizedUrl,
                  steamID64: steamID64,
                });
              }
              // Показываем метку "основной" только если контактов больше одного
              const showPreferred = contact.preferred && contacts.length > 1;
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
                    {showPreferred && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase text-blue-200 border border-blue-500/30">
                        <StarIcon className="h-3 w-3" />
                        {t("party.preferred")}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {contact.type === "steam" && steamID64 ? (
                      <>
                        <button
                          onClick={() => handleOpen(`https://steamcommunity.com/profiles/${steamID64}`, "steam")}
                          className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-sm rounded-lg font-medium transition-all duration-200 shadow-md active:scale-95 flex items-center gap-2"
                        >
                          <UserIcon className="w-4 h-4" />
                          {t("contact.open_profile_steam")}
                        </button>
                        <button
                          onClick={async () => {
                            await navigator.clipboard.writeText(contact.handle);
                            setCopiedHandle(contact.handle);
                            setTimeout(() => setCopiedHandle(null), 2000);
                          }}
                          className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-sm rounded-lg font-medium transition-all duration-200 active:scale-95"
                        >
                          {copiedHandle === contact.handle ? t("ui.copied", "Скопировано!") : t("ui.copy_contact", "Скопировать")}
                        </button>
                      </>
                    ) : contact.type === "discord" ? (
                      <button
                        onClick={() => handleAddToDiscord(contact)}
                        className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-sm rounded-lg font-medium transition-all duration-200 shadow-md active:scale-95"
                      >
                        {t("contact.add_to_discord")}
                      </button>
                    ) : normalizedUrl ? (
                      <>
                        <button
                          onClick={() => handleOpen(normalizedUrl, contact.type)}
                          className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-sm rounded-lg font-medium transition-all duration-200 shadow-md active:scale-95"
                        >
                          {t("contact.open")}
                        </button>
                        <button
                          onClick={async () => {
                            await navigator.clipboard.writeText(contact.handle);
                            setCopiedHandle(contact.handle);
                            setTimeout(() => setCopiedHandle(null), 2000);
                          }}
                          className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-sm rounded-lg font-medium transition-all duration-200 active:scale-95"
                        >
                          {copiedHandle === contact.handle ? t("ui.copied", "Скопировано!") : t("ui.copy_contact", "Скопировать")}
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleCopy(contact.handle, contact.type)}
                        className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-sm rounded-lg font-medium transition-all duration-200 shadow-md active:scale-95"
                      >
                        {t("ui.copy_contact", "Скопировать")}
                      </button>
                    )}
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