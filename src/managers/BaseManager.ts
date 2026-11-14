import type { Client } from '../client/Client.js';
import { BisimjsError, ErrorCodes } from '../errors/index.js';
import { Collection } from '../util/Collection.js';
import { attachHidden } from '../util/internal.js';

/**
 * The base of every manager.
 */
export abstract class BaseManager {
  /**
   * The client that made this manager.
   */
  public declare readonly client: Client<true>;

  /**
   * @param client - The client that made this manager
   */
  protected constructor(client: Client) {
    attachHidden(this, 'client', client);
  }
}

/**
 * A manager whose structures can be resolved from ids.
 *
 * @typeParam Key - The key of the cache
 * @typeParam Holds - The structure the manager holds
 * @typeParam Resolvable - What can be resolved into a held structure
 */
export abstract class DataManager<Key, Holds, Resolvable> extends BaseManager {
  /**
   * The cache of held structures.
   */
  public get cache(): Collection<Key, Holds> {
    throw new BisimjsError(ErrorCodes.NotImplemented, 'get cache', this.constructor.name);
  }

  /**
   * Resolves a resolvable to the held structure, or `null`.
   *
   * @param idOrInstance - The id or the structure
   */
  public resolve(idOrInstance: Resolvable | Holds): Holds | null {
    if (idOrInstance === null || idOrInstance === undefined) return null;
    if (typeof idOrInstance === 'object') {
      const id = (idOrInstance as { id?: Key }).id;
      if (id !== undefined && this.cache.has(id)) return this.cache.get(id)!;
      return this.isHeld(idOrInstance) ? (idOrInstance as Holds) : null;
    }
    return this.cache.get(idOrInstance as unknown as Key) ?? null;
  }

  /**
   * Resolves a resolvable to the id of the held structure, or `null`.
   *
   * @param idOrInstance - The id or the structure
   */
  public resolveId(idOrInstance: Resolvable | Holds | Key): Key | null {
    if (idOrInstance === null || idOrInstance === undefined) return null;
    if (typeof idOrInstance === 'object') return ((idOrInstance as { id?: Key }).id ?? null) as Key | null;
    return idOrInstance as unknown as Key;
  }

  /**
   * Whether a value is one of the held structures.
   *
   * @internal
   */
  protected isHeld(_value: unknown): boolean {
    return false;
  }

  /**
   * The cache, so a manager reads as its collection.
   */
  public override valueOf(): Collection<Key, Holds> {
    return this.cache;
  }
}

/**
 * A manager with its own cache.
 */
export abstract class CachedManager<Key, Holds, Resolvable> extends DataManager<Key, Holds, Resolvable> {
  private declare readonly _cache: Collection<Key, Holds>;

  protected constructor(client: Client, iterable?: Iterable<Holds>) {
    super(client);
    attachHidden(this, '_cache', new Collection<Key, Holds>());
    if (iterable) for (const item of iterable) this.cache.set((item as { id: Key }).id, item);
  }

  /**
   * The cache of held structures.
   */
  public override get cache(): Collection<Key, Holds> {
    return this._cache;
  }

  /**
   * Brings the cached structure under `key` up to date with `data` and returns it, or returns `undefined`
   * when nothing is cached under that key.
   *
   * @internal
   */
  protected refreshCached(key: Key, data: unknown): Holds | undefined {
    const known = this.cache.get(key) as (Holds & { _patch(data: unknown): unknown }) | undefined;
    known?._patch(data);
    return known;
  }

  /**
   * What the cache can answer for `key` without asking Bisim: the structure, when it is cached and not
   * partial, and a fresh copy was not asked for.
   *
   * @param key - The key to look up
   * @param force - Whether a fresh copy is wanted
   * @internal
   */
  protected fromCache(key: Key, force = false): Holds | undefined {
    if (force) return undefined;
    const known = this.cache.get(key);
    return known === undefined || (known as { partial?: boolean }).partial ? undefined : known;
  }
}
