'use client';

import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { createPortal } from "react-dom";
import { XMarkIcon } from "@heroicons/react/24/solid";
import CreatePartyForm from "@/components/CreatePartyForm";
import type { Party } from "@/lib/types";
import { analytics } from "@/lib/utils/analytics";

export default function CreatePartyModal({
  onClose,
  parties = []
}: {
  onClose: () => void;
  parties?: Party[];
}) {
  const { t } = useTranslation();

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    analytics.createPartyModalOpen();
  }, []);

  const modalContent = (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[9999] animate-fadeIn p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900/95 backdrop-blur-md p-6 rounded-xl w-full max-w-2xl text-white shadow-2xl border border-zinc-700/50 animate-slideIn my-auto max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold bg-gradient-to-r from-white to-zinc-200 bg-clip-text text-transparent">
            {t("form.title")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors p-1"
            aria-label={t("ui.close")}
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="max-h-[calc(90vh-100px)] overflow-y-auto">
          <CreatePartyForm
            parties={parties}
            onSuccess={onClose}
          />
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined"
    ? createPortal(modalContent, document.body)
    : null;
}
