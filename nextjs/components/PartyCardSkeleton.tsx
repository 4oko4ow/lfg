'use client';

export default function PartyCardSkeleton() {
  return (
    <div className="rounded-xl p-5 border-2 border-zinc-700/60 bg-gradient-to-br from-zinc-800/60 via-zinc-800/40 to-zinc-900/60 backdrop-blur-sm animate-pulse">
      <div className="space-y-3">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div className="space-y-2 flex-1">
            <div className="h-6 w-32 bg-zinc-700/50 rounded-lg"></div>
            <div className="flex flex-wrap gap-2">
              <div className="h-5 w-20 bg-zinc-700/50 rounded-full"></div>
              <div className="h-5 w-24 bg-zinc-700/50 rounded-full"></div>
            </div>
          </div>
          <div className="h-5 w-16 bg-zinc-700/50 rounded-md"></div>
        </div>

        {/* Goal */}
        <div className="flex items-start gap-3 bg-zinc-900/30 rounded-lg p-3 border border-zinc-700/30">
          <div className="h-5 w-5 bg-zinc-700/50 rounded-full shrink-0"></div>
          <div className="flex-1 space-y-2">
            <div className="h-4 w-full bg-zinc-700/50 rounded"></div>
            <div className="h-4 w-3/4 bg-zinc-700/50 rounded"></div>
          </div>
        </div>

        {/* Contacts */}
        <div className="flex flex-wrap gap-2">
          <div className="h-8 w-24 bg-zinc-700/50 rounded-full"></div>
          <div className="h-8 w-28 bg-zinc-700/50 rounded-full"></div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-zinc-700/50">
          <div className="h-8 w-32 bg-zinc-700/50 rounded-lg"></div>
          <div className="h-8 w-20 bg-zinc-700/50 rounded-lg"></div>
        </div>
      </div>
    </div>
  );
}
