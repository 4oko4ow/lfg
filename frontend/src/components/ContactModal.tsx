// components/ContactModal.tsx
import { useEffect } from "react";
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

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);

  const handleCopy = async (value: string) => {
    analytics.contactCopy();
    try {
      await navigator.clipboard.writeText(value);
      sendJoinParty(partyId);
      toast.success(t("ui.copied"), { duration: 5000 });
      onClose();
    } catch {
      toast.error(t("toasts.error"), { duration: 5000 });
    }
  };

  const handleOpen = (url: string) => {
    analytics.contactCopy();
    window.open(url, "_blank", "noopener");
    sendJoinParty(partyId);
    toast.success(t("contact.opened", "Открываем контакт"), { duration: 4000 });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-zinc-900 p-6 rounded-xl w-full max-w-md text-white space-y-4 shadow-xl">
        <h2 className="text-lg font-semibold">{t("contact.title")}</h2>
        {contacts.length === 0 ? (
          <p className="text-sm text-zinc-300">
            {t("contact.no_methods", "Контакты не указаны")}
          </p>
        ) : (
          <div className="space-y-3">
            {contacts.map((contact) => (
              <div
                key={`${contact.type}-${contact.handle}`}
                className="rounded-lg border border-zinc-700 bg-zinc-800/70 p-4"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2 text-sm text-zinc-300">
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
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase text-blue-200">
                      <StarIcon className="h-3 w-3" />
                      {t("party.preferred", "Основной")}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {contact.url && (
                    <button
                      onClick={() => handleOpen(contact.url as string)}
                      className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-sm rounded"
                    >
                      {t("contact.open", "Открыть")}
                    </button>
                  )}
                  <button
                    onClick={() => handleCopy(contact.handle)}
                    className="px-4 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-sm rounded"
                  >
                    {t("ui.copy_contact")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-sm rounded"
          >
            {t("ui.close")}
          </button>
        </div>
      </div>
    </div>
  );
}