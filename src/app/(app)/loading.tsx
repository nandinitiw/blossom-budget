export default function AppLoading() {
  return (
    <div className="space-y-4 animate-pulse" aria-label="Loading">
      <div className="h-8 w-48 rounded-lg bg-lavender-light" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="h-28 rounded-2xl bg-lavender-light/70" />
        <div className="h-28 rounded-2xl bg-lavender-light/70" />
        <div className="h-28 rounded-2xl bg-lavender-light/70" />
      </div>
      <div className="h-72 rounded-2xl bg-lavender-light/50" />
    </div>
  );
}
