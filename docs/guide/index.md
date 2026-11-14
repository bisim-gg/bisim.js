# Introduction

bisim.js is the official Node.js library for building bots on [Bisim](https://bisim.gg). Its public surface
follows discord.js v14: the same classes, methods, events, option objects and builders. If you have written
a discord.js bot before, you already know how to write a Bisim bot.

```js
const { Client, Events, GatewayIntentBits } = require('bisim.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, (readyClient) => {
  console.log(`${readyClient.user.tag} is online.`);
});

client.login(process.env.BISIM_TOKEN);
```

## How bisim.js works

Underneath, bisim.js talks to Bisim's own REST API and gateway. Bisim uses its own JSON shapes (camelCase,
ids as strings) but Discord's numbers for types, flags and permission bits, so bisim.js can turn every Bisim
object into the discord.js object you expect: a `Message`, a `GuildMember`, a `ChatInputCommandInteraction`.

Some things exist on Discord but not on Bisim, such as threads, stage channels and scheduled events.
bisim.js never ignores them silently: calling them throws a `BisimjsError` that says the feature is not
supported on Bisim. The [Moving from discord.js](./moving-from-discord-js.md) page lists all of them.

## How this guide is laid out

- **Getting started** installs Node.js and bisim.js, creates your application in Bisim and runs a first bot.
- **Slash commands** builds, registers and answers commands, with options, autocomplete, permissions and
  Persian and English names.
- **Interactions** covers context menu commands, buttons, select menus, modals and receiving interactions
  over HTTP.
- **Topics** explains events, embeds, messages, members and roles, collectors and how the gateway works on
  Bisim.
- **Voice** joins voice channels with @bisim/voice, plays audio and receives what others say.

Every code sample is plain JavaScript (CommonJS). bisim.js ships its own types, so the same code works in
TypeScript, and `import` works as well as `require`.

## Before you start

You need:

- [Node.js](https://nodejs.org) 18 or newer.
- A Bisim account and a server where you can add a bot (you need the Manage Server permission there).
- A little JavaScript: functions, objects, `async` and `await`.

When you are ready, continue with [Installing](./installing.md).
