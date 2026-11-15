# Creating your application

On Bisim, an application **is** its bot: creating an application creates a bot account with the same id.
Commands, the token and the public key all belong to it.

## Create the application

1. Open the **Developer Portal**: in Bisim, go to **Settings**, then **Developer Portal**, or open
   [bisim.gg/developers](https://bisim.gg/developers) directly.
2. Select **New Application**, choose a name for your bot and select **Create**.
3. On the application's **Bot** page, Bisim shows the **bot token** once, right after the application is
   created. Copy it now and keep it somewhere safe: it is never shown again.

The application's other pages:

- **General Information**: the **Public Key**, used to check requests if you choose an
  [Interactions URL](./interactions/interactions-url.md), and the **Interactions Endpoint URL**: leave it empty to
  receive interactions over the gateway, which is what most bots do.
- **Bot**: the bot's picture, banner and token, and its **Privileged Gateway Intents**.
- **Installation**: the install link, and the servers the bot is in.
- **Commands**: the commands it has registered.

::: warning Keep the token secret
Anyone with the token controls your bot. If it leaks, select **Reset Token** on the **Bot** page: the old
token stops working at once, and you put the new one wherever your bot runs.
:::

## Add the bot to a server

There are two ways:

- On the **Installation** page, choose a server you manage and select **Add to Server**.
- With an install link. Anyone who manages a server can open it (if the bot is public) and pick the
  permissions to grant. bisim.js makes the link for you:

```js
const { OAuth2Scopes, PermissionFlagsBits } = require('bisim.js');

const link = client.generateInvite({
  scopes: [OAuth2Scopes.Bot],
  permissions: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.ViewChannel],
});
// https://bisim.gg/oauth2/authorize?client_id=...&permissions=3072&scope=bot
```

When a bot joins, Bisim gives it a role named after it with the granted permissions. Like any member, the
bot can only see and do what its roles allow.

## Ids

The application id and the bot's user id are the same number. You need it as `clientId` in the command
deploy script; once your bot is logged in it is also `client.application.id` and `client.user.id`.

Next: [your first bot](./your-first-bot.md).
