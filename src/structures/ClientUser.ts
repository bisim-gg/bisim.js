import type { RawUserData } from '../types/raw.js';
import { Routes } from '../rest/Routes.js';
import { ActivityType } from '../util/Enums.js';
import { type ImageResolvable, imageForm } from '../util/images.js';
import type { ActivityOptions, ClientPresence, PresenceStatusData, PresenceUpdateData } from './Presence.js';
import { User } from './User.js';

/**
 * Data for {@link ClientUser.edit}.
 */
export interface ClientUserEditOptions {
  /** The bot's name (renames its application). */
  username?: string;
  /** The picture: a Buffer, a path, a URL or a `data:` URI; `null` takes it off. */
  avatar?: ImageResolvable | null;
  /** The banner, the same way; `null` takes it off. */
  banner?: ImageResolvable | null;
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
   * Changes the bot's picture, banner or name. On Bisim a bot is named after its application, so a new name renames
   * the application.
   *
   * @param options - What to change
   */
  public async edit(options: ClientUserEditOptions): Promise<this> {
    if (options.avatar !== undefined) await this.setPicture(Routes.currentUserAvatar(), options.avatar);
    if (options.banner !== undefined) await this.setPicture(Routes.currentUserBanner(), options.banner);
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
   * Sets the bot's picture.
   *
   * @param avatar - A Buffer, a path, a URL or a `data:` URI; `null` takes it off
   * @example
   * ```js
   * await client.user.setAvatar('./avatar.png');
   * ```
   */
  public setAvatar(avatar: ImageResolvable | null): Promise<this> {
    return this.edit({ avatar });
  }

  /**
   * Sets the bot's banner.
   *
   * @param banner - A Buffer, a path, a URL or a `data:` URI; `null` takes it off
   */
  public setBanner(banner: ImageResolvable | null): Promise<this> {
    return this.edit({ banner });
  }

  /** Uploads (or with `null` removes) the picture or banner, and takes the new keys. */
  private async setPicture(route: `/${string}`, image: ImageResolvable | null): Promise<void> {
    const data =
      image === null
        ? await this.client.rest.delete(route)
        : await this.client.rest.post(route, { body: await imageForm(image), passThroughBody: true });
    if (data && typeof data === 'object') {
      const profile = data as { avatarKey?: string | null; bannerKey?: string | null };
      const patch: Partial<RawUserData> & { bannerKey?: string | null } = {};
      if ('avatarKey' in profile) patch.avatarKey = profile.avatarKey ?? null;
      if ('bannerKey' in profile) patch.bannerKey = profile.bannerKey ?? null;
      this._patch(patch);
    }
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
