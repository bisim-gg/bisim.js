# Registering commands

Bisim needs to know your commands before members can see them. You register them once, and again whenever
you change a name, a description or an option. There is no need to do it every time the bot starts.

## The deploy script

Save this script as `deploy-commands.js` next to `index.js`. It finds every command file and registers all of
them in one request:

```js
const fs = require('node:fs');
const path = require('node:path');
const { REST, Routes } = require('bisim.js');

const token = process.env.BISIM_TOKEN;
const clientId = process.env.BISIM_CLIENT_ID; // the application id
const guildId = process.env.BISIM_GUILD_ID; // a server to test in

// The same walk over commands/ as in index.js.
function commandFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return commandFiles(full);
    return entry.name.endsWith('.js') ? [full] : [];
  });
}

const body = commandFiles(path.join(__dirname, 'commands')).map((file) => require(file).data.toJSON());

new REST()
  .setToken(token)
  .put(Routes.applicationGuildCommands(clientId, guildId), { body })
  .then((saved) => console.log(`Registered ${saved.length} commands in the test server.`))
  .catch((error) => console.error('Could not register the commands:', error));
```

Run it with `node deploy-commands.js`. A `PUT` replaces the whole set: commands you leave out are removed.

## Server commands and global commands

- `Routes.applicationGuildCommands(clientId, guildId)` registers commands in one server. Use it while you
  develop.
- `Routes.applicationCommands(clientId)` registers global commands, available in every server the bot is in.

A server command with the same name as a global one takes its place in that server.

## Without REST

The same can be done from a running bot through `client.application.commands`:

```js
client.once(Events.ClientReady, async (readyClient) => {
  const commands = [pingCommand.data, serverCommand.data];
  await readyClient.application.commands.set(commands); // global
  await readyClient.application.commands.set(commands, guildId); // one server
});
```

It also creates, edits and deletes single commands:

```js
const created = await client.application.commands.create(data, guildId);
await client.application.commands.edit(created, { description: 'A better description' }, guildId);
await client.application.commands.delete(created, guildId);
const all = await client.application.commands.fetch();
```

`guild.commands` does the same for one server without passing `guildId`.

## Deleting every command

Register an empty list:

```js
await new REST().setToken(token).put(Routes.applicationCommands(clientId), { body: [] });
```

## Local Bisim

`new REST({ api: 'http://localhost:3000/api' })` points the script at a Bisim running on your machine.
