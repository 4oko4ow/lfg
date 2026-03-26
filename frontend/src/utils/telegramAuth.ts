export type TelegramAuthData = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
};

const STORAGE_KEY = "telegram_auth_pending";

export function openTelegramAuth(botId: string): Promise<TelegramAuthData> {
  return new Promise((resolve, reject) => {
    const trimmedBotId = botId?.trim();
    if (!trimmedBotId) {
      reject(new Error("Telegram bot ID is not configured"));
      return;
    }

    // Clear any stale auth data from previous attempts
    localStorage.removeItem(STORAGE_KEY);

    const origin = window.location.origin;
    const returnTo = `${origin}/telegram-auth-relay`;
    const url = `https://oauth.telegram.org/auth?bot_id=${encodeURIComponent(
      trimmedBotId
    )}&origin=${encodeURIComponent(origin)}&embed=1&return_to=${encodeURIComponent(returnTo)}&request_access=write`;

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
      window.removeEventListener("storage", onStorage);
      clearInterval(intervalId);
      if (closeTimeout !== null) {
        clearTimeout(closeTimeout);
        closeTimeout = null;
      }
      localStorage.removeItem(STORAGE_KEY);
      try { popup.close(); } catch { /* ignore */ }
    };

    const handleAuthData = (data: TelegramAuthData) => {
      if (!resolved && !rejected) {
        resolved = true;
        cleanup();
        resolve(data);
      }
    };

    // Primary channel: localStorage storage event (fired when popup writes to localStorage)
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      console.log("[Telegram Auth] Got auth data via storage event");
      try {
        const data = JSON.parse(e.newValue) as TelegramAuthData;
        handleAuthData(data);
      } catch {
        console.error("[Telegram Auth] Failed to parse storage data");
      }
    };
    window.addEventListener("storage", onStorage);

    // Polling interval: checks localStorage (fallback if storage event missed)
    // and detects popup close
    const intervalId = window.setInterval(() => {
      // Fallback: check localStorage directly
      const pending = localStorage.getItem(STORAGE_KEY);
      if (pending && !resolved && !rejected) {
        console.log("[Telegram Auth] Got auth data via localStorage poll");
        try {
          const data = JSON.parse(pending) as TelegramAuthData;
          handleAuthData(data);
          return;
        } catch { /* ignore */ }
      }

      // Detect popup close without receiving auth data
      if (popup.closed && !resolved && !rejected && closeTimeout === null) {
        console.log("[Telegram Auth] Popup closed, waiting up to 3s for data...");
        closeTimeout = window.setTimeout(() => {
          if (!resolved && !rejected) {
            console.log("[Telegram Auth] No auth data received after popup closed");
            rejected = true;
            cleanup();
            reject(new Error("Telegram popup closed without authentication data"));
          }
        }, 3000) as unknown as number;
      }
    }, 200);
  });
}
