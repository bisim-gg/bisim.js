import { describe, expect, it } from 'vitest';
import {
  ActionRow,
  ActionRowBuilder,
  ApplicationCommandType,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  Colors,
  ContextMenuCommandBuilder,
  EmbedBuilder,
  InteractionContextType,
  ModalBuilder,
  PermissionFlagsBits,
  RoleSelectMenuBuilder,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder,
} from '../src/index.js';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { MessagePayload } from '../src/index.js';
import { toBisimEmbed } from '../src/builders/EmbedBuilder.js';

describe('SlashCommandBuilder', () => {
  it('builds options of every type in Bisim JSON', () => {
    const command = new SlashCommandBuilder()
      .setName('settings')
      .setDescription('Change settings')
      .setNameLocalizations({ fa: 'تنظیمات', 'en-US': 'settings' })
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .setContexts(InteractionContextType.Guild)
      .setNSFW(false)
      .addStringOption((option) =>
        option
          .setName('mode')
          .setDescription('Mode')
          .setRequired(true)
          .addChoices({ name: 'Fast', value: 'fast' }, { name: 'Slow', value: 'slow', name_localizations: { fa: 'آهسته' } })
          .setMinLength(2)
          .setMaxLength(10),
      )
      .addIntegerOption((option) => option.setName('count').setDescription('Count').setMinValue(1).setMaxValue(10))
      .addNumberOption((option) => option.setName('ratio').setDescription('Ratio').setAutocomplete(true))
      .addBooleanOption((option) => option.setName('quiet').setDescription('Quiet'))
      .addUserOption((option) => option.setName('user').setDescription('User'))
      .addChannelOption((option) => option.setName('channel').setDescription('Channel').addChannelTypes(ChannelType.GuildText, ChannelType.GuildVoice))
      .addRoleOption((option) => option.setName('role').setDescription('Role'))
      .addMentionableOption((option) => option.setName('who').setDescription('Who'))
      .addAttachmentOption((option) => option.setName('file').setDescription('File'));

    expect(command.name).toBe('settings');
    expect(command.toJSON()).toEqual({
      name: 'settings',
      description: 'Change settings',
      defaultMemberPermissions: '32',
      contexts: ['GUILD'],
      nameLocalizations: { fa: 'تنظیمات', en: 'settings' },
      options: [
        {
          type: 'STRING',
          name: 'mode',
          description: 'Mode',
          required: true,
          choices: [
            { name: 'Fast', value: 'fast' },
            { name: 'Slow', value: 'slow', nameLocalizations: { fa: 'آهسته' } },
          ],
          minLength: 2,
          maxLength: 10,
        },
        { type: 'INTEGER', name: 'count', description: 'Count', minValue: 1, maxValue: 10 },
        { type: 'NUMBER', name: 'ratio', description: 'Ratio', autocomplete: true },
        { type: 'BOOLEAN', name: 'quiet', description: 'Quiet' },
        { type: 'USER', name: 'user', description: 'User' },
        { type: 'CHANNEL', name: 'channel', description: 'Channel', channelTypes: ['GUILD_TEXT', 'GUILD_VOICE'] },
        { type: 'ROLE', name: 'role', description: 'Role' },
        { type: 'MENTIONABLE', name: 'who', description: 'Who' },
        { type: 'ATTACHMENT', name: 'file', description: 'File' },
      ],
    });
  });

  it('builds subcommands and groups', () => {
    const command = new SlashCommandBuilder()
      .setName('info')
      .setDescription('Get info')
      .addSubcommand((sub) => sub.setName('user').setDescription('About a user').addUserOption((option) => option.setName('target').setDescription('Who')))
      .addSubcommandGroup((group) =>
        group
          .setName('server')
          .setDescription('About the server')
          .addSubcommand((sub) => sub.setName('roles').setDescription('Roles')),
      );
    expect(command.toJSON().options).toEqual([
      { type: 'SUB_COMMAND', name: 'user', description: 'About a user', options: [{ type: 'USER', name: 'target', description: 'Who' }] },
      { type: 'SUB_COMMAND_GROUP', name: 'server', description: 'About the server', options: [{ type: 'SUB_COMMAND', name: 'roles', description: 'Roles' }] },
    ]);
  });

  it('turns setDMPermission(false) into the guild context', () => {
    const json = new SlashCommandBuilder().setName('a').setDescription('b').setDMPermission(false).toJSON();
    expect(json.contexts).toEqual(['GUILD']);
  });

  it('refuses names Bisim refuses', () => {
    expect(() => new SlashCommandBuilder().setName('Bad Name')).toThrow(/Invalid command name/);
    expect(() => new SlashCommandBuilder().setName('ok').setDescription('')).toThrow(/description/);
  });

  it('builds context menu commands', () => {
    const json = new ContextMenuCommandBuilder().setName('User Information').setType(ApplicationCommandType.User).setDefaultMemberPermissions('0').toJSON();
    expect(json).toEqual({ name: 'User Information', type: 2, defaultMemberPermissions: '0' });
  });
});

describe('EmbedBuilder', () => {
  it('builds the discord.js shape and converts to Bisim', () => {
    const embed = new EmbedBuilder()
      .setColor(Colors.Blue)
      .setTitle('Some title')
      .setURL('https://bisim.gg/')
      .setAuthor({ name: 'Some name', url: 'https://bisim.gg' })
      .setDescription('Some description here')
      .addFields({ name: 'Regular field title', value: 'Some value here' }, { name: 'Inline', value: 'Yes', inline: true })
      .setTimestamp(new Date('2026-11-14T00:00:00.000Z'))
      .setFooter({ text: 'Some footer text here' });
    expect(embed.data.title).toBe('Some title');
    expect(embed.toJSON().fields).toHaveLength(2);
    expect(toBisimEmbed(embed)).toEqual({
      title: 'Some title',
      description: 'Some description here',
      url: 'https://bisim.gg/',
      color: Colors.Blue,
      timestamp: '2026-11-14T00:00:00.000Z',
      author: { name: 'Some name', url: 'https://bisim.gg' },
      footer: { text: 'Some footer text here' },
      fields: [
        { name: 'Regular field title', value: 'Some value here', inline: false },
        { name: 'Inline', value: 'Yes', inline: true },
      ],
    });
  });

  it('keeps images but warns once that Bisim does not show them', () => {
    const warnings: string[] = [];
    const listener = (warning: Error) => warnings.push(warning.message);
    process.on('warning', listener);
    const embed = new EmbedBuilder().setImage('https://example.com/a.png').setThumbnail('https://example.com/b.png');
    expect(embed.data.image?.url).toBe('https://example.com/a.png');
    expect(toBisimEmbed(embed)).toEqual({});
    return new Promise<void>((resolve) => {
      setImmediate(() => {
        process.off('warning', listener);
        expect(warnings.some((message) => message.includes('not shown on Bisim'))).toBe(true);
        resolve();
      });
    });
  });

  it('enforces the limits', () => {
    expect(() => new EmbedBuilder().setTitle('x'.repeat(257))).toThrow();
    expect(() => new EmbedBuilder().addFields(...Array.from({ length: 26 }, (_, index) => ({ name: `n${index}`, value: 'v' })))).toThrow();
  });
});

describe('component builders', () => {
  it('builds buttons and rows in camelCase', () => {
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('confirm').setLabel('Confirm Ban').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary).setEmoji('<:no:123>'),
      new ButtonBuilder().setURL('https://bisim.gg').setLabel('Site').setStyle(ButtonStyle.Link),
    );
    expect(row.toJSON()).toEqual({
      type: 1,
      components: [
        { type: 2, style: 4, label: 'Confirm Ban', customId: 'confirm' },
        { type: 2, style: 2, label: 'Cancel', customId: 'cancel', emoji: { id: '123', name: 'no' } },
        { type: 2, style: 5, label: 'Site', url: 'https://bisim.gg' },
      ],
    });
  });

  it('refuses invalid buttons', () => {
    expect(() => new ButtonBuilder().setLabel('x').setStyle(ButtonStyle.Primary).toJSON()).toThrow();
    expect(() => new ButtonBuilder().setCustomId('a').setLabel('x').setStyle(ButtonStyle.Link).toJSON()).toThrow();
  });

  it('builds select menus', () => {
    const select = new StringSelectMenuBuilder()
      .setCustomId('starter')
      .setPlaceholder('Make a selection!')
      .setMinValues(1)
      .setMaxValues(2)
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel('Bulbasaur').setDescription('The dual-type Grass/Poison Seed Pokemon.').setValue('bulbasaur'),
        { label: 'Charmander', value: 'charmander', default: true },
      );
    expect(select.toJSON()).toEqual({
      type: 3,
      customId: 'starter',
      placeholder: 'Make a selection!',
      minValues: 1,
      maxValues: 2,
      options: [
        { label: 'Bulbasaur', description: 'The dual-type Grass/Poison Seed Pokemon.', value: 'bulbasaur' },
        { label: 'Charmander', value: 'charmander', default: true },
      ],
    });
    expect(new UserSelectMenuBuilder().setCustomId('u').toJSON()).toEqual({ type: 5, customId: 'u' });
    expect(new RoleSelectMenuBuilder().setCustomId('r').setDisabled().toJSON()).toEqual({ type: 6, customId: 'r', disabled: true });
    expect(new ChannelSelectMenuBuilder().setCustomId('c').addChannelTypes(ChannelType.GuildText).toJSON()).toEqual({
      type: 8,
      customId: 'c',
      channelTypes: ['GUILD_TEXT'],
    });
  });

  it('copies received components to change them', () => {
    const row = new ActionRow({ type: 1, components: [{ type: 2, style: 1, label: 'Go', customId: 'go' }] });
    const button = ButtonBuilder.from(row.components[0]!).setDisabled(true);
    expect(button.toJSON()).toEqual({ type: 2, style: 1, label: 'Go', customId: 'go', disabled: true });
    const copy = ActionRowBuilder.from(row);
    expect(copy.components).toHaveLength(1);
    expect(copy.toJSON()).toEqual({ type: 1, components: [{ type: 2, style: 1, label: 'Go', customId: 'go' }] });
  });

  it('reads Discord snake_case JSON', () => {
    const row = ActionRowBuilder.from({ type: 1, components: [{ type: 2, style: 1, custom_id: 'x', label: 'X' }] });
    expect(row.toJSON()).toEqual({ type: 1, components: [{ type: 2, style: 1, customId: 'x', label: 'X' }] });
  });

  it('builds modals with text inputs', () => {
    const modal = new ModalBuilder()
      .setCustomId('myModal')
      .setTitle('My Modal')
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId('favoriteColor').setLabel("What's your favorite color?").setStyle(TextInputStyle.Short).setRequired(true),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId('hobbies').setLabel("What's some of your favorite hobbies?").setStyle(TextInputStyle.Paragraph).setMaxLength(1000),
        ),
      );
    expect(modal.toJSON()).toEqual({
      customId: 'myModal',
      title: 'My Modal',
      components: [
        { type: 1, components: [{ type: 4, customId: 'favoriteColor', label: "What's your favorite color?", style: 1, required: true }] },
        { type: 1, components: [{ type: 4, customId: 'hobbies', label: "What's some of your favorite hobbies?", style: 2, maxLength: 1000 }] },
      ],
    });
  });
});

describe('AttachmentBuilder', () => {
  it('handles names and spoilers', () => {
    const file = new AttachmentBuilder(Buffer.from('hello'), { name: 'hello.txt', description: 'greeting' });
    expect(file.spoiler).toBe(false);
    file.setSpoiler();
    expect(file.name).toBe('SPOILER_hello.txt');
    expect(file.spoiler).toBe(true);
    file.setSpoiler(false);
    expect(file.name).toBe('hello.txt');
    expect(AttachmentBuilder.from(file).description).toBe('greeting');
  });
});

describe('file resolution', () => {
  it('reads Buffers, paths, streams and attachment objects', async () => {
    const fromBuffer = await MessagePayload.resolveFile(Buffer.from('abc'));
    expect(fromBuffer).toEqual({ name: 'file.jpg', data: Buffer.from('abc') });
    const path = fileURLToPath(new URL('../LICENSE', import.meta.url));
    const fromPath = await MessagePayload.resolveFile(path);
    expect(fromPath.name).toBe('LICENSE');
    expect(String(fromPath.data)).toContain('MIT License');
    const fromStream = await MessagePayload.resolveFile({ attachment: Readable.from([Buffer.from('st'), Buffer.from('ream')]), name: 's.txt', description: 'alt' });
    expect(fromStream).toEqual({ name: 's.txt', data: Buffer.from('stream'), description: 'alt' });
    await expect(MessagePayload.resolveFile('./does-not-exist.png')).rejects.toThrow(/could not be found/);
  });

  it('refuses files where Bisim takes none', async () => {
    const payload = MessagePayload.create({ id: '1' }, { content: 'x', files: [Buffer.from('a')] }, {}, 'interaction');
    await expect(payload.resolveFiles()).rejects.toThrow(/Files in interaction replies: not supported on Bisim/);
  });
});
