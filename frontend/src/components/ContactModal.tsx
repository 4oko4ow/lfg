// components/ContactModal.tsx
import { useEffect } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { analytics } from "../utils/analytics";
import { sendJoinParty } from "../ws/client";

export default function ContactModal({
  contact,
  onClose,
  partyId,
}: {
  contact: string;
  partyId: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);

  const handleCopy = async () => {
    analytics.contactCopy();
    try {
      await navigator.clipboard.writeText(contact);
      sendJoinParty(partyId);
      toast.success(t("contact.copySuccess"), { duration: 5000 });
      onClose();
    } catch {
      toast.error(t("contact.copyError"), { duration: 5000 });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-zinc-900 p-6 rounded-xl w-full max-w-sm text-white space-y-4 shadow-xl">
        <h2 className="text-lg font-semibold">{t("contact.title")}</h2>
        <p className="break-all text-zinc-300">{contact}</p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={handleCopy}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-sm rounded"
          >
            {t("contact.copy")}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-sm rounded"
          >
            {t("contact.close")}
          </button>
        </div>
      </div>
    </div>
  );
}