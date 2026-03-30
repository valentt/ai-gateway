# AI Gateway v2 - Bug Fix Session (Round 5)

You are fixing bugs in this Electron app. Work ONLY in this directory.

## Previous fixes (DONE, rounds 1-4):
- sendQuestion() sends via IPC
- send-to-model IPC handler in main.js
- API URL parsing + Anthropic auth
- Response display in panels
- CSS panels visibility + spinner fix
- Settings dialog + API key persistence
- refreshApiStatus on startup

## Round 5: End-to-end testing and remaining issues

Read through the full flow and find any remaining bugs:

1. Check `main.js` for duplicate IPC handlers (there may be old ones conflicting with new ones)
2. Check that response-scraped event data format matches what renderer expects
3. Check that `formatResponse()` in index.html properly renders markdown/code blocks
4. Check error handling: what happens when API returns an error? Does the panel show it?
5. Check that model selection chips correctly map to API platform IDs

Fix anything broken. The goal is a working demo where you can enter an API key, select a model, ask a question, and see the response.

## Rules
- Vanilla JS only, no frameworks
- Read files before modifying
- Make minimal, focused changes
