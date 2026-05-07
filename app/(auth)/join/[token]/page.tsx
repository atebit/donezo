import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { acceptInvitation } from "./actions";

export default async function JoinPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(`/join/${token}`)}`);

  async function accept() {
    "use server";
    const result = await acceptInvitation({ token });
    if (!result.ok) {
      redirect(`/join/${token}?error=${encodeURIComponent(result.error.message)}`);
    }
    redirect("/");
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">You&apos;ve been invited</h2>
      {error ? (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <p className="text-sm text-muted-foreground">Click below to accept and continue to Donezo.</p>
      <form action={accept}>
        <button
          type="submit"
          className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Accept and continue
        </button>
      </form>
    </div>
  );
}
