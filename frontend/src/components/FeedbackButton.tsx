import { ExclamationCircleIcon } from "@heroicons/react/24/outline";
import { analytics } from "../utils/analytics";

export default function FeedbackButton() {
    const handleClick = () => {
        analytics.feedbackClick();
    };

    return (
        <a
            href="https://t.me/chocochow"
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleClick}
            className="fixed bottom-4 right-4 flex items-center gap-2 bg-zinc-800 text-white px-4 py-2 rounded-lg text-sm shadow hover:bg-zinc-700 transition z-50"
        >
            <ExclamationCircleIcon className="w-5 h-5" />
            Что-то не работает?
        </a>
    );
}