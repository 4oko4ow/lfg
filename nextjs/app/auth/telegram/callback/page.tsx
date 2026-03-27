'use client';

import { useEffect } from "react";

const rawBackendBaseUrl = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "").trim();
const backendBaseUrl = rawBackendBaseUrl.endsWith("/")
  ? rawBackendBaseUrl.slice(0, -1)
  : rawBackendBaseUrl;

export default function TelegramCallbackPage() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    const hash = params.get("hash");
    const auth_date = params.get("auth_date");
    const first_name = params.get("first_name") ?? "";

    const redirect = sessionStorage.getItem("telegram_auth_redirect") || "/";
    sessionStorage.removeItem("telegram_auth_redirect");

    const fail = (status: string) => {
      window.location.href = `/auth/callback?status=${status}&provider=telegram&redirect=${encodeURIComponent(redirect)}`;
    };

    if (!id || !hash || !auth_date) {
      fail("telegram_error");
      return;
    }

    const url = backendBaseUrl
      ? `${backendBaseUrl}/auth/telegram/verify`
      : "/auth/telegram/verify";

    fetch(url, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        first_name,
        last_name: params.get("last_name") ?? undefined,
        username: params.get("username") ?? undefined,
        photo_url: params.get("photo_url") ?? undefined,
        auth_date,
        hash,
      }),
    })
      .then((response) => {
        if (response.ok) {
          window.location.href = `/auth/callback?status=success&provider=telegram&redirect=${encodeURIComponent(redirect)}`;
        } else {
          fail(response.status === 409 ? "telegram_conflict" : "telegram_error");
        }
      })
      .catch(() => fail("telegram_error"));
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen bg-zinc-950 text-zinc-300 text-sm">
      Авторизация через Telegram...
    </div>
  );
}
