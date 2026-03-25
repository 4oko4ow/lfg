export type TelegramAuthData = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
};

export function openTelegramAuth(botId: string): Promise<TelegramAuthData> {
  return new Promise((resolve, reject) => {
    const trimmedBotId = botId?.trim();
    if (!trimmedBotId) {
      reject(new Error("Telegram bot ID is not configured"));
      return;
    }

    const origin = window.location.origin;
    const url = `https://oauth.telegram.org/auth?bot_id=${encodeURIComponent(
      trimmedBotId
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

    let resolved = false;
    let rejected = false;
    let closeTimeout: number | null = null;

    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      clearInterval(intervalId);
      if (closeTimeout !== null) {
        clearTimeout(closeTimeout);
        closeTimeout = null;
      }
      try { popup.close(); } catch { /* ignore */ }
    };

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== "https://oauth.telegram.org") return;
      const data = event.data as { event?: string; data?: TelegramAuthData };

      if (data?.event === "auth_user" && data.data) {
        if (!resolved && !rejected) {
          resolved = true;
          cleanup();
          resolve(data.data);
        }
        return;
      }

      if (data?.event === "auth_cancel") {
        if (!resolved && !rejected) {
          rejected = true;
          cleanup();
          reject(new Error("Telegram authentication cancelled"));
        }
      }
    };

    window.addEventListener("message", onMessage);

    // Poll for popup close - give 1 second after close for message to arrive
    const intervalId = window.setInterval(() => {
      if (popup.closed && !resolved && !rejected && closeTimeout === null) {
        closeTimeout = window.setTimeout(() => {
          if (!resolved && !rejected) {
            rejected = true;
            cleanup();
            reject(new Error("Telegram popup closed"));
          }
        }, 1000) as unknown as number;
      }
    }, 200);
  });
}
