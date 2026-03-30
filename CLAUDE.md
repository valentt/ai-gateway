# AI Gateway v2 - Bug Fix Session (Round 4)

You are fixing bugs in this Electron app. Work ONLY in this directory.

## Previous fixes (DONE):
- sendQuestion() sends via IPC
- send-to-model IPC handler in main.js
- API URL parsing + Anthropic auth
- Response display in panels
- CSS panels visibility
- Spinner stuck fix

## Round 4: Settings dialog + API key persistence

Check and fix the Settings dialog flow:
1. In `ui/settings.html`, verify the save button sends keys back to main process
2. In `main.js`, verify save-api-key handler stores keys to config/api-keys.json
3. In `preload.js`, verify settings IPC methods are exposed
4. Test: can a user open settings, enter an API key, save, and then send a question?

Also check: does the app correctly load saved API keys on startup?

## Rules
- Vanilla JS only, no frameworks
- Read files before modifying
- Make minimal, focused changes
