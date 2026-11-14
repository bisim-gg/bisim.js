import { Routes } from '../rest/Routes.js';
import type { GuildChannel } from '../structures/channels/GuildChannel.js';
import {
  type GuildChannelOverwriteOptions,
  type OverwriteData,
  type PermissionOverwriteOptions,
  PermissionOverwrites,
} from '../structures/PermissionOverwrites.js';
import type { RawOverwriteData } from '../types/raw.js';
import type { Collection } from '../util/Collection.js';
import { OverwriteType } from '../util/Enums.js';
import { CachedManager } from './BaseManager.js';
import { attachHidden } from '../util/internal.js';

/**
 * A role or member an overwrite can target.
 */
export type OverwriteTargetResolvable = string | { id: string };

/**
 * Manages the permission overwrites of a channel.
 */
export class PermissionOverwriteManager extends CachedManager<string, PermissionOverwrites, OverwriteTargetResolvable> {
  /** The channel. */
  public declare readonly channel: GuildChannel;

  /**
   * Whether the overwrites were loaded (Bisim sends them on request, not with the server).
   */
  public loaded = false;

  /**
   * @param channel - The channel
   */
  public constructor(channel: GuildChannel) {
    super(channel.client);
    attachHidden(this, 'channel', channel);
  }

  /**
   * Adds an overwrite to the cache.
   *
   * @internal
   */
  public _add(data: RawOverwriteData, cache = true): PermissionOverwrites {
    const id = (data.id ?? data.targetId)!;
    const refreshed = this.refreshCached(id, data);
    if (refreshed) return refreshed;
    const overwrite = new PermissionOverwrites(this.client, data, this.channel);
    if (cache) this.cache.set(id, overwrite);
    return overwrite;
  }

  /**
   * Loads the channel's overwrites from Bisim (a Bisim addition: Discord sends them with the channel).
   */
  public async fetch(): Promise<Collection<string, PermissionOverwrites>> {
    const data = (await this.client.rest.get(Routes.guildChannelOverwrites(this.channel.guildId, this.channel.id))) as RawOverwriteData[];
    this.cache.clear();
    for (const overwrite of data) this._add(overwrite);
    this.loaded = true;
    return this.cache;
  }

  /**
   * Replaces every overwrite of the channel.
   *
   * @param overwrites - The overwrites to have
   * @param reason - Why
   */
  public async set(
    overwrites: readonly (OverwriteData | PermissionOverwrites)[] | Collection<string, OverwriteData | PermissionOverwrites>,
    reason?: string,
  ): Promise<GuildChannel> {
    if (!this.loaded) await this.fetch();
    const list = Array.isArray(overwrites) ? overwrites : [...(overwrites as Collection<string, OverwriteData>).values()];
    const resolved = list.map((overwrite) => PermissionOverwrites.resolve(overwrite, this.channel.guild));
    const keep = new Set(resolved.map((overwrite) => overwrite.id));
    for (const overwrite of resolved) {
      await this.put(overwrite.id, overwrite.type, overwrite.allow, overwrite.deny, reason);
    }
    for (const id of [...this.cache.keys()]) {
      if (!keep.has(id)) await this.delete(id, reason);
    }
    return this.channel;
  }

  /**
   * Creates or edits the overwrite of a role or member.
   *
   * @param userOrRole - The target
   * @param options - The changes
   * @param overwriteOptions - The type and the reason
   * @param existing - The overwrite to merge with
   * @internal
   */
  public async upsert(
    userOrRole: OverwriteTargetResolvable,
    options: PermissionOverwriteOptions,
    overwriteOptions: GuildChannelOverwriteOptions = {},
    existing?: PermissionOverwrites,
  ): Promise<GuildChannel> {
    const id = typeof userOrRole === 'string' ? userOrRole : userOrRole.id;
    const guild = this.channel.guild;
    const type =
      overwriteOptions.type ??
      existing?.type ??
      (guild.roles.cache.has(id) || id === guild.id ? OverwriteType.Role : OverwriteType.Member);
    const { allow, deny } = PermissionOverwrites.resolveOverwriteOptions(options, existing ?? {});
    await this.put(id, type, allow.bitfield.toString(), deny.bitfield.toString(), overwriteOptions.reason);
    return this.channel;
  }

  /**
   * Creates (or replaces) the overwrite of a role or member.
   *
   * @param userOrRole - The target
   * @param options - The permissions
   * @param overwriteOptions - The type and the reason
   */
  public create(
    userOrRole: OverwriteTargetResolvable,
    options: PermissionOverwriteOptions,
    overwriteOptions?: GuildChannelOverwriteOptions,
  ): Promise<GuildChannel> {
    return this.upsert(userOrRole, options, overwriteOptions);
  }

  /**
   * Edits the overwrite of a role or member, merging with what it has.
   *
   * @param userOrRole - The target
   * @param options - The changes
   * @param overwriteOptions - The type and the reason
   */
  public async edit(
    userOrRole: OverwriteTargetResolvable,
    options: PermissionOverwriteOptions,
    overwriteOptions?: GuildChannelOverwriteOptions,
  ): Promise<GuildChannel> {
    if (!this.loaded) await this.fetch().catch(() => undefined);
    const id = typeof userOrRole === 'string' ? userOrRole : userOrRole.id;
    return this.upsert(userOrRole, options, overwriteOptions, this.cache.get(id));
  }

  /**
   * Deletes the overwrite of a role or member.
   *
   * @param userOrRole - The target
   * @param reason - Why
   */
  public async delete(userOrRole: OverwriteTargetResolvable, reason?: string): Promise<GuildChannel> {
    const id = typeof userOrRole === 'string' ? userOrRole : userOrRole.id;
    await this.client.rest.delete(Routes.guildChannelOverwrite(this.channel.guildId, this.channel.id, id), { reason });
    this.cache.delete(id);
    return this.channel;
  }

  private async put(id: string, type: OverwriteType, allow: string, deny: string, reason?: string): Promise<void> {
    const data = (await this.client.rest.put(Routes.guildChannelOverwrite(this.channel.guildId, this.channel.id, id), {
      body: { type, allow, deny },
      reason,
    })) as RawOverwriteData | undefined;
    this._add(data && typeof data === 'object' ? { ...data, id } : { id, type, allow, deny });
  }
}
