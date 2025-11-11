export type TelegramAuthData = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: string;
  hash: string;
};

export function openTelegramAuth(botId: string): Promise<TelegramAuthData> {
  return new Promise((resolve, reject) => {
    if (!botId) {
      reject(new Error("Telegram bot ID is not configured"));
      return;
    }

    const origin = window.location.origin;
    const url = `https://oauth.telegram.org/auth?bot_id=${encodeURIComponent(
      botId
    )}&origin=${encodeURIComponent(origin)}&embed=1&request_access=write`;

    const width = 500;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      url,
      "telegram_oauth",
      `width=${width},height=${height},left=${left},top=${top},resizable=no,scrollbars=yes,status=no`
    );

    if (!popup) {
      reject(new Error("Telegram popup blocked"));
      return;
    }

    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      clearInterval(intervalId);
      try {
        popup.close();
      } catch {
        // ignore
      }
    };

    const intervalId = window.setInterval(() => {
      if (popup.closed) {
        cleanup();
        reject(new Error("Telegram popup closed"));
      }
    }, 500);

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== "https://oauth.telegram.org") {
        return;
      }
      const data = event.data as { event?: string; data?: TelegramAuthData };
      if (data?.event === "auth_user" && data.data) {
        cleanup();
        resolve(data.data);
      }
    };

    window.addEventListener("message", onMessage);
  });
}

