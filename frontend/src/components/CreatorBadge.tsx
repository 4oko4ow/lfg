import { useState, useRef } from "react";
import { useCreatorProfile } from "../hooks/useCreatorProfile";
import {
  ACHIEVEMENTS,
  getRarestAchievement,
  getLevelColor,
  type AchievementType,
} from "../constants/achievements";
import CreatorTooltip from "./CreatorTooltip";

interface CreatorBadgeProps {
  userId: string | undefined;
}

export default function CreatorBadge({ userId }: CreatorBadgeProps) {
  const { profile, loading } = useCreatorProfile(userId);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<"top" | "bottom">("top");
  const badgeRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  if (!userId || loading || !profile) {
    return null;
  }

  const rarestAchievement = getRarestAchievement(profile.achievements);
  const levelColor = getLevelColor(profile.level);

  const handleMouseEnter = () => {
    // Calculate tooltip position based on badge position
    if (badgeRef.current) {
      const rect = badgeRef.current.getBoundingClientRect();
      const spaceAbove = rect.top;
      const spaceBelow = window.innerHeight - rect.bottom;
      setTooltipPosition(spaceAbove > 300 || spaceAbove > spaceBelow ? "top" : "bottom");
    }

    hoverTimeoutRef.current = setTimeout(() => {
      setShowTooltip(true);
    }, 300);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setShowTooltip(false);
  };

  const handleClick = () => {
    // For mobile: toggle tooltip on click
    setShowTooltip(!showTooltip);
  };

  return (
    <div
      ref={badgeRef}
      className="relative inline-flex"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      <div className="flex items-center gap-1.5 rounded-lg bg-zinc-800/50 px-2 py-1 text-xs cursor-pointer hover:bg-zinc-700/50 transition-colors">
        {/* Level */}
        <span className={`font-semibold ${levelColor}`}>
          Lv.{profile.level}
        </span>

        <span className="text-zinc-500">•</span>

        {/* Parties created */}
        <span className="text-zinc-400">
          {profile.parties_created} {getPartiesWord(profile.parties_created)}
        </span>

        {/* Rarest achievement icon */}
        {rarestAchievement && (
          <>
            <span className="text-zinc-500">•</span>
            <AchievementIcon achievement={rarestAchievement.type} />
          </>
        )}
      </div>

      {/* Tooltip */}
      {showTooltip && (
        <CreatorTooltip
          profile={profile}
          position={tooltipPosition}
          onClose={() => setShowTooltip(false)}
        />
      )}
    </div>
  );
}

function AchievementIcon({ achievement }: { achievement: AchievementType }) {
  const def = ACHIEVEMENTS[achievement];
  if (!def) return null;

  const Icon = def.icon;
  return (
    <div className={`${def.bgColor} rounded p-0.5`} title={def.name}>
      <Icon className={`h-3 w-3 ${def.color}`} />
    </div>
  );
}

function getPartiesWord(count: number): string {
  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 19) {
    return "пати";
  }
  if (lastDigit === 1) {
    return "пати";
  }
  if (lastDigit >= 2 && lastDigit <= 4) {
    return "пати";
  }
  return "пати";
}
