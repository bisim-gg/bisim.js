# Interactions URL

By default, interactions reach your bot over the gateway, the same WebSocket that brings messages and other
events. You can instead give your application an **Interactions URL**: Bisim then sends every interaction as
a signed HTTP POST to that address, and nothing over the gateway.

Use it when your bot runs as a web service that answers commands and does not need to stay connected.

## Setting it up

1. In the Developer Portal ([bisim.gg/developers](https://bisim.gg/developers)), open your application's
   **General Information** page and fill in **Interactions Endpoint URL** with a public `https` address.
2. Bisim checks the address when you save it: it sends a **PING** that must be answered with `{ "type": 1 }`,
   and a request with a deliberately bad signature that must be refused with status 401.
3. Copy the **public key** from the same page. You need it to check signatures.

## Checking signatures

Every request carries an Ed25519 signature of the timestamp followed by the raw body, in the
`X-Signature-Ed25519` and `X-Signature-Timestamp` headers. It is Discord's scheme exactly. `verifyKey`
checks it:

```js
const { verifyKey } = require('bisim.js');

const valid = await verifyKey(rawBody, signature, timestamp, process.env.BISIM_PUBLIC_KEY);
```

Always use the body **exactly as received**, before parsing it.

## A complete server

`client.handleInteraction()` takes the request body and emits `interactionCreate` just like the gateway
does, so the rest of your bot stays the same. It returns `{ type: 1 }` for a PING:

```js
const { createServer } = require('node:http');
const { Client, Events, verifyKey } = require('bisim.js');

const client = new Client({ intents: [] });
client.rest.setToken(process.env.BISIM_TOKEN);

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isChatInputCommand() && interaction.commandName === 'ping') {
    await interaction.reply('Pong, over HTTP.');
  }
});

createServer((req, res) => {
  let body = '';
  req.on('data', (chunk) => (body += chunk));
  req.on('end', async () => {
    const valid = await verifyKey(
      body,
      req.headers['x-signature-ed25519'],
      req.headers['x-signature-timestamp'],
      process.env.BISIM_PUBLIC_KEY,
    );
    if (!valid) {
      res.writeHead(401).end('invalid request signature');
      return;
    }
    const answer = client.handleInteraction(body);
    res.writeHead(200, { 'content-type': 'application/json' }).end(answer ? JSON.stringify(answer) : '{}');
  });
}).listen(8787);
```

Bisim waits up to three seconds for the HTTP response. Answer the request first, as above, and let the
interaction methods (`reply`, `deferReply` and the rest) send the real answer through Bisim's API.

::: tip Logging in is optional
A bot that only answers interactions does not need `client.login()`. Setting the token on `client.rest`, as
above, is enough for commands to be registered and answered. Call `login()` if you also want events,
caches and the rest of the gateway.
:::

## Going back to the gateway

Clear the Interactions URL in the application settings. From then on, interactions arrive over the gateway
again as `interactionCreate`.
