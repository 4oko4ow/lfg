import {
  PartyPopper,
  Flame,
  Star,
  Crown,
  Handshake,
  Gamepad2,
  Calendar,
  CalendarCheck,
  Moon,
  Zap,
  Target,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type AchievementType =
  | "first_party"
  | "activist"
  | "veteran"
  | "legend"
  | "teammate"
  | "team_player"
  | "week_streak"
  | "month_streak"
  | "night_gamer"
  | "quick_fill"
  | "sniper";

export interface AchievementDef {
  type: AchievementType;
  icon: LucideIcon;
  name: string;
  description: string;
  color: string;
  bgColor: string;
  rarity: number; // 1 = common, 5 = legendary (for sorting)
}

export const ACHIEVEMENTS: Record<AchievementType, AchievementDef> = {
  // По количеству созданных пати
  first_party: {
    type: "first_party",
    icon: PartyPopper,
    name: "Первая пати",
    description: "Создайте первую пати",
    color: "text-green-400",
    bgColor: "bg-green-400/20",
    rarity: 1,
  },
  activist: {
    type: "activist",
    icon: Flame,
    name: "Активист",
    description: "Создайте 10 пати",
    color: "text-orange-400",
    bgColor: "bg-orange-400/20",
    rarity: 2,
  },
  veteran: {
    type: "veteran",
    icon: Star,
    name: "Ветеран",
    description: "Создайте 50 пати",
    color: "text-yellow-400",
    bgColor: "bg-yellow-400/20",
    rarity: 4,
  },
  legend: {
    type: "legend",
    icon: Crown,
    name: "Легенда",
    description: "Создайте 100 пати",
    color: "text-amber-400",
    bgColor: "bg-amber-400/20",
    rarity: 5,
  },

  // По джоинам
  teammate: {
    type: "teammate",
    icon: Handshake,
    name: "Тиммейт",
    description: "Присоединитесь к 10 пати",
    color: "text-blue-400",
    bgColor: "bg-blue-400/20",
    rarity: 1,
  },
  team_player: {
    type: "team_player",
    icon: Gamepad2,
    name: "Командный игрок",
    description: "Присоединитесь к 50 пати",
    color: "text-indigo-400",
    bgColor: "bg-indigo-400/20",
    rarity: 3,
  },

  // По стрикам
  week_streak: {
    type: "week_streak",
    icon: Calendar,
    name: "Неделя огня",
    description: "7 дней активности подряд",
    color: "text-red-400",
    bgColor: "bg-red-400/20",
    rarity: 2,
  },
  month_streak: {
    type: "month_streak",
    icon: CalendarCheck,
    name: "Месяц огня",
    description: "30 дней активности подряд",
    color: "text-rose-400",
    bgColor: "bg-rose-400/20",
    rarity: 4,
  },

  // Особые
  night_gamer: {
    type: "night_gamer",
    icon: Moon,
    name: "Ночной геймер",
    description: "Создайте пати после полуночи",
    color: "text-purple-400",
    bgColor: "bg-purple-400/20",
    rarity: 2,
  },
  quick_fill: {
    type: "quick_fill",
    icon: Zap,
    name: "Быстрый старт",
    description: "Пати заполнилась за 5 минут",
    color: "text-cyan-400",
    bgColor: "bg-cyan-400/20",
    rarity: 3,
  },
  sniper: {
    type: "sniper",
    icon: Target,
    name: "Снайпер",
    description: "100% fill rate на 10+ пати",
    color: "text-pink-400",
    bgColor: "bg-pink-400/20",
    rarity: 5,
  },
};

// Sorted by rarity (most rare first)
export const ACHIEVEMENTS_BY_RARITY = Object.values(ACHIEVEMENTS).sort(
  (a, b) => b.rarity - a.rarity
);

// Get the rarest achievement from a list
export function getRarestAchievement(
  achievementTypes: string[]
): AchievementDef | null {
  if (!achievementTypes || achievementTypes.length === 0) return null;

  let rarest: AchievementDef | null = null;
  for (const type of achievementTypes) {
    const achievement = ACHIEVEMENTS[type as AchievementType];
    if (achievement && (!rarest || achievement.rarity > rarest.rarity)) {
      rarest = achievement;
    }
  }
  return rarest;
}

// Get level color based on level number
export function getLevelColor(level: number): string {
  if (level >= 11) return "text-amber-400"; // Gold
  if (level >= 6) return "text-blue-400"; // Blue
  return "text-zinc-400"; // Gray
}

export function getLevelBgColor(level: number): string {
  if (level >= 11) return "bg-amber-400/20";
  if (level >= 6) return "bg-blue-400/20";
  return "bg-zinc-400/20";
}
