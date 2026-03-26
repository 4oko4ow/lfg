import { useEffect, useRef, useState } from "react";

type Props = {
  botUsername: string;
  authUrl: string;
};

export default function TelegramLoginButton({ botUsername, authUrl }: Props) {
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
    // Small delay after load to let the iframe render inside the container
    script.onload = () => setTimeout(() => setLoaded(true), 200);

    container.appendChild(script);

    return () => {
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
    };
  }, [botUsername, authUrl]);

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
