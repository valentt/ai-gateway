# AI Gateway v2 - Bug Fix Session (Round 6)

You are fixing bugs in this Electron app. Work ONLY in this directory.

## Previous fixes (DONE, rounds 1-5):
- sendQuestion() sends via IPC to all selected models
- send-to-model IPC handler calls API and returns response
- API URL parsing + Anthropic auth (x-api-key header)
- Response display in panels with formatResponse()
- CSS panels visibility, spinner fix, error display in red
- Settings dialog saves/loads API keys
- Template literal fix in extractors
- shouldUseApi null check

## Round 6: Webview tab mode + provider login

The app has two approaches: API mode (direct API calls) and Webview mode (browser automation).
Check and fix webview tab functionality:

1. Do webview tabs load the correct URLs for each provider?
2. Can a user switch between tabs?
3. Does the tab switching UI work (sidebar or topbar)?
4. Is there a way to inject a prompt into a webview? Check injector code.
5. Can responses be scraped from webviews? Check extractor code.

Fix any issues found. Focus on making at least one provider (e.g. ChatGPT) work in webview mode.

## Rules
- Vanilla JS only, no frameworks
- Read files before modifying
- Make minimal, focused changes
