import type { Client } from '../client/Client.js';
import type { RawBanData } from '../types/raw.js';
import { Base } from './Base.js';
import type { Guild } from './Guild.js';
import type { User } from './User.js';
import { attachHidden } from '../util/internal.js';

/**
 * A ban in a server.
 */
export class GuildBan extends Base {
  /** The server. */
  public declare readonly guild: Guild;
  /** The banned user. */
  public user!: User;
  /** Why they were banned. */
  public reason!: string | null;
  /** Who banned them (Bisim's own addition). */
  public bannedById!: string | null;
  /** When they were banned, in milliseconds. */
  public createdTimestamp!: number | null;

  /**
   * @param client - The client
   * @param data - The ban from Bisim
   * @param guild - The server
   */
  public constructor(client: Client, data: RawBanData, guild: Guild) {
    super(client);
    attachHidden(this, 'guild', guild);
    this.reason = null;
    this.bannedById = null;
    this.createdTimestamp = null;
    this._patch(data);
  }

  public override _patch(data: Partial<RawBanData>): void {
    if (data.user) this.user = this.client.users._add(data.user);
    else if (data.userId && !this.user) this.user = this.client.users._add({ id: data.userId } as never, false);
    if ('reason' in data) this.reason = data.reason ?? null;
    if ('bannedById' in data) this.bannedById = data.bannedById ?? null;
    if (data.createdAt) this.createdTimestamp = Date.parse(data.createdAt);
  }

  /**
   * Whether this ban is partial.
   */
  public get partial(): boolean {
    return !('reason' in this);
  }

  /**
   * Fetches this ban again.
   *
   * @param force - Whether to skip the cache
   */
  public fetch(force = true): Promise<GuildBan> {
    return this.guild.bans.fetch({ user: this.user.id, cache: true, force });
  }
}
