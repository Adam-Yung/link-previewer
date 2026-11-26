# Brief

Read at the start of every task: it decides what is worth doing. Drafted from the README and approved by the owner on 2026-11-26.

## Mission
Peek at a linked page in a floating window inside the current tab, without opening a new tab or navigating away. One shared codebase
ships to Chrome (Manifest V3) and Firefox (Manifest V2).

## Who it serves
People working through lists of links (search results, feeds, docs) who want to glance at a page and return to the list at once.

## Non-goals
- AI summaries or any AI feature (a public promise in the README).
- Telemetry, accounts, sync, or reading and storing the content of previewed pages.

## Anti-goals
- Security headers weakened anywhere outside the preview frame, or for longer than a preview is open.
- A preview that breaks the host page (its clicks, scrolling, styles) after it closes.
- Closed source.

## Priorities now
1. Never weaken security beyond the preview frame.
2. Previews work reliably on common sites.
3. Fast to open, smooth to drag and resize.
4. Chrome and Firefox parity.
5. Small runtime code with no runtime dependencies (dev tools such as the linter are fine).

## Where to look
`docs/status.md` (present state) · `docs/todo.md` (next work, in order) · `docs/decisions/` (settled calls) · `docs/README.md` (map).
