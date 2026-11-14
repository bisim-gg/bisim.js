/**
 * A Bisim snowflake: a 64 bit id serialized as a decimal string.
 */
export type Snowflake = string;

/**
 * Bisim's snowflake epoch, 2026-06-01T00:00:00.000Z, in milliseconds.
 */
export const BisimEpoch = 1_780_272_000_000;

/**
 * The parts of a snowflake.
 */
export interface DeconstructedSnowflake {
  /** The id itself. */
  id: bigint;
  /** When the id was made, in milliseconds since the Unix epoch. */
  timestamp: bigint;
  /** The api instance that made it (10 bits on Bisim). */
  workerId: bigint;
  /** Always `0n` on Bisim, kept for the shape discord.js users know. */
  processId: bigint;
  /** The per millisecond sequence (12 bits). */
  increment: bigint;
  /** The epoch the timestamp counts from. */
  epoch: bigint;
}

/**
 * Options for {@link SnowflakeGenerator.generate}.
 */
export interface SnowflakeGenerateOptions {
  /** The time to encode, now by default. */
  timestamp?: number | bigint | Date;
  /** The sequence number, counted up by the generator by default. */
  increment?: bigint;
  /** The worker id, `0n` by default. */
  workerId?: bigint;
  /** Ignored on Bisim. */
  processId?: bigint;
}

const WORKER_SHIFT = 12n;
const TIMESTAMP_SHIFT = 22n;

/**
 * Reads and makes snowflakes with Bisim's layout: 42 bits of milliseconds since {@link BisimEpoch}, 10 bits
 * of worker id and 12 bits of sequence.
 */
export class SnowflakeGenerator {
  /**
   * The epoch this generator counts from, in milliseconds.
   */
  public readonly epoch: bigint;

  private increment = 0n;

  /**
   * @param epoch - The epoch to count from
   */
  public constructor(epoch: number | bigint | Date = BisimEpoch) {
    this.epoch = BigInt(epoch instanceof Date ? epoch.getTime() : epoch);
  }

  /**
   * Makes a snowflake.
   *
   * @param options - What to encode
   */
  public generate(options: SnowflakeGenerateOptions = {}): bigint {
    const { timestamp = Date.now(), workerId = 0n } = options;
    const ms = BigInt(timestamp instanceof Date ? timestamp.getTime() : timestamp);
    let increment = options.increment;
    if (increment === undefined) {
      increment = this.increment;
      this.increment = (this.increment + 1n) & 0xfffn;
    }
    return ((ms - this.epoch) << TIMESTAMP_SHIFT) | ((workerId & 0x3ffn) << WORKER_SHIFT) | (increment & 0xfffn);
  }

  /**
   * Splits a snowflake into its parts.
   *
   * @param id - The snowflake
   */
  public deconstruct(id: string | bigint): DeconstructedSnowflake {
    const bigId = BigInt(id);
    return {
      id: bigId,
      timestamp: (bigId >> TIMESTAMP_SHIFT) + this.epoch,
      workerId: (bigId >> WORKER_SHIFT) & 0x3ffn,
      processId: 0n,
      increment: bigId & 0xfffn,
      epoch: this.epoch,
    };
  }

  /**
   * The same as {@link SnowflakeGenerator.deconstruct}.
   *
   * @param id - The snowflake
   */
  public decode(id: string | bigint): DeconstructedSnowflake {
    return this.deconstruct(id);
  }

  /**
   * When a snowflake was made, in milliseconds since the Unix epoch.
   *
   * @param id - The snowflake
   */
  public timestampFrom(id: string | bigint): number {
    return Number((BigInt(id) >> TIMESTAMP_SHIFT) + this.epoch);
  }

  /**
   * Compares two snowflakes: -1 when `a` is older, 1 when it is newer, 0 when they are the same.
   *
   * @param a - The first snowflake
   * @param b - The second snowflake
   */
  public static compare(a: string | bigint, b: string | bigint): -1 | 0 | 1 {
    const first = BigInt(a);
    const second = BigInt(b);
    return first === second ? 0 : first < second ? -1 : 1;
  }

  /**
   * Compares two snowflakes, see {@link SnowflakeGenerator.compare}.
   *
   * @param a - The first snowflake
   * @param b - The second snowflake
   */
  public compare(a: string | bigint, b: string | bigint): -1 | 0 | 1 {
    return SnowflakeGenerator.compare(a, b);
  }
}

/**
 * The snowflake helper with Bisim's epoch, what discord.js calls `SnowflakeUtil`.
 *
 * @example
 * ```js
 * const createdAt = new Date(SnowflakeUtil.timestampFrom(message.id));
 * ```
 */
export const SnowflakeUtil = new SnowflakeGenerator(BisimEpoch);

/**
 * The same helper as {@link SnowflakeUtil}, under the name `@sapphire/snowflake` gives Discord's.
 */
export const BisimSnowflake = SnowflakeUtil;
