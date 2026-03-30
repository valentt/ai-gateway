# AI Gateway v2 - UX Fix Session (Round 8)

You are fixing UX problems in this Electron app. Work ONLY in this directory.

## CRITICAL UX PROBLEM: User can't find how to login to providers

The user opens the app and sees model chips (Claude, GPT, Gemini etc) and an input box. But there's NO visible way to switch to webview/browser mode where they can LOGIN to ChatGPT, Claude, Grok etc with their free accounts.

## Fix Required:

1. Add a PROMINENT mode toggle in the topbar. Two clear buttons:
   - "Chat" (API panels mode - current default)
   - "Browse" or "Login" (webview tabs mode - shows browser tabs for each provider)

2. The toggle should be visually obvious - not hidden. Use contrasting colors.

3. When user clicks "Browse"/"Login":
   - Show the webview tab bar with all 9 provider tabs
   - Each tab shows the provider name (ChatGPT, Claude, Gemini, Grok, DeepSeek, Kimi, Qwen, Perplexity, Manus)
   - Clicking a tab loads that provider's website in the main area
   - User can login with their free account
   - Session persists (no need to re-login)

4. Add a brief instruction text when first switching to Browse mode: "Click a tab to open a provider. Login with your free account."

5. Make sure the webview fills the main content area properly (no overlap with panels)

## Rules
- Vanilla JS only, no frameworks
- Read existing code before modifying - the webview infrastructure exists, just needs better UX
- Focus on making it OBVIOUS how to use the app
- Keep changes minimal but impactful for UX
