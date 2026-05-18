export default function Loading() {
  return (
    <div className="min-h-screen animate-pulse bg-[var(--background)] p-6">
      <div className="mx-auto max-w-[1440px] space-y-4">
        <div className="h-32 rounded-[32px] bg-white/6" />
        <div className="grid gap-4 md:grid-cols-3">
          <div className="h-40 rounded-[28px] bg-white/6" />
          <div className="h-40 rounded-[28px] bg-white/6" />
          <div className="h-40 rounded-[28px] bg-white/6" />
        </div>
        <div className="h-72 rounded-[32px] bg-white/6" />
      </div>
    </div>
  );
}
