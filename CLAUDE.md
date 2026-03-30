# AI Gateway v2 - CRITICAL: Fix webview height

You are fixing ONE bug in this Electron app. Work ONLY in this directory.

## THE BUG

When user clicks "Browse & Login", webview tabs appear but the webview content (ChatGPT, Gemini etc) only shows about 20% of the window height. The rest is black/empty space.

## WHAT TO DO

1. First, read ui/index.html and understand the current CSS for webview mode
2. Find all CSS rules that affect: #webviewContainer, webview elements, .response-area, body.webview-mode
3. The webview must fill ALL available vertical space below the tab bar
4. Key constraint: webview is an Electron `<webview>` tag (replaced element), not a regular div
5. Test approach: `<webview>` elements need explicit width and height set via style attribute or CSS. They do NOT respond to flex like regular elements.

## KNOWN ISSUE

The `<webview>` tag in Electron does not participate in CSS flex layout. It needs explicit pixel or viewport-relative dimensions. The container must also have explicit dimensions.

## APPROACH

Set explicit dimensions using JavaScript after creating the webview:
- Calculate available height: window.innerHeight - topbar height - tab bar height
- Set webview style.height to that value
- Add resize listener to recalculate on window resize

Or use CSS: give the container and webview `position: fixed` or `absolute` with explicit `top`, `bottom`, `left`, `right`.

## Rules
- Vanilla JS only
- Read the code first
- Make it work, not pretty
