/**
 * Decides the order of two entries when a collection is sorted. A negative result puts the first entry
 * earlier, a positive one later, and zero keeps their current order.
 */
export type Comparator<Key, Value> = (firstValue: Value, secondValue: Value, firstKey: Key, secondKey: Key) => number;

/** The methods that change a collection where it stands. */
type InPlaceMethods = 'set' | 'delete' | 'clear' | 'sort' | 'reverse' | 'sweep' | 'ensure' | 'get' | 'forEach';

/**
 * A collection that is only read: every query and copy method, none of those that change it.
 */
export type ReadonlyCollection<Key, Value> = Omit<Collection<Key, Value>, InPlaceMethods> & ReadonlyMap<Key, Value>;

/**
 * What a {@link Collection.merge} callback answers for one key: drop it, or keep it with this value.
 */
export type Keep<Value> = { keep: false } | { keep: true; value: Value };

/** A callback that receives an entry and the collection it belongs to. */
type EntryCallback<Key, Value, Owner, Result> = (value: Value, key: Key, collection: Owner) => Result;

/** A reduce step: the result so far and one entry in, the next result out. */
type Reducer<Key, Value, Owner, Result> = (accumulator: Result, value: Value, key: Key, collection: Owner) => Result;

/** A {@link Collection.merge} callback for a key found in one of the two collections. */
type OneSideAnswer<Key, Value, Result> = (value: Value, key: Key) => Keep<Result>;

/** A {@link Collection.merge} callback for a key found in both collections. */
type BothSidesAnswer<Key, Value, OtherValue, Result> = (value: Value, valueOther: OtherValue, key: Key) => Keep<Result>;

/**
 * The `Map` that holds every cache in bisim.js, with the array style helpers bots use every day: find a
 * member, filter channels, map roles to names, sort, pick the first few. Its methods and their behaviour
 * follow the `Collection` that discord.js bots already know.
 *
 * @typeParam Key - What the entries are looked up by, usually an id
 * @typeParam Value - What is stored
 */
export class Collection<Key, Value> extends Map<Key, Value> {
  /**
   * Reads a key, creating its value first when the key is missing.
   *
   * @param key - The key to read
   * @param defaultValueGenerator - Makes the value to store when the key is missing; it receives the key
   * and this collection
   */
  public ensure(key: Key, defaultValueGenerator: (key: Key, collection: this) => Value): Value {
    if (this.has(key)) return this.get(key) as Value;
    const created = callable(defaultValueGenerator)(key, this);
    this.set(key, created);
    return created;
  }

  /**
   * Whether every one of the keys is present.
   *
   * @param keys - The keys to look for
   */
  public hasAll(...keys: Key[]): boolean {
    for (const wanted of keys) {
      if (!this.has(wanted)) return false;
    }
    return true;
  }

  /**
   * Whether at least one of the keys is present.
   *
   * @param keys - The keys to look for
   */
  public hasAny(...keys: Key[]): boolean {
    for (const wanted of keys) {
      if (this.has(wanted)) return true;
    }
    return false;
  }

  /**
   * The value at the front, or `undefined` when the collection is empty.
   */
  public first(): Value | undefined;
  /**
   * Up to `amount` values from the front. A negative amount counts from the back instead.
   *
   * @param amount - How many values to return
   */
  public first(amount: number): Value[];
  public first(amount?: number): Value | Value[] | undefined {
    if (amount === undefined) return headOf(this.values(), 1)[0];
    return amount < 0 ? this.last(-amount) : headOf(this.values(), amount);
  }

  /**
   * The key at the front, or `undefined` when the collection is empty.
   */
  public firstKey(): Key | undefined;
  /**
   * Up to `amount` keys from the front. A negative amount counts from the back instead.
   *
   * @param amount - How many keys to return
   */
  public firstKey(amount: number): Key[];
  public firstKey(amount?: number): Key | Key[] | undefined {
    if (amount === undefined) return headOf(this.keys(), 1)[0];
    return amount < 0 ? this.lastKey(-amount) : headOf(this.keys(), amount);
  }

  /**
   * The value at the back, or `undefined` when the collection is empty.
   */
  public last(): Value | undefined;
  /**
   * Up to `amount` values from the back, in their stored order. A negative amount counts from the front.
   *
   * @param amount - How many values to return
   */
  public last(amount: number): Value[];
  public last(amount?: number): Value | Value[] | undefined {
    const all = [...this.values()];
    if (amount === undefined) return all.at(-1);
    return amount < 0 ? this.first(-amount) : tailOf(all, amount);
  }

  /**
   * The key at the back, or `undefined` when the collection is empty.
   */
  public lastKey(): Key | undefined;
  /**
   * Up to `amount` keys from the back, in their stored order. A negative amount counts from the front.
   *
   * @param amount - How many keys to return
   */
  public lastKey(amount: number): Key[];
  public lastKey(amount?: number): Key | Key[] | undefined {
    const all = [...this.keys()];
    if (amount === undefined) return all.at(-1);
    return amount < 0 ? this.firstKey(-amount) : tailOf(all, amount);
  }

  /**
   * The value at a position, where 0 is the front and -1 the back, as with arrays.
   *
   * @param index - The position; fractions are cut off
   */
  public at(index: number): Value | undefined {
    return itemAt(this.values(), this.size, index);
  }

  /**
   * The key at a position, where 0 is the front and -1 the back, as with arrays.
   *
   * @param index - The position; fractions are cut off
   */
  public keyAt(index: number): Key | undefined {
    return itemAt(this.keys(), this.size, index);
  }

  /**
   * One value chosen at random, or `undefined` when the collection is empty.
   */
  public random(): Value | undefined;
  /**
   * Up to `amount` different values chosen at random.
   *
   * @param amount - How many values to return
   */
  public random(amount: number): Value[];
  public random(amount?: number): Value | Value[] | undefined {
    const pool = [...this.values()];
    return amount === undefined ? pool[randomIndex(pool.length)] : drawFrom(pool, amount);
  }

  /**
   * One key chosen at random, or `undefined` when the collection is empty.
   */
  public randomKey(): Key | undefined;
  /**
   * Up to `amount` different keys chosen at random.
   *
   * @param amount - How many keys to return
   */
  public randomKey(amount: number): Key[];
  public randomKey(amount?: number): Key | Key[] | undefined {
    const pool = [...this.keys()];
    return amount === undefined ? pool[randomIndex(pool.length)] : drawFrom(pool, amount);
  }

  /**
   * Turns the order of the entries around, in this collection itself.
   */
  public reverse(): this {
    const backwards = [...this].reverse();
    super.clear();
    for (const [key, value] of backwards) super.set(key, value);
    return this;
  }

  /**
   * The first value the test accepts, or `undefined`.
   *
   * @param fn - The test, given each value, its key and this collection
   */
  public find<NewValue extends Value>(fn: (value: Value, key: Key, collection: this) => value is NewValue): NewValue | undefined;
  public find(fn: EntryCallback<Key, Value, this, unknown>): Value | undefined;
  /**
   * The first value the test accepts, with `thisArg` as `this` inside the test.
   *
   * @param fn - The test, given each value, its key and this collection
   * @param thisArg - What `this` is inside the test
   */
  public find<This>(fn: (this: This, value: Value, key: Key, collection: this) => unknown, thisArg: This): Value | undefined;
  public find(fn: EntryCallback<Key, Value, this, unknown>, thisArg?: unknown): Value | undefined {
    return scan(this, fn, thisArg, false)?.[1];
  }

  /**
   * The key of the first entry the test accepts, or `undefined`.
   *
   * @param fn - The test, given each value, its key and this collection
   * @param thisArg - What `this` is inside the test
   */
  public findKey(fn: EntryCallback<Key, Value, this, unknown>, thisArg?: unknown): Key | undefined {
    return scan(this, fn, thisArg, false)?.[0];
  }

  /**
   * The last value the test accepts, searching from the back, or `undefined`.
   *
   * @param fn - The test, given each value, its key and this collection
   * @param thisArg - What `this` is inside the test
   */
  public findLast(fn: EntryCallback<Key, Value, this, unknown>, thisArg?: unknown): Value | undefined {
    return scan(this, fn, thisArg, true)?.[1];
  }

  /**
   * The key of the last entry the test accepts, searching from the back, or `undefined`.
   *
   * @param fn - The test, given each value, its key and this collection
   * @param thisArg - What `this` is inside the test
   */
  public findLastKey(fn: EntryCallback<Key, Value, this, unknown>, thisArg?: unknown): Key | undefined {
    return scan(this, fn, thisArg, true)?.[0];
  }

  /**
   * Deletes, from this collection itself, every entry the test accepts.
   *
   * @param fn - The test, given each value, its key and this collection
   * @param thisArg - What `this` is inside the test
   * @returns How many entries were deleted
   */
  public sweep(fn: EntryCallback<Key, Value, this, unknown>, thisArg?: unknown): number {
    const test = callable(fn, thisArg);
    let removed = 0;
    for (const [key, value] of this) {
      if (test(value, key, this) && this.delete(key)) removed += 1;
    }
    return removed;
  }

  /**
   * A new collection with only the entries the test accepts.
   *
   * @param fn - The test, given each value, its key and this collection
   */
  public filter<NewValue extends Value>(fn: (value: Value, key: Key, collection: this) => value is NewValue): Collection<Key, NewValue>;
  public filter(fn: EntryCallback<Key, Value, this, unknown>): Collection<Key, Value>;
  /**
   * A new collection with only the entries the test accepts, with `thisArg` as `this` inside the test.
   *
   * @param fn - The test, given each value, its key and this collection
   * @param thisArg - What `this` is inside the test
   */
  public filter<This>(fn: (this: This, value: Value, key: Key, collection: this) => unknown, thisArg: This): Collection<Key, Value>;
  public filter(fn: EntryCallback<Key, Value, this, unknown>, thisArg?: unknown): Collection<Key, Value> {
    const test = callable(fn, thisArg);
    const kept = emptyLike<Key, Value>(this);
    for (const [key, value] of this) {
      if (test(value, key, this)) kept.set(key, value);
    }
    return kept;
  }

  /**
   * Splits the entries in two new collections: those the test accepts, then those it rejects.
   *
   * @param fn - The test, given each value, its key and this collection
   * @param thisArg - What `this` is inside the test
   */
  public partition(fn: EntryCallback<Key, Value, this, unknown>, thisArg?: unknown): [Collection<Key, Value>, Collection<Key, Value>] {
    const test = callable(fn, thisArg);
    const accepted = emptyLike<Key, Value>(this);
    const rejected = emptyLike<Key, Value>(this);
    for (const [key, value] of this) {
      (test(value, key, this) ? accepted : rejected).set(key, value);
    }
    return [accepted, rejected];
  }

  /**
   * Turns every entry into a collection and joins them all into one new collection.
   *
   * @param fn - Makes a collection from each value, its key and this collection
   * @param thisArg - What `this` is inside the function
   */
  public flatMap<NewValue>(fn: EntryCallback<Key, Value, this, Collection<Key, NewValue>>, thisArg?: unknown): Collection<Key, NewValue> {
    const joined = emptyLike<Key, NewValue>(this);
    for (const part of this.map(fn, thisArg)) {
      for (const [key, value] of part) joined.set(key, value);
    }
    return joined;
  }

  /**
   * An array with what the function returns for every entry, in order.
   *
   * @param fn - Makes an array item from each value, its key and this collection
   * @param thisArg - What `this` is inside the function
   */
  public map<NewValue>(fn: EntryCallback<Key, Value, this, NewValue>, thisArg?: unknown): NewValue[] {
    const transform = callable(fn, thisArg);
    return Array.from(this, ([key, value]) => transform(value, key, this));
  }

  /**
   * A new collection with the same keys, holding what the function returns for every entry.
   *
   * @param fn - Makes the new value from each value, its key and this collection
   * @param thisArg - What `this` is inside the function
   */
  public mapValues<NewValue>(fn: EntryCallback<Key, Value, this, NewValue>, thisArg?: unknown): Collection<Key, NewValue> {
    const transform = callable(fn, thisArg);
    const mapped = emptyLike<Key, NewValue>(this);
    for (const [key, value] of this) mapped.set(key, transform(value, key, this));
    return mapped;
  }

  /**
   * Whether the test accepts at least one entry.
   *
   * @param fn - The test, given each value, its key and this collection
   * @param thisArg - What `this` is inside the test
   */
  public some(fn: EntryCallback<Key, Value, this, unknown>, thisArg?: unknown): boolean {
    return scan(this, fn, thisArg, false) !== undefined;
  }

  /**
   * Whether the test accepts every entry. An empty collection passes.
   *
   * @param fn - The test, given each value, its key and this collection
   * @param thisArg - What `this` is inside the test
   */
  public every(fn: EntryCallback<Key, Value, this, unknown>, thisArg?: unknown): boolean {
    const test = callable(fn, thisArg);
    return scan<Key, Value, this>(this, (value, key, owner) => !test(value, key, owner), undefined, false) === undefined;
  }

  /**
   * Folds the entries, front to back, into one result.
   *
   * @param fn - Combines the result so far with each value, its key and this collection
   * @param initialValue - The result to start from; without it the first value is the start, and an empty
   * collection throws a `TypeError`
   */
  public reduce<InitialValue = Value>(fn: Reducer<Key, Value, this, InitialValue>, initialValue?: InitialValue): InitialValue {
    return fold(this, this.entries(), fn, arguments.length > 1, initialValue);
  }

  /**
   * Folds the entries, back to front, into one result.
   *
   * @param fn - Combines the result so far with each value, its key and this collection
   * @param initialValue - The result to start from; without it the last value is the start, and an empty
   * collection throws a `TypeError`
   */
  public reduceRight<InitialValue = Value>(fn: Reducer<Key, Value, this, InitialValue>, initialValue?: InitialValue): InitialValue {
    return fold(this, [...this].reverse().values(), fn, arguments.length > 1, initialValue);
  }

  /**
   * Calls the function for every entry, like `forEach`, and returns this collection so calls can chain.
   *
   * @param fn - Called with each value, its key and this collection
   * @param thisArg - What `this` is inside the function
   */
  public each(fn: EntryCallback<Key, Value, this, void>, thisArg?: unknown): this {
    const visit = callable(fn, thisArg);
    for (const [key, value] of this) visit(value, key, this);
    return this;
  }

  /**
   * Hands this collection to the function and returns it, handy in the middle of a chain.
   *
   * @param fn - Called with this collection
   * @param thisArg - What `this` is inside the function
   */
  public tap(fn: (collection: this) => void, thisArg?: unknown): this {
    callable(fn, thisArg)(this);
    return this;
  }

  /**
   * A new collection with the same entries in the same order. The values themselves are shared.
   */
  public clone(): Collection<Key, Value> {
    return emptyLike<Key, Value>(this, this);
  }

  /**
   * A new collection with these entries followed by those of the others. Where a key repeats, the later
   * value wins. Nothing is changed in the sources.
   *
   * @param collections - The collections to add
   */
  public concat(...collections: ReadonlyCollection<Key, Value>[]): Collection<Key, Value> {
    const joined = this.clone();
    for (const source of collections) {
      for (const [key, value] of source) joined.set(key, value);
    }
    return joined;
  }

  /**
   * Whether the other collection holds exactly the same keys with the same values (compared with `===`),
   * even when it is a different object.
   *
   * @param collection - The collection to compare with
   */
  public equals(collection: ReadonlyCollection<Key, Value>): boolean {
    if (!collection) return false;
    if (Object.is(collection, this)) return true;
    return collection.size === this.size && this.every((value, key) => collection.has(key) && collection.get(key) === value);
  }

  /**
   * Puts the entries in order, in this collection itself.
   *
   * @param compareFunction - Decides the order of two entries; by default values are compared with `<`
   * and `>`, which sorts numbers by size and strings alphabetically
   */
  public sort(compareFunction: Comparator<Key, Value> = Collection.defaultSort): this {
    const ordered = [...this].sort(([keyA, valueA], [keyB, valueB]) => compareFunction(valueA, valueB, keyA, keyB));
    super.clear();
    for (const [key, value] of ordered) super.set(key, value);
    return this;
  }

  /**
   * A new collection of the entries the two collections share: same key and the very same value.
   *
   * @param other - The collection to compare with
   */
  public intersect<OtherValue>(other: ReadonlyCollection<Key, OtherValue>): Collection<Key, OtherValue> {
    const shared = emptyLike<Key, OtherValue>(this);
    for (const [key, value] of other) {
      if (this.has(key) && Object.is(this.get(key), value)) shared.set(key, value);
    }
    return shared;
  }

  /**
   * A new collection of this collection's entries whose keys the other one also has.
   *
   * @param other - The collection to compare with
   */
  public intersection(other: ReadonlyCollection<Key, unknown>): Collection<Key, Value> {
    return this.filter((_value, key) => other.has(key));
  }

  /**
   * A new collection with these entries, then the other collection's entries for keys this one lacks.
   *
   * @param other - The collection to add
   */
  public union<OtherValue>(other: ReadonlyCollection<Key, OtherValue>): Collection<Key, OtherValue | Value> {
    const combined = emptyLike<Key, OtherValue | Value>(this, this);
    for (const [key, value] of other) {
      if (!combined.has(key)) combined.set(key, value);
    }
    return combined;
  }

  /**
   * A new collection of this collection's entries, minus those the other holds with the very same value.
   *
   * @param other - The collection to take away
   */
  public subtract<OtherValue>(other: ReadonlyCollection<Key, OtherValue>): Collection<Key, Value> {
    return this.filter((value, key) => !(other.has(key) && Object.is(other.get(key), value)));
  }

  /**
   * The same as {@link Collection.symmetricDifference}: the entries whose keys only one side has.
   *
   * @param other - The collection to compare with
   */
  public difference<OtherValue>(other: ReadonlyCollection<Key, OtherValue>): Collection<Key, OtherValue | Value> {
    return this.symmetricDifference(other);
  }

  /**
   * A new collection of the entries whose keys only one of the two collections has: first those of this
   * collection, then those of the other.
   *
   * @param other - The collection to compare with
   */
  public symmetricDifference<OtherValue>(other: ReadonlyCollection<Key, OtherValue>): Collection<Key, OtherValue | Value> {
    const onlyOneSide: Collection<Key, OtherValue | Value> = this.filter((_value, key) => !other.has(key));
    for (const [key, value] of other) {
      if (!this.has(key)) onlyOneSide.set(key, value);
    }
    return onlyOneSide;
  }

  /**
   * Builds a new collection from the keys of both collections, asking one of three callbacks about each key
   * depending on where it is found. A callback answers `{ keep: true, value }` to add the key with that value,
   * or `{ keep: false }` to leave it out.
   *
   * @param other - The other collection
   * @param whenInSelf - Asked about keys only this collection has
   * @param whenInOther - Asked about keys only the other collection has
   * @param whenInBoth - Asked about keys both have, with both values
   */
  public merge<OtherValue, ResultValue>(other: ReadonlyCollection<Key, OtherValue>, whenInSelf: OneSideAnswer<Key, Value, ResultValue>,
    whenInOther: OneSideAnswer<Key, OtherValue, ResultValue>, whenInBoth: BothSidesAnswer<Key, Value, OtherValue, ResultValue>): Collection<Key, ResultValue> {
    const decide = (key: Key): Keep<ResultValue> => {
      if (!other.has(key)) return whenInSelf(this.get(key) as Value, key);
      if (!this.has(key)) return whenInOther(other.get(key) as OtherValue, key);
      return whenInBoth(this.get(key) as Value, other.get(key) as OtherValue, key);
    };
    const merged = emptyLike<Key, ResultValue>(this);
    for (const key of new Set([...this.keys(), ...other.keys()])) {
      const answer = decide(key);
      if (answer.keep) merged.set(key, answer.value);
    }
    return merged;
  }

  /**
   * A sorted copy; this collection keeps its order.
   *
   * @param compareFunction - Decides the order of two entries, as in {@link Collection.sort}
   */
  public sorted(compareFunction: Comparator<Key, Value> = Collection.defaultSort): Collection<Key, Value> {
    return this.clone().sort(compareFunction);
  }

  /**
   * A sorted copy; this collection keeps its order. The same as {@link Collection.sorted}.
   *
   * @param compareFunction - Decides the order of two entries, as in {@link Collection.sort}
   */
  public toSorted(compareFunction: Comparator<Key, Value> = Collection.defaultSort): Collection<Key, Value> {
    return this.clone().sort(compareFunction);
  }

  /**
   * A copy in the opposite order; this collection keeps its order.
   */
  public toReversed(): Collection<Key, Value> {
    return this.clone().reverse();
  }

  /**
   * The values as an array. `JSON.stringify` uses this, so a collection is written as a list.
   */
  public toJSON(): Value[] {
    return [...this.values()];
  }

  /**
   * The order {@link Collection.sort} uses when it is given no function: smaller values first, by `<` and `>`.
   *
   * @param firstValue - One value
   * @param secondValue - The value to compare it with
   */
  public static defaultSort<Value>(firstValue: Value, secondValue: Value): number {
    if (firstValue === secondValue) return 0;
    return firstValue > secondValue ? 1 : -1;
  }

  /**
   * Builds a collection from entries in which a key may appear more than once; the function decides what
   * a repeated key ends up holding.
   *
   * @param entries - The key and value pairs
   * @param combine - Given the value stored so far, the new one and the key, returns the value to keep
   */
  public static combineEntries<Key, Value>(entries: Iterable<[Key, Value]>, combine: (stored: Value, incoming: Value, key: Key) => Value): Collection<Key, Value> {
    const result = new Collection<Key, Value>();
    for (const [key, value] of entries) {
      result.set(key, result.has(key) ? combine(result.get(key) as Value, value, key) : value);
    }
    return result;
  }
}

export interface Collection<Key, Value> {
  /**
   * The class this collection was made from. New collections returned by its methods are made from the
   * class's `Symbol.species`, so a subclass gets instances of itself back.
   */
  constructor: CollectionConstructor;
}

/**
 * The shape of the `Collection` class itself.
 */
export interface CollectionConstructor {
  new (): Collection<unknown, unknown>;
  new <Key, Value>(entries?: readonly (readonly [Key, Value])[] | null): Collection<Key, Value>;
  new <Key, Value>(iterable: Iterable<readonly [Key, Value]>): Collection<Key, Value>;
  readonly prototype: Collection<unknown, unknown>;
  readonly [Symbol.species]: CollectionConstructor;
}

/** Checks that a callback can be called, and fixes its `this` when one is given. */
function callable<Fn extends Function>(fn: Fn, thisArg?: unknown): Fn {
  if (typeof fn !== 'function') throw new TypeError(`Expected a function, received ${typeof fn}: ${String(fn)}`);
  return thisArg === undefined ? fn : (fn.bind(thisArg) as Fn);
}

/** A new, empty (or seeded) collection of the same class as `source`. */
function emptyLike<Key, Value>(
  source: { constructor: CollectionConstructor },
  seed?: Iterable<readonly [Key, Value]>,
): Collection<Key, Value> {
  const Species = source.constructor[Symbol.species];
  return seed === undefined ? new Species<Key, Value>() : new Species<Key, Value>(seed);
}

/** The first entry, walking forwards or backwards, that the test accepts. */
function scan<Key, Value, Owner extends Collection<Key, Value>>(
  owner: Owner,
  fn: EntryCallback<Key, Value, Owner, unknown>,
  thisArg: unknown,
  fromBack: boolean,
): [Key, Value] | undefined {
  const test = callable(fn, thisArg);
  const order: Iterable<[Key, Value]> = fromBack ? [...owner].reverse() : owner;
  for (const entry of order) {
    if (test(entry[1], entry[0], owner)) return entry;
  }
  return undefined;
}

/** Shared by reduce and reduceRight: folds entries in the order the iterator gives them. */
function fold<Key, Value, Owner, Result>(
  owner: Owner,
  entries: Iterator<[Key, Value]>,
  fn: Reducer<Key, Value, Owner, Result>,
  seeded: boolean,
  seed: Result | undefined,
): Result {
  const combine = callable(fn);
  let result: Result;
  if (seeded) {
    result = seed as Result;
  } else {
    const start = entries.next();
    if (start.done) throw new TypeError('Cannot reduce an empty collection without an initial value');
    result = start.value[1] as unknown as Result;
  }
  for (let step = entries.next(); !step.done; step = entries.next()) {
    result = combine(result, step.value[1], step.value[0], owner);
  }
  return result;
}

/** Up to `amount` items from the start of an iterator. */
function headOf<Item>(iterator: Iterator<Item>, amount: number): Item[] {
  const limit = Math.trunc(amount);
  const taken: Item[] = [];
  while (taken.length < limit) {
    const step = iterator.next();
    if (step.done) break;
    taken.push(step.value);
  }
  return taken;
}

/** Up to `amount` items from the end of an array, in their order. */
function tailOf<Item>(items: Item[], amount: number): Item[] {
  const limit = Math.trunc(amount);
  return limit > 0 ? items.slice(Math.max(0, items.length - limit)) : [];
}

/** The item at an array style position (negative counts from the end) of an iterable of known size. */
function itemAt<Item>(items: Iterable<Item>, size: number, index: number): Item | undefined {
  const whole = Math.trunc(index);
  const target = whole < 0 ? whole + size : whole;
  if (!(target >= 0 && target < size)) return undefined;
  let position = 0;
  for (const item of items) {
    if (position === target) return item;
    position += 1;
  }
  return undefined;
}

/** A whole number from 0 up to, but not including, `length`. */
function randomIndex(length: number): number {
  return Math.floor(Math.random() * length);
}

/** Up to `amount` different items, in random order, without changing the pool's length. */
function drawFrom<Item>(pool: Item[], amount: number): Item[] {
  const count = Math.min(Math.trunc(amount), pool.length);
  if (!(count > 0)) return [];
  for (let slot = 0; slot < count; slot += 1) {
    const chosen = slot + randomIndex(pool.length - slot);
    [pool[slot], pool[chosen]] = [pool[chosen] as Item, pool[slot] as Item];
  }
  return pool.slice(0, count);
}
