-- pgTAP tests for clone_board RPC
-- Runner: deferred to epic 15 (pnpm test:db)
begin;
select plan(4);

-- Setup: create minimal fixtures (workspace, board, group, task, column, cell)
-- These tests verify that clone_board copies the right counts and remaps ids correctly.

-- Test 1: cloned board has same column count as source
-- Test 2: cloned board has same group count as source
-- Test 3: cloned board has same task count as source
-- Test 4: cell label_id in clone references a label owned by the cloned column (not the source)

-- NOTE: Flesh out with real fixture SQL when the runner is wired in epic 15.
-- For now, emit a descriptive skip.
select skip('clone_board fixture tests — runner wired in epic 15', 4);

select * from finish();
rollback;
