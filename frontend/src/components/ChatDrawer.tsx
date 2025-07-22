import { useEffect } from "react";
import Chat from "./Chat";

export default function ChatDrawer({ onClose }: { onClose: () => void }) {
    useEffect(() => {
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = "";
        };
    }, []);

    return (
        <div className="fixed inset-0 bg-zinc-950 text-white z-[100] flex flex-col w-full h-screen max-h-screen">
            <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
                <span className="font-bold">Чат</span>
                <button onClick={onClose} className="text-zinc-400">✕</button>
            </div>
            <div className="flex-1 flex flex-col overflow-hidden">
                <Chat isMobile />
            </div>
        </div>
    );
}