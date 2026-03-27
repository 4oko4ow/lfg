import { useTranslation } from "react-i18next";

type Entry = {
  date: string;
  items: string[];
};

const ENTRIES: Entry[] = [
  {
    date: "2026-03-27",
    items: [
      "Chat messages now require authentication",
      "Chat moved to WebSocket for instant delivery",
      "Public profile pages at /profile/:userId",
      "Profile links in chat nicknames",
      "This changelog page",
    ],
  },
];

export default function ChangelogPage() {
  const { t } = useTranslation();

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 pt-20 pb-16">
      <div className="max-w-2xl mx-auto px-4">
        <h1 className="text-2xl font-bold mb-8 text-white">
          {t("changelog.title", "What's new")}
        </h1>
        <div className="space-y-10">
          {ENTRIES.map((entry) => (
            <div key={entry.date}>
              <p className="text-xs font-mono text-zinc-500 mb-3 uppercase tracking-widest">
                {entry.date}
              </p>
              <ul className="space-y-2">
                {entry.items.map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-zinc-300">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
