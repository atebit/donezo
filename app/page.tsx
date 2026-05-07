import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/current-user";
import { PingButton } from "./_components/ping-button";
import { SignOutButton } from "./_components/sign-out-button";

export default async function HomePage() {
  const sha = process.env.NEXT_PUBLIC_BUILD_SHA ?? "unknown";
  const user = await getCurrentUser();
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-start justify-center gap-6 p-8">
      <h1 className="text-3xl font-semibold">Donezo</h1>
      <p className="text-fg/70">Foundation health-check</p>
      <p className="font-mono text-sm">build: {sha.slice(0, 7)}</p>
      {user ? (
        <div className="flex items-center gap-3">
          <span className="text-sm">
            Signed in as <strong>{user.email}</strong>
          </span>
          <SignOutButton />
        </div>
      ) : (
        <Link href="/sign-in" className="text-sm underline">
          Sign in
        </Link>
      )}
      <PingButton />
    </main>
  );
}
