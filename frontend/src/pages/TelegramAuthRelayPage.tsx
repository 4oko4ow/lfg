import { useEffect } from "react";

// This page is opened as a popup by Telegram's return_to redirect.
// It relays the auth data to the opener window via postMessage, then closes itself.
export default function TelegramAuthRelayPage() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    const hash = params.get("hash");
    const auth_date = params.get("auth_date");
    const first_name = params.get("first_name") ?? "";
    const last_name = params.get("last_name") ?? undefined;
    const username = params.get("username") ?? undefined;
    const photo_url = params.get("photo_url") ?? undefined;

    if (id && hash && auth_date && window.opener) {
      const data = {
        id: Number(id),
        first_name,
        last_name,
        username,
        photo_url,
        auth_date: Number(auth_date),
        hash,
      };
      window.opener.postMessage(
        { event: "auth_user", data },
        window.location.origin
      );
    } else if (window.opener) {
      window.opener.postMessage(
        { event: "auth_cancel" },
        window.location.origin
      );
    }

    window.close();
  }, []);

  return null;
}
