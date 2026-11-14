import type { Client } from '../client/Client.js';
import { flatten } from '../util/Util.js';
import { attachHidden } from '../util/internal.js';

/**
 * The base of every structure that belongs to a client.
 */
export abstract class Base {
  /**
   * The client that made this structure.
   */
  public declare readonly client: Client<true>;

  /**
   * @param client - The client that made this structure
   */
  protected constructor(client: Client) {
    attachHidden(this, 'client', client);
  }

  /**
   * A shallow copy of this structure, used to hand out the "old" side of an update event.
   *
   * @internal
   */
  public _clone(): this {
    return Object.assign(Object.create(this) as this, this);
  }

  /**
   * Applies data from Bisim to this structure.
   *
   * @internal
   */
  public _patch(data: unknown): unknown {
    return data;
  }

  /**
   * Applies data and returns a copy of the structure as it was before.
   *
   * @internal
   */
  public _update(data: unknown): this {
    const clone = this._clone();
    this._patch(data);
    return clone;
  }

  /**
   * The structure as a plain object.
   *
   * @param props - Properties to include, exclude or rename
   */
  public toJSON(...props: Record<string, boolean | string>[]): unknown {
    const plain = flatten(this, ...props);
    return plain;
  }

  /**
   * The id of the structure, so structures compare by id.
   */
  public valueOf(): string {
    return (this as unknown as { id?: string }).id ?? '';
  }
}
