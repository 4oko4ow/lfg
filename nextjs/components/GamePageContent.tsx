import { getGameContent } from "@/lib/constants/game-content";
import { SLUG_TO_FALLBACK_NAME } from "@/lib/constants/games";
import type { GameSlug } from "@/lib/constants/games";

interface Props {
  slug: string;
}

export function GamePageContent({ slug }: Props) {
  const content = getGameContent(slug);
  const gameName =
    SLUG_TO_FALLBACK_NAME[slug as GameSlug] ?? slug;

  if (!content) {
    return (
      <section className="mt-10 px-4 max-w-2xl mx-auto text-center text-sm text-zinc-500">
        <p>
          Найди тиммейтов для {gameName} на FindParty — создай объявление или
          вступи в готовую пати. Без регистрации, всё бесплатно.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-10 px-4 max-w-2xl mx-auto space-y-6">
      <div>
        <div className="flex flex-wrap gap-2 mb-3">
          {content.tags.map((tag) => (
            <span
              key={tag}
              className="text-xs px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700"
            >
              {tag}
            </span>
          ))}
        </div>
        <p className="text-sm text-zinc-400 leading-relaxed">
          {content.description}
        </p>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-zinc-300 mb-3">
          Советы для поиска тиммейтов в {gameName}
        </h2>
        <ul className="space-y-2">
          {content.tips.map((tip, i) => (
            <li key={i} className="flex gap-2.5 text-sm text-zinc-400">
              <span className="text-zinc-600 shrink-0">{i + 1}.</span>
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
