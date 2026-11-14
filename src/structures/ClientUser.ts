import type { RawUserData } from '../types/raw.js';
import { Routes } from '../rest/Routes.js';
import { ActivityType } from '../util/Enums.js';
import { notSupported } from '../util/Util.js';
import type { ActivityOptions, ClientPresence, PresenceStatusData, PresenceUpdateData } from './Presence.js';
import { User } from './User.js';

/**
 * Data for {@link ClientUser.edit}.
 */
export interface ClientUserEditOptions {
  username?: string;
  avatar?: unknown;
  banner?: unknown;
}

/**
 * The bot's own user.
 */
export class ClientUser extends User {
  /** Whether the account is verified (always `true` for a bot). */
  public verified!: boolean;
  /** Whether two factor login is on for the account. */
  public mfaEnabled!: boolean;

  public override _patch(data: Partial<RawUserData> & { totpEnabled?: boolean }): void {
    super._patch(data);
    this.verified = true;
    if ('totpEnabled' in data) this.mfaEnabled = Boolean(data.totpEnabled);
    else this.mfaEnabled ??= false;
    if (data.bot === undefined && !this.bot) this.bot = true;
  }

  /**
   * The bot's presence.
   */
  public get presence(): ClientPresence {
    return this.client.presence;
  }

  /**
   * Changes the bot's name. On Bisim a bot is named after its application, so this renames the application.
   * Avatars and banners of bots are set in the app's settings, not through the API.
   *
   * @param options - What to change
   */
  public async edit(options: ClientUserEditOptions): Promise<this> {
    if (options.avatar !== undefined) notSupported("Changing a bot's avatar through the API");
    if (options.banner !== undefined) notSupported("Changing a bot's banner through the API");
    if (options.username !== undefined) {
      await this.client.rest.patch(Routes.application(this.id), { body: { name: options.username } });
      const me = (await this.client.rest.get(Routes.user())) as RawUserData;
      this._patch(me);
    }
    return this;
  }

  /**
   * Changes the bot's name (by renaming its application).
   *
   * @param username - The new name
   */
  public setUsername(username: string): Promise<this> {
    const changes = { username };
    return this.edit(changes);
  }

  /**
   * Not on Bisim: a bot's avatar is set in the app's settings.
   */
  public setAvatar(_avatar: unknown): Promise<this> {
    return notSupported("Changing a bot's avatar through the API");
  }

  /**
   * Not on Bisim: a bot's banner is set in the app's settings.
   */
  public setBanner(_banner: unknown): Promise<this> {
    return notSupported("Changing a bot's banner through the API");
  }

  /**
   * Sets the bot's presence: status and activity.
   *
   * @param data - The presence
   * @example
   * ```js
   * client.user.setPresence({ status: 'idle', activities: [{ name: 'the queue', type: ActivityType.Watching }] });
   * ```
   */
  public setPresence(data: PresenceUpdateData): ClientPresence {
    const { presence } = this.client;
    return presence.set(data);
  }

  /**
   * Sets the bot's status.
   *
   * @param status - The status
   * @param shardId - Accepted for compatibility (Bisim has one connection)
   */
  public setStatus(status: PresenceStatusData, shardId?: number | readonly number[]): ClientPresence {
    return this.setPresence({ shardId, status });
  }

  /**
   * Sets the bot's activity, or clears it with no arguments.
   *
   * @param name - The activity name, or the whole activity
   * @param options - The type and other details
   * @example
   * ```js
   * client.user.setActivity('the server', { type: ActivityType.Watching });
   * ```
   */
  public setActivity(name?: string | ActivityOptions, options: Omit<ActivityOptions, 'name'> = {}): ClientPresence {
    if (name === undefined) return this.setPresence({ activities: [], shardId: options.shardId });
    const activity = typeof name === 'string' ? { name, ...options } : name;
    return this.setPresence({
      activities: [{ name: activity.name, type: activity.type ?? ActivityType.Playing, url: activity.url, state: activity.state }],
      shardId: activity.shardId,
    });
  }

  /**
   * Accepted for compatibility. In Discord this only changes where push notifications go; Bisim has no such
   * setting for bots, so nothing visible changes.
   *
   * @param afk - Whether the bot is away
   * @param shardId - Accepted for compatibility
   */
  public setAFK(afk = true, shardId?: number | readonly number[]): ClientPresence {
    return this.setPresence({ shardId, afk });
  }
}
