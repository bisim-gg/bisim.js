import { describe, expect, it } from 'vitest';
import {
  BisimjsError,
  BisimjsRangeError,
  BitField,
  ChannelType,
  Collection,
  Colors,
  ErrorCodes,
  GatewayIntentBits,
  IntentsBitField,
  MessageFlags,
  MessageFlagsBitField,
  PermissionFlagsBits,
  PermissionsBitField,
  SnowflakeUtil,
  TimestampStyles,
  blockQuote,
  bold,
  channelMention,
  codeBlock,
  escapeMarkdown,
  formatEmoji,
  heading,
  hyperlink,
  inlineCode,
  italic,
  messageLink,
  orderedList,
  parseEmoji,
  quote,
  resolveColor,
  roleMention,
  spoiler,
  strikethrough,
  time,
  underline,
  unorderedList,
  userMention,
} from '../src/index.js';
import { channelTypeFromBisim, channelTypeToBisim, optionTypeToBisim, toBisimCommand } from '../src/util/Transformers.js';

describe('Collection', () => {
  const coll = new Collection<string, number>([
    ['a', 1],
    ['b', 2],
    ['c', 3],
  ]);

  it('reads the first and last entries', () => {
    expect(coll.first()).toBe(1);
    expect(coll.first(2)).toEqual([1, 2]);
    expect(coll.last()).toBe(3);
    expect(coll.last(2)).toEqual([2, 3]);
    expect(coll.firstKey()).toBe('a');
    expect(coll.lastKey()).toBe('c');
    expect(coll.at(-1)).toBe(3);
    expect(coll.keyAt(1)).toBe('b');
  });

  it('filters, maps and reduces like an array', () => {
    expect([...coll.filter((value) => value > 1).keys()]).toEqual(['b', 'c']);
    expect(coll.map((value) => value * 2)).toEqual([2, 4, 6]);
    expect(coll.mapValues((value) => value * 10).get('b')).toBe(20);
    expect(coll.reduce((sum, value) => sum + value, 0)).toBe(6);
    expect(coll.find((value) => value === 2)).toBe(2);
    expect(coll.findKey((value) => value === 3)).toBe('c');
    expect(coll.some((value) => value > 2)).toBe(true);
    expect(coll.every((value) => value > 2)).toBe(false);
    const [big, small] = coll.partition((value) => value >= 2);
    expect(big.size).toBe(2);
    expect(small.size).toBe(1);
  });

  it('compares and combines collections', () => {
    const other = new Collection<string, number>([
      ['b', 2],
      ['d', 4],
    ]);
    expect([...coll.intersect(other).keys()]).toEqual(['b']);
    expect([...coll.subtract(other).keys()]).toEqual(['a', 'c']);
    expect([...coll.difference(other).keys()].sort()).toEqual(['a', 'c', 'd']);
    expect(coll.concat(other).size).toBe(4);
    expect(coll.clone().equals(coll)).toBe(true);
    expect(coll.ensure('z', () => 26)).toBe(26);
    coll.delete('z');
  });

  it('sorts in place and copies', () => {
    const unsorted = new Collection<string, number>([
      ['x', 3],
      ['y', 1],
      ['z', 2],
    ]);
    expect([...unsorted.sorted((a, b) => a - b).values()]).toEqual([1, 2, 3]);
    expect([...unsorted.values()]).toEqual([3, 1, 2]);
    unsorted.sort((a, b) => b - a);
    expect([...unsorted.values()]).toEqual([3, 2, 1]);
    expect(unsorted.toJSON()).toEqual([3, 2, 1]);
  });
});

describe('BitField', () => {
  it('resolves flags, numbers and arrays', () => {
    const intents = new IntentsBitField([GatewayIntentBits.Guilds, 'GuildMessages', GatewayIntentBits.MessageContent]);
    expect(intents.has(GatewayIntentBits.Guilds)).toBe(true);
    expect(intents.has('GuildMembers')).toBe(false);
    expect(intents.toArray()).toEqual(['Guilds', 'GuildMessages', 'MessageContent']);
    expect(intents.bitfield).toBe(1 | (1 << 9) | (1 << 15));
    expect(intents.add('GuildMembers').has('GuildMembers')).toBe(true);
    expect(intents.remove('GuildMembers').has('GuildMembers')).toBe(false);
  });

  it('keeps frozen bit fields immutable', () => {
    const frozen = new IntentsBitField(1).freeze();
    const added = frozen.add(2);
    expect(frozen.bitfield).toBe(1);
    expect(added.bitfield).toBe(3);
  });

  it('throws a BisimjsRangeError on unknown flags', () => {
    expect(() => new IntentsBitField('NotAnIntent' as never)).toThrow(BisimjsRangeError);
    try {
      BitField.resolve('Nope');
    } catch (error) {
      expect((error as InstanceType<typeof BisimjsRangeError>).code).toBe(ErrorCodes.BitFieldInvalid);
      expect((error as Error).name).toBe('RangeError [BitFieldInvalid]');
    }
  });

  it('reads message flags', () => {
    const flags = new MessageFlagsBitField(MessageFlags.Ephemeral);
    expect(flags.has('Ephemeral')).toBe(true);
    expect(flags.bitfield).toBe(64);
  });
});

describe('PermissionsBitField', () => {
  it('uses Discord bit numbers', () => {
    expect(PermissionFlagsBits.Administrator).toBe(8n);
    expect(PermissionFlagsBits.ManageGuild).toBe(32n);
    expect(PermissionFlagsBits.ModerateMembers).toBe(1n << 40n);
    expect(PermissionFlagsBits.PokeMembers).toBe(1n << 60n);
  });

  it('lets administrator override by default', () => {
    const admin = new PermissionsBitField(PermissionFlagsBits.Administrator);
    expect(admin.has(PermissionFlagsBits.BanMembers)).toBe(true);
    expect(admin.has(PermissionFlagsBits.BanMembers, false)).toBe(false);
    expect(admin.missing([PermissionFlagsBits.KickMembers])).toEqual([]);
    expect(admin.toArray()).toEqual(['Administrator']);
  });

  it('resolves names, strings and bigints', () => {
    const permissions = new PermissionsBitField(['SendMessages', '1024', 2n]);
    expect(permissions.has('ViewChannel')).toBe(true);
    expect(permissions.has('KickMembers')).toBe(true);
    expect(permissions.missing(['SendMessages', 'BanMembers'])).toEqual(['BanMembers']);
    expect(permissions.toJSON()).toBe(String((1n << 11n) | (1n << 10n) | 2n));
    expect(PermissionsBitField.resolve('ManageRoles')).toBe(1n << 28n);
  });
});

describe('SnowflakeUtil', () => {
  it('uses Bisim epoch', () => {
    expect(SnowflakeUtil.epoch).toBe(1_780_272_000_000n);
    const timestamp = Date.UTC(2026, 10, 14, 12, 0, 0);
    const id = SnowflakeUtil.generate({ timestamp, workerId: 5n, increment: 7n });
    expect(id).toBe(((BigInt(timestamp) - 1_780_272_000_000n) << 22n) | (5n << 12n) | 7n);
    expect(SnowflakeUtil.timestampFrom(id)).toBe(timestamp);
    const parts = SnowflakeUtil.deconstruct(id.toString());
    expect(parts.workerId).toBe(5n);
    expect(parts.increment).toBe(7n);
    expect(parts.timestamp).toBe(BigInt(timestamp));
  });

  it('compares snowflakes', () => {
    expect(SnowflakeUtil.compare('1', '2')).toBe(-1);
    expect(SnowflakeUtil.compare('2', '2')).toBe(0);
    expect(SnowflakeUtil.compare(3n, '2')).toBe(1);
  });
});

describe('formatters', () => {
  it('formats markdown', () => {
    expect(bold('a')).toBe('**a**');
    expect(italic('a')).toBe('_a_');
    expect(underline('a')).toBe('__a__');
    expect(strikethrough('a')).toBe('~~a~~');
    expect(spoiler('a')).toBe('||a||');
    expect(inlineCode('a')).toBe('`a`');
    expect(codeBlock('a')).toBe('```\na\n```');
    expect(codeBlock('js', 'a')).toBe('```js\na\n```');
    expect(quote('a')).toBe('> a');
    expect(blockQuote('a')).toBe('>>> a');
    expect(hyperlink('a', 'https://bisim.gg')).toBe('[a](https://bisim.gg)');
    expect(hyperlink('a', 'https://bisim.gg', 't')).toBe('[a](https://bisim.gg "t")');
    expect(heading('a', 2)).toBe('## a');
    expect(unorderedList(['a', ['b']])).toBe('- a\n  - b');
    expect(orderedList(['a', 'b'])).toBe('1. a\n2. b');
  });

  it('formats mentions and tokens', () => {
    expect(userMention('1')).toBe('<@1>');
    expect(channelMention('2')).toBe('<#2>');
    expect(roleMention('3')).toBe('<@&3>');
    expect(formatEmoji('4')).toBe('<:_:4>');
    expect(formatEmoji({ id: '4', name: 'wave', animated: true })).toBe('<a:wave:4>');
    expect(messageLink('1', '2', '3')).toBe('https://bisim.gg/channels/3/1/2');
    expect(messageLink('1', '2')).toBe('https://bisim.gg/channels/@me/1/2');
  });

  it('formats timestamps', () => {
    const date = new Date(1_700_000_000_000);
    expect(time(date)).toBe('<t:1700000000>');
    expect(time(date, TimestampStyles.RelativeTime)).toBe('<t:1700000000:R>');
    expect(time(1_700_000_000, 'f')).toBe('<t:1700000000:f>');
  });

  it('escapes markdown', () => {
    expect(escapeMarkdown('**hi** _there_ ||x||')).toBe('\\*\\*hi\\*\\* \\_there\\_ \\|\\|x\\|\\|');
  });
});

describe('utilities', () => {
  it('names bisim.js errors with their code', () => {
    const error = new BisimjsError(ErrorCodes.NotSupported, 'Threads');
    expect(error.message).toBe('Threads: not supported on Bisim.');
    expect(error.name).toBe('Error [NotSupported]');
    expect(error.code).toBe('NotSupported');
    expect(error).toBeInstanceOf(Error);
  });

  it('resolves colors', () => {
    expect(resolveColor('#ff0000')).toBe(0xff0000);
    expect(resolveColor([0, 255, 0])).toBe(0x00ff00);
    expect(resolveColor('Blurple')).toBe(Colors.Blurple);
    expect(resolveColor(123)).toBe(123);
    expect(() => resolveColor(0x1000000)).toThrow();
  });

  it('parses emoji', () => {
    expect(parseEmoji('<:wave:123>')).toEqual({ animated: false, name: 'wave', id: '123' });
    expect(parseEmoji('<a:wave:123>')).toEqual({ animated: true, name: 'wave', id: '123' });
    expect(parseEmoji('👍')).toEqual({ animated: false, name: '👍', id: undefined });
  });

  it('maps channel and option types to Bisim names', () => {
    expect(channelTypeFromBisim('GUILD_TEXT')).toBe(ChannelType.GuildText);
    expect(channelTypeFromBisim('GUILD_CATEGORY')).toBe(ChannelType.GuildCategory);
    expect(channelTypeToBisim(ChannelType.GuildVoice)).toBe('GUILD_VOICE');
    expect(channelTypeToBisim(ChannelType.PublicThread)).toBeNull();
    expect(optionTypeToBisim(3)).toBe('STRING');
    expect(optionTypeToBisim('SUB_COMMAND_GROUP')).toBe('SUB_COMMAND_GROUP');
  });

  it('converts Discord command JSON to Bisim command JSON', () => {
    const command = toBisimCommand({
      name: 'ban',
      description: 'Ban someone',
      default_member_permissions: '4',
      dm_permission: false,
      name_localizations: { 'en-US': 'ban', fa: 'بن', fr: 'bannir' },
      options: [
        { type: 6, name: 'target', description: 'Who', required: true },
        { type: 4, name: 'days', description: 'Days', min_value: 0, max_value: 7 },
        { type: 7, name: 'where', description: 'Where', channel_types: [0, 2, 11] },
      ],
    });
    expect(command).toEqual({
      name: 'ban',
      description: 'Ban someone',
      defaultMemberPermissions: '4',
      contexts: ['GUILD'],
      nameLocalizations: { en: 'ban', fa: 'بن' },
      options: [
        { type: 'USER', name: 'target', description: 'Who', required: true },
        { type: 'INTEGER', name: 'days', description: 'Days', minValue: 0, maxValue: 7 },
        { type: 'CHANNEL', name: 'where', description: 'Where', channelTypes: ['GUILD_TEXT', 'GUILD_VOICE'] },
      ],
    });
  });
});
