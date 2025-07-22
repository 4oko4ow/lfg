import { useEffect, useState } from "react";
import { analytics } from "../utils/analytics";

const reasons = [
    "Не нашёл подходящую игру",
    "Боюсь писать незнакомым",
    "Слишком мало пати",
    "Не понял, что дальше делать",
    "Просто смотрю / тестирую",
];

export function NoJoinSurvey({ visible }: { visible: boolean }) {
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        const isDismissed = localStorage.getItem("noJoinDismissed") === "true";
        if (isDismissed) setDismissed(true);
    }, []);

    useEffect(() => {
        if (visible && !dismissed) {
            analytics.noJoinSurveyShown();
        }
    }, [visible, dismissed]);

    const handleClick = (reason: string) => {
        analytics.noJoinFeedback(reason);
        localStorage.setItem("noJoinDismissed", "true");
        setDismissed(true);
    };

    const handleClose = () => {
        localStorage.setItem("noJoinDismissed", "true");
        setDismissed(true);
    };

    if (!visible || dismissed) return null;

    const isMobile = window.innerWidth < 768;

    return (
        <div
            className={`fixed bottom-4 ${isMobile ? "left-1/2 -translate-x-1/2" : "left-4"
                } z-50 w-[90vw] max-w-[300px] bg-zinc-900 border border-zinc-700 p-4 rounded-xl shadow-xl text-sm text-white`}
        >
            <div className="flex justify-between items-start mb-3">
                <p className="font-semibold">Почему ты не вступил в пати?</p>
                <button
                    onClick={handleClose}
                    className="text-zinc-400 hover:text-white transition"
                    title="Больше не показывать"
                >
                    ✕
                </button>
            </div>
            <ul className="space-y-2">
                {reasons.map((reason) => (
                    <li key={reason}>
                        <button
                            className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white transition-all px-3 py-1.5 rounded-lg text-left"
                            onClick={() => handleClick(reason)}
                        >
                            {reason}
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
}