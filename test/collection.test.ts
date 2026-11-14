import { describe, expect, it } from 'vitest';
import { Collection } from '../src/index.js';

const letters = () =>
  new Collection<string, number>([
    ['a', 1],
    ['b', 2],
    ['c', 3],
    ['d', 4],
  ]);

const keysOf = (collection: Map<string, unknown>) => [...collection.keys()];
const valuesOf = <Value>(collection: Map<string, Value>) => [...collection.values()];

describe('Collection: reading', () => {
  it('ensure returns what is there, or stores what the generator makes', () => {
    const coll = letters();
    expect(coll.ensure('a', () => 100)).toBe(1);
    const seen: unknown[] = [];
    expect(
      coll.ensure('z', (key, collection) => {
        seen.push(key, collection);
        return 26;
      }),
    ).toBe(26);
    expect(seen).toEqual(['z', coll]);
    expect(coll.get('z')).toBe(26);
    expect(() => coll.ensure('y', 5 as never)).toThrow(TypeError);
  });

  it('hasAll and hasAny', () => {
    const coll = letters();
    expect(coll.hasAll('a', 'b')).toBe(true);
    expect(coll.hasAll('a', 'x')).toBe(false);
    expect(coll.hasAny('x', 'b')).toBe(true);
    expect(coll.hasAny('x', 'y')).toBe(false);
    expect(coll.hasAll()).toBe(true);
    expect(coll.hasAny()).toBe(false);
  });

  it('first, firstKey, last and lastKey take an optional amount', () => {
    const coll = letters();
    expect(coll.first()).toBe(1);
    expect(coll.first(2)).toEqual([1, 2]);
    expect(coll.first(10)).toEqual([1, 2, 3, 4]);
    expect(coll.first(0)).toEqual([]);
    expect(coll.first(-2)).toEqual([3, 4]);
    expect(coll.firstKey()).toBe('a');
    expect(coll.firstKey(3)).toEqual(['a', 'b', 'c']);
    expect(coll.firstKey(-1)).toEqual(['d']);
    expect(coll.last()).toBe(4);
    expect(coll.last(2)).toEqual([3, 4]);
    expect(coll.last(10)).toEqual([1, 2, 3, 4]);
    expect(coll.last(0)).toEqual([]);
    expect(coll.last(-2)).toEqual([1, 2]);
    expect(coll.lastKey()).toBe('d');
    expect(coll.lastKey(2)).toEqual(['c', 'd']);
    expect(coll.lastKey(-1)).toEqual(['a']);

    const empty = new Collection<string, number>();
    expect(empty.first()).toBeUndefined();
    expect(empty.last()).toBeUndefined();
    expect(empty.firstKey(2)).toEqual([]);
    expect(empty.lastKey(2)).toEqual([]);
  });

  it('at and keyAt count from the end for negative indexes', () => {
    const coll = letters();
    expect(coll.at(0)).toBe(1);
    expect(coll.at(3)).toBe(4);
    expect(coll.at(4)).toBeUndefined();
    expect(coll.at(-1)).toBe(4);
    expect(coll.at(-4)).toBe(1);
    expect(coll.at(-5)).toBeUndefined();
    expect(coll.at(1.9)).toBe(2);
    expect(coll.keyAt(1)).toBe('b');
    expect(coll.keyAt(-2)).toBe('c');
    expect(coll.keyAt(9)).toBeUndefined();
  });

  it('random and randomKey pick distinct entries', () => {
    const coll = letters();
    expect([1, 2, 3, 4]).toContain(coll.random());
    expect(['a', 'b', 'c', 'd']).toContain(coll.randomKey());
    const three = coll.random(3);
    expect(three).toHaveLength(3);
    expect(new Set(three).size).toBe(3);
    expect(coll.random(10).sort()).toEqual([1, 2, 3, 4]);
    expect(coll.random(0)).toEqual([]);
    expect(new Set(coll.randomKey(4)).size).toBe(4);

    const empty = new Collection<string, number>();
    expect(empty.random()).toBeUndefined();
    expect(empty.random(2)).toEqual([]);
    expect(empty.randomKey()).toBeUndefined();
    expect(empty.randomKey(2)).toEqual([]);
  });
});

describe('Collection: searching', () => {
  it('find, findKey, findLast and findLastKey', () => {
    const coll = letters();
    expect(coll.find((value) => value > 1)).toBe(2);
    expect(coll.findKey((value) => value > 1)).toBe('b');
    expect(coll.findLast((value) => value < 4)).toBe(3);
    expect(coll.findLastKey((value) => value < 4)).toBe('c');
    expect(coll.find((value) => value > 10)).toBeUndefined();
    expect(coll.findKey((value) => value > 10)).toBeUndefined();
    expect(coll.findLast((value) => value > 10)).toBeUndefined();
    expect(coll.findLastKey((value) => value > 10)).toBeUndefined();
  });

  it('passes the key and the collection, and binds thisArg', () => {
    const coll = letters();
    const context = { limit: 2 };
    expect(
      coll.find(function (this: typeof context, value) {
        return value > this.limit;
      }, context),
    ).toBe(3);
    const calls: [number, string, unknown][] = [];
    coll.findKey((value, key, collection) => {
      calls.push([value, key, collection]);
      return false;
    });
    expect(calls).toEqual([
      [1, 'a', coll],
      [2, 'b', coll],
      [3, 'c', coll],
      [4, 'd', coll],
    ]);
  });

  it('throws a TypeError when the callback is not a function', () => {
    const coll = letters();
    const notAFunction = 'nope' as never;
    expect(() => coll.find(notAFunction)).toThrow(TypeError);
    expect(() => coll.findKey(notAFunction)).toThrow(TypeError);
    expect(() => coll.findLast(notAFunction)).toThrow(TypeError);
    expect(() => coll.findLastKey(notAFunction)).toThrow(TypeError);
    expect(() => coll.filter(notAFunction)).toThrow(TypeError);
    expect(() => coll.partition(notAFunction)).toThrow(TypeError);
    expect(() => coll.map(notAFunction)).toThrow(TypeError);
    expect(() => coll.mapValues(notAFunction)).toThrow(TypeError);
    expect(() => coll.some(notAFunction)).toThrow(TypeError);
    expect(() => coll.every(notAFunction)).toThrow(TypeError);
    expect(() => coll.reduce(notAFunction)).toThrow(TypeError);
    expect(() => coll.reduceRight(notAFunction)).toThrow(TypeError);
    expect(() => coll.each(notAFunction)).toThrow(TypeError);
    expect(() => coll.tap(notAFunction)).toThrow(TypeError);
    expect(() => coll.sweep(notAFunction)).toThrow(TypeError);
  });

  it('some and every', () => {
    const coll = letters();
    expect(coll.some((value) => value === 3)).toBe(true);
    expect(coll.some((value) => value === 9)).toBe(false);
    expect(coll.every((value) => value > 0)).toBe(true);
    expect(coll.every((value) => value > 1)).toBe(false);
    expect(new Collection().some(() => true)).toBe(false);
    expect(new Collection().every(() => false)).toBe(true);
  });
});

describe('Collection: transforming', () => {
  it('filter and partition return new collections', () => {
    const coll = letters();
    const even = coll.filter((value) => value % 2 === 0);
    expect(even).toBeInstanceOf(Collection);
    expect(keysOf(even)).toEqual(['b', 'd']);
    expect(coll.size).toBe(4);
    const [pass, fail] = coll.partition((value) => value > 2);
    expect(keysOf(pass)).toEqual(['c', 'd']);
    expect(keysOf(fail)).toEqual(['a', 'b']);
    const context = { min: 3 };
    expect(
      keysOf(
        coll.filter(function (this: typeof context, value) {
          return value >= this.min;
        }, context),
      ),
    ).toEqual(['c', 'd']);
  });

  it('map, mapValues and flatMap', () => {
    const coll = letters();
    expect(coll.map((value, key) => `${key}${value}`)).toEqual(['a1', 'b2', 'c3', 'd4']);
    const doubled = coll.mapValues((value) => value * 2);
    expect(doubled.get('c')).toBe(6);
    expect(keysOf(doubled)).toEqual(['a', 'b', 'c', 'd']);
    const flat = coll.flatMap((value, key) => new Collection([[`${key}${key}`, value * 100]]));
    expect([...flat.entries()]).toEqual([
      ['aa', 100],
      ['bb', 200],
      ['cc', 300],
      ['dd', 400],
    ]);
  });

  it('reduce and reduceRight, with and without a start value', () => {
    const coll = letters();
    expect(coll.reduce((sum, value) => sum + value, 0)).toBe(10);
    expect(coll.reduce((sum, value) => sum + value)).toBe(10);
    expect(coll.reduce((text, _value, key) => text + key, '')).toBe('abcd');
    expect(coll.reduceRight((text, _value, key) => text + key, '')).toBe('dcba');
    expect(coll.reduceRight((total, value) => total * 10 + value)).toBe(4321);
    expect(new Collection<string, number>().reduce((sum, value) => sum + value, 5)).toBe(5);
    expect(() => new Collection<string, number>().reduce((sum, value) => sum + value)).toThrow(TypeError);
    expect(() => new Collection<string, number>().reduceRight((sum, value) => sum + value)).toThrow(TypeError);
  });

  it('each and tap return the collection itself', () => {
    const coll = letters();
    const seen: string[] = [];
    expect(coll.each((value, key) => seen.push(key + value))).toBe(coll);
    expect(seen).toEqual(['a1', 'b2', 'c3', 'd4']);
    let tapped: unknown;
    expect(coll.tap((collection) => (tapped = collection))).toBe(coll);
    expect(tapped).toBe(coll);
  });

  it('sweep removes in place and counts', () => {
    const coll = letters();
    expect(coll.sweep((value) => value > 2)).toBe(2);
    expect(keysOf(coll)).toEqual(['a', 'b']);
    expect(coll.sweep(() => false)).toBe(0);
  });

  it('reverse works in place; toReversed copies', () => {
    const coll = letters();
    const copy = coll.toReversed();
    expect(keysOf(copy)).toEqual(['d', 'c', 'b', 'a']);
    expect(keysOf(coll)).toEqual(['a', 'b', 'c', 'd']);
    expect(coll.reverse()).toBe(coll);
    expect(keysOf(coll)).toEqual(['d', 'c', 'b', 'a']);
  });

  it('sort works in place; sorted and toSorted copy', () => {
    const coll = new Collection<string, number>([
      ['x', 3],
      ['y', 1],
      ['z', 2],
    ]);
    expect(valuesOf(coll.sorted())).toEqual([1, 2, 3]);
    expect(valuesOf(coll.toSorted((first, second) => second - first))).toEqual([3, 2, 1]);
    expect(valuesOf(coll)).toEqual([3, 1, 2]);
    expect(coll.sort((_first, _second, firstKey, secondKey) => secondKey.localeCompare(firstKey))).toBe(coll);
    expect(keysOf(coll)).toEqual(['z', 'y', 'x']);
    const words = new Collection([
      [1, 'pear'],
      [2, 'apple'],
      [3, 'fig'],
    ]);
    expect([...words.sort().values()]).toEqual(['apple', 'fig', 'pear']);
  });

  it('defaultSort orders like the default array sort', () => {
    expect(Collection.defaultSort(1, 2)).toBe(-1);
    expect(Collection.defaultSort(2, 1)).toBe(1);
    expect(Collection.defaultSort(2, 2)).toBe(0);
    expect(Collection.defaultSort('b', 'a')).toBe(1);
  });
});

describe('Collection: combining', () => {
  const left = () =>
    new Collection<string, number>([
      ['a', 1],
      ['b', 2],
      ['c', 3],
    ]);
  const right = () =>
    new Collection<string, number>([
      ['b', 2],
      ['c', 30],
      ['d', 4],
    ]);

  it('clone, concat and equals', () => {
    const coll = left();
    const clone = coll.clone();
    expect(clone).not.toBe(coll);
    expect(clone.equals(coll)).toBe(true);
    const joined = coll.concat(right(), new Collection([['e', 5]]));
    expect([...joined.entries()]).toEqual([
      ['a', 1],
      ['b', 2],
      ['c', 30],
      ['d', 4],
      ['e', 5],
    ]);
    expect(coll.size).toBe(3);
    expect(coll.equals(coll)).toBe(true);
    expect(coll.equals(right())).toBe(false);
    expect(coll.equals(new Collection([['a', 1]]))).toBe(false);
    expect(coll.equals(null as never)).toBe(false);
  });

  it('intersect keeps the entries both hold with the same value', () => {
    expect([...left().intersect(right()).entries()]).toEqual([['b', 2]]);
  });

  it('intersection keeps this collection\'s entries whose keys the other has', () => {
    expect([...left().intersection(right()).entries()]).toEqual([
      ['b', 2],
      ['c', 3],
    ]);
  });

  it('union adds the other collection\'s new keys', () => {
    expect([...left().union(right()).entries()]).toEqual([
      ['a', 1],
      ['b', 2],
      ['c', 3],
      ['d', 4],
    ]);
  });

  it('subtract drops the entries the other holds with the same value', () => {
    expect([...left().subtract(right()).entries()]).toEqual([
      ['a', 1],
      ['c', 3],
    ]);
  });

  it('difference and symmetricDifference keep the keys only one side has', () => {
    expect([...left().symmetricDifference(right()).entries()]).toEqual([
      ['a', 1],
      ['d', 4],
    ]);
    expect([...left().difference(right()).entries()]).toEqual([
      ['a', 1],
      ['d', 4],
    ]);
  });

  it('merge asks a callback for every key', () => {
    const merged = left().merge(
      right(),
      (value) => ({ keep: true, value: `left ${value}` }),
      (value) => ({ keep: value > 10, value: `right ${value}` }),
      (value, other, key) => (key === 'b' ? { keep: false } : { keep: true, value: `both ${value} ${other}` }),
    );
    expect([...merged.entries()]).toEqual([
      ['a', 'left 1'],
      ['c', 'both 3 30'],
    ]);
  });

  it('combineEntries folds duplicate keys', () => {
    const combined = Collection.combineEntries(
      [
        ['a', 1],
        ['b', 2],
        ['a', 10],
      ],
      (first, second, key) => (key === 'a' ? first + second : first),
    );
    expect([...combined.entries()]).toEqual([
      ['a', 11],
      ['b', 2],
    ]);
  });
});

describe('Collection: shape', () => {
  it('serializes to its values', () => {
    expect(JSON.stringify(letters())).toBe('[1,2,3,4]');
    expect(letters().toJSON()).toEqual([1, 2, 3, 4]);
  });

  it('builds results of the same class as the source', () => {
    class Named<Key, Value> extends Collection<Key, Value> {}
    const named = new Named<string, number>([
      ['a', 1],
      ['b', 2],
    ]);
    expect(named.filter(() => true)).toBeInstanceOf(Named);
    expect(named.mapValues((value) => value)).toBeInstanceOf(Named);
    expect(named.clone()).toBeInstanceOf(Named);
    expect(named.partition(() => true)[1]).toBeInstanceOf(Named);
  });
});
