import { redirect } from "next/navigation";

export default async function BoardSettingsIndexPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; boardId: string }>;
}) {
  const { workspaceSlug, boardId } = await params;
  redirect(`/w/${workspaceSlug}/b/${boardId}/settings/general`);
}
