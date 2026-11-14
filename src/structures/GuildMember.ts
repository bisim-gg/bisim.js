import type { Client } from '../client/Client.js';
import { BisimjsError, ErrorCodes } from '../errors/index.js';
import type { GuildMemberEditOptions } from '../managers/GuildMemberManager.js';
import { GuildMemberRoleManager } from '../managers/GuildMemberRoleManager.js';
import type { RawMemberData } from '../types/raw.js';
import { PermissionFlagsBits, type PermissionResolvable, PermissionsBitField } from '../util/PermissionsBitField.js';
import { toTimestamp } from '../util/Util.js';
import { Base } from './Base.js';
import type { GuildChannel } from './channels/GuildChannel.js';
import type { DMChannel } from './channels/DMChannel.js';
import type { Guild } from './Guild.js';
import type { BanOptions } from '../managers/GuildBanManager.js';
import type { Message } from './Message.js';
import type { MessageCreateOptions, MessagePayload } from './MessagePayload.js';
import type { Presence } from './Presence.js';
import type { ImageURLOptions, User } from './User.js';
import { VoiceState } from './VoiceState.js';
import { attachHidden, dateFrom } from '../util/internal.js';

/**
 * A member of a server.
 */
export class GuildMember extends Base {
  /** The server. */
  public declare readonly guild: Guild;
  /** The user. */
  public user!: User;
  /** When the member joined, in milliseconds, or `null` when not known. */
  public joinedTimestamp: number | null = null;
  /** Always `null` on Bisim (no boosts). */
  public premiumSinceTimestamp: number | null = null;
  /** The member's nickname in this server. */
  public nickname: string | null = null;
  /** Always `false` on Bisim (no membership screening). */
  public pending = false;
  /** Until when the member is timed out, in milliseconds, or `null`. */
  public communicationDisabledUntilTimestamp: number | null = null;
  /** Always `null` on Bisim (no per-server avatars). */
  public avatar: string | null = null;
  /** Always `null` on Bisim (no per-server banners). */
  public banner: string | null = null;
  /**
   * The ids of the member's roles, without `@everyone`.
   *
   * @internal
   */
  public _roles: string[] = [];

  /**
   * @param client - The client
   * @param data - The member from Bisim
   * @param guild - The server
   */
  public constructor(client: Client, data: RawMemberData, guild: Guild) {
    super(client);
    attachHidden(this, 'guild', guild);
    this._patch(data);
  }

  public override _patch(data: Partial<RawMemberData>): void {
    if (data.user) this.user = this.client.users._add(data.user);
    else if (!this.user && data.userId) this.user = this.client.users._add({ id: data.userId } as never, false);
    if ('nickname' in data) this.nickname = data.nickname?.length ? data.nickname : null;
    if ('joinedAt' in data && data.joinedAt) this.joinedTimestamp = toTimestamp(data.joinedAt);
    if ('timeoutUntil' in data) this.communicationDisabledUntilTimestamp = toTimestamp(data.timeoutUntil);
    if (data.roleIds) this._roles = data.roleIds.filter((id) => id !== this.guild.id);
  }

  public override _clone(): this {
    const clone = super._clone();
    clone._roles = [...this._roles];
    return clone;
  }

  /**
   * Whether this member is partial (its join date is not known).
   */
  public get partial(): boolean {
    return this.joinedAt === null;
  }

  /**
   * The member's roles.
   */
  public get roles(): GuildMemberRoleManager {
    return new GuildMemberRoleManager(this);
  }

  /**
   * The member's voice state.
   */
  public get voice(): VoiceState {
    return this.guild.voiceStates.cache.get(this.id) ?? new VoiceState(this.guild, { userId: this.id });
  }

  /**
   * When the member joined.
   */
  public get joinedAt(): Date | null {
    return dateFrom(this.joinedTimestamp);
  }

  /**
   * Always `null` on Bisim (no boosts).
   */
  public get premiumSince(): Date | null {
    return null;
  }

  /**
   * Until when the member is timed out, or `null`.
   */
  public get communicationDisabledUntil(): Date | null {
    return dateFrom(this.communicationDisabledUntilTimestamp);
  }

  /**
   * The member's presence in this server, or `null`.
   */
  public get presence(): Presence | null {
    const { presences } = this.guild;
    return presences.cache.get(this.id) ?? null;
  }

  /**
   * The color of the member's highest colored role, as a number.
   */
  public get displayColor(): number {
    return this.roles.color?.color ?? 0;
  }

  /**
   * The color of the member's highest colored role, as `#rrggbb`.
   */
  public get displayHexColor(): `#${string}` {
    const colored = this.roles.color;
    return colored ? colored.hexColor : '#000000';
  }

  /**
   * The member's id.
   */
  public get id(): string {
    return this.user.id;
  }

  /**
   * The name to show: the nickname, the display name, or the username.
   */
  public get displayName(): string {
    return this.nickname !== null ? this.nickname : this.user.displayName;
  }

  /**
   * The member's permissions in the server (roles combined; the owner has all).
   */
  public get permissions(): Readonly<PermissionsBitField> {
    const { guild } = this;
    let bits: PermissionResolvable;
    if (this.id === guild.ownerId) bits = PermissionsBitField.All;
    else if (this.id === this.client.user?.id && guild._myPermissions !== null && guild.roles.cache.size === 0) bits = guild._myPermissions;
    else bits = this.roles.cache.map((role) => role.permissions);
    return new PermissionsBitField(bits).freeze();
  }

  /**
   * Whether the bot sits above this member in the role list (and so can moderate them).
   */
  public get manageable(): boolean {
    const { ownerId } = this.guild;
    const botId = this.client.user.id;
    if (this.id === ownerId || this.id === botId) return false;
    if (botId === ownerId) return true;
    const me = this.guild.members.me;
    if (me === null) throw new BisimjsError(ErrorCodes.GuildUncachedMe);
    return me.roles.highest.comparePositionTo(this.roles.highest) > 0;
  }

  /**
   * Whether the bot can kick this member.
   */
  public get kickable(): boolean {
    return this.manageable && this.guild.members.me!.permissions.has(PermissionFlagsBits.KickMembers);
  }

  /**
   * Whether the bot can ban this member.
   */
  public get bannable(): boolean {
    return this.manageable && this.guild.members.me!.permissions.has(PermissionFlagsBits.BanMembers);
  }

  /**
   * Whether the bot can time this member out.
   */
  public get moderatable(): boolean {
    if (this.permissions.has(PermissionFlagsBits.Administrator) || !this.manageable) return false;
    return this.guild.members.me?.permissions.has(PermissionFlagsBits.ModerateMembers) === true;
  }

  /**
   * Whether the member is timed out now.
   */
  public isCommunicationDisabled(): boolean {
    return this.communicationDisabledUntilTimestamp !== null && this.communicationDisabledUntilTimestamp > Date.now();
  }

  /**
   * The member's permissions in a channel, overwrites included.
   *
   * @param channel - The channel
   */
  public permissionsIn(channel: GuildChannel | string): Readonly<PermissionsBitField> {
    const resolved = typeof channel === 'string' ? this.guild.channels.cache.get(channel) : channel;
    if (!resolved) throw new BisimjsError(ErrorCodes.GuildChannelResolve);
    return resolved.permissionsFor(this)!;
  }

  /**
   * Edits the member.
   *
   * @param options - What to change
   */
  public edit(options: GuildMemberEditOptions): Promise<GuildMember> {
    return this.guild.members.edit(this.id, options);
  }

  /**
   * Sets the member's nickname.
   *
   * @param nick - The nickname, or `null` to clear it
   * @param reason - Why
   */
  public setNickname(nick: string | null, reason?: string): Promise<GuildMember> {
    return this.edit({ reason, nick });
  }

  /**
   * Opens the DM channel with this member.
   *
   * @param force - Whether to skip the cache
   */
  public createDM(force = false): Promise<DMChannel> {
    return this.user.createDM(force);
  }

  /**
   * Forgets the DM channel with this member.
   */
  public deleteDM(): Promise<DMChannel> {
    return this.user.deleteDM();
  }

  /**
   * The DM channel with this member, if cached.
   */
  public get dmChannel(): DMChannel | null {
    return this.user.dmChannel;
  }

  /**
   * Sends a message to this member, in DMs.
   *
   * @param options - The message
   */
  public send(options: string | MessagePayload | MessageCreateOptions): Promise<Message> {
    return this.user.send(options);
  }

  /**
   * Kicks the member.
   *
   * @param reason - Why
   */
  public async kick(reason?: string): Promise<GuildMember> {
    await this.guild.members.kick(this.id, reason);
    return this;
  }

  /**
   * Bans the member.
   *
   * @param options - The reason and how many seconds of their messages to delete
   */
  public async ban(options?: BanOptions): Promise<GuildMember> {
    await this.guild.bans.create(this.id, options);
    return this;
  }

  /**
   * Times the member out for a while, or ends a timeout with `null`.
   *
   * @param timeout - How long, in milliseconds, or `null`
   * @param reason - Why
   */
  public timeout(timeout: number | null, reason?: string): Promise<GuildMember> {
    return this.edit({ communicationDisabledUntil: timeout === null ? null : Date.now() + timeout, reason });
  }

  /**
   * Ends the member's timeout.
   *
   * @param reason - Why
   */
  public disableCommunicationDisabled(reason?: string): Promise<GuildMember> {
    return this.timeout(null, reason);
  }

  /**
   * Fetches this member from Bisim.
   *
   * @param force - Whether to skip the cache
   */
  public fetch(force = true): Promise<GuildMember> {
    return this.guild.members.fetch({ force, cache: true, user: this.id });
  }

  /**
   * Always `null` on Bisim (no per-server avatars).
   */
  public avatarURL(_options?: ImageURLOptions): string | null {
    return null;
  }

  /**
   * The member's avatar URL (their user avatar, or the default one).
   *
   * @param options - The size to ask for
   */
  public displayAvatarURL(options?: ImageURLOptions): string {
    return this.user.displayAvatarURL(options);
  }

  /**
   * Always `null` on Bisim (no per-server banners).
   */
  public bannerURL(_options?: ImageURLOptions): string | null {
    return null;
  }

  /**
   * The member's banner URL (their user banner, when fetched).
   *
   * @param options - The size to ask for
   */
  public displayBannerURL(options?: ImageURLOptions): string | null | undefined {
    return this.user.bannerURL(options);
  }

  /**
   * Whether this member is the same as another.
   *
   * @param member - The other member
   */
  public equals(member: GuildMember): boolean {
    if (!member) return false;
    const fields = ['id', 'joinedTimestamp', 'nickname', 'communicationDisabledUntilTimestamp'] as const;
    const sameRoles = this._roles.length === member._roles.length && this._roles.every((role, index) => member._roles[index] === role);
    return sameRoles && this.guild.id === member.guild.id && fields.every((field) => this[field] === member[field]);
  }

  /**
   * The member as a mention, `<@id>`.
   */
  public override toString(): `<@${string}>` {
    return `<@${this.user.id}>`;
  }

  public override valueOf(): string {
    return this.id;
  }

  public override toJSON(): unknown {
    return {
      guildId: this.guild.id,
      userId: this.user.id,
      nickname: this.nickname,
      joinedTimestamp: this.joinedTimestamp,
      communicationDisabledUntilTimestamp: this.communicationDisabledUntilTimestamp,
      roles: [this.guild.id, ...this._roles],
      displayName: this.displayName,
      avatarURL: this.avatarURL(),
      displayAvatarURL: this.displayAvatarURL(),
    };
  }
}
