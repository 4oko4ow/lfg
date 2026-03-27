'use client';

import { useEffect, useRef, useState } from "react";

type Props = {
  botUsername: string;
  authUrl: string;
  /** When true, renders children as the visible button and overlays the invisible widget on top */
  masked?: boolean;
  children?: React.ReactNode;
};

export default function TelegramLoginButton({ botUsername, authUrl, masked, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const container = ref.current;
    if (!container || !botUsername) return;

    setLoaded(false);
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", botUsername);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-auth-url", authUrl);
    script.setAttribute("data-request-access", "write");
    script.setAttribute("data-userpic", "false");
    script.onload = () => setTimeout(() => setLoaded(true), 200);

    container.appendChild(script);

    return () => {
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
    };
  }, [botUsername, authUrl]);

  if (masked) {
    return (
      <div className="relative inline-block">
        {/* Visible custom button — not interactive, just decorative */}
        <div className="pointer-events-none">{children}</div>
        {/* Invisible widget iframe stretched over the button — captures the click */}
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ opacity: 0.001 }}
        >
          <div
            ref={ref}
            className="scale-150 origin-top-left"
            style={{ width: "200%", height: "200%" }}
          />
        </div>
        {!loaded && (
          <div className="absolute inset-0 cursor-wait" />
        )}
      </div>
    );
  }

  return (
    <div className="relative flex justify-center" style={{ minHeight: 42 }}>
      {!loaded && (
        <div className="absolute inset-0 flex justify-center items-center">
          <div className="h-[42px] w-[220px] rounded bg-[#0088cc]/60 animate-pulse" />
        </div>
      )}
      <div
        ref={ref}
        className={`flex justify-center transition-opacity duration-200 ${loaded ? "opacity-100" : "opacity-0"}`}
      />
    </div>
  );
}
