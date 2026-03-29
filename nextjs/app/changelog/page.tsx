import { ENTRIES } from "@/lib/changelog";
import { MarkChangelogSeen } from "./MarkChangelogSeen";

export const metadata = {
  title: "Изменения — FindParty",
  description: "Что нового в FindParty",
};

export default function ChangelogPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 pt-20 pb-16">
      <MarkChangelogSeen />
      <div className="max-w-2xl mx-auto px-4">
        <h1 className="text-2xl font-bold mb-8 text-white">Что нового</h1>
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
