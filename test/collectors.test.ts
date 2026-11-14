import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BisimjsError, ComponentType, ErrorCodes, Events, InteractionType } from '../src/index.js';
import {
  InteractionCollector,
  MessageCollector,
  ReactionCollector,
  awaitCollector,
  awaitInteraction,
} from '../src/structures/Collectors.js';

class FakeClient extends EventEmitter {
  public extraListeners = 0;
  public incrementMaxListeners(): void {
    this.extraListeners += 1;
  }
  public decrementMaxListeners(): void {
    this.extraListeners -= 1;
  }
}

const flush = async () => {
  for (let round = 0; round < 10; round += 1) await Promise.resolve();
};

const message = (id: string, channelId = 'chan') => ({ id, channelId });
const reaction = (key: string, messageId = 'msg', count = 1) => ({ key, count, message: { id: messageId } });
const user = (id: string) => ({ id });
const button = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  type: InteractionType.MessageComponent,
  componentType: ComponentType.Button,
  message: { id: 'msg' },
  channelId: 'chan',
  guildId: 'guild',
  user: user(`u${id}`),
  ...extra,
});

afterEach(() => {
  vi.useRealTimers();
});

describe('MessageCollector', () => {
  const setup = (options = {}) => {
    const client = new FakeClient();
    const collector = new MessageCollector({ id: 'chan', client } as never, options);
    return { client, collector };
  };

  it('collects messages from its channel that pass the filter, and ends at max', async () => {
    const { client, collector } = setup({ filter: (m: { id: string }) => m.id !== 'skip', max: 2 });
    expect(client.extraListeners).toBe(1);
    const collected: string[] = [];
    const ignored: string[] = [];
    collector.on('collect', (m) => collected.push(m.id));
    collector.on('ignore', (m) => ignored.push(m.id));
    const ended = new Promise<[Map<string, unknown>, string]>((resolve) => collector.on('end', (...args) => resolve(args as never)));

    client.emit(Events.MessageCreate, message('1'));
    client.emit(Events.MessageCreate, message('x', 'elsewhere'));
    client.emit(Events.MessageCreate, message('skip'));
    await flush();
    client.emit(Events.MessageCreate, message('2'));
    await flush();

    const [items, reason] = await ended;
    expect(reason).toBe('limit');
    expect([...items.keys()]).toEqual(['1', '2']);
    expect(collected).toEqual(['1', '2']);
    expect(ignored).toEqual(['skip']);
    expect(collector.received).toBe(3);
    expect(collector.ended).toBe(true);
    expect(collector.endReason).toBe('limit');
    expect(client.listenerCount(Events.MessageCreate)).toBe(0);
    expect(client.listenerCount(Events.MessageDelete)).toBe(0);
    expect(client.extraListeners).toBe(0);
  });

  it('ends at maxProcessed, counting messages it did not keep', async () => {
    const { client, collector } = setup({ filter: () => false, maxProcessed: 2 });
    const reasons: string[] = [];
    collector.on('end', (_items, reason) => reasons.push(reason));
    client.emit(Events.MessageCreate, message('1'));
    await flush();
    client.emit(Events.MessageCreate, message('2'));
    await flush();
    expect(reasons).toEqual(['processedLimit']);
    expect(collector.collected.size).toBe(0);
  });

  it('accepts a filter that returns a promise', async () => {
    const { client, collector } = setup({ filter: async (m: { id: string }) => m.id === 'yes' });
    client.emit(Events.MessageCreate, message('no'));
    client.emit(Events.MessageCreate, message('yes'));
    await flush();
    expect([...collector.collected.keys()]).toEqual(['yes']);
    collector.stop();
  });

  it('drops deleted messages only when dispose is on', async () => {
    const withDispose = setup({ dispose: true });
    const disposed: string[] = [];
    withDispose.collector.on('dispose', (m) => disposed.push(m.id));
    withDispose.client.emit(Events.MessageCreate, message('1'));
    withDispose.client.emit(Events.MessageCreate, message('2'));
    await flush();
    withDispose.client.emit(Events.MessageDelete, message('1'));
    withDispose.client.emit(Events.MessageDelete, message('3'));
    await flush();
    expect([...withDispose.collector.collected.keys()]).toEqual(['2']);
    expect(disposed).toEqual(['1']);
    withDispose.collector.stop();

    const without = setup();
    without.client.emit(Events.MessageCreate, message('1'));
    await flush();
    without.client.emit(Events.MessageDelete, message('1'));
    await flush();
    expect(without.collector.collected.size).toBe(1);
    without.collector.stop();
  });

  it('stops once, with the reason given or user', () => {
    const { collector } = setup();
    const reasons: string[] = [];
    collector.on('end', (_items, reason) => reasons.push(reason));
    expect(collector.endReason).toBeNull();
    collector.stop();
    collector.stop('again');
    expect(reasons).toEqual(['user']);
    const other = setup().collector;
    other.stop('done');
    expect(other.endReason).toBe('done');
  });

  it('next resolves with the next item and rejects with the collection after the end', async () => {
    const { client, collector } = setup();
    const next = collector.next;
    client.emit(Events.MessageCreate, message('1'));
    await flush();
    await expect(next).resolves.toMatchObject({ id: '1' });
    const pending = collector.next;
    collector.stop();
    await expect(pending).rejects.toBe(collector.collected);
    await expect(collector.next).rejects.toBe(collector.collected);
  });

  it('can be read with for await until it ends', async () => {
    const { client, collector } = setup({ max: 3 });
    const seen: string[] = [];
    const reading = (async () => {
      for await (const [m] of collector) seen.push((m as { id: string }).id);
    })();
    for (const id of ['1', '2', '3']) {
      client.emit(Events.MessageCreate, message(id));
      await flush();
    }
    await reading;
    expect(seen).toEqual(['1', '2', '3']);
  });

  it('ends after time, and after an idle time that each item restarts', async () => {
    vi.useFakeTimers();
    const timed = setup({ time: 1_000 });
    const timedReasons: string[] = [];
    timed.collector.on('end', (_items, reason) => timedReasons.push(reason));
    vi.advanceTimersByTime(999);
    expect(timedReasons).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(timedReasons).toEqual(['time']);

    const idle = setup({ idle: 500 });
    const idleReasons: string[] = [];
    idle.collector.on('end', (_items, reason) => idleReasons.push(reason));
    vi.advanceTimersByTime(400);
    idle.client.emit(Events.MessageCreate, message('1'));
    await flush();
    vi.advanceTimersByTime(400);
    expect(idleReasons).toEqual([]);
    vi.advanceTimersByTime(100);
    expect(idleReasons).toEqual(['idle']);
  });

  it('resetTimer restarts the running timers', () => {
    vi.useFakeTimers();
    const { collector } = setup({ time: 1_000, idle: 800 });
    const reasons: string[] = [];
    collector.on('end', (_items, reason) => reasons.push(reason));
    vi.advanceTimersByTime(700);
    collector.resetTimer({ time: 2_000 });
    vi.advanceTimersByTime(700);
    expect(reasons).toEqual([]);
    vi.advanceTimersByTime(100);
    expect(reasons).toEqual(['idle']);
  });
});

describe('ReactionCollector', () => {
  const setup = (options = {}) => {
    const client = new FakeClient();
    const collector = new ReactionCollector({ id: 'msg', client } as never, options);
    return { client, collector };
  };

  it('collects reactions on its message under the reaction key, with users and a total', async () => {
    const { client, collector } = setup();
    client.emit(Events.MessageReactionAdd, reaction('👍'), user('a'));
    client.emit(Events.MessageReactionAdd, reaction('👍'), user('b'));
    client.emit(Events.MessageReactionAdd, reaction('🎉', 'other'), user('c'));
    await flush();
    expect([...collector.collected.keys()]).toEqual(['👍']);
    expect([...collector.users.keys()]).toEqual(['a', 'b']);
    expect(collector.total).toBe(2);
    expect(ReactionCollector.key(reaction('k') as never)).toBe('k');
    collector.stop();
    expect(client.listenerCount(Events.MessageReactionAdd)).toBe(0);
    expect(client.listenerCount(Events.MessageReactionRemove)).toBe(0);
  });

  it('ends at max, maxEmojis or maxUsers', async () => {
    for (const [options, reason] of [
      [{ max: 2 }, 'limit'],
      [{ maxEmojis: 2 }, 'emojiLimit'],
      [{ maxUsers: 2 }, 'userLimit'],
    ] as const) {
      const { client, collector } = setup(options);
      const reasons: string[] = [];
      collector.on('end', (_items, why) => reasons.push(why));
      client.emit(Events.MessageReactionAdd, reaction('a'), user('1'));
      await flush();
      client.emit(Events.MessageReactionAdd, reaction('b'), user('2'));
      await flush();
      expect(reasons).toEqual([reason]);
    }
  });

  it('drops a reaction when its last user removes it, if dispose is on', async () => {
    const { client, collector } = setup({ dispose: true });
    client.emit(Events.MessageReactionAdd, reaction('a'), user('1'));
    client.emit(Events.MessageReactionAdd, reaction('b'), user('1'));
    await flush();
    client.emit(Events.MessageReactionRemove, reaction('a', 'msg', 1), user('1'));
    client.emit(Events.MessageReactionRemove, reaction('b', 'msg', 0), user('1'));
    await flush();
    expect([...collector.collected.keys()]).toEqual(['a']);
    collector.stop();
  });
});

describe('InteractionCollector', () => {
  it('collects only matching interactions', async () => {
    const client = new FakeClient();
    const collector = new InteractionCollector(client as never, {
      componentType: ComponentType.Button,
      interactionType: InteractionType.MessageComponent,
      message: { id: 'msg' },
      channel: 'chan',
      guild: { id: 'guild' },
    });
    expect(collector.messageId).toBe('msg');
    expect(collector.channelId).toBe('chan');
    expect(collector.guildId).toBe('guild');
    client.emit(Events.InteractionCreate, button('1'));
    client.emit(Events.InteractionCreate, button('2', { componentType: ComponentType.StringSelect }));
    client.emit(Events.InteractionCreate, button('3', { type: InteractionType.ModalSubmit }));
    client.emit(Events.InteractionCreate, button('4', { message: { id: 'other' } }));
    client.emit(Events.InteractionCreate, button('5', { channelId: 'other' }));
    client.emit(Events.InteractionCreate, button('6', { guildId: 'other' }));
    await flush();
    expect([...collector.collected.keys()]).toEqual(['1']);
    expect(collector.total).toBe(1);
    expect([...collector.users.keys()]).toEqual(['u1']);
    collector.stop();
    expect(client.listenerCount(Events.InteractionCreate)).toBe(0);
    expect(client.extraListeners).toBe(0);
  });

  it('ends at max, maxComponents or maxUsers, and empty() clears it', async () => {
    for (const [options, reason] of [
      [{ max: 2 }, 'limit'],
      [{ maxComponents: 2 }, 'componentLimit'],
      [{ maxUsers: 2 }, 'userLimit'],
    ] as const) {
      const client = new FakeClient();
      const collector = new InteractionCollector(client as never, options);
      const reasons: string[] = [];
      collector.on('end', (_items, why) => reasons.push(why));
      client.emit(Events.InteractionCreate, button('1'));
      await flush();
      client.emit(Events.InteractionCreate, button('2'));
      await flush();
      expect(reasons).toEqual([reason]);
    }
    const client = new FakeClient();
    const collector = new InteractionCollector(client as never, {});
    client.emit(Events.InteractionCreate, button('1'));
    await flush();
    collector.empty();
    expect(collector.collected.size).toBe(0);
    expect(collector.users.size).toBe(0);
    expect(collector.total).toBe(0);
    collector.stop();
  });
});

describe('awaitInteraction and awaitCollector', () => {
  it('awaitInteraction resolves with the first match', async () => {
    const client = new FakeClient();
    const waiting = awaitInteraction(client as never, { componentType: ComponentType.Button });
    client.emit(Events.InteractionCreate, button('9'));
    await expect(waiting).resolves.toMatchObject({ id: '9' });
    expect(client.listenerCount(Events.InteractionCreate)).toBe(0);
  });

  it('awaitInteraction rejects with InteractionCollectorError when time runs out', async () => {
    vi.useFakeTimers();
    const client = new FakeClient();
    const waiting = awaitInteraction(client as never, { time: 100 });
    const caught = waiting.catch((error: unknown) => error);
    vi.advanceTimersByTime(100);
    const error = (await caught) as InstanceType<typeof BisimjsError>;
    expect(error).toBeInstanceOf(BisimjsError);
    expect(error.code).toBe(ErrorCodes.InteractionCollectorError);
    expect(error.message).toContain('time');
  });

  it('awaitCollector resolves with what was collected, or rejects on a listed reason', async () => {
    const client = new FakeClient();
    const first = new MessageCollector({ id: 'chan', client } as never, { max: 1 });
    const done = awaitCollector(first, ['time']);
    client.emit(Events.MessageCreate, message('1'));
    const items = await done;
    expect([...items.keys()]).toEqual(['1']);

    const second = new MessageCollector({ id: 'chan', client } as never, {});
    const failed = awaitCollector(second, ['time']);
    second.stop('time');
    await expect(failed).rejects.toBe(second.collected);
  });
});
