import type { MetadataRoute } from "next";
import { GAME_SLUGS } from "@/lib/constants/games";

const BASE_URL = "https://findparty.online";
const LAST_MODIFIED = new Date("2025-03-20");

export default function sitemap(): MetadataRoute.Sitemap {
  const gamePages = GAME_SLUGS.map((slug) => ({
    url: `${BASE_URL}/game/${slug}`,
    lastModified: LAST_MODIFIED,
    changeFrequency: "daily" as const,
    priority: 0.8,
  }));

  return [
    {
      url: BASE_URL,
      lastModified: LAST_MODIFIED,
      changeFrequency: "daily" as const,
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/feed`,
      lastModified: LAST_MODIFIED,
      changeFrequency: "always" as const,
      priority: 0.9,
    },
    ...gamePages,
  ];
}
