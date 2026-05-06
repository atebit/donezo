import Link from "next/link";

export default function NotFound() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold">Not found</h1>
      <p>The page you&apos;re looking for doesn&apos;t exist.</p>
      <Link href="/" className="underline underline-offset-4">
        Go home
      </Link>
    </main>
  );
}
