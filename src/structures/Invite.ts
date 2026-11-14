import type { Client } from '../client/Client.js';
import { Routes } from '../rest/Routes.js';
import type { RawInviteData } from '../types/raw.js';
import { DefaultURLs } from '../util/Constants.js';
import { PermissionFlagsBits } from '../util/PermissionsBitField.js';
import { cdnURL, toTimestamp } from '../util/Util.js';
import { Base } from './Base.js';
import type { GuildBasedChannel } from './channels/index.js';
import type { Guild } from './Guild.js';
import type { User } from './User.js';

/**
 * A server an invite leads to, when the bot is not in it.
 */
export interface InviteGuild {
  id: string;
  name: string;
  icon: string | null;
  description: string | null;
  splash: string | null;
  iconURL(): string | null;
}

/**
 * An invite to a server.
 */
export class Invite extends Base {
  /** The code. */
  public code: string;
  /** The server, or what the invite says about it when the bot is not in it. */
  public guild!: Guild | InviteGuild | null;
  /** The channel's id, or `null`. */
  public channelId!: string | null;
  /** The id of who made it. */
  public inviterId!: string | null;
  /** How many members the server has (when resolved by code). */
  public memberCount!: number | null;
  /** How many are online (when resolved by code). */
  public presenceCount!: number | null;
  /** How long the invite lasts, in seconds (0 or `null` for ever). */
  public maxAge!: number | null;
  /** How many times it can be used (0 or `null` for no limit). */
  public maxUses!: number | null;
  /** How many times it was used. */
  public uses!: number | null;
  /** Always `false` on Bisim. */
  public temporary!: boolean | null;
  /** When it was made, in milliseconds. */
  public createdTimestamp!: number | null;
  /** When it expires, in milliseconds, or `null`. */
  public expiresTimestamp!: number | null;
  /** Always `null` on Bisim. */
  public targetType: null = null;
  /** Always `null` on Bisim. */
  public targetUser: null = null;
  /** Always `null` on Bisim. */
  public targetApplication: null = null;
  /** Always `null` on Bisim. */
  public guildScheduledEvent: null = null;

  /**
   * @param client - The client
   * @param data - The invite from Bisim
   */
  public constructor(client: Client, data: RawInviteData) {
    super(client);
    this.code = data.code;
    this.guild = null;
    this.channelId = null;
    this.inviterId = null;
    this.memberCount = null;
    this.presenceCount = null;
    this.maxAge = null;
    this.maxUses = null;
    this.uses = null;
    this.temporary = false;
    this.createdTimestamp = null;
    this.expiresTimestamp = null;
    this._patch(data);
  }

  public override _patch(data: Partial<RawInviteData>): void {
    const guildId = data.guildId ?? data.guild?.id;
    if (guildId) {
      const cached = this.client.guilds.cache.get(guildId);
      if (cached) this.guild = cached;
      else if (data.guild) {
        const cdn = this.client.options.rest.cdn;
        const raw = data.guild;
        this.guild = {
          id: raw.id,
          name: raw.name,
          icon: raw.iconKey ?? null,
          description: raw.description ?? null,
          splash: raw.splashKey ?? null,
          iconURL: () => cdnURL(cdn, raw.iconKey),
        };
      }
    }
    if ('channelId' in data) this.channelId = data.channelId ?? null;
    if (data.inviter) this.client.users._add(data.inviter);
    if ('inviterId' in data || data.inviter) this.inviterId = data.inviterId ?? data.inviter?.id ?? null;
    if ('memberCount' in data) this.memberCount = data.memberCount ?? null;
    if ('onlineCount' in data) this.presenceCount = data.onlineCount ?? null;
    if ('maxAgeSec' in data) this.maxAge = data.maxAgeSec ?? 0;
    if ('maxUses' in data) this.maxUses = data.maxUses ?? 0;
    if ('uses' in data) this.uses = data.uses ?? 0;
    if (data.createdAt) this.createdTimestamp = toTimestamp(data.createdAt);
    if ('expiresAt' in data) this.expiresTimestamp = toTimestamp(data.expiresAt);
  }

  /**
   * The channel, when cached.
   */
  public get channel(): GuildBasedChannel | null {
    return (this.channelId ? (this.client.channels.cache.get(this.channelId) ?? null) : null) as GuildBasedChannel | null;
  }

  /**
   * Who made the invite, when cached.
   */
  public get inviter(): User | null {
    return this.inviterId ? (this.client.users.cache.get(this.inviterId) ?? null) : null;
  }

  /**
   * When the invite was made.
   */
  public get createdAt(): Date | null {
    return this.createdTimestamp === null ? null : new Date(this.createdTimestamp);
  }

  /**
   * When the invite expires, or `null`.
   */
  public get expiresAt(): Date | null {
    return this.expiresTimestamp === null ? null : new Date(this.expiresTimestamp);
  }

  /**
   * The same as {@link Invite.memberCount}.
   */
  public get approximateMemberCount(): number | null {
    return this.memberCount;
  }

  /**
   * The same as {@link Invite.presenceCount}.
   */
  public get approximatePresenceCount(): number | null {
    return this.presenceCount;
  }

  /**
   * The invite link, `https://bisim.gg/{code}`.
   */
  public get url(): string {
    return `${DefaultURLs.web}/${this.code}`;
  }

  /**
   * Whether the bot can delete this invite.
   */
  public get deletable(): boolean {
    const guild = this.guild as Guild | null;
    if (!guild || !('members' in guild)) return false;
    if (this.inviterId === this.client.user.id) return true;
    return guild.members.me?.permissions.has(PermissionFlagsBits.ManageGuild) ?? false;
  }

  /**
   * Deletes the invite.
   *
   * @param reason - Why
   */
  public async delete(reason?: string): Promise<Invite> {
    const guildId = this.guild?.id;
    if (!guildId) throw new TypeError('The invite does not say which server it belongs to.');
    await this.client.rest.delete(Routes.guildInvite(guildId, this.code), { reason });
    return this;
  }

  /**
   * The invite link.
   */
  public override toString(): string {
    return this.url;
  }

  public override toJSON(): unknown {
    return {
      code: this.code,
      guildId: this.guild?.id ?? null,
      channelId: this.channelId,
      inviterId: this.inviterId,
      maxAge: this.maxAge,
      maxUses: this.maxUses,
      uses: this.uses,
      createdTimestamp: this.createdTimestamp,
      expiresTimestamp: this.expiresTimestamp,
      url: this.url,
    };
  }
}

/**
 * The same class as {@link Invite}, under the name newer discord.js versions use.
 */
export const GuildInvite = Invite;
