import { useEffect, useRef } from "react";

type Props = {
  botUsername: string;
  authUrl: string;
};

export default function TelegramLoginButton({ botUsername, authUrl }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = ref.current;
    if (!container || !botUsername) return;

    // Remove any previously appended script
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
    container.appendChild(script);

    return () => {
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
    };
  }, [botUsername, authUrl]);

  return <div ref={ref} className="flex justify-center" />;
}
