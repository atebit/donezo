import { requireUser } from "@/lib/auth/current-user";
import { AccountSettings } from "./account-settings";

export default async function AccountPage() {
  const user = await requireUser();
  return <AccountSettings user={user} />;
}
