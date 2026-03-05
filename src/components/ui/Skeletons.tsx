export function StatCardSkeleton() {
  return (
    <div className="glass rounded-2xl p-4 animate-pulse">
      <div className="h-2.5 w-16 bg-white/10 rounded mb-3" />
      <div className="h-7 w-24 bg-white/10 rounded" />
    </div>
  );
}

export function FeedCardSkeleton() {
  return (
    <div className="glass rounded-2xl p-4 animate-pulse">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-white/10 flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-28 bg-white/10 rounded" />
          <div className="h-2 w-20 bg-white/10 rounded" />
        </div>
      </div>
      <div className="h-32 bg-white/10 rounded-xl mb-3" />
      <div className="flex gap-4">
        <div className="h-3 w-16 bg-white/10 rounded" />
        <div className="h-3 w-16 bg-white/10 rounded" />
      </div>
    </div>
  );
}
