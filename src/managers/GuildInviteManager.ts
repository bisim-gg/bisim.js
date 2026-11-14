import { BisimjsError, ErrorCodes } from '../errors/index.js';
import { Routes } from '../rest/Routes.js';
import type { InviteCreateOptions } from '../structures/channels/GuildChannel.js';
import type { Guild } from '../structures/Guild.js';
import { Invite } from '../structures/Invite.js';
import type { RawInviteData } from '../types/raw.js';
import { Collection } from '../util/Collection.js';
import { CachedManager } from './BaseManager.js';
import type { GuildChannelResolvable } from './GuildChannelManager.js';
import { attachHidden } from '../util/internal.js';

/**
 * Manages the invites of a server.
 */
export class GuildInviteManager extends CachedManager<string, Invite, Invite | string> {
  /** The server. */
  public declare readonly guild: Guild;

  /**
   * @param guild - The server
   */
  public constructor(guild: Guild) {
    super(guild.client);
    attachHidden(this, 'guild', guild);
  }

  /**
   * Adds an invite to the cache.
   *
   * @internal
   */
  public _add(data: RawInviteData, cache = true): Invite {
    const refreshed = this.refreshCached(data.code, data);
    if (refreshed) return refreshed;
    const invite = new Invite(this.client, { guildId: this.guild.id, ...data });
    if (cache) this.cache.set(invite.code, invite);
    return invite;
  }

  /**
   * Fetches one invite by code, or every invite of the server.
   *
   * @param options - The code, or options
   */
  public fetch(options: string | { code: string; cache?: boolean; force?: boolean }): Promise<Invite>;
  public fetch(options?: { cache?: boolean; channelId?: string }): Promise<Collection<string, Invite>>;
  public async fetch(
    options?: string | { code?: string; cache?: boolean; force?: boolean; channelId?: string },
  ): Promise<Invite | Collection<string, Invite>> {
    const code = typeof options === 'string' ? options : options?.code;
    const cache = typeof options === 'object' ? (options.cache ?? true) : true;
    if (code) {
      if (typeof options !== 'object' || !options.force) {
        const cached = this.fromCache(code);
        if (cached) return cached;
      }
      const all = await this.fetch({ cache });
      const found = all.get(code);
      if (!found) throw new BisimjsError(ErrorCodes.InviteNotFound);
      return found;
    }
    const data = (await this.client.rest.get(Routes.guildInvites(this.guild.id))) as RawInviteData[];
    const invites = new Collection<string, Invite>();
    for (const raw of data) {
      const invite = this._add(raw, cache);
      if (typeof options === 'object' && options.channelId && invite.channelId !== options.channelId) continue;
      invites.set(invite.code, invite);
    }
    return invites;
  }

  /**
   * Creates an invite to a channel.
   *
   * @param channel - The channel
   * @param options - How long and how many uses
   */
  public async create(channel: GuildChannelResolvable, options: InviteCreateOptions = {}): Promise<Invite> {
    const channelId = typeof channel === 'string' ? channel : channel?.id;
    if (!channelId) throw new BisimjsError(ErrorCodes.InviteOptionsMissingChannel);
    const body: Record<string, unknown> = { channelId };
    if (options.maxUses) body.maxUses = options.maxUses;
    body.maxAgeSec = Math.min(30 * 86_400, Math.max(0, Math.floor(options.maxAge ?? 86_400)));
    const data = (await this.client.rest.post(Routes.guildInvites(this.guild.id), { body, reason: options.reason })) as RawInviteData;
    return this._add(data);
  }

  /**
   * Deletes an invite.
   *
   * @param invite - The invite or its code
   * @param reason - Why
   */
  public async delete(invite: Invite | string, reason?: string): Promise<void> {
    const code = typeof invite === 'string' ? invite : invite.code;
    await this.client.rest.delete(Routes.guildInvite(this.guild.id, code), { reason });
    this.cache.delete(code);
  }
}
