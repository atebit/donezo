import { BoardCardGrid } from "@/components/shared/board-card/BoardCardGrid";
import { LastViewed } from "@/components/shared/LastViewed";

// LastViewed requires an array of boards with member data.
// The workspace landing page does not yet fetch recently-visited boards with
// member details (that data pipeline is out of scope for Slice 11 — see followups).
// Render with an empty array so the section is hidden until that data lands.
export default function WorkspacePage() {
  return (
    <main className="flex flex-col" style={{ padding: "32px 24px", flex: 1 }}>
      <LastViewed boards={[]} />
      <BoardCardGrid />
    </main>
  );
}
