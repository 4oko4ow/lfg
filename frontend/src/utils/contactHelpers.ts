import type {
  ContactHandle,
  ContactMethod,
  ContactMethodType,
} from "../types";

const isUrl = (value: string) => /^https?:\/\//i.test(value);

export function normalizeContactHandle(
  provider: ContactMethodType,
  value: string
): ContactHandle | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (isUrl(trimmed)) {
    return { handle: trimmed, url: trimmed };
  }

  switch (provider) {
    case "telegram": {
      const username = trimmed.replace(/^@/, "");
      if (!username) return null;
      return {
        handle: trimmed.startsWith("@") ? trimmed : `@${username}`,
        url: `https://t.me/${username}`,
      };
    }
    case "steam": {
      if (/^\d{5,}$/.test(trimmed)) {
        return {
          handle: trimmed,
          url: `https://steamcommunity.com/profiles/${trimmed}`,
        };
      }
      const clean = trimmed.replace(/^@/, "");
      return {
        handle: trimmed,
        url: `https://steamcommunity.com/id/${clean}`,
      };
    }
    case "discord": {
      // Если это Discord ID (только цифры, обычно 17-19 цифр)
      if (/^\d{17,19}$/.test(trimmed)) {
        return {
          handle: trimmed,
          url: `https://discord.com/users/${trimmed}`,
        };
      }
      // Если это username с @, просто возвращаем handle без URL
      // (Discord не позволяет открыть профиль по username без ID)
      if (/^@/.test(trimmed)) {
        return {
          handle: trimmed,
        };
      }
      return { handle: trimmed };
    }
    default:
      return { handle: trimmed };
  }
}

export function contactHandleToMethod(
  provider: ContactMethodType,
  handle: ContactHandle | null | undefined,
  preferred: boolean
): ContactMethod | null {
  if (!handle) return null;
  return {
    type: provider,
    handle: handle.handle,
    url: handle.url,
    preferred,
  };
}

export function contactHandleToInput(handle: ContactHandle | null | undefined) {
  return handle?.handle ?? "";
}
