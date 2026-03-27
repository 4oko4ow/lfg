import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SLUG_TO_FALLBACK_NAME, GAME_SLUGS } from "@/lib/constants/games";
import { getGameSeo } from "@/lib/seo";
import { GameFeedClient } from "./GameFeedClient";
import { GamePageContent } from "@/components/GamePageContent";

// Pre-render all game pages at build time
export function generateStaticParams() {
  return GAME_SLUGS.map((slug) => ({ slug }));
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

  return (
    <>
      <GameFeedClient slug={slug} gameName={gameName} />
      <GamePageContent slug={slug} />
    </>
  );
}
