# AI Bot — advanced AI chat

This repository contains the original AI Bot interface plus a small Node.js server that securely connects chat messages to OpenRouter. The API key stays on the server and must never be added to `index.html` or committed to Git.

## What changed

- Restores the original, full-size AI Bot interface instead of the temporary starter page.
- Sends the current conversation history to an AI model for contextual replies.
- Shows a thinking state and useful error messages.
- Keeps chat history and settings in the user's browser as before.
- Adds a server-side API endpoint at `/api/chat`; no third-party packages are required.

## Run it locally

1. Install Node.js 18 or newer.
2. Create an API key with an AI provider supported by OpenRouter: https://openrouter.ai/keys
3. In a terminal, set the key as an environment variable. Do not paste it into source code.

**Windows PowerShell**
```powershell
$env:OPENROUTER_API_KEY="your-key-here"
$env:OPENROUTER_MODEL="openai/gpt-4o-mini"
npm start
```

**Linux/macOS**
```bash
export OPENROUTER_API_KEY="your-key-here"
export OPENROUTER_MODEL="openai/gpt-4o-mini"
npm start
```

4. Open http://localhost:3000

The provider may require credits or impose rate limits. Check the model and usage limits in your provider account.

## Hosting it online

GitHub Pages only hosts static files; it cannot run `server.js` or keep a secret API key. To use real AI online, deploy this repository to a Node.js host that supports environment variables, then set:

- `OPENROUTER_API_KEY` — your private provider key
- `OPENROUTER_MODEL` — optional model ID (defaults to `openai/gpt-4o-mini`)
- `SITE_URL` — optional public website URL sent to the provider
- `PORT` — supplied automatically by many hosts

Use the Node server as the website's web service, not a GitHub Pages deployment. Never commit a real API key. The AI provider may charge for usage, so set spending limits where available.

## Important

The Web Search, image generation, file reading, voice, and other plugin labels in the original interface are not fully implemented integrations yet. The new server provides text chat only; it does not pretend those plugins are active.
