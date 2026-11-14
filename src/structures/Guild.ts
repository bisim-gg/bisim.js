import type { Client } from '../client/Client.js';
import type { InternalBisimGatewayAdapterCreator } from '../client/voice/ClientVoiceManager.js';
import { BisimjsError, ErrorCodes } from '../errors/index.js';
import { GuildApplicationCommandManager } from '../managers/ApplicationCommandManager.js';
import { GuildBanManager } from '../managers/GuildBanManager.js';
import { GuildChannelManager } from '../managers/GuildChannelManager.js';
import { GuildEmojiManager, GuildStickerManager } from '../managers/GuildExpressionManagers.js';
import { GuildInviteManager } from '../managers/GuildInviteManager.js';
import { GuildMemberManager } from '../managers/GuildMemberManager.js';
import { RoleManager } from '../managers/RoleManager.js';
import { PresenceManager, VoiceStateManager } from '../managers/VoiceStateManager.js';
import { Routes } from '../rest/Routes.js';
import type { RawGuildData, RawWebhookData } from '../types/raw.js';
import { Collection } from '../util/Collection.js';
import {
  GuildDefaultMessageNotifications,
  GuildExplicitContentFilter,
  GuildMFALevel,
  GuildNSFWLevel,
  GuildPremiumTier,
  type GuildVerificationLevel,
} from '../util/Enums.js';
import { SnowflakeUtil } from '../util/SnowflakeUtil.js';
import { cdnURL, notSupported } from '../util/Util.js';
import { Base } from './Base.js';
import type { TextChannel } from './channels/TextChannel.js';
import type { VoiceChannel } from './channels/VoiceChannel.js';
import { GuildAuditLogs, type RawAuditLogEntry } from './GuildAuditLogs.js';
import type { GuildMember } from './GuildMember.js';
import type { ImageURLOptions } from './User.js';
import { Webhook } from './Webhook.js';
import { dateFrom } from '../util/internal.js';

/**
 * Options for editing a server.
 */
export interface GuildEditOptions {
  name?: string;
  description?: string | null;
  verificationLevel?: GuildVerificationLevel | null;
  systemChannel?: TextChannel | string | null;
  afkChannel?: VoiceChannel | string | null;
  /** Seconds before an idle member is moved to the AFK channel: 60, 300, 900, 1800 or 3600. */
  afkTimeout?: number;
  /** Not on Bisim through the API. */
  icon?: unknown;
  /** Not on Bisim through the API. */
  banner?: unknown;
  /** Not on Bisim through the API. */
  splash?: unknown;
  /** Not on Bisim: bots cannot take or give ownership. */
  owner?: unknown;
  reason?: string;
  [key: string]: unknown;
}

/**
 * Options for fetching the audit log.
 */
export interface GuildAuditLogsFetchOptions {
  /** Entries before this one (an entry or its id). */
  before?: string | { id: string };
  /** How many entries to keep (Bisim answers a page; extras are cut). */
  limit?: number;
  /** Only entries of this Bisim action, for example `CHANNEL_CREATE`. */
  type?: string | number | null;
  /** Only entries made by this user. */
  user?: string | { id: string };
}

const SUPPORTED_EDIT_KEYS = new Set(['name', 'description', 'verificationLevel', 'systemChannel', 'afkChannel', 'afkTimeout', 'reason']);

/**
 * A server (what Discord and discord.js call a guild).
 */
export class Guild extends Base {
  /** The server's id. */
  public id: string;
  /** The name. */
  public name!: string;
  /** The CDN key of the icon. */
  public icon!: string | null;
  /** The CDN key of the banner. */
  public banner!: string | null;
  /** The CDN key of the invite splash. */
  public splash!: string | null;
  /** Always `null` on Bisim. */
  public discoverySplash!: string | null;
  /** The description. */
  public description!: string | null;
  /** The verification level. */
  public verificationLevel!: GuildVerificationLevel;
  /** The owner's id. */
  public ownerId!: string;
  /** The channel join messages go to, or `null`. */
  public systemChannelId!: string | null;
  /** The voice channel idle members are moved to, or `null`. */
  public afkChannelId!: string | null;
  /** Seconds before an idle member is moved. */
  public afkTimeout!: number;
  /** Always empty on Bisim. */
  public features!: string[];
  /** Always `true`. */
  public available!: boolean;
  /** Always 0 (Bisim has one connection). */
  public shardId!: number;
  /** How many members the server has. */
  public memberCount!: number;
  /** Always `None` on Bisim. */
  public premiumTier!: GuildPremiumTier;
  /** Always 0 on Bisim. */
  public premiumSubscriptionCount!: number | null;
  /** Always `null` on the server object (vanity links are managed by Bisim's staff). */
  public vanityURLCode!: string | null;
  /** Always `null`. */
  public vanityURLUses!: number | null;
  /** Always `Default`. */
  public nsfwLevel!: GuildNSFWLevel;
  /** Always `None`. */
  public mfaLevel!: GuildMFALevel;
  /** Always `Disabled` (Bisim's AutoMod does this work). */
  public explicitContentFilter!: GuildExplicitContentFilter;
  /** Always `AllMessages`. */
  public defaultMessageNotifications!: GuildDefaultMessageNotifications;
  /** Always `null`. */
  public rulesChannelId!: string | null;
  /** Always `null`. */
  public publicUpdatesChannelId!: string | null;
  /** Always `null`. */
  public safetyAlertsChannelId!: string | null;
  /** Always `null`. */
  public widgetChannelId!: string | null;
  /** Always `null`. */
  public widgetEnabled!: boolean | null;
  /** Always `null`. */
  public applicationId!: string | null;
  /** Always `null`. */
  public maximumMembers!: number | null;
  /** Always `null`. */
  public maximumPresences!: number | null;
  /** The member count, when known. */
  public approximateMemberCount!: number | null;
  /** Always `null`. */
  public approximatePresenceCount!: number | null;
  /** Always `en-US`. */
  public preferredLocale!: string;
  /** Always `false`. */
  public premiumProgressBarEnabled!: boolean;

  /** The members. */
  public readonly members: GuildMemberManager = new GuildMemberManager(this);
  /** The channels. */
  public readonly channels: GuildChannelManager = new GuildChannelManager(this);
  /** The roles. */
  public readonly roles: RoleManager = new RoleManager(this);
  /** The bans. */
  public readonly bans: GuildBanManager = new GuildBanManager(this);
  /** The invites. */
  public readonly invites: GuildInviteManager = new GuildInviteManager(this);
  /** The custom emoji. */
  public readonly emojis: GuildEmojiManager = new GuildEmojiManager(this);
  /** The stickers. */
  public readonly stickers: GuildStickerManager = new GuildStickerManager(this);
  /** The members' presences. */
  public readonly presences: PresenceManager = new PresenceManager(this.client);
  /** Who is in voice. */
  public readonly voiceStates: VoiceStateManager = new VoiceStateManager(this);
  /** The bot's commands in this server. */
  public readonly commands: GuildApplicationCommandManager = new GuildApplicationCommandManager(this);

  /**
   * The bot's own permissions in the server, as Bisim computed them.
   *
   * @internal
   */
  public _myPermissions: bigint | null = null;
  /**
   * Whether the server's channels and roles were loaded.
   *
   * @internal
   */
  public _detailed = false;
  /**
   * Whether Bisim sent the member count (then it is used as it is, not counted from the member list).
   *
   * @internal
   */
  public _memberCountKnown = false;

  /**
   * @param client - The client
   * @param data - The server from Bisim
   */
  public constructor(client: Client, data: RawGuildData) {
    super(client);
    this.id = data.id;
    this.name = '';
    this.icon = null;
    this.banner = null;
    this.splash = null;
    this.discoverySplash = null;
    this.description = null;
    this.verificationLevel = 0;
    this.ownerId = '';
    this.systemChannelId = null;
    this.afkChannelId = null;
    this.afkTimeout = 300;
    this.features = [];
    this.available = true;
    this.shardId = 0;
    this.memberCount = 0;
    this.premiumTier = GuildPremiumTier.None;
    this.premiumSubscriptionCount = 0;
    this.vanityURLCode = null;
    this.vanityURLUses = null;
    this.nsfwLevel = GuildNSFWLevel.Default;
    this.mfaLevel = GuildMFALevel.None;
    this.explicitContentFilter = GuildExplicitContentFilter.Disabled;
    this.defaultMessageNotifications = GuildDefaultMessageNotifications.AllMessages;
    this.rulesChannelId = null;
    this.publicUpdatesChannelId = null;
    this.safetyAlertsChannelId = null;
    this.widgetChannelId = null;
    this.widgetEnabled = null;
    this.applicationId = null;
    this.maximumMembers = null;
    this.maximumPresences = null;
    this.approximateMemberCount = null;
    this.approximatePresenceCount = null;
    this.preferredLocale = 'en-US';
    this.premiumProgressBarEnabled = false;
    this._patch(data);
  }

  public override _patch(data: Partial<RawGuildData>): void {
    if (data.name !== undefined) this.name = data.name;
    if ('iconKey' in data) this.icon = data.iconKey || null;
    if ('bannerKey' in data) this.banner = data.bannerKey || null;
    if ('splashKey' in data) this.splash = data.splashKey || null;
    if ('description' in data) this.description = data.description || null;
    if (data.verificationLevel !== undefined) this.verificationLevel = data.verificationLevel ?? 0;
    if (data.ownerId) this.ownerId = data.ownerId;
    if ('systemChannelId' in data) this.systemChannelId = data.systemChannelId || null;
    if ('afkChannelId' in data) this.afkChannelId = data.afkChannelId || null;
    if (data.afkTimeout !== undefined) this.afkTimeout = data.afkTimeout ?? 300;
    if (typeof data.memberCount === 'number') {
      this.memberCount = data.memberCount;
      this.approximateMemberCount = data.memberCount;
      this._memberCountKnown = true;
    }
    if (data.roles) {
      const seen = new Set<string>();
      for (const role of data.roles) {
        this.roles._add({ ...role, guildId: this.id });
        seen.add(role.id);
      }
      for (const id of [...this.roles.cache.keys()]) if (!seen.has(id)) this.roles.cache.delete(id);
    }
    if (data.channels) {
      const seen = new Set<string>();
      for (const raw of data.channels) {
        this.channels._add(raw);
        seen.add(raw.id);
      }
      for (const id of [...this.channels.cache.keys()]) if (!seen.has(id)) this.client.channels._remove(id);
    }
    if (data.permissions !== undefined) this._myPermissions = BigInt(data.permissions || '0');
    if (data.myRoleIds && this.client.user) {
      const me = this.members.cache.get(this.client.user.id);
      if (me) me._roles = data.myRoleIds.filter((id) => id !== this.id);
      else this.members._add({ userId: this.client.user.id, roleIds: data.myRoleIds, nickname: null, joinedAt: null });
    }
    if (data.roles && data.channels) this._detailed = true;
  }

  /**
   * Counts a member joining or leaving, when Bisim did not send a member count.
   *
   * @internal
   */
  public _countMember(delta: number): void {
    this.memberCount = Math.max(0, this.memberCount + delta);
    if (this._memberCountKnown) this.approximateMemberCount = this.memberCount;
  }

  /**
   * When the server was made, in milliseconds.
   */
  public get createdTimestamp(): number {
    return SnowflakeUtil.timestampFrom(this.id);
  }

  /**
   * When the server was made.
   */
  public get createdAt(): Date {
    return dateFrom(this.createdTimestamp);
  }

  /**
   * When the bot joined, in milliseconds.
   */
  public get joinedTimestamp(): number | null {
    return this.members.me?.joinedTimestamp ?? null;
  }

  /**
   * When the bot joined.
   */
  public get joinedAt(): Date | null {
    const timestamp = this.joinedTimestamp;
    return timestamp === null ? null : new Date(timestamp);
  }

  /**
   * Whether the server has many members (more than 250).
   */
  public get large(): boolean {
    return this.memberCount > 250;
  }

  /**
   * The first letters of the server's name.
   */
  public get nameAcronym(): string {
    return this.name
      .replace(/'s /g, ' ')
      .replace(/\w+/g, (word) => word[0]!)
      .replace(/\s/g, '');
  }

  /**
   * Always `false` on Bisim.
   */
  public get partnered(): boolean {
    return false;
  }

  /**
   * Always `false` on Bisim.
   */
  public get verified(): boolean {
    return false;
  }

  /**
   * The adapter @bisim/voice uses to join voice in this server: pass it as `adapterCreator`.
   *
   * @example
   * ```js
   * const { joinVoiceChannel } = require('@bisim/voice');
   * const connection = joinVoiceChannel({
   *   channelId: channel.id,
   *   guildId: guild.id,
   *   adapterCreator: guild.voiceAdapterCreator,
   * });
   * ```
   */
  public get voiceAdapterCreator(): InternalBisimGatewayAdapterCreator {
    return (methods) => this.client.voice._createAdapter(this.id, methods);
  }

  /**
   * The AFK voice channel, or `null`.
   */
  public get afkChannel(): VoiceChannel | null {
    return (this.afkChannelId ? (this.channels.cache.get(this.afkChannelId) ?? null) : null) as VoiceChannel | null;
  }

  /**
   * The channel join messages go to, or `null`.
   */
  public get systemChannel(): TextChannel | null {
    return (this.systemChannelId ? (this.channels.cache.get(this.systemChannelId) ?? null) : null) as TextChannel | null;
  }

  /** Always `null` on Bisim. */
  public get rulesChannel(): TextChannel | null {
    return null;
  }

  /** Always `null` on Bisim. */
  public get publicUpdatesChannel(): TextChannel | null {
    return null;
  }

  /** Always `null` on Bisim. */
  public get safetyAlertsChannel(): TextChannel | null {
    return null;
  }

  /** Always `null` on Bisim. */
  public get widgetChannel(): TextChannel | null {
    return null;
  }

  /** Always `null` on Bisim. */
  public get scheduledEvents(): never {
    return notSupported('Scheduled events');
  }

  /** Not on Bisim. */
  public get stageInstances(): never {
    return notSupported('Stage channels');
  }

  /** Not on Bisim through the API. */
  public get autoModerationRules(): never {
    return notSupported('AutoMod rules through bisim.js');
  }

  /**
   * The URL of the server's icon, or `null`.
   *
   * @param options - The size to ask for
   */
  public iconURL(options: ImageURLOptions = {}): string | null {
    return cdnURL(this.client.options.rest.cdn, this.icon, options.size);
  }

  /**
   * The URL of the server's banner, or `null`.
   *
   * @param options - The size to ask for
   */
  public bannerURL(options: ImageURLOptions = {}): string | null {
    return cdnURL(this.client.options.rest.cdn, this.banner, options.size);
  }

  /**
   * The URL of the server's invite splash, or `null`.
   *
   * @param options - The size to ask for
   */
  public splashURL(options: ImageURLOptions = {}): string | null {
    return cdnURL(this.client.options.rest.cdn, this.splash, options.size);
  }

  /**
   * Always `null` on Bisim.
   */
  public discoverySplashURL(_options?: ImageURLOptions): string | null {
    return null;
  }

  /**
   * Fetches the owner as a member.
   *
   * @param options - Whether to cache or skip the cache
   */
  public async fetchOwner(options: { cache?: boolean; force?: boolean } = {}): Promise<GuildMember> {
    if (!this.ownerId) throw new BisimjsError(ErrorCodes.FetchOwnerId, 'guild');
    return this.members.fetch({ user: this.ownerId, cache: options.cache, force: options.force });
  }

  /**
   * Fetches the server again (its channels and roles too).
   */
  public fetch(): Promise<Guild> {
    return this.client.guilds.fetch({ guild: this.id, force: true });
  }

  /**
   * Edits the server.
   *
   * @param options - What to change
   */
  public async edit(options: GuildEditOptions): Promise<Guild> {
    if (options.icon !== undefined) notSupported("Changing a server's icon as a bot");
    if (options.banner !== undefined) notSupported("Changing a server's banner as a bot");
    if (options.splash !== undefined) notSupported("Changing a server's splash as a bot");
    if (options.owner !== undefined) notSupported('Transferring a server as a bot');
    for (const key of Object.keys(options)) {
      if (!SUPPORTED_EDIT_KEYS.has(key) && options[key] !== undefined) notSupported(`The server setting "${key}"`);
    }
    const body: Record<string, unknown> = {};
    if (options.name !== undefined) body.name = options.name;
    if (options.description !== undefined) body.description = options.description ?? '';
    if (options.verificationLevel !== undefined) body.verificationLevel = options.verificationLevel ?? 0;
    if (options.systemChannel !== undefined) {
      body.systemChannelId = typeof options.systemChannel === 'string' ? options.systemChannel : (options.systemChannel?.id ?? null);
    }
    if (options.afkChannel !== undefined) {
      body.afkChannelId = typeof options.afkChannel === 'string' ? options.afkChannel : (options.afkChannel?.id ?? null);
    }
    if (options.afkTimeout !== undefined) body.afkTimeout = options.afkTimeout;
    const data = (await this.client.rest.patch(Routes.guild(this.id), { body, reason: options.reason })) as RawGuildData;
    this._patch(data);
    return this;
  }

  /** Renames the server. */
  public setName(name: string, reason?: string): Promise<Guild> {
    return this.edit({ reason, name });
  }

  /** Sets the description. */
  public setDescription(description: string | null, reason?: string): Promise<Guild> {
    return this.edit({ reason, description });
  }

  /** Sets the verification level. */
  public setVerificationLevel(verificationLevel: GuildVerificationLevel | null, reason?: string): Promise<Guild> {
    return this.edit({ reason, verificationLevel });
  }

  /** Sets the channel join messages go to. */
  public setSystemChannel(systemChannel: TextChannel | string | null, reason?: string): Promise<Guild> {
    return this.edit({ reason, systemChannel });
  }

  /** Sets the AFK voice channel. */
  public setAFKChannel(afkChannel: VoiceChannel | string | null, reason?: string): Promise<Guild> {
    return this.edit({ reason, afkChannel });
  }

  /** Sets how long before an idle member is moved, in seconds. */
  public setAFKTimeout(afkTimeout: number, reason?: string): Promise<Guild> {
    return this.edit({ reason, afkTimeout });
  }

  /** Not on Bisim as a bot. */
  public setIcon(_icon: unknown, _reason?: string): Promise<Guild> {
    return notSupported("Changing a server's icon as a bot");
  }

  /** Not on Bisim as a bot. */
  public setBanner(_banner: unknown, _reason?: string): Promise<Guild> {
    return notSupported("Changing a server's banner as a bot");
  }

  /** Not on Bisim as a bot. */
  public setSplash(_splash: unknown, _reason?: string): Promise<Guild> {
    return notSupported("Changing a server's splash as a bot");
  }

  /** Not on Bisim as a bot. */
  public setOwner(_owner: unknown, _reason?: string): Promise<Guild> {
    return notSupported('Transferring a server as a bot');
  }

  /**
   * Leaves the server.
   */
  public async leave(): Promise<Guild> {
    if (this.ownerId === this.client.user.id) throw new BisimjsError(ErrorCodes.GuildOwned);
    const membership = Routes.userGuild(this.id);
    await this.client.rest.delete(membership);
    this.client._removeGuild(this.id, true);
    return this;
  }

  /** Not on Bisim: bots cannot delete servers. */
  public delete(): Promise<Guild> {
    return notSupported('Deleting a server as a bot');
  }

  /**
   * Fetches the audit log (needs View Audit Log).
   *
   * @param options - Paging and filters
   */
  public async fetchAuditLogs(options: GuildAuditLogsFetchOptions = {}): Promise<GuildAuditLogs> {
    const before = typeof options.before === 'string' ? options.before : options.before?.id;
    const data = (await this.client.rest.get(Routes.guildAuditLog(this.id), { query: { before } })) as RawAuditLogEntry[];
    let entries = data;
    if (options.type !== undefined && options.type !== null) entries = entries.filter((entry) => String(entry.action) === String(options.type));
    const userId = typeof options.user === 'string' ? options.user : options.user?.id;
    if (userId) entries = entries.filter((entry) => entry.actorId === userId);
    if (options.limit) entries = entries.slice(0, options.limit);
    return new GuildAuditLogs(this, entries);
  }

  /**
   * Fetches the webhooks of the server (those in channels the bot manages).
   */
  public async fetchWebhooks(): Promise<Collection<string, Webhook>> {
    const data = (await this.client.rest.get(Routes.guildWebhooks(this.id))) as RawWebhookData[];
    return new Collection(data.map((raw) => [raw.id, new Webhook(this.client, raw)]));
  }

  /** Not on Bisim. */
  public fetchVanityData(): Promise<never> {
    return notSupported('Vanity data through the API');
  }

  /** Not on Bisim. */
  public fetchWidget(): Promise<never> {
    return notSupported('Server widgets');
  }

  /** Not on Bisim. */
  public fetchWidgetSettings(): Promise<never> {
    return notSupported('Server widgets');
  }

  /** Not on Bisim. */
  public fetchPreview(): Promise<never> {
    return notSupported('Server previews');
  }

  /** Not on Bisim through bisim.js yet. */
  public fetchTemplates(): Promise<never> {
    return notSupported('Server templates through bisim.js');
  }

  /** Not on Bisim. */
  public fetchWelcomeScreen(): Promise<never> {
    return notSupported('Welcome screens');
  }

  /** Not on Bisim. */
  public fetchOnboarding(): Promise<never> {
    return notSupported('Onboarding');
  }

  /** Not on Bisim. */
  public fetchIntegrations(): Promise<never> {
    return notSupported('Integrations');
  }

  /** Not on Bisim. */
  public disableInvites(_disabled = true): Promise<never> {
    return notSupported('Pausing invites');
  }

  /**
   * The server's name.
   */
  public override toString(): string {
    return this.name;
  }

  public override toJSON(): unknown {
    return {
      id: this.id,
      name: this.name,
      icon: this.icon,
      description: this.description,
      ownerId: this.ownerId,
      memberCount: this.memberCount,
      verificationLevel: this.verificationLevel,
      systemChannelId: this.systemChannelId,
      afkChannelId: this.afkChannelId,
      afkTimeout: this.afkTimeout,
      createdTimestamp: this.createdTimestamp,
      iconURL: this.iconURL(),
      channels: [...this.channels.cache.keys()],
      roles: [...this.roles.cache.keys()],
      members: [...this.members.cache.keys()],
    };
  }
}

