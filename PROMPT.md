# AI Gateway v2 - Fix Core Message Flow

Project: `C:/Users/Valent/code/ai-gateway/`

## Critical Bug: sendQuestion() does nothing

In `ui/index.html`, the `sendQuestion()` function clears input but NEVER sends to API or webview. Fix this:

1. When user clicks Send, get selected models from the chip toggles
2. For each selected model, call the API via IPC (`window.aiGateway.sendToModel(platform, question)`)
3. In `main.js`, handle this IPC call: use `api-service.js` to make the actual API request with the user's message
4. Return the response back to the renderer via `window.aiGateway.onUnifiedResponse`
5. Display each model's response in the appropriate panel

## Bug 2: API requests send empty message

In `main.js` around `setupApiMode()`, `makeApiRequest(platformId, '', apiKey)` passes empty string as message. Fix to pass actual user message.

## Bug 3: IPC plumbing broken

- `preload.js` exposes `onUnifiedResponse()` but `main.js` never sends through that channel
- Fix: when API response arrives in main process, send it to renderer via `webContents.send('unified-response', {platform, response})`

## Bug 4: Mode switching incomplete

- `currentMode` uses 'tabs'/'panels' but code checks for 'isolated'
- Fix mode constants to be consistent

## Rules
- Work ONLY in `C:/Users/Valent/code/ai-gateway/`
- Vanilla JS, no frameworks, no npm dependencies beyond electron
- Read existing code BEFORE modifying
- Keep all existing webview/tab functionality intact
- Test by checking that the code is syntactically valid
