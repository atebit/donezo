export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-semibold">Donezo</h1>
      <div className="w-full rounded-xl border border-border bg-bg p-6 shadow-sm">{children}</div>
    </main>
  );
}
