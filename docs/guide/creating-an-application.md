# Creating your application

On Bisim, an application **is** its bot: creating an application creates a bot account with the same id.
Commands, the token and the public key all belong to it.

## Create the application

1. Open Bisim and go to **Settings**, then **Applications**.
2. Choose a name for your bot and select **Create**.
3. Bisim shows the **bot token** once. Copy it now and keep it somewhere safe: it is never shown again.

The application page also shows:

- **Public key**: used to check requests if you choose an [Interactions URL](./interactions/interactions-url.md).
- **Interactions URL**: leave it empty to receive interactions over the gateway, which is what most bots do.
- **Servers** and **Commands**: where the bot is, and which commands it has registered.

::: warning Keep the token secret
Anyone with the token controls your bot. If it leaks, select **Reset token** on the application page: the
old token stops working at once, and you put the new one wherever your bot runs.
:::

## Add the bot to a server

There are two ways:

- From the application page, under **Servers**, choose a server you manage and select **Add**.
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
