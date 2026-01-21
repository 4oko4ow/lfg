import { useState } from "react";
import { Flame, BarChart3, Trophy } from "lucide-react";
import { type CreatorProfile } from "../hooks/useCreatorProfile";
import {
  ACHIEVEMENTS_BY_RARITY,
  getLevelColor,
  type AchievementType,
} from "../constants/achievements";

interface CreatorTooltipProps {
  profile: CreatorProfile;
  position: "top" | "bottom";
  onClose: () => void;
}

export default function CreatorTooltip({
  profile,
  position,
  onClose,
}: CreatorTooltipProps) {
  const [hoveredAchievement, setHoveredAchievement] = useState<AchievementType | null>(null);

  const levelColor = getLevelColor(profile.level);

  const positionClasses =
    position === "top"
      ? "bottom-full mb-2"
      : "top-full mt-2";

  return (
    <>
      {/* Backdrop for mobile */}
      <div
        className="fixed inset-0 z-40 sm:hidden"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      />

      <div
        className={`absolute left-1/2 z-50 -translate-x-1/2 ${positionClasses}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-64 rounded-xl border border-zinc-700 bg-zinc-900 p-4 shadow-xl">
          {/* Header: Avatar + Name + Level */}
          <div className="mb-3 flex items-center gap-3">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.display_name}
                className="h-10 w-10 rounded-full"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-700 text-lg font-bold text-zinc-400">
                {profile.display_name?.charAt(0)?.toUpperCase() || "?"}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="truncate font-medium text-white">
                {profile.display_name || "Аноним"}
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <span className={`font-semibold ${levelColor}`}>
                  Lv.{profile.level}
                </span>
                <span className="text-zinc-500">•</span>
                <span className="text-zinc-400">
                  {profile.total_xp.toLocaleString()} XP
                </span>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="mb-3 h-px bg-zinc-800" />

          {/* Stats */}
          <div className="mb-3">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-zinc-400">
              <BarChart3 className="h-3.5 w-3.5" />
              <span>Статистика</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-zinc-800/50 px-2 py-1.5">
                <div className="text-zinc-500">Создано пати</div>
                <div className="font-semibold text-white">{profile.parties_created}</div>
              </div>
              <div className="rounded-lg bg-zinc-800/50 px-2 py-1.5">
                <div className="text-zinc-500">Джоинов</div>
                <div className="font-semibold text-white">{profile.parties_joined}</div>
              </div>
              {profile.current_streak > 0 && (
                <div className="col-span-2 flex items-center gap-2 rounded-lg bg-orange-500/10 px-2 py-1.5">
                  <Flame className="h-4 w-4 text-orange-400" />
                  <div>
                    <span className="text-zinc-400">Стрик: </span>
                    <span className="font-semibold text-orange-400">
                      {profile.current_streak} {getDaysWord(profile.current_streak)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="mb-3 h-px bg-zinc-800" />

          {/* Achievements */}
          <div>
            <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-zinc-400">
              <Trophy className="h-3.5 w-3.5" />
              <span>Ачивки ({profile.achievements.length}/11)</span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {ACHIEVEMENTS_BY_RARITY.map((achievement) => {
                const isUnlocked = profile.achievements.includes(achievement.type);
                const Icon = achievement.icon;

                return (
                  <div
                    key={achievement.type}
                    className="relative"
                    onMouseEnter={() => setHoveredAchievement(achievement.type)}
                    onMouseLeave={() => setHoveredAchievement(null)}
                  >
                    <div
                      className={`rounded-lg p-1.5 transition-all ${
                        isUnlocked
                          ? `${achievement.bgColor} ${achievement.color}`
                          : "bg-zinc-800/50 text-zinc-600"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>

                    {/* Achievement name tooltip */}
                    {hoveredAchievement === achievement.type && (
                      <div className="absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded bg-zinc-950 px-2 py-1 text-[10px] font-medium shadow-lg">
                        <div className={isUnlocked ? "text-white" : "text-zinc-500"}>
                          {achievement.name}
                        </div>
                        {!isUnlocked && (
                          <div className="text-zinc-600">{achievement.description}</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Arrow */}
        <div
          className={`absolute left-1/2 -translate-x-1/2 border-8 border-transparent ${
            position === "top"
              ? "top-full border-t-zinc-700"
              : "bottom-full border-b-zinc-700"
          }`}
        />
      </div>
    </>
  );
}

function getDaysWord(count: number): string {
  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 19) {
    return "дней";
  }
  if (lastDigit === 1) {
    return "день";
  }
  if (lastDigit >= 2 && lastDigit <= 4) {
    return "дня";
  }
  return "дней";
}
