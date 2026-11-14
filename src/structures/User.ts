import type { Client } from '../client/Client.js';
import type { RawUserData } from '../types/raw.js';
import { SnowflakeUtil } from '../util/SnowflakeUtil.js';
import { cdnURL } from '../util/Util.js';
import { Base } from './Base.js';
import type { DMChannel } from './channels/DMChannel.js';
import type { Message } from './Message.js';
import type { MessageCreateOptions, MessagePayload } from './MessagePayload.js';
import { dateFrom } from '../util/internal.js';

/**
 * Options for an image URL. Bisim's CDN serves files as they were uploaded; `size` asks for a resized copy
 * where the CDN offers it.
 */
export interface ImageURLOptions {
  /** The size in pixels. */
  size?: number;
  /** Accepted for compatibility: Bisim keeps the uploaded format. */
  extension?: string;
  /** Accepted for compatibility. */
  forceStatic?: boolean;
}

/**
 * Represents a user on Bisim.
 */
export class User extends Base {
  /** The user's id. */
  public id: string;
  /** Whether the user is a bot. */
  public bot!: boolean;
  /** Always `false` on Bisim (it has no system account messages). */
  public system!: boolean;
  /** The user's username. */
  public username!: string | null;
  /** The name the user shows (Discord's global name), from Bisim's `displayName`. */
  public globalName!: string | null;
  /** Always `'0'`: Bisim has no discriminators. */
  public discriminator!: string;
  /** The CDN key of the user's avatar. */
  public avatar!: string | null;
  /** The CDN key of the user's banner, `undefined` until fetched. */
  public banner?: string | null;
  /** Always `null` on Bisim. */
  public accentColor?: number | null;
  /** Always `null` on Bisim. */
  public flags: null = null;
  /** Always `null` on Bisim. */
  public avatarDecoration: null = null;
  /** Always `null` on Bisim. */
  public avatarDecorationData: null = null;
  /** The user's bio, when fetched. */
  public bio?: string | null;
  /** The user's pronouns, when fetched. */
  public pronouns?: string | null;

  /**
   * @param client - The client
   * @param data - The user data from Bisim
   */
  public constructor(client: Client, data: RawUserData) {
    super(client);
    this.id = data.id;
    this.bot = false;
    this.system = false;
    this.discriminator = '0';
    this.username ??= null;
    this.globalName ??= null;
    this.avatar ??= null;
    this._patch(data);
  }

  public override _patch(data: Partial<RawUserData>): void {
    if ('username' in data && data.username !== undefined) this.username = data.username;
    if ('displayName' in data) this.globalName = data.displayName?.trim() ? data.displayName : null;
    if ('avatarKey' in data) this.avatar = data.avatarKey ?? null;
    if ('bannerKey' in data) this.banner = data.bannerKey ?? null;
    if ('bot' in data && data.bot !== undefined) this.bot = Boolean(data.bot);
    if ('bio' in data) this.bio = data.bio ?? null;
    if ('pronouns' in data) this.pronouns = data.pronouns ?? null;
  }

  /**
   * Whether this is a partial user (only the id is known).
   */
  public get partial(): boolean {
    return this.username === null;
  }

  /**
   * When the account was made, in milliseconds.
   */
  public get createdTimestamp(): number {
    return SnowflakeUtil.timestampFrom(this.id);
  }

  /**
   * When the account was made.
   */
  public get createdAt(): Date {
    return dateFrom(this.createdTimestamp);
  }

  /**
   * The URL of the user's avatar, or `null` when they have none.
   *
   * @param options - The size to ask for
   */
  public avatarURL(options: ImageURLOptions = {}): string | null {
    return cdnURL(this.client.options.rest.cdn, this.avatar, options.size);
  }

  /**
   * The URL of the default avatar shown for users without one.
   */
  public get defaultAvatarURL(): string {
    const seed = Number((BigInt(this.id) >> 22n) % 24n);
    const set = seed < 12 ? 'm' : 'f';
    const index = String((seed % 12) + 1).padStart(2, '0');
    return `${this.client.options.rest.cdn}/avatars/default/v1/${set}${index}.webp`;
  }

  /**
   * The avatar URL, or the default avatar when the user has none.
   *
   * @param options - The size to ask for
   */
  public displayAvatarURL(options: ImageURLOptions = {}): string {
    const own = this.avatarURL(options);
    return own === null ? this.defaultAvatarURL : own;
  }

  /**
   * The URL of the user's banner (fetch the user first), or `null`.
   *
   * @param options - The size to ask for
   */
  public bannerURL(options: ImageURLOptions = {}): string | null | undefined {
    if (this.banner === undefined) return undefined;
    return cdnURL(this.client.options.rest.cdn, this.banner, options.size);
  }

  /**
   * Always `null`: Bisim has no accent colors.
   */
  public get hexAccentColor(): string | null | undefined {
    return this.accentColor === undefined ? undefined : null;
  }

  /**
   * The name to show: the display name, or the username.
   */
  public get displayName(): string {
    return this.globalName ?? this.username ?? this.id;
  }

  /**
   * The user's tag. Bisim has no discriminators, so this is the username.
   */
  public get tag(): string {
    return this.username ?? this.id;
  }

  /**
   * The DM channel with this user, if cached.
   */
  public get dmChannel(): DMChannel | null {
    const { users } = this.client;
    return users.dmChannel(this.id);
  }

  /**
   * Opens (or reuses) the DM channel with this user.
   *
   * @param force - Whether to ask Bisim even if the channel is cached
   */
  public createDM(force = false): Promise<DMChannel> {
    const { users } = this.client;
    return users.createDM(this.id, { force });
  }

  /**
   * Closes the DM channel with this user (on Bisim this forgets it locally).
   */
  public deleteDM(): Promise<DMChannel> {
    const { users } = this.client;
    return users.deleteDM(this.id);
  }

  /**
   * Sends a message to this user (opening the DM first).
   *
   * @param options - The message
   */
  public async send(options: string | MessagePayload | MessageCreateOptions): Promise<Message> {
    const dm = await this.createDM();
    return dm.send(options);
  }

  /**
   * Fetches this user from Bisim.
   *
   * @param force - Whether to skip the cache
   */
  public fetch(force = true): Promise<User> {
    const { users } = this.client;
    return users.fetch(this.id, { force });
  }

  /**
   * Always `null` on Bisim.
   */
  public async fetchFlags(): Promise<null> {
    return null;
  }

  /**
   * Whether this user is the same as another one (same id and same data).
   *
   * @param user - The other user
   */
  public equals(user: User): boolean {
    if (!user) return false;
    const fields = ['id', 'username', 'globalName', 'avatar', 'bot'] as const;
    return fields.every((field) => this[field] === user[field]);
  }

  /**
   * The user as a mention, `<@id>`.
   */
  public override toString(): `<@${string}>` {
    return `<@${this.id}>`;
  }

  public override toJSON(...props: Record<string, boolean | string>[]): unknown {
    const json = super.toJSON({ createdTimestamp: true, defaultAvatarURL: true, tag: true }, ...props) as Record<string, unknown>;
    return { ...json, avatarURL: this.avatarURL(), displayAvatarURL: this.displayAvatarURL() };
  }
}
