# AI Gateway v2 - Bug Fix Session (Round 7)

You are fixing bugs in this Electron app. Work ONLY in this directory.

## Previous fixes (DONE, rounds 1-6):
- sendQuestion() sends via IPC to all selected models
- send-to-model IPC handler calls API and returns response
- API URL parsing + Anthropic auth
- Response display in panels with formatResponse()
- CSS panels visibility, spinner fix, error display
- Settings dialog saves/loads API keys, refreshApiStatus on startup
- Template literal fix in extractors, shouldUseApi null check
- Webview useragent spoofing (Chrome UA), webview display CSS

## Round 7: Polish and robustness

1. Check that switching between Tabs mode and Panels mode works cleanly (no stale panels, no missing responses)
2. Check that the sidebar conversation history saves and loads correctly
3. Check that "New Chat" button clears panels and starts fresh
4. Check that multiple questions in sequence work (not just the first one)
5. Add any missing error boundaries so the app never shows a blank screen

Fix anything broken. This is the final polish round.

## Rules
- Vanilla JS only, no frameworks
- Read files before modifying
- Make minimal, focused changes
