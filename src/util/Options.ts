import type { CacheFactory, ClientOptions } from '../client/Client.js';

/**
 * Cache limits by manager name, as discord.js names them.
 */
export interface CacheWithLimitsOptions {
  /** How many messages each channel keeps. */
  MessageManager?: number | { maxSize?: number };
  [manager: string]: unknown;
}

/**
 * Helpers for client options, discord.js's `Options`. On Bisim only the message cache size is used; the rest
 * is accepted.
 */
export const Options = {
  /**
   * Makes a cache setting with limits. bisim.js reads `MessageManager` (messages kept per channel).
   *
   * @param settings - The limits by manager name
   */
  cacheWithLimits(settings: CacheWithLimitsOptions = {}): CacheFactory {
    const factory = (() => undefined) as CacheFactory;
    const messages = settings.MessageManager;
    factory.messages = typeof messages === 'number' ? messages : (messages?.maxSize ?? 200);
    return factory;
  },

  /**
   * Makes a cache setting that keeps everything (a large message cache).
   */
  cacheEverything(): CacheFactory {
    const factory = (() => undefined) as CacheFactory;
    factory.messages = Number.POSITIVE_INFINITY;
    return factory;
  },

  /**
   * The default cache limits.
   */
  DefaultMakeCacheSettings: { MessageManager: 200 } as CacheWithLimitsOptions,

  /**
   * The default sweepers (accepted, not used on Bisim).
   */
  DefaultSweeperSettings: {} as Record<string, unknown>,

  /**
   * The default client options.
   */
  createDefault(): Partial<ClientOptions> {
    return { partials: [], makeCache: Options.cacheWithLimits(Options.DefaultMakeCacheSettings) };
  },
};

/**
 * Accepted for compatibility: sweeper helpers.
 */
export const Sweepers = {
  filterByLifetime(_options: unknown = {}): () => () => boolean {
    return () => () => false;
  },
  archivedThreadSweepFilter(): () => () => boolean {
    return () => () => false;
  },
  expiredInviteSweepFilter(): () => () => boolean {
    return () => () => false;
  },
  outdatedMessageSweepFilter(): () => () => boolean {
    return () => () => false;
  },
};
