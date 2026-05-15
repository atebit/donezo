#!/usr/bin/env node
/**
 * Import parsed monday.com board exports into Donezo via the Supabase service-role key.
 * Reads scripts/import-monday/parsed.json and inserts boards/groups/columns/labels/tasks/cells/comments.
 *
 * Run with:  node --env-file=.env.local scripts/import-monday/import.mjs
 *
 * One-shot. Refuses to clobber a board with a name that already exists in the workspace.
 * Pass --force to delete and recreate matching boards (intended for retries during dev).
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PARSED_PATH = join(__dirname, "parsed.json");
const WORKSPACE_SLUG = "sleepofmirrors";
const IMPORTER_EMAIL = "atebitcreative@gmail.com";
const FORCE = process.argv.includes("--force");

const GROUP_PALETTE = [
  "#a25ddc", "#fbbc04", "#f1e4de", "#fdcfe8",
  "#f28b82", "#fff475", "#ccff90", "#cbf0f8",
  "#a7ffeb", "#d7aefb", "#e6c9a8", "#e8eaed",
];

// Column name → donezo cell type. Mirrors parse.py.
const COLUMN_TYPE = {
  "Publisher(s)": "tags", "Platforms": "tags", "Writers(s)": "tags",
  "Release Date": "date", "Date Shared": "date", "Date": "date",
  "Budget": "currency", "BPM(s)": "number",
  "Priority": "priority", "Creative": "status", "Status": "status", "Method": "status",
  "Creative Owner": "text", "Owner": "text",
  "Working Title(s)": "text", "Key(s)": "text", "Duration": "text",
  "Text": "long_text", "Link to files": "link",
};

// Visual-only seed colors for status/priority labels we auto-create.
const STATUS_COLOR_HINTS = {
  "Done": "#00c875", "Ready": "#579bfc", "In progress": "#fdab3d",
  "Planned": "#a25ddc", "Working on it": "#fdab3d", "Stuck": "#e2445c",
  "Polish / Pre-pro": "#a25ddc", "Needs Vox": "#e2445c", "Idea / early": "#e8eaed",
  "Critical": "#333333", "High": "#e2445c", "Medium": "#fdab3d", "Low": "#579bfc",
};
function hashColor(name) {
  // deterministic fallback color from a small palette
  const palette = ["#fdab3d", "#00c875", "#e2445c", "#a25ddc", "#579bfc", "#bb3354", "#037f4c", "#fdab3d"];
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return palette[h % palette.length];
}
const labelColor = (name) => STATUS_COLOR_HINTS[name] ?? hashColor(name);

const sb = createClient(
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

function die(msg, err) {
  console.error("FATAL:", msg, err ? `\n  ${JSON.stringify(err)}` : "");
  process.exit(1);
}

async function main() {
  const data = JSON.parse(readFileSync(PARSED_PATH, "utf8"));

  const { data: ws, error: wsErr } = await sb
    .from("workspace").select("id,name").eq("slug", WORKSPACE_SLUG).maybeSingle();
  if (wsErr || !ws) die(`workspace ${WORKSPACE_SLUG} not found`, wsErr);

  const { data: me, error: meErr } = await sb
    .from("profile").select("id,display_name").eq("email", IMPORTER_EMAIL).maybeSingle();
  if (meErr || !me) die(`profile ${IMPORTER_EMAIL} not found`, meErr);
  console.log(`workspace=${ws.name}  importer=${me.display_name} (${me.id})  force=${FORCE}`);

  for (const entry of data) {
    await importBoard({ entry, workspaceId: ws.id, userId: me.id });
  }
  console.log("\n✓ done");
}

async function importBoard({ entry, workspaceId, userId }) {
  const board = entry.board;
  const sourceFile = entry.source_file;
  const updatesByMondayId = entry.updates ?? {};
  console.log(`\n=== importing ${sourceFile} → board "${board.board_name}" ===`);

  // Idempotency: refuse / replace if same name exists
  const { data: existing } = await sb
    .from("board").select("id,name")
    .eq("workspace_id", workspaceId).eq("name", board.board_name).is("deleted_at", null);
  if (existing && existing.length > 0) {
    if (!FORCE) die(`board "${board.board_name}" already exists; pass --force to replace`);
    for (const b of existing) {
      const { error } = await sb.from("board").delete().eq("id", b.id);
      if (error) die(`delete existing board ${b.id}`, error);
      console.log(`  removed existing board ${b.id}`);
    }
  }

  // 1. Board
  const { data: created, error: boardErr } = await sb.from("board").insert({
    workspace_id: workspaceId,
    name: board.board_name,
    created_by: userId,
    is_private: false,
    description: `Imported from monday.com export ${sourceFile}`,
  }).select("id").single();
  if (boardErr) die("create board", boardErr);
  const boardId = created.id;
  console.log(`  board ${boardId}`);

  // 2. Default Main table view (RPC normally creates it; we bypass the RPC).
  await sb.from("view").insert({
    board_id: boardId, owner_id: null, name: "Main table",
    kind: "table", config: {}, is_shared: true, position: 0,
  });

  // 3. Build column set: union of every header observed across groups + subitems.
  const observedCols = collectColumns(board);
  console.log(`  columns: ${observedCols.join(", ")}`);

  // 4. Create columns + collect (name → {id, type})
  const columnIds = {};
  for (let i = 0; i < observedCols.length; i++) {
    const name = observedCols[i];
    const type = COLUMN_TYPE[name];
    const { data: col, error } = await sb.from("column").insert({
      board_id: boardId, name, type, position: i + 1, settings: {},
    }).select("id").single();
    if (error) die(`create column ${name}`, error);
    columnIds[name] = { id: col.id, type };
  }

  // 5. For status/priority/tags columns: collect distinct values, create labels.
  const labelIds = {}; // {colName: {labelName: labelId}}
  const labelValues = collectLabelValues(board);
  for (const [colName, valueSet] of Object.entries(labelValues)) {
    const col = columnIds[colName];
    if (!col) continue;
    labelIds[colName] = {};
    let pos = 1;
    for (const v of valueSet) {
      const { data: lab, error } = await sb.from("label").insert({
        column_id: col.id, name: v, color: labelColor(v), position: pos++,
      }).select("id").single();
      if (error) die(`create label ${colName}:${v}`, error);
      labelIds[colName][v] = lab.id;
    }
  }

  // 6. Promote subitems: build the final group list.
  //    For each parent with subitems, insert a synthetic group named "<parent.title> — subitems"
  //    immediately after the parent's group.
  const finalGroups = [];
  for (const g of board.groups) {
    finalGroups.push({ name: g.name, items: g.items.map(stripSubitems) });
    for (const it of g.items) {
      if (it.subitems && it.subitems.length > 0) {
        finalGroups.push({
          name: `${it.title} — subitems`,
          items: it.subitems,
        });
      }
    }
  }

  // 7. Create groups (only those with at least one item, preserving order — empty source
  //    groups in the export are noise placeholders).
  const groupIds = [];
  let gpos = 1;
  for (const g of finalGroups) {
    if (g.items.length === 0) continue;
    const color = GROUP_PALETTE[(gpos - 1) % GROUP_PALETTE.length];
    const { data: gr, error } = await sb.from("group").insert({
      board_id: boardId, name: g.name, position: gpos, color,
    }).select("id").single();
    if (error) die(`create group ${g.name}`, error);
    groupIds.push({ id: gr.id, name: g.name, items: g.items });
    gpos++;
  }

  // 8. Create tasks + cells
  let taskCount = 0, cellCount = 0;
  const tasksByMondayId = {};
  for (const g of groupIds) {
    let tpos = 1;
    for (const it of g.items) {
      const { data: t, error } = await sb.from("task").insert({
        group_id: g.id, board_id: boardId,
        title: it.title, position: tpos++,
        created_by: userId, updated_by: userId,
      }).select("id").single();
      if (error) die(`create task ${it.title}`, error);
      taskCount++;
      if (it.monday_id) tasksByMondayId[it.monday_id] = t.id;

      const cellRows = [];
      for (const [colName, val] of Object.entries(it.fields ?? {})) {
        const col = columnIds[colName];
        if (!col) continue;
        const cell = buildCell(val, col.type, labelIds[colName]);
        if (!cell) continue;
        cellRows.push({
          task_id: t.id, column_id: col.id, board_id: boardId,
          updated_by: userId, ...cell,
        });
      }
      if (cellRows.length > 0) {
        const { error: cellErr } = await sb.from("cell").insert(cellRows);
        if (cellErr) die(`insert cells for ${it.title}`, cellErr);
        cellCount += cellRows.length;
      }
    }
  }

  // 9. Comments from updates sheet
  let commentCount = 0;
  for (const [mondayId, updates] of Object.entries(updatesByMondayId)) {
    const taskId = tasksByMondayId[mondayId];
    if (!taskId) continue;
    for (const u of updates) {
      const text = `[${u.user || "unknown"} • ${u.created_at}]\n${u.content}`;
      const { error } = await sb.from("comment").insert({
        task_id: taskId, board_id: boardId, author_id: userId,
        body: tiptapDoc(text), body_text: text,
      });
      if (error) die(`insert comment for ${mondayId}`, error);
      commentCount++;
    }
  }

  console.log(`  ✓ ${groupIds.length} groups, ${taskCount} tasks, ${cellCount} cells, ${commentCount} comments`);
}

function stripSubitems(it) {
  return { title: it.title, monday_id: it.monday_id, fields: it.fields };
}

function collectColumns(board) {
  // Iterate all top-level items + subitems, collect first-seen order from board.columns_observed,
  // but also pick up any columns subitems have that the parent set lacks.
  const seen = new Set(board.columns_observed);
  const order = [...board.columns_observed];
  for (const g of board.groups) {
    for (const it of g.items) {
      for (const sub of it.subitems ?? []) {
        for (const k of Object.keys(sub.fields ?? {})) {
          if (!seen.has(k) && COLUMN_TYPE[k]) { seen.add(k); order.push(k); }
        }
      }
    }
  }
  return order;
}

function collectLabelValues(board) {
  // {colName: Set<value>} for status/priority columns + {colName: Set<tagValue>} for tags
  const out = {};
  const visit = (it) => {
    for (const [col, val] of Object.entries(it.fields ?? {})) {
      if (val.type === "status" || val.type === "priority") {
        (out[col] ??= new Set()).add(val.label);
      } else if (val.type === "tags") {
        const set = (out[col] ??= new Set());
        for (const v of val.values) set.add(v);
      }
    }
  };
  for (const g of board.groups) {
    for (const it of g.items) {
      visit(it);
      for (const s of it.subitems ?? []) visit(s);
    }
  }
  // freeze ordering: keep insertion order (Set iteration order is insertion in JS)
  const result = {};
  for (const [k, set] of Object.entries(out)) result[k] = [...set];
  return result;
}

function buildCell(val, colType, labelMap) {
  const empty = {
    text_value: null, number_value: null, boolean_value: null,
    date_value: null, date_end_value: null, label_id: null, json_value: null,
  };
  switch (colType) {
    case "text":
    case "long_text":
      return { ...empty, text_value: val.text };
    case "currency":
      return { ...empty, number_value: val.value };
    case "number":
      return { ...empty, number_value: val.value };
    case "date":
      return { ...empty, date_value: val.iso };
    case "tags": {
      const values = (val.values ?? []).filter(Boolean);
      if (values.length === 0) return null;
      return { ...empty, json_value: { values } };
    }
    case "status":
    case "priority": {
      const id = labelMap?.[val.label];
      if (!id) return null;
      return { ...empty, label_id: id };
    }
    case "link": {
      const url = val.url ?? "";
      if (!url) return null;
      return { ...empty, json_value: { url, label: val.label ?? url } };
    }
    default:
      return null;
  }
}

function tiptapDoc(text) {
  // minimal doc: paragraph(s) split on \n
  const lines = text.split("\n");
  return {
    type: "doc",
    content: lines.map((line) => ({
      type: "paragraph",
      content: line ? [{ type: "text", text: line }] : [],
    })),
  };
}

main().catch((e) => die("uncaught", { msg: e.message, stack: e.stack }));
