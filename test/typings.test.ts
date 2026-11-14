import { describe, expect, it } from 'vitest';
import {
  type ChatInputCommandInteraction,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  type Guild,
  type GuildMember,
  type Message,
  MessageFlags,
  PermissionFlagsBits,
  type TextChannel,
} from '../src/index.js';

/**
 * These handlers are written exactly as a discord.js v14 bot in TypeScript would write them. They are not
 * run: `npm run typecheck` checks that they compile against bisim.js's types.
 */
function guideStyleBot(): Client {
  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

  client.once(Events.ClientReady, (readyClient) => {
    const tag: string = readyClient.user.tag;
    const when: Date = readyClient.readyAt;
    void tag;
    void when;
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    const typed: ChatInputCommandInteraction = interaction;
    const maybe: string | null = typed.options.getString('text');
    const sure: string = typed.options.getString('text', true);
    void maybe;
    void sure;
    const message: Message = await interaction.reply({ content: 'hi', fetchReply: true });
    await message.edit('edited');
    const response = await interaction.followUp({ content: 'more', flags: MessageFlags.Ephemeral });
    await response.delete();
    await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('x')] });
    if (interaction.inCachedGuild()) {
      const guild: Guild = interaction.guild;
      const member: GuildMember = interaction.member;
      const canKick: boolean = member.permissions.has(PermissionFlagsBits.KickMembers);
      void guild;
      void canKick;
    }
  });

  client.on(Events.MessageCreate, async (message) => {
    if (message.author?.bot) return;
    if (message.inGuild()) {
      const name: string = message.guild.name;
      void name;
    }
    const channel = message.channel as TextChannel;
    await channel.send({ content: 'hello', embeds: [{ title: 'raw json works too' }] });
    await message.reply('pong');
  });

  client.on(Events.MessageUpdate, (oldMessage, newMessage) => {
    void oldMessage.content;
    void newMessage.content;
  });

  client.on(Events.GuildMemberUpdate, (oldMember, newMember) => {
    void oldMember.nickname;
    void newMember.roles.cache.size;
  });

  return client;
}

describe('typings', () => {
  it('compile for a discord.js style bot', () => {
    expect(typeof guideStyleBot).toBe('function');
  });
});
