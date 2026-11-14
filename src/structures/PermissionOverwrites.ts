import type { Client } from '../client/Client.js';
import type { RawOverwriteData } from '../types/raw.js';
import { OverwriteType } from '../util/Enums.js';
import { PermissionsBitField, type PermissionsString } from '../util/PermissionsBitField.js';
import { Base } from './Base.js';
import type { GuildChannel } from './channels/GuildChannel.js';
import type { Guild } from './Guild.js';
import { attachHidden } from '../util/internal.js';

/**
 * Permission changes for a role or member in a channel: `true` allows, `false` denies, `null` resets.
 *
 * @example
 * ```js
 * { ViewChannel: true, SendMessages: false, AddReactions: null }
 * ```
 */
export type PermissionOverwriteOptions = Partial<Record<PermissionsString, boolean | null>>;

/**
 * Options for creating or editing an overwrite.
 */
export interface GuildChannelOverwriteOptions {
  /** Why (for the audit log). */
  reason?: string;
  /** Whether the target is a role or a member, when it cannot be told from the id. */
  type?: OverwriteType;
}

/**
 * An overwrite in the shape discord.js resolves: the target and the allowed and denied bits.
 */
export interface OverwriteData {
  id: string | { id: string };
  type?: OverwriteType;
  allow?: PermissionsBitField | bigint | string | PermissionsString[] | readonly PermissionsString[];
  deny?: PermissionsBitField | bigint | string | PermissionsString[] | readonly PermissionsString[];
}

/**
 * An overwrite resolved to what Bisim's routes take.
 */
export interface ResolvedOverwriteOptions {
  allow: PermissionsBitField;
  deny: PermissionsBitField;
}

/**
 * The permission overwrites of a role or member in a channel.
 */
export class PermissionOverwrites extends Base {
  /** The channel. */
  public declare readonly channel: GuildChannel;
  /** The role or member id. */
  public id!: string;
  /** Whether the target is a role or a member. */
  public type!: OverwriteType;
  /** The permissions denied. */
  public deny!: Readonly<PermissionsBitField>;
  /** The permissions allowed. */
  public allow!: Readonly<PermissionsBitField>;

  /**
   * @param client - The client
   * @param data - The overwrite from Bisim
   * @param channel - The channel
   */
  public constructor(client: Client, data: RawOverwriteData, channel: GuildChannel) {
    super(client);
    attachHidden(this, 'channel', channel);
    this._patch(data);
  }

  public override _patch(data: RawOverwriteData): void {
    this.id = (data.id ?? data.targetId)!;
    this.type = data.type === OverwriteType.Member ? OverwriteType.Member : OverwriteType.Role;
    this.deny = new PermissionsBitField(BigInt(data.deny || '0')).freeze();
    this.allow = new PermissionsBitField(BigInt(data.allow || '0')).freeze();
  }

  /**
   * Edits this overwrite, merging with what it has.
   *
   * @param options - The changes
   * @param reason - Why
   */
  public async edit(options: PermissionOverwriteOptions, reason?: string): Promise<this> {
    const overwrites = this.channel.permissionOverwrites;
    await overwrites.upsert(this.id, options, { reason, type: this.type }, this);
    return this;
  }

  /**
   * Deletes this overwrite.
   *
   * @param reason - Why
   */
  public async delete(reason?: string): Promise<this> {
    const overwrites = this.channel.permissionOverwrites;
    await overwrites.delete(this.id, reason);
    return this;
  }

  public override toJSON(): { id: string; type: OverwriteType; allow: string; deny: string } {
    return { id: this.id, type: this.type, allow: this.allow.bitfield.toString(), deny: this.deny.bitfield.toString() };
  }

  /**
   * Applies `{ Permission: true | false | null }` changes on top of existing bits.
   *
   * @param options - The changes
   * @param initial - The bits to start from
   */
  public static resolveOverwriteOptions(
    options: PermissionOverwriteOptions,
    initial: { allow?: PermissionsBitField | bigint; deny?: PermissionsBitField | bigint } = {},
  ): ResolvedOverwriteOptions {
    const allow = new PermissionsBitField(initial.allow ?? 0n);
    const deny = new PermissionsBitField(initial.deny ?? 0n);
    for (const [perm, value] of Object.entries(options) as [PermissionsString, boolean | null | undefined][]) {
      if (value === true) {
        allow.add(perm);
        deny.remove(perm);
      } else if (value === false) {
        allow.remove(perm);
        deny.add(perm);
      } else if (value === null) {
        allow.remove(perm);
        deny.remove(perm);
      }
    }
    return { allow, deny };
  }

  /**
   * Resolves an overwrite (data, a structure) to what Bisim's routes take.
   *
   * @param overwrite - The overwrite
   * @param guild - The server, to tell roles from members
   */
  public static resolve(
    overwrite: OverwriteData | PermissionOverwrites,
    guild: Guild,
  ): { id: string; type: OverwriteType; allow: string; deny: string } {
    if (overwrite instanceof PermissionOverwrites) return overwrite.toJSON();
    const id = typeof overwrite.id === 'string' ? overwrite.id : overwrite.id.id;
    const type =
      overwrite.type ?? (guild.roles.cache.has(id) || id === guild.id ? OverwriteType.Role : OverwriteType.Member);
    return {
      id,
      type,
      allow: PermissionsBitField.resolve(overwrite.allow ?? 0n).toString(),
      deny: PermissionsBitField.resolve(overwrite.deny ?? 0n).toString(),
    };
  }
}
