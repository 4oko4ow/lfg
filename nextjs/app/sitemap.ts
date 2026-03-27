import type { MetadataRoute } from "next";

const BASE_URL = "https://findparty.online";

const TOP_GAME_SLUGS = [
  "repo", "dota2", "cs2", "rust", "fortnite",
  "minecraft", "valorant", "apex", "tarkov", "peak"
];

export default function sitemap(): MetadataRoute.Sitemap {
  const gamePages = TOP_GAME_SLUGS.map((slug) => ({
    url: `${BASE_URL}/game/${slug}`,
    lastModified: new Date(),
    changeFrequency: "daily" as const,
    priority: 0.8,
  }));

  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/feed`,
      lastModified: new Date(),
      changeFrequency: "always" as const,
      priority: 0.9,
    },
    ...gamePages,
  ];
}
