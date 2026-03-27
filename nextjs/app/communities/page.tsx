'use client';

import { useEffect, useState, useRef } from "react";
import {
  CheckCircle2,
  Users,
  Zap,
  BarChart3,
  MessageSquare,
  Clock,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { analytics } from "@/lib/utils/analytics";

type FormData = {
  email: string;
  platform: string[];
  communitySize: string;
  willingToPay: string;
  communityName: string;
  games: string;
};

type FormErrors = {
  email?: string;
  platform?: string;
  communitySize?: string;
  willingToPay?: string;
};

export default function CommunitiesPage() {
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [formStarted, setFormStarted] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const formRef = useRef<HTMLDivElement>(null);
  const pricingRef = useRef<HTMLDivElement>(null);
  const pricingTracked = useRef(false);

  const [formData, setFormData] = useState<FormData>({
    email: "",
    platform: [],
    communitySize: "",
    willingToPay: "",
    communityName: "",
    games: "",
  });

  useEffect(() => {
    analytics.communitiesPageView();
  }, []);

  useEffect(() => {
    if (!pricingRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !pricingTracked.current) {
          analytics.communitiesPricingViewed();
          pricingTracked.current = true;
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(pricingRef.current);
    return () => observer.disconnect();
  }, []);

  const handleCtaClick = () => {
    setShowForm(true);
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  const handleFormInteraction = () => {
    if (!formStarted) {
      setFormStarted(true);
      analytics.communitiesFormStart();
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Введите корректный email";
      analytics.communitiesFormError("email");
    }

    if (formData.platform.length === 0) {
      newErrors.platform = "Выберите хотя бы одну платформу";
      analytics.communitiesFormError("platform");
    }

    if (!formData.communitySize) {
      newErrors.communitySize = "Выберите размер сообщества";
      analytics.communitiesFormError("communitySize");
    }

    if (!formData.willingToPay) {
      newErrors.willingToPay = "Выберите вариант";
      analytics.communitiesFormError("willingToPay");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);

    const platformValue =
      formData.platform.length === 2
        ? "both"
        : formData.platform[0]?.toLowerCase() || "";

    const payload = {
      email: formData.email,
      platform: platformValue,
      community_size: formData.communitySize,
      willing_to_pay: formData.willingToPay,
      community_name: formData.communityName || undefined,
      games: formData.games || undefined,
    };

    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
      const response = await fetch(`${backendUrl}/api/community-leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        analytics.communitiesFormSubmit({
          platform: platformValue,
          community_size: formData.communitySize,
          willing_to_pay: formData.willingToPay,
        });
        setIsSubmitted(true);
      } else {
        throw new Error("Failed to submit");
      }
    } catch (error) {
      console.error("Error submitting form:", error);
      setErrors({ email: "Произошла ошибка. Попробуйте ещё раз." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePlatformChange = (platform: string) => {
    handleFormInteraction();
    setFormData((prev) => ({
      ...prev,
      platform: prev.platform.includes(platform)
        ? prev.platform.filter((p) => p !== platform)
        : [...prev.platform, platform],
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 text-white">
      {/* Hero Section */}
      <section className="relative overflow-hidden px-4 py-20 sm:py-28">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="mb-6 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            <span className="bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent">
              Помогите вашему сообществу находить тиммейтов быстрее
            </span>
          </h1>
          <p className="mx-auto mb-8 max-w-2xl text-xl text-zinc-300">
            Превратите активность сообщества в игровые сессии — автоматически,
            без хаоса в чате.
          </p>
          <button
            onClick={handleCtaClick}
            className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-600 to-cyan-600 px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-emerald-500/30 transition-all duration-200 hover:scale-105 hover:shadow-xl hover:shadow-emerald-500/40"
          >
            Попробовать бесплатно
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
          </button>
        </div>
      </section>

      {/* Features Section */}
      <section className="px-4 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-10 text-center text-3xl font-bold">
            Что вы получаете
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={<MessageSquare className="h-6 w-6" />}
              text="Создание пати прямо из Discord / Telegram"
            />
            <FeatureCard
              icon={<Clock className="h-6 w-6" />}
              text="Автоудаление старых пати (без спама)"
            />
            <FeatureCard
              icon={<Users className="h-6 w-6" />}
              text="Единый пул: ваш сервер + публичное обнаружение"
            />
            <FeatureCard
              icon={<Zap className="h-6 w-6" />}
              text="Присоединение в один клик по ссылке"
            />
            <FeatureCard
              icon={<BarChart3 className="h-6 w-6" />}
              text="Базовая аналитика (просмотры / джоины)"
            />
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section ref={pricingRef} className="px-4 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-10 text-center text-3xl font-bold">Тарифы</h2>
          <div className="grid gap-6 md:grid-cols-2">
            {/* Free Plan */}
            <div className="rounded-2xl border border-zinc-700 bg-zinc-900/50 p-8">
              <h3 className="mb-2 text-2xl font-bold">Free</h3>
              <p className="mb-6 text-zinc-400">Для старта</p>
              <ul className="space-y-3">
                <PricingFeature text="До 3 активных пати" />
                <PricingFeature text="Публичный листинг" />
                <PricingFeature text="Стандартные ссылки" />
              </ul>
            </div>

            {/* Pro Plan */}
            <div className="relative rounded-2xl border-2 border-emerald-500/50 bg-gradient-to-br from-emerald-900/20 to-cyan-900/20 p-8">
              <div className="absolute -top-3 right-6 rounded-full bg-emerald-500 px-3 py-1 text-xs font-semibold text-black">
                Рекомендуем
              </div>
              <h3 className="mb-2 text-2xl font-bold">Pro</h3>
              <p className="mb-6">
                <span className="text-3xl font-bold text-emerald-400">$15</span>
                <span className="text-zinc-400"> / мес</span>
              </p>
              <ul className="space-y-3">
                <PricingFeature text="Безлимит пати" highlighted />
                <PricingFeature text="Приоритет в выдаче" highlighted />
                <PricingFeature text="Брендинг сообщества" highlighted />
                <PricingFeature
                  text="Аналитика (просмотры/джоины)"
                  highlighted
                />
                <PricingFeature text="Кастомные инвайт-сообщения" highlighted />
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Form Section */}
      <section ref={formRef} className="px-4 py-16">
        <div className="mx-auto max-w-2xl">
          {showForm && !isSubmitted && (
            <div className="rounded-2xl border border-zinc-700 bg-zinc-900/70 p-8 backdrop-blur-sm">
              <h2 className="mb-6 text-center text-2xl font-bold">
                Оставить заявку
              </h2>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Email */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-300">
                    Email <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => {
                      handleFormInteraction();
                      setFormData({ ...formData, email: e.target.value });
                    }}
                    className={`w-full rounded-lg border bg-zinc-800 px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 ${
                      errors.email
                        ? "border-red-500 focus:ring-red-500"
                        : "border-zinc-600 focus:ring-emerald-500"
                    }`}
                    placeholder="admin@community.gg"
                  />
                  {errors.email && (
                    <p className="mt-1 text-sm text-red-400">{errors.email}</p>
                  )}
                </div>

                {/* Platform */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-300">
                    Платформа <span className="text-red-400">*</span>
                  </label>
                  <div className="flex gap-4">
                    {["Discord", "Telegram"].map((platform) => (
                      <label
                        key={platform}
                        className="flex cursor-pointer items-center gap-2"
                      >
                        <input
                          type="checkbox"
                          checked={formData.platform.includes(platform)}
                          onChange={() => handlePlatformChange(platform)}
                          className="h-5 w-5 rounded border-zinc-600 bg-zinc-800 text-emerald-500 focus:ring-emerald-500"
                        />
                        <span>{platform}</span>
                      </label>
                    ))}
                  </div>
                  {errors.platform && (
                    <p className="mt-1 text-sm text-red-400">
                      {errors.platform}
                    </p>
                  )}
                </div>

                {/* Community Size */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-300">
                    Размер сообщества <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={formData.communitySize}
                    onChange={(e) => {
                      handleFormInteraction();
                      setFormData({ ...formData, communitySize: e.target.value });
                    }}
                    className={`w-full rounded-lg border bg-zinc-800 px-4 py-3 text-white focus:outline-none focus:ring-2 ${
                      errors.communitySize
                        ? "border-red-500 focus:ring-red-500"
                        : "border-zinc-600 focus:ring-emerald-500"
                    }`}
                  >
                    <option value="">Выберите...</option>
                    <option value="under_100">До 100 участников</option>
                    <option value="100_500">100 — 500</option>
                    <option value="500_1000">500 — 1000</option>
                    <option value="over_1000">Более 1000</option>
                  </select>
                  {errors.communitySize && (
                    <p className="mt-1 text-sm text-red-400">
                      {errors.communitySize}
                    </p>
                  )}
                </div>

                {/* Willing to Pay */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-300">
                    Готовы платить $15/мес за Pro?{" "}
                    <span className="text-red-400">*</span>
                  </label>
                  <div className="flex gap-6">
                    {[
                      { value: "yes", label: "Да" },
                      { value: "maybe", label: "Возможно" },
                      { value: "no", label: "Нет" },
                    ].map((option) => (
                      <label
                        key={option.value}
                        className="flex cursor-pointer items-center gap-2"
                      >
                        <input
                          type="radio"
                          name="willingToPay"
                          value={option.value}
                          checked={formData.willingToPay === option.value}
                          onChange={(e) => {
                            handleFormInteraction();
                            setFormData({
                              ...formData,
                              willingToPay: e.target.value,
                            });
                          }}
                          className="h-5 w-5 border-zinc-600 bg-zinc-800 text-emerald-500 focus:ring-emerald-500"
                        />
                        <span>{option.label}</span>
                      </label>
                    ))}
                  </div>
                  {errors.willingToPay && (
                    <p className="mt-1 text-sm text-red-400">
                      {errors.willingToPay}
                    </p>
                  )}
                </div>

                {/* Community Name (optional) */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-300">
                    Название сообщества{" "}
                    <span className="text-zinc-500">(опционально)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.communityName}
                    onChange={(e) => {
                      handleFormInteraction();
                      setFormData({ ...formData, communityName: e.target.value });
                    }}
                    className="w-full rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Например: CS2 Russia"
                  />
                </div>

                {/* Games (optional) */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-300">
                    Какие игры играете{" "}
                    <span className="text-zinc-500">(опционально)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.games}
                    onChange={(e) => {
                      handleFormInteraction();
                      setFormData({ ...formData, games: e.target.value });
                    }}
                    className="w-full rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="CS2, Dota 2, Valorant..."
                  />
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full rounded-lg bg-gradient-to-r from-emerald-600 to-cyan-600 px-6 py-4 font-semibold text-white transition-all duration-200 hover:from-emerald-500 hover:to-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Отправляем...
                    </span>
                  ) : (
                    "Отправить заявку"
                  )}
                </button>
              </form>
            </div>
          )}

          {isSubmitted && (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-900/20 p-8 text-center">
              <CheckCircle2 className="mx-auto mb-4 h-16 w-16 text-emerald-400" />
              <h2 className="mb-2 text-2xl font-bold text-emerald-400">
                Спасибо!
              </h2>
              <p className="text-zinc-300">
                Мы свяжемся с вами в ближайшее время.
              </p>
            </div>
          )}

          {!showForm && (
            <div className="text-center">
              <button
                onClick={handleCtaClick}
                className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-600 to-cyan-600 px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-emerald-500/30 transition-all duration-200 hover:scale-105 hover:shadow-xl hover:shadow-emerald-500/40"
              >
                Попробовать бесплатно
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function FeatureCard({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
      <div className="flex-shrink-0 text-emerald-400">{icon}</div>
      <span className="text-zinc-200">{text}</span>
    </div>
  );
}

function PricingFeature({
  text,
  highlighted = false,
}: {
  text: string;
  highlighted?: boolean;
}) {
  return (
    <li className="flex items-center gap-2">
      <CheckCircle2
        className={`h-5 w-5 flex-shrink-0 ${
          highlighted ? "text-emerald-400" : "text-zinc-500"
        }`}
      />
      <span className={highlighted ? "text-white" : "text-zinc-300"}>
        {text}
      </span>
    </li>
  );
}
