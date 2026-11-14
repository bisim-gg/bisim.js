import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cleanCodeBlockContent, cleanContent, flatten, parseEmoji, resolveColor, verifyString } from '../src/index.js';

// Expected outputs recorded from an earlier build; these helpers must keep producing exactly these.
const fixture = JSON.parse(readFileSync(new URL('./fixtures/util.json', import.meta.url), 'utf8'));

type Outcome = { ok: unknown } | { error: string; code: string | null; message: string };

const attempt = (fn: () => unknown): Outcome => {
  try {
    return { ok: fn() };
  } catch (error) {
    const { name, message, code } = error as Error & { code?: string };
    return { error: name, code: code ?? null, message };
  }
};

describe('resolveColor', () => {
  it.each(fixture.colors as [unknown, Outcome][])('%j', (input, expected) => {
    // JSON has no NaN; the fixture wrote it as null.
    const color = input === null ? Number.NaN : input;
    expect(attempt(() => resolveColor(color as never))).toEqual(expected);
  });

  it('picks a random color in range', () => {
    for (let round = 0; round < 50; round += 1) {
      const color = resolveColor('Random');
      expect(Number.isInteger(color) && color >= 0 && color <= 0xffffff).toBe(true);
    }
  });
});

describe('parseEmoji', () => {
  it.each(fixture.emojis as [string, unknown][])('%j', (text, expected) => {
    expect(JSON.parse(JSON.stringify(parseEmoji(text)))).toEqual(expected);
  });
});

describe('verifyString', () => {
  const cases: Record<string, () => unknown> = {
    ok: () => verifyString('x'),
    number: () => verifyString(5 as never),
    'empty allowed': () => verifyString(''),
    'empty refused': () => verifyString('', TypeError, 'nope', false),
  };
  it.each(fixture.verify as [string, Outcome][])('%s', (name, expected) => {
    expect(attempt(cases[name]!)).toEqual(expected);
  });
});

describe('flatten', () => {
  class Thing {
    public declare readonly client: object;
    public id = '1';
    public name = 'thing';
    public _secret = 's';
    public tags = new Map([
      ['a', 1],
      ['b', 2],
    ]);
    public when = new Date(1_700_000_000_000);
    public inner = { deep: { x: 1 }, list: [1, { toJSON: () => 'J' }, { y: 2 }] };
    public nothing = null;
    public flag = false;
    public wrapped = { valueOf: () => new Map([['k', 1]]) };
    public json = { toJSON: () => ({ z: 3 }) };
    public constructor() {
      Object.defineProperty(this, 'client', { value: {} });
    }
  }
  const thing = new Thing();
  const results: Record<string, unknown> = {
    plain: flatten(thing),
    rename: flatten(thing, { name: 'title', tags: false }),
    'add hidden': flatten(thing, { client: true, _secret: true }),
    primitive: flatten(5),
    null: flatten(null),
  };
  it.each(fixture.flat as [string, unknown][])('%s', (name, expected) => {
    expect(JSON.parse(JSON.stringify(results[name]))).toEqual(expected);
  });
});

describe('cleanContent', () => {
  const client = {
    users: {
      cache: new Map<string, { username: string; displayName?: string }>([
        ['1', { username: 'ali', displayName: 'Ali' }],
        ['2', { username: 'sara' }],
      ]),
    },
    channels: {
      cache: new Map<string, { name?: string | null }>([
        ['5', { name: 'general' }],
        ['6', { name: null }],
      ]),
    },
  };
  const guild = {
    members: { cache: new Map([['3', { displayName: 'Member Three' }]]) },
    roles: { cache: new Map([['4', { name: 'Mods' }]]) },
  };
  it.each(fixture.clean as [string, string, string][])('%j', (text, inGuild, inDM) => {
    expect(cleanContent(text, { client, guild })).toBe(inGuild);
    expect(cleanContent(text, { client, guild: null })).toBe(inDM);
  });

  it('cleanCodeBlockContent breaks up code fences', () => {
    expect(cleanCodeBlockContent('a ``` b ```')).toBe(fixture.codeBlock);
  });
});
