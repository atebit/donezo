import { PingButton } from "./_components/ping-button";

export default function HomePage() {
  const sha = process.env.NEXT_PUBLIC_BUILD_SHA ?? "unknown";
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-start justify-center gap-6 p-8">
      <h1 className="text-3xl font-semibold">Donezo</h1>
      <p className="text-fg/70">Foundation health-check</p>
      <p className="font-mono text-sm">build: {sha.slice(0, 7)}</p>
      <PingButton />
    </main>
  );
}
