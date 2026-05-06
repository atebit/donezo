import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-start justify-center gap-4 p-8">
      <h1 className="text-2xl font-semibold">Not found</h1>
      <p className="text-fg/70">The page you're looking for doesn't exist.</p>
      <Link href="/" className="underline underline-offset-4">
        Go home
      </Link>
    </main>
  );
}
