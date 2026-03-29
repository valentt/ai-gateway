# AI Gateway v2 - Add data-platform attributes to webviews

Project: `C:/Users/Valent/code/ai-gateway/`

## Task 1: Find where webviews are created and add data-platform attribute

The UI in `ui/index.html` creates webview elements dynamically for each AI provider (chatgpt, claude, gemini, grok, deepseek, kimi, qwen, perplexity, manus). Find where `<webview>` elements are created (search for createElement, webview, or src assignment) and add `data-platform="${platformId}"` attribute to each.

The unified inject handler looks for `webview[data-platform="${platform}"]` to find the right webview to inject prompts into.

## Task 2: Add dual-mode toggle (Tabs vs Panels)

Add a toggle in the topbar with two buttons: "Tabs" and "Panels". In Tabs mode show the webview tabs normally. In Panels mode hide webviews offscreen (position:absolute; left:-9999px) and show the response panels grid instead.

## Rules
- Work ONLY in `C:/Users/Valent/code/ai-gateway/` (Electron project)
- Vanilla JS, no frameworks
- Read existing code before modifying
- Keep all existing injector/extractor/IPC code intact
