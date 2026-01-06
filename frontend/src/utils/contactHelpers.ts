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
          url: `https://discord.com/channels/@me/${trimmed}`,
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

/**
 * Преобразует Discord URL из старого формата (users) в новый (channels/@me)
 * или извлекает Discord ID из handle и генерирует правильный URL
 */
export function normalizeDiscordUrl(
  contact: { type: string; url?: string; handle: string },
  providerId?: string
): string | undefined {
  // Если это не Discord, возвращаем URL как есть
  if (contact.type !== "discord") {
    return contact.url;
  }

  // Приоритет 1: Используем providerId, если передан
  if (providerId) {
    return `https://discord.com/channels/@me/${providerId}`;
  }

  // Приоритет 2: Преобразуем старый формат URL
  if (contact.url) {
    // Старый формат: https://discord.com/users/{id}
    const oldFormatMatch = contact.url.match(/discord\.com\/users\/(\d{17,19})/i);
    if (oldFormatMatch) {
      const discordId = oldFormatMatch[1];
      return `https://discord.com/channels/@me/${discordId}`;
    }

    // Уже правильный формат: https://discord.com/channels/@me/{id}
    if (contact.url.includes("discord.com/channels/@me/")) {
      return contact.url;
    }
  }

  // Приоритет 3: Извлекаем Discord ID из handle (если это числовой ID)
  if (/^\d{17,19}$/.test(contact.handle)) {
    return `https://discord.com/channels/@me/${contact.handle}`;
  }

  // Если ничего не подошло, возвращаем исходный URL
  return contact.url;
}
