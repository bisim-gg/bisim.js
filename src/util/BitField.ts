import { BisimjsRangeError, ErrorCodes } from '../errors/index.js';

/**
 * What a bit field can be made from: a flag name, a number or bigint (or the bigint written as a string),
 * another bit field, or a list mixing any of these.
 */
export type BitFieldResolvable<Flags extends string, Type extends bigint | number> =
  | Flags
  | Readonly<BitField<Flags, Type>>
  | RecursiveReadonlyArray<Flags | Readonly<BitField<Flags, Type>> | Type | `${bigint}`>
  | Type
  | `${bigint}`;

/**
 * A read only list whose items may be lists of the same kind, nested to any depth.
 */
export interface RecursiveReadonlyArray<Item> extends ReadonlyArray<Item | RecursiveReadonlyArray<Item>> {}

type Bits = bigint | number;

/** Bitwise work on numbers or bigints, whichever the field uses. */
function combine(left: Bits, right: Bits, operation: 'or' | 'and' | 'clear'): Bits {
  if (typeof left === 'bigint') {
    const other = right as bigint;
    if (operation === 'or') return left | other;
    return operation === 'and' ? left & other : left & ~other;
  }
  const other = right as number;
  if (operation === 'or') return left | other;
  return operation === 'and' ? left & other : left & ~other;
}

/**
 * A set of named on and off flags packed into one number (or bigint): permissions, intents, message flags.
 * Subclasses list their flags in {@link BitField.Flags}. A frozen bit field is never changed; adding to or
 * removing from it returns a new one.
 *
 * @typeParam Flags - The flag names
 * @typeParam Type - `number` or `bigint`
 */
export class BitField<Flags extends string = string, Type extends bigint | number = number> {
  /**
   * The flags this kind of bit field knows, by name. Each subclass sets its own.
   */
  public static Flags: Record<string, bigint | number> = {};

  /**
   * The value with no flag set: `0`, or `0n` for bigint fields.
   */
  public static DefaultBit: bigint | number = 0;

  /**
   * The packed value.
   */
  public bitfield: Type;

  /**
   * @param bits - The flags to start with; none when left out
   */
  public constructor(bits: BitFieldResolvable<Flags, Type> = (new.target as typeof BitField).DefaultBit as Type) {
    this.bitfield = kindOf(this).resolve(bits) as Type;
  }

  /**
   * Whether at least one of the given flags is set.
   *
   * @param bit - The flags to look for
   */
  public any(bit: BitFieldResolvable<Flags, Type>): boolean {
    return combine(this.bitfield, kindOf(this).resolve(bit), 'and') !== kindOf(this).DefaultBit;
  }

  /**
   * Whether exactly the given flags are set, no more and no fewer.
   *
   * @param bit - The flags to compare with
   */
  public equals(bit: BitFieldResolvable<Flags, Type>): boolean {
    return kindOf(this).resolve(bit) === this.bitfield;
  }

  /**
   * Whether all of the given flags are set.
   *
   * @param bit - The flags to look for
   */
  public has(bit: BitFieldResolvable<Flags, Type>, ..._hasParams: unknown[]): boolean {
    const wanted = kindOf(this).resolve(bit);
    return combine(this.bitfield, wanted, 'and') === wanted;
  }

  /**
   * The names of the given flags that are not set here.
   *
   * @param bits - The flags to look for
   * @param hasParams - Passed on to {@link BitField.has} by subclasses that take more arguments
   */
  public missing(bits: BitFieldResolvable<Flags, Type>, ...hasParams: unknown[]): Flags[] {
    const Kind = this.constructor as new (bits: BitFieldResolvable<Flags, Type>) => BitField<Flags, Type>;
    const absent = new Kind(bits).remove(this);
    return absent.toArray(...hasParams);
  }

  /**
   * Makes this bit field unchangeable; {@link BitField.add} and {@link BitField.remove} then return copies.
   */
  public freeze(): Readonly<this> {
    return Object.freeze(this);
  }

  /**
   * Sets flags.
   *
   * @param bits - The flags to set
   * @returns This bit field, or a changed copy when this one is frozen
   */
  public add(...bits: BitFieldResolvable<Flags, Type>[]): this {
    return updated(this, bits, 'or');
  }

  /**
   * Clears flags.
   *
   * @param bits - The flags to clear
   * @returns This bit field, or a changed copy when this one is frozen
   */
  public remove(...bits: BitFieldResolvable<Flags, Type>[]): this {
    return updated(this, bits, 'clear');
  }

  /**
   * Every flag name this kind of bit field knows, with whether it is set.
   *
   * @param hasParams - Passed on to {@link BitField.has} by subclasses that take more arguments
   */
  public serialize(...hasParams: unknown[]): Record<Flags, boolean> {
    const { Flags: known } = kindOf(this);
    return Object.fromEntries(flagNames(known).map((name) => [name, this.has(known[name] as never, ...hasParams)])) as Record<Flags, boolean>;
  }

  /**
   * The names of the flags that are set.
   *
   * @param hasParams - Passed on to {@link BitField.has} by subclasses that take more arguments
   */
  public toArray(...hasParams: unknown[]): Flags[] {
    return namesSet(this, hasParams);
  }

  /**
   * What `JSON.stringify` writes: the number, or for bigint fields the value as a string.
   */
  public toJSON(): Type extends bigint ? string : number {
    return (typeof this.bitfield === 'bigint' ? String(this.bitfield) : this.bitfield) as never;
  }

  /**
   * The packed value, so bit fields work with comparison and arithmetic operators.
   */
  public valueOf(): Type {
    return this.bitfield;
  }

  /**
   * Goes through the names of the flags that are set.
   *
   * @param hasParams - Passed on to {@link BitField.has} by subclasses that take more arguments
   */
  public *[Symbol.iterator](...hasParams: unknown[]): IterableIterator<Flags> {
    yield* namesSet(this, hasParams);
  }

  /**
   * Turns anything a bit field can be made from into the packed value.
   *
   * @param bit - What to turn into a value
   * @throws `BisimjsRangeError` with the code `BitFieldInvalid` for an unknown flag name, a negative value or
   * a value of the wrong type
   */
  public static resolve(bit?: unknown): bigint | number {
    const empty = this.DefaultBit;
    const usesBigint = typeof empty === 'bigint';
    switch (typeof bit) {
      case 'object':
        if (Array.isArray(bit)) return bit.reduce<Bits>((sum, piece) => combine(sum, this.resolve(piece), 'or'), empty);
        if (bit instanceof BitField) return bit.valueOf();
        break;
      case 'number':
        if (!usesBigint && bit >= 0) return bit;
        if (usesBigint && Number.isInteger(bit) && bit >= 0) return BigInt(bit);
        break;
      case 'bigint':
        if (usesBigint && bit >= 0n) return bit;
        break;
      case 'string': {
        if (!Number.isNaN(Number(bit))) return usesBigint ? BigInt(bit) : Number(bit);
        const named = this.Flags[bit];
        if (named !== undefined) return named;
        break;
      }
      default:
        break;
    }
    throw invalidBit(bit);
  }
}

/** The class of a bit field, for its flags and its empty value. */
function kindOf(field: BitField<string, Bits>): typeof BitField {
  return field.constructor as typeof BitField;
}

/** Sets or clears bits: on the field itself, or on a copy when the field is frozen. */
function updated<Field extends BitField<string, Bits>>(field: Field, bits: unknown[], operation: 'or' | 'clear'): Field {
  const kind = kindOf(field);
  const change = bits.reduce<Bits>((sum, bit) => combine(sum, kind.resolve(bit), 'or'), kind.DefaultBit);
  const next = combine(field.bitfield, change, operation);
  if (Object.isFrozen(field)) {
    const Kind = field.constructor as new (bits: Bits) => Field;
    return new Kind(next);
  }
  field.bitfield = next;
  return field;
}

/** The set flag names, by the field's own {@link BitField.has}; shared by toArray and iteration. */
function namesSet<Flags extends string>(field: BitField<Flags, Bits>, hasParams: unknown[]): Flags[] {
  const { Flags: known } = kindOf(field);
  return flagNames(known).filter((name) => field.has(known[name] as never, ...hasParams)) as Flags[];
}

function invalidBit(bit: unknown): BisimjsRangeError {
  return new BisimjsRangeError(ErrorCodes.BitFieldInvalid, bit);
}

/** The flag names of a flags object, without the number keys a numeric enum adds. */
function flagNames(flags: Record<string, unknown>): string[] {
  return Object.keys(flags).filter((name) => Number.isNaN(Number(name)));
}
