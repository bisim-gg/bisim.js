import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as bisim from '../src/index.js';

// Expected outputs recorded from an earlier build; the formatters must keep producing exactly these.
const fixture = JSON.parse(readFileSync(new URL('./fixtures/formatters.json', import.meta.url), 'utf8')) as {
  out: [string, bisim.EscapeMarkdownOptions, string][];
  single: [string, string, string][];
  misc: { lists: [string, bisim.RecursiveArray<string>, string][]; wrappers: Record<string, string> };
};

describe('escapeMarkdown', () => {
  it.each(fixture.out)('escapes %j with %j', (text, options, expected) => {
    expect(bisim.escapeMarkdown(text, options)).toBe(expected);
  });
});

describe('the single escapers', () => {
  it.each(fixture.single)('%s(%j)', (name, text, expected) => {
    const escaper = (bisim as unknown as Record<string, (text: string) => string>)[name]!;
    expect(escaper(text)).toBe(expected);
  });
});

describe('lists', () => {
  it.each(fixture.misc.lists)('%s', (name, items, expected) => {
    const start = /from (-?\d+)/.exec(name)?.[1];
    const result = name.startsWith('unordered')
      ? bisim.unorderedList(items)
      : start === undefined
        ? bisim.orderedList(items)
        : bisim.orderedList(items, Number(start));
    expect(result).toBe(expected);
  });
});

describe('wrappers, mentions and links', () => {
  const url = new URL('https://bisim.gg/a?b=1');
  const actual: Record<string, string> = {
    inlineCode: bisim.inlineCode('x'),
    italic: bisim.italic('x'),
    bold: bisim.bold('x'),
    underline: bisim.underline('x'),
    strikethrough: bisim.strikethrough('x'),
    quote: bisim.quote('x'),
    blockQuote: bisim.blockQuote('x'),
    spoiler: bisim.spoiler('x'),
    subtext: bisim.subtext('x'),
    hideLinkEmbed: bisim.hideLinkEmbed('https://bisim.gg'),
    hideLinkEmbedUrl: bisim.hideLinkEmbed(url),
    hyperlinkUrl: bisim.hyperlink('a', url as unknown as string),
    hyperlinkEmptyTitle: bisim.hyperlink('a', 'https://b.c', ''),
    userMention: bisim.userMention('1'),
    channelMention: bisim.channelMention('2'),
    roleMention: bisim.roleMention('3'),
    command2: bisim.chatInputApplicationCommandMention('ping', '9'),
    command3: bisim.chatInputApplicationCommandMention('a', 'b', '9'),
    command4: bisim.chatInputApplicationCommandMention('a', 'b', 'c', '9'),
    channelLink: bisim.channelLink('5'),
    channelLinkGuild: bisim.channelLink('5', '6'),
    messageLink: bisim.messageLink('5', '7'),
    messageLinkGuild: bisim.messageLink('5', '7', '6'),
    heading1: bisim.heading('h'),
    heading3: bisim.heading('h', 3),
    emojiAnimated: bisim.formatEmoji('4', true),
    emojiNamed: bisim.formatEmoji({ id: '4', name: 'n' }),
    codeBlockEmpty: bisim.codeBlock(''),
    shrug: bisim.Faces.Shrug,
    tableflip: bisim.Faces.Tableflip,
    unflip: bisim.Faces.Unflip,
  };

  it.each(Object.keys(fixture.misc.wrappers))('%s', (name) => {
    expect(actual[name]).toBe(fixture.misc.wrappers[name]);
  });

  it('time() without a date uses now', () => {
    const before = Math.floor(Date.now() / 1_000);
    const seconds = Number(/<t:(\d+)>/.exec(bisim.time())![1]);
    expect(seconds).toBeGreaterThanOrEqual(before);
    expect(seconds).toBeLessThanOrEqual(before + 1);
  });
});
