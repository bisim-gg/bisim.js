import { HeadingLevel } from './Enums.js';

/**
 * Helpers that turn text, ids and dates into the markdown and tokens Bisim renders: bold text, code
 * blocks, mentions, timestamps, lists. Names and output match the formatters discord.js bots use.
 *
 * @packageDocumentation
 */

const FENCE = '```';

/** `text` between `before` and `after`. */
const surround = (text: string, before: string, after = before): string => `${before}${text}${after}`;

/**
 * Puts text in a code block without a language.
 *
 * @param content - The text inside the block
 */
export function codeBlock<Content extends string>(content: Content): `\`\`\`\n${Content}\n\`\`\``;
/**
 * Puts text in a code block highlighted as the given language.
 *
 * @param language - The language name after the opening fence, such as `js`
 * @param content - The text inside the block
 */
export function codeBlock<Language extends string, Content extends string>(language: Language, content: Content): `\`\`\`${Language}\n${Content}\n\`\`\``;
export function codeBlock(languageOrContent: string, content?: string): string {
  const [language, body] = content === undefined ? ['', languageOrContent] : [languageOrContent, content];
  return `${FENCE}${language}\n${body}\n${FENCE}`;
}

/**
 * Shows text as code inside a line.
 *
 * @param content - The text to show as code
 */
export function inlineCode<Content extends string>(content: Content): `\`${Content}\`` {
  return surround(content, '`') as `\`${Content}\``;
}

/**
 * Shows text in italics.
 *
 * @param content - The text to slant
 */
export function italic<Content extends string>(content: Content): `_${Content}_` {
  return surround(content, '_') as `_${Content}_`;
}

/**
 * Shows text in bold.
 *
 * @param content - The text to make bold
 */
export function bold<Content extends string>(content: Content): `**${Content}**` {
  return surround(content, '**') as `**${Content}**`;
}

/**
 * Underlines text.
 *
 * @param content - The text to underline
 */
export function underline<Content extends string>(content: Content): `__${Content}__` {
  return surround(content, '__') as `__${Content}__`;
}

/**
 * Draws a line through text.
 *
 * @param content - The text to cross out
 */
export function strikethrough<Content extends string>(content: Content): `~~${Content}~~` {
  return surround(content, '~~') as `~~${Content}~~`;
}

/**
 * Quotes one line of text. For text over several lines, see {@link blockQuote}.
 *
 * @param content - The line to quote
 */
export function quote<Content extends string>(content: Content): `> ${Content}` {
  return surround(content, '> ', '') as `> ${Content}`;
}

/**
 * Quotes text from here to the end of the message, over as many lines as it has.
 *
 * @param content - The text to quote
 */
export function blockQuote<Content extends string>(content: Content): `>>> ${Content}` {
  return surround(content, '>>> ', '') as `>>> ${Content}`;
}

/**
 * Puts a link in angle brackets so it stays a plain link, without a preview card under the message.
 *
 * @param url - The link
 */
export function hideLinkEmbed<Content extends string>(url: Content): `<${Content}>`;
export function hideLinkEmbed(url: URL): `<${string}>`;
export function hideLinkEmbed(url: string | URL): string {
  return surround(String(url), '<', '>');
}

/**
 * Makes text a link: the text is shown and the URL opens on click.
 *
 * @param content - The text people see
 * @param url - Where the link goes
 */
export function hyperlink<Content extends string, Url extends string>(content: Content, url: Url): `[${Content}](${Url})`;
/**
 * Makes text a link with a tooltip.
 *
 * @param content - The text people see
 * @param url - Where the link goes
 * @param title - The tooltip shown when the pointer rests on the link
 */
export function hyperlink<Content extends string, Url extends string, Title extends string>(content: Content, url: Url, title: Title): `[${Content}](${Url} "${Title}")`;
export function hyperlink(content: string, url: string | URL, title?: string): string {
  const target = title ? `${String(url)} "${title}"` : String(url);
  return `[${content}](${target})`;
}

/**
 * Hides text behind a spoiler until it is clicked.
 *
 * @param content - The text to hide
 */
export function spoiler<Content extends string>(content: Content): `||${Content}||` {
  return surround(content, '||') as `||${Content}||`;
}

/**
 * The token that mentions a person.
 *
 * @param userId - Their user id
 */
export function userMention<UserId extends string>(userId: UserId): `<@${UserId}>` {
  return surround(userId, '<@', '>') as `<@${UserId}>`;
}

/**
 * The token that links to a channel.
 *
 * @param channelId - The channel id
 */
export function channelMention<ChannelId extends string>(channelId: ChannelId): `<#${ChannelId}>` {
  return surround(channelId, '<#', '>') as `<#${ChannelId}>`;
}

/**
 * The token that mentions a role.
 *
 * @param roleId - The role id
 */
export function roleMention<RoleId extends string>(roleId: RoleId): `<@&${RoleId}>` {
  return surround(roleId, '<@&', '>') as `<@&${RoleId}>`;
}

/**
 * The token that shows a slash command people can click to start typing it. Give the command's name,
 * then optionally a subcommand group and a subcommand, and the command's id last.
 *
 * @param commandName - The command's name
 * @param commandId - The command's id
 */
export function chatInputApplicationCommandMention(commandName: string, commandId: string): string;
export function chatInputApplicationCommandMention(commandName: string, subcommandName: string, commandId: string): string;
export function chatInputApplicationCommandMention(commandName: string, subcommandGroupName: string, subcommandName: string, commandId: string): string;
export function chatInputApplicationCommandMention(...names: string[]): string {
  const commandId = names.splice(-1, 1)[0]!;
  return `</${names.join(' ')}:${commandId}>`;
}

/**
 * A custom emoji, as an object for {@link formatEmoji}.
 */
export interface FormatEmojiOptions {
  animated?: boolean;
  id: string;
  name?: string;
}

/**
 * The token that shows a server's custom emoji: `<:name:id>`, or `<a:name:id>` when it moves.
 *
 * @param emoji - The emoji's id, or the emoji as an object
 * @param animated - Whether it moves, when only the id is given
 */
export function formatEmoji(emoji: string | FormatEmojiOptions, animated = false): string {
  const { id, name = '_', animated: moving = false } = typeof emoji === 'string' ? { id: emoji, animated } : emoji;
  return `<${moving ? 'a' : ''}:${name}:${id}>`;
}

/**
 * Where the Bisim web app lives; the link helpers build on it.
 *
 * @internal
 */
export const BisimWebOrigin = 'https://bisim.gg';

/**
 * The web address of a channel.
 *
 * @param channelId - The channel id
 * @param guildId - The server id; leave it out for a direct message
 */
export function channelLink(channelId: string, guildId?: string): string {
  return [BisimWebOrigin, 'channels', guildId ?? '@me', channelId].join('/');
}

/**
 * The web address of a message, which opens its channel scrolled to it.
 *
 * @param channelId - The id of the message's channel
 * @param messageId - The message id
 * @param guildId - The server id; leave it out for a direct message
 */
export function messageLink(channelId: string, messageId: string, guildId?: string): string {
  return [channelLink(channelId, guildId), messageId].join('/');
}

/**
 * Makes a line a heading.
 *
 * @param content - The heading text
 * @param level - 1 for the largest heading, 3 for the smallest
 */
export function heading(content: string, level: HeadingLevel = HeadingLevel.One): string {
  return `${'#'.repeat(level)} ${content}`;
}

/**
 * Items of a list, where an item may itself be a list shown indented under the previous one.
 */
export type RecursiveArray<Item> = readonly (Item | RecursiveArray<Item>)[];

/** Writes list lines; numbered when `firstNumber` is given, each nested list restarting from it. */
function renderList(items: RecursiveArray<string>, firstNumber: number | undefined, depth: number): string[] {
  const lines: string[] = [];
  let next = firstNumber ?? 1;
  for (const item of items) {
    if (typeof item !== 'string') {
      lines.push(...renderList(item, firstNumber, depth + 1));
      continue;
    }
    const marker = firstNumber === undefined ? '-' : `${next}.`;
    next += 1;
    lines.push(`${'  '.repeat(depth)}${marker} ${item}`);
  }
  return lines;
}

/**
 * A bulleted list. An array inside the array becomes a list indented under the item before it.
 *
 * @param list - The items
 */
export function unorderedList(list: RecursiveArray<string>): string {
  return renderList(list, undefined, 0).join('\n');
}

/**
 * A numbered list. An array inside the array becomes a numbered list indented under the item before it.
 *
 * @param list - The items
 * @param startNumber - The number of the first item; anything below 1 counts as 1
 */
export function orderedList(list: RecursiveArray<string>, startNumber = 1): string {
  return renderList(list, startNumber < 1 ? 1 : startNumber, 0).join('\n');
}

/**
 * Shows a line in small, faded text.
 *
 * @param content - The line to shrink
 */
export function subtext<Content extends string>(content: Content): `-# ${Content}` {
  return surround(content, '-# ', '') as `-# ${Content}`;
}

/**
 * How a timestamp token is displayed. The examples are for 16:20 on 20 April 2021.
 */
export const TimestampStyles = {
  /** 16:20 */
  ShortTime: 't',
  /** 16:20:30 */
  LongTime: 'T',
  /** 20/04/2021 */
  ShortDate: 'd',
  /** 20 April 2021 */
  LongDate: 'D',
  /** 20 April 2021 16:20 */
  ShortDateTime: 'f',
  /** Tuesday, 20 April 2021 16:20 */
  LongDateTime: 'F',
  /** 2 months ago, counting live */
  RelativeTime: 'R',
} as const;

/**
 * The letter of one of the {@link TimestampStyles}.
 */
export type TimestampStylesString = (typeof TimestampStyles)[keyof typeof TimestampStyles];

/**
 * A timestamp token: every reader sees the moment in their own time zone and language.
 *
 * @param date - The moment; the current time when left out
 */
export function time(date?: Date): `<t:${bigint}>`;
/**
 * A timestamp token shown in one of the {@link TimestampStyles}.
 *
 * @param date - The moment
 * @param style - How to show it
 */
export function time<Style extends TimestampStylesString>(date: Date, style: Style): `<t:${bigint}:${Style}>`;
export function time<Seconds extends number>(seconds: Seconds): `<t:${Seconds}>`;
export function time<Seconds extends number, Style extends TimestampStylesString>(seconds: Seconds, style: Style): `<t:${Seconds}:${Style}>`;
export function time(moment?: Date | number, style?: TimestampStylesString): string {
  const unixSeconds = typeof moment === 'number' ? moment : Math.floor((moment ?? new Date()).getTime() / 1_000);
  const parts = typeof style === 'string' ? [unixSeconds, style] : [unixSeconds];
  return `<t:${parts.join(':')}>`;
}

/**
 * Faces made of text.
 */
export enum Faces {
  Shrug = '¯\\_(ツ)_/¯',
  Tableflip = '(╯°□°)╯︵ ┻━┻',
  Unflip = '┬─┬ノ( º _ ºノ)',
}

/**
 * The kinds of markdown {@link escapeMarkdown} neutralizes. A kind is escaped unless it is set to `false`,
 * except headings, lists and masked links, which are only escaped when set to `true`.
 */
export interface EscapeMarkdownOptions {
  bold?: boolean;
  bulletedList?: boolean;
  codeBlock?: boolean;
  codeBlockContent?: boolean;
  escape?: boolean;
  heading?: boolean;
  inlineCode?: boolean;
  inlineCodeContent?: boolean;
  italic?: boolean;
  maskedLink?: boolean;
  numberedList?: boolean;
  spoiler?: boolean;
  strikethrough?: boolean;
  underline?: boolean;
}

/** Puts a backslash before every character of each `sequence` in the text. */
function backslashAll(text: string, sequence: string): string {
  const escaped = [...sequence].map((character) => `\\${character}`).join('');
  return text.split(sequence).join(escaped);
}

/**
 * Doubles every backslash, so none of them escapes what follows.
 *
 * @param text - The text to make safe
 */
export function escapeEscape(text: string): string {
  return backslashAll(text, '\\');
}

/**
 * Neutralizes code block fences (three backticks).
 *
 * @param text - The text to make safe
 */
export function escapeCodeBlock(text: string): string {
  return backslashAll(text, FENCE);
}

/**
 * Neutralizes inline code backticks, single or doubled, leaving code block fences alone.
 *
 * @param text - The text to make safe
 */
export function escapeInlineCode(text: string): string {
  return text.replace(/(?<=^|[^`])``?(?=[^`]|$)/g, (ticks) => backslashAll(ticks, '`'));
}

/**
 * Neutralizes italics written with one asterisk or one underscore.
 *
 * @param text - The text to make safe
 */
export function escapeItalic(text: string): string {
  const asterisks = /(?<=^|[^*])\*([^*]|\*\*|$)/g;
  const underscores = /(?<=^|[^_])_([^_]|__|$)/g;
  return text.replace(asterisks, (_whole, rest: string) => `\\*${rest}`).replace(underscores, (_whole, rest: string) => `\\_${rest}`);
}

/**
 * Neutralizes bold (double asterisks).
 *
 * @param text - The text to make safe
 */
export function escapeBold(text: string): string {
  return backslashAll(text, '**');
}

/**
 * Neutralizes underlines (double underscores).
 *
 * @param text - The text to make safe
 */
export function escapeUnderline(text: string): string {
  return backslashAll(text, '__');
}

/**
 * Neutralizes crossed out text (double tildes).
 *
 * @param text - The text to make safe
 */
export function escapeStrikethrough(text: string): string {
  return backslashAll(text, '~~');
}

/**
 * Neutralizes spoilers (double bars).
 *
 * @param text - The text to make safe
 */
export function escapeSpoiler(text: string): string {
  return backslashAll(text, '||');
}

/**
 * Neutralizes `#`, `##` and `###` at the start of a line, including in list items.
 *
 * @param text - The text to make safe
 */
export function escapeHeading(text: string): string {
  return text.replace(/^( {0,2})([*-] )?( *)(#{1,3} )/gm, '$1$2$3\\$4');
}

/**
 * Neutralizes `-` and `*` bullets at the start of a line.
 *
 * @param text - The text to make safe
 */
export function escapeBulletedList(text: string): string {
  return text.replace(/^( *)([*-])( +)/gm, '$1\\$2$3');
}

/**
 * Neutralizes `1.` style numbers at the start of a line.
 *
 * @param text - The text to make safe
 */
export function escapeNumberedList(text: string): string {
  return text.replace(/^( *\d+)\./gm, '$1\\.');
}

/**
 * Neutralizes masked links written as `[text](url)`.
 *
 * @param text - The text to make safe
 */
export function escapeMaskedLink(text: string): string {
  return text.replace(/\[.+]\(.+\)/gm, (link) => `\\${link}`);
}

/** Matches a single backtick that is not part of a longer run. */
const LONE_BACKTICK = /(?<=^|[^`])`(?=[^`]|$)/g;

/**
 * Escapes text so the markdown in it shows as typed instead of being rendered. Choose what to escape with
 * the options; by default everything but headings, lists and masked links is escaped.
 *
 * @param text - The text to make safe
 * @param options - Which kinds of markdown to escape
 */
export function escapeMarkdown(text: string, options: EscapeMarkdownOptions = {}): string {
  const wanted = (kind: keyof EscapeMarkdownOptions, byDefault: boolean) => options[kind] ?? byDefault;

  // Text inside code (blocks or inline) can be left alone: split around the code, escape the rest.
  if (!wanted('codeBlockContent', true)) {
    return escapeAround(text, FENCE, wanted('codeBlock', true) ? '\\`\\`\\`' : FENCE, (outside) =>
      escapeMarkdown(outside, { ...options, codeBlock: false, codeBlockContent: true }),
    );
  }
  if (!wanted('inlineCodeContent', true)) {
    return escapeAround(text, LONE_BACKTICK, wanted('inlineCode', true) ? '\\`' : '`', (outside) =>
      escapeMarkdown(outside, { ...options, inlineCode: false, inlineCodeContent: true }),
    );
  }

  const steps: [enabled: boolean, escaper: (text: string) => string][] = [
    [wanted('escape', true), escapeEscape],
    [wanted('heading', false), escapeHeading],
    [wanted('bulletedList', false), escapeBulletedList],
    [wanted('numberedList', false), escapeNumberedList],
    [wanted('maskedLink', false), escapeMaskedLink],
    [wanted('italic', true), escapeItalic],
    [wanted('bold', true), escapeBold],
    [wanted('underline', true), escapeUnderline],
    [wanted('strikethrough', true), escapeStrikethrough],
    [wanted('spoiler', true), escapeSpoiler],
    [wanted('inlineCode', true), escapeInlineCode],
    [wanted('codeBlock', true), escapeCodeBlock],
  ];
  return steps.reduce((result, [enabled, escaper]) => (enabled ? escaper(result) : result), text);
}

/**
 * Splits text on a delimiter, escapes the pieces outside the delimited spans, and joins it back with
 * `joiner`. A piece is inside a span when it sits at an odd position and is not the last piece (an
 * unclosed delimiter does not start a span).
 */
function escapeAround(text: string, delimiter: string | RegExp, joiner: string, escapeOutside: (piece: string) => string): string {
  const pieces = text.split(delimiter);
  const lastIndex = pieces.length - 1;
  return pieces.map((piece, index) => (index % 2 === 1 && index !== lastIndex ? piece : escapeOutside(piece))).join(joiner);
}
