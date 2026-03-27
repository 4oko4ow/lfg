import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SLUG_TO_FALLBACK_NAME } from "@/lib/constants/games";
import { getGameSeo } from "@/lib/seo";
import { GameFeedClient } from "./GameFeedClient";

// Top 10 games for static generation (Phase 1)
const TOP_GAME_SLUGS = [
  "repo", "dota2", "cs2", "rust", "fortnite",
  "minecraft", "valorant", "apex", "tarkov", "peak"
] as const;

// Pre-render these pages at build time
export function generateStaticParams() {
  return TOP_GAME_SLUGS.map((slug) => ({ slug }));
}

// SEO metadata for each game
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const seo = getGameSeo(slug);
  return {
    title: seo.title,
    description: seo.description,
    openGraph: {
      title: seo.title,
      description: seo.description,
      siteName: "FindParty",
      locale: "ru_RU",
      type: "website",
      images: [{ url: "/og-image.png", width: 1200, height: 630 }],
    },
    alternates: {
      canonical: `https://findparty.online/game/${slug}`,
    },
  };
}

export default async function GamePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // 404 for unknown slugs
  const validSlugs = Object.keys(SLUG_TO_FALLBACK_NAME);
  if (!validSlugs.includes(slug)) {
    notFound();
  }

  const gameName = SLUG_TO_FALLBACK_NAME[slug as keyof typeof SLUG_TO_FALLBACK_NAME];

  return <GameFeedClient slug={slug} gameName={gameName} />;
}
