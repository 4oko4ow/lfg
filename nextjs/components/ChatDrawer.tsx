'use client';

import { useEffect } from "react";
import Chat from "@/components/Chat";

export default function ChatDrawer({ onClose }: { onClose: () => void }) {
    useEffect(() => {
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = "";
        };
    }, []);

    return (
        <div className="fixed inset-0 bg-zinc-950 text-white z-[100] flex flex-col w-full h-screen max-h-screen">
            <Chat isMobile onClose={onClose} />
        </div>
    );
}
