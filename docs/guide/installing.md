# Installing

## Node.js

bisim.js needs Node.js 18 or newer. Check the version you have:

```sh
node --version
```

If the command is missing or the version is older, install the current LTS release from
[nodejs.org](https://nodejs.org).

## A project folder

Create a folder for your bot and a `package.json` inside it:

```sh
mkdir my-bot
cd my-bot
npm init -y
```

## bisim.js

Install the library:

```sh
npm install bisim.js
```

That is the only package a bot needs. bisim.js depends on `ws` for the WebSocket connection and on nothing
else; Node's own `fetch` handles HTTP.

## CommonJS, ES modules and TypeScript

bisim.js ships both module formats and its own type declarations:

::: code-group

```js [CommonJS]
const { Client, GatewayIntentBits } = require('bisim.js');
```

```js [ES modules]
import { Client, GatewayIntentBits } from 'bisim.js';
```

```ts [TypeScript]
import { Client, GatewayIntentBits, type ChatInputCommandInteraction } from 'bisim.js';
```

:::

This guide uses CommonJS in its samples, as the discord.js guide does.

## Keeping the token out of your code

Your bot logs in with a token, which works like a password. Never write it into a file you commit. Put it
in an environment variable instead:

```sh
# Linux and macOS
export BISIM_TOKEN="your token"

# Windows PowerShell
$env:BISIM_TOKEN = "your token"
```

`client.login()` reads `BISIM_TOKEN` when you call it without an argument. If you prefer a file, use a
`.env` file with `node --env-file=.env index.js` (Node 20.6 or newer) and add `.env` to `.gitignore`.

Next: [create your application](./creating-an-application.md) and get its token.
