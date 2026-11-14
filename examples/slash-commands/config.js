// Everything comes from the environment, so no secret ends up in a file:
//   BISIM_TOKEN      the bot token (Settings > Applications on Bisim)
//   BISIM_CLIENT_ID  the application id (the same as the bot's user id)
//   BISIM_GUILD_ID   a server to register the commands in (instant); leave it out for global commands
//   BISIM_API        optional, for example http://localhost:3000/api for a local Bisim
//   BISIM_WS         optional, for example ws://localhost:4000/ws for a local Bisim
module.exports = {
  token: process.env.BISIM_TOKEN,
  clientId: process.env.BISIM_CLIENT_ID,
  guildId: process.env.BISIM_GUILD_ID,
  api: process.env.BISIM_API,
  gateway: process.env.BISIM_WS,
};
