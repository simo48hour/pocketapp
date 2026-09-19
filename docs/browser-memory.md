# Browser runtime memory controls

The terminal shell previously used two `tee()` calls. Its command branch was read only while a command awaited an OSC marker; background output accumulated indefinitely while that branch was idle. The shell now uses a single continuously drained reader and bounded command observers. Split OSC markers are handled across chunks.

## Limits and runtime behavior

- Xterm retains 250 scrollback lines. Its existing viewport renderer handles visible rows.
- Terminal rendering batches at 32 ms, with one xterm write in flight and at most 32 KiB / 250 lines pending. Older pending output is discarded under overload.
- Command results and build diagnostics retain the last 32 KiB / 250 lines.
- Debug terminal logs retain up to 250 pending entries, with each entry limited to 4 KiB. Flushes run during continuous output. Console capture no longer retains live object references. Default debug/event history is 250 entries.
- Repeated identical start actions share an execution. Command preparation is serialized across action runners; starting another command interrupts the previous foreground command.
- Start actions no longer prepend `npm install`. Initial setup and dependency changes must provide an install action.
- Partial file content stays in the parser until the file action completes. Completed files go through one global queue and one runtime write, with a 16 ms yield between files. Identical file content is not rewritten.
- Vite starter and host configurations disable polling and overlays and exclude dependencies, Git, and generated outputs. The workspace content watcher also excludes these trees, so generated buffers are not mirrored into the editor store.
- All selectable prompt modes receive the dependency and watcher guardrails. Existing imported Vite configs are not rewritten automatically.

## Restart Environment

The preview toolbar saves editor changes, stops tracked processes, removes `node_modules/.vite`, `node_modules/.cache`, and `.vite`, resets terminal buffers, reconnects shells, and starts `npm run dev`. Repeated restart requests share one operation. Failure to start within 30 seconds appears in the toolbar; further details remain in the terminal.

This is a process/cache restart of the existing WebContainer. It preserves source files and installed dependencies. It does not tear down/reboot the VM, erase unrelated temporary files, or promise that WebAssembly's allocated memory returns to the OS. The button assumes a root `dev` script. The slow-preview badge reports loads exceeding eight seconds, not a memory measurement.

## Validation

Automated tests cover idle output drainage, split OSC markers, duplicate starts, bounded output under backpressure, command cancellation, tracked process shutdown, and a spawn resolving after restart. Run `npm test` and `npm run typecheck`.

Before release, validate in a WebContainer-capable browser:

1. Open a Vite project, stream repeated edits, and confirm HMR occurs on completed file actions without reinstalling dependencies.
2. Run sustained stdout/stderr output, including one very long line, then hide the tab and return. Verify the terminal remains responsive and old output is truncated.
3. Repeat the same start action and verify one server/port remains active.
4. Restart with unsaved editor changes and an active dev server. Confirm edits survive, terminal input still works, and the preview reconnects. Repeat after an invalid `dev` script and retry after correcting it.
5. Compare browser task-manager memory and heap snapshots over an extended run; no browser memory plateau or OOM prevention has been established by the unit tests alone.

## Response completion scheduling

Artifact closure no longer releases commands. The chat SDK must report a successful response finish and streaming must stop before commands are queued behind completed files. Cancellation, failed/truncated responses, and failed file writes prevent pending startup. Repeated installation/start commands within the batch are reused; known `npm install && npm run dev` commands are separated so a dev server cannot hold the file queue open. Arbitrary shell scripts retain their original semantics.

Chat text is sampled at 150 ms, unchanged historical messages are not reparsed, and history persistence occurs when streaming ends. A full page reload is needed to replace existing runtime/store instances during local development.
