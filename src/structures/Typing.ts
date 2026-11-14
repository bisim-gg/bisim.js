import type { Client } from '../client/Client.js';
import { Base } from './Base.js';
import type { TextBasedChannel } from './channels/index.js';
import type { Guild } from './Guild.js';
import type { GuildMember } from './GuildMember.js';
import type { User } from './User.js';
import { dateFrom } from '../util/internal.js';

/**
 * Someone started typing in a channel.
 */
export class Typing extends Base {
  /** The channel. */
  public channel: TextBasedChannel;
  /** Who is typing. */
  public user: User;
  /** When they started, in milliseconds. */
  public startedTimestamp: number;
  /** The server's id, or `null` in a DM. */
  public guildId: string | null;

  /**
   * @param client - The client
   * @param channel - The channel
   * @param user - Who is typing
   * @param data - When they started and in which server
   */
  public constructor(client: Client, channel: TextBasedChannel, user: User, data: { startedTimestamp?: number; guildId?: string | null } = {}) {
    super(client);
    this.channel = channel;
    this.user = user;
    this.startedTimestamp = data.startedTimestamp ?? Date.now();
    this.guildId = data.guildId ?? null;
  }

  /**
   * When they started.
   */
  public get startedAt(): Date {
    return dateFrom(this.startedTimestamp);
  }

  /**
   * The server, or `null` in a DM.
   */
  public get guild(): Guild | null {
    return this.guildId ? (this.client.guilds.cache.get(this.guildId) ?? null) : null;
  }

  /**
   * Who is typing, as a member of the server, or `null`.
   */
  public get member(): GuildMember | null {
    return this.guild?.members.cache.get(this.user.id) ?? null;
  }

  /**
   * Whether this happened in a server.
   */
  public inGuild(): boolean {
    return this.guildId !== null;
  }
}
