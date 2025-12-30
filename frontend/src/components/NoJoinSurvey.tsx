import { useEffect, useMemo, useState, useRef } from "react";
import { analytics } from "../utils/analytics";
import { useTranslation } from "react-i18next";

export function NoJoinSurvey({ visible }: { visible: boolean }) {
    const { t } = useTranslation();
    const [dismissed, setDismissed] = useState(false);
    const surveyShownTime = useRef<number | null>(null);
    const hasResponded = useRef(false);

    // безопасно тянем массив причин из i18n
    const reasons = useMemo(() => {
        const raw = t("survey.reasons", { returnObjects: true }) as unknown;
        if (Array.isArray(raw)) return raw as string[];
        // fallback на случай кривых ресурсов
        return [
            t("survey.reasons.0"),
            t("survey.reasons.1"),
            t("survey.reasons.2"),
            t("survey.reasons.3"),
            t("survey.reasons.4"),
        ];
    }, [t]);

    useEffect(() => {
        const isDismissed = localStorage.getItem("noJoinDismissed") === "true";
        if (isDismissed) setDismissed(true);
    }, []);

    useEffect(() => {
        if (visible && !dismissed) {
            analytics.noJoinSurveyShown();
            surveyShownTime.current = Date.now();
        }
    }, [visible, dismissed]);

    const handleClick = (reason: string) => {
        hasResponded.current = true;
        analytics.noJoinFeedback(reason);
        const timeShown = surveyShownTime.current ? Date.now() - surveyShownTime.current : 0;
        analytics.noJoinSurveyClosed(timeShown, true);
        localStorage.setItem("noJoinDismissed", "true");
        setDismissed(true);
    };

    const handleClose = () => {
        const timeShown = surveyShownTime.current ? Date.now() - surveyShownTime.current : 0;
        if (!hasResponded.current) {
            analytics.noJoinSurveyClosed(timeShown, false);
            analytics.noJoinSurveyDismissed(timeShown);
        }
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
                <p className="font-semibold">{t("survey.nojoin_title")}</p>
                <button
                    onClick={handleClose}
                    className="text-zinc-400 hover:text-white transition"
                    title={t("survey.dismiss")}
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