'use client';

import { useEffect, useId } from "react";
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
  const titleId = useId();

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
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 bg-black/75 backdrop-blur-sm z-[9999] flex items-start justify-center p-4 pt-[8vh] overflow-y-auto animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-zinc-950 border border-zinc-800 rounded-xl w-full max-w-lg text-white shadow-2xl shadow-black/60 mb-8 animate-slideIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800/60">
          <h2 id={titleId} className="text-sm font-semibold text-white">
            {t("form.title")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-500 hover:text-white p-1 rounded-md hover:bg-zinc-800"
            aria-label={t("ui.close")}
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5">
          <CreatePartyForm parties={parties} onSuccess={onClose} />
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined"
    ? createPortal(modalContent, document.body)
    : null;
}
