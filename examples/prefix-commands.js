// A prefix command bot that reads messageCreate, the classic way.
//   BISIM_TOKEN comes from the environment (BISIM_API / BISIM_WS for a local Bisim).
const { Client, EmbedBuilder, Events, GatewayIntentBits, PermissionFlagsBits } = require('bisim.js');

const prefix = '!';
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  rest: process.env.BISIM_API ? { api: process.env.BISIM_API } : undefined,
  ws: process.env.BISIM_WS ? { gateway: process.env.BISIM_WS } : undefined,
});

client.once(Events.ClientReady, (readyClient) => {
  console.log(`${readyClient.user.tag} is online.`);
  readyClient.user.setActivity('!help');
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.content.startsWith(prefix)) return;
  const [name, ...args] = message.content.slice(prefix.length).trim().split(/\s+/);

  switch (name?.toLowerCase()) {
    case 'help':
      await message.reply('Commands: !ping, !avatar [@user], !server, !react, !purge <count>, !kick @user [reason]');
      break;

    case 'ping': {
      const sent = await message.reply('Pinging...');
      await sent.edit(`Pong! Round trip ${sent.createdTimestamp - message.createdTimestamp}ms, gateway ${client.ws.ping}ms`);
      break;
    }

    case 'avatar': {
      const user = message.mentions.users.first() ?? message.author;
      await message.reply(user.displayAvatarURL({ size: 256 }));
      break;
    }

    case 'server': {
      if (!message.inGuild()) return;
      const card = new EmbedBuilder()
        .setTitle(message.guild.name)
        .setDescription(`${message.guild.memberCount} members, ${message.guild.roles.cache.size} roles`)
        .setColor('Blurple');
      await message.channel.send({ embeds: [card] });
      break;
    }

    case 'react':
      await message.react('👍');
      break;

    case 'purge': {
      if (!message.inGuild() || !message.member?.permissions.has(PermissionFlagsBits.ManageMessages)) return;
      const count = Math.min(100, Math.max(2, Number(args[0]) || 2));
      const deleted = await message.channel.bulkDelete(count, true);
      await message.channel.send(`Deleted ${deleted.size} messages.`);
      break;
    }

    case 'kick': {
      if (!message.inGuild() || !message.member?.permissions.has(PermissionFlagsBits.KickMembers)) return;
      const target = message.mentions.members?.first();
      if (!target) return message.reply('Mention someone to kick.');
      if (!target.kickable) return message.reply('I cannot kick that member.');
      await target.kick(args.slice(1).join(' ') || undefined);
      await message.reply(`Kicked ${target.displayName}.`);
      break;
    }

    default:
      break;
  }
});

client.login(process.env.BISIM_TOKEN);
