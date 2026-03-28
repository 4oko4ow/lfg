import Link from "next/link";
import {
  Gamepad2,
  Zap,
  Trophy,
  ArrowRight,
  MessageCircle,
} from "lucide-react";
import { LandingStats } from "@/components/LandingStats";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 text-white">
      {/* Hero Section */}
      <section className="relative overflow-hidden px-4 py-20 sm:py-32">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <h1 className="mb-6 text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
              <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                Найди свою команду
              </span>
            </h1>
            <p className="mx-auto mb-8 max-w-2xl text-xl text-zinc-300 sm:text-2xl">
              Подключайся к игрокам, вступай в пати и прокачивай игровой опыт. Без регистрации.
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/feed"
                className="group flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-blue-500/50 transition-all duration-200 hover:scale-105 hover:shadow-xl hover:shadow-blue-500/60"
              >
                Смотреть пати
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href="/profile"
                className="rounded-full border-2 border-zinc-600 bg-zinc-900/50 px-8 py-4 text-lg font-semibold text-white transition-all duration-200 hover:border-zinc-400 hover:bg-zinc-800/50"
              >
                Создать первую пати
              </Link>
            </div>
          </div>

          {/* Динамическая статистика + редирект если авторизован */}
          <LandingStats />
        </div>
      </section>

      {/* Features Section */}
      <section className="px-4 py-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-12 text-center text-4xl font-bold">
            Почему FindParty?
          </h2>
          <div className="grid gap-8 md:grid-cols-3">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-6 backdrop-blur-sm transition-all duration-200 hover:border-blue-500/50 hover:bg-zinc-900/50">
              <div className="mb-4 inline-flex rounded-full bg-blue-500/20 p-3">
                <Zap className="h-6 w-6 text-blue-400" />
              </div>
              <h3 className="mb-2 text-xl font-semibold">Моментально</h3>
              <p className="text-zinc-400">
                Найди или создай пати за секунды. Без длинных регистраций и сложных форм.
              </p>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-6 backdrop-blur-sm transition-all duration-200 hover:border-purple-500/50 hover:bg-zinc-900/50">
              <div className="mb-4 inline-flex rounded-full bg-purple-500/20 p-3">
                <Trophy className="h-6 w-6 text-purple-400" />
              </div>
              <h3 className="mb-2 text-xl font-semibold">Геймифицировано</h3>
              <p className="text-zinc-400">
                Зарабатывай XP, открывай достижения и поднимайся в рейтинге.
              </p>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-6 backdrop-blur-sm transition-all duration-200 hover:border-pink-500/50 hover:bg-zinc-900/50">
              <div className="mb-4 inline-flex rounded-full bg-pink-500/20 p-3">
                <MessageCircle className="h-6 w-6 text-pink-400" />
              </div>
              <h3 className="mb-2 text-xl font-semibold">Живое сообщество</h3>
              <p className="text-zinc-400">
                Общайся в чате, находи игроков и расширяй свою игровую сеть.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Popular Games Section — внутренние ссылки для SEO */}
      <section className="px-4 py-12">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-6 text-center text-2xl font-bold">Поиск тиммейтов по играм</h2>
          <div className="flex flex-wrap justify-center gap-3">
            {[
              { slug: "dota2", name: "Dota 2" },
              { slug: "cs2", name: "CS2" },
              { slug: "rust", name: "Rust" },
              { slug: "valorant", name: "Valorant" },
              { slug: "minecraft", name: "Minecraft" },
              { slug: "apex", name: "Apex Legends" },
              { slug: "tarkov", name: "Escape from Tarkov" },
              { slug: "repo", name: "R.E.P.O" },
              { slug: "fortnite", name: "Fortnite" },
              { slug: "peak", name: "PEAK" },
            ].map(({ slug, name }) => (
              <Link
                key={slug}
                href={`/game/${slug}`}
                className="rounded-lg border border-zinc-700 bg-zinc-900/50 px-4 py-2 text-sm text-zinc-300 transition-all duration-200 hover:border-zinc-500 hover:text-white"
              >
                {name}
              </Link>
            ))}
          </div>
        </div>
      </section>


      {/* CTA Section */}
      <section className="px-4 py-20">
        <div className="mx-auto max-w-4xl rounded-2xl border border-zinc-800 bg-gradient-to-r from-blue-600/20 to-purple-600/20 p-12 text-center backdrop-blur-sm">
          <h2 className="mb-4 text-3xl font-bold sm:text-4xl">
            Готов найти свою команду?
          </h2>
          <p className="mb-8 text-lg text-zinc-300">
            Тысячи игроков уже ищут партнёров прямо сейчас.
          </p>
          <Link
            href="/feed"
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-blue-500/50 transition-all duration-200 hover:scale-105 hover:shadow-xl hover:shadow-blue-500/60"
          >
            Начать сейчас
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>
    </div>
  );
}
