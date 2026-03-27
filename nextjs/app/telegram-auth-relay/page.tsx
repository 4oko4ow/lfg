'use client';

import { useEffect } from "react";

// This page handles Telegram's return_to redirect after successful auth.
// It stores auth data in localStorage so the opener window can pick it up
// via the 'storage' event (more reliable than postMessage across popups).
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

    if (id && hash && auth_date) {
      const data = {
        id: Number(id),
        first_name,
        last_name,
        username,
        photo_url,
        auth_date: Number(auth_date),
        hash,
      };
      localStorage.setItem("telegram_auth_pending", JSON.stringify(data));
    }

    // Close popup; if browser blocks close, redirect to home
    window.close();
    setTimeout(() => {
      if (!window.closed) {
        window.location.href = "/";
      }
    }, 500);
  }, []);

  return null;
}
