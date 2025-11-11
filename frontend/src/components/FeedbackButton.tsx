import { ExclamationCircleIcon } from "@heroicons/react/24/outline";
import { useTranslation } from "react-i18next";
import { analytics } from "../utils/analytics";

export default function FeedbackButton() {
  const { t } = useTranslation();

  const handleClick = () => {
    analytics.feedbackClick();
  };

  return (
    <a
      href="https://t.me/chocochow"
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className="fixed bottom-20 right-4 sm:right-6 flex items-center gap-2 bg-zinc-800/90 backdrop-blur-sm text-white px-3 py-2 sm:px-4 rounded-lg text-xs sm:text-sm shadow-lg hover:bg-zinc-700 hover:shadow-xl transition-all duration-200 hover:scale-105 active:scale-95 z-50 animate-fadeIn"
    >
      <ExclamationCircleIcon className="w-4 h-4 sm:w-5 sm:h-5" />
      <span className="hidden sm:inline">{t("feedback.label")}</span>
      <span className="sm:hidden">{t("feedback.label_short", "Feedback")}</span>
    </a>
  );
}