// Registers every command in ./commands with Bisim: in one server when BISIM_GUILD_ID is set (instant),
// globally otherwise. Run it again after changing a command's name, description or options.
const fs = require('node:fs');
const path = require('node:path');
const { REST, Routes } = require('bisim.js');
const { api, clientId, guildId, token } = require('./config.js');

const body = fs
  .readdirSync(path.join(__dirname, 'commands'))
  .filter((file) => file.endsWith('.js'))
  .map((file) => require(path.join(__dirname, 'commands', file)).data.toJSON());

const route = guildId ? Routes.applicationGuildCommands(clientId, guildId) : Routes.applicationCommands(clientId);

new REST(api ? { api } : {})
  .setToken(token)
  .put(route, { body })
  .then((saved) => console.log(`Registered ${saved.length} commands${guildId ? ' in the test server' : ' globally'}.`))
  .catch((error) => {
    console.error('Could not register the commands:', error);
    process.exitCode = 1;
  });
