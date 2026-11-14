import type { Client } from '../client/Client.js';
import { ApplicationCommandManager } from '../managers/ApplicationCommandManager.js';
import { Routes } from '../rest/Routes.js';
import type { RawUserData } from '../types/raw.js';
import { SnowflakeUtil } from '../util/SnowflakeUtil.js';
import { cdnURL, notSupported } from '../util/Util.js';
import { Base } from './Base.js';
import type { User } from './User.js';
import { dateFrom } from '../util/internal.js';

/**
 * An application as Bisim sends it.
 */
export interface RawApplicationData {
  id: string;
  name?: string;
  description?: string | null;
  iconKey?: string | null;
  avatarKey?: string | null;
  publicKey?: string | null;
  interactionsUrl?: string | null;
  botPublic?: boolean;
  owner?: RawUserData | null;
  ownerId?: string | null;
  guildCount?: number;
  approximateGuildCount?: number;
}

/**
 * Options for editing the application.
 */
export interface ClientApplicationEditOptions {
  /** The name (renames the bot too). */
  name?: string;
  description?: string;
  /** The address interactions are sent to, or `null` to receive them over the gateway. */
  interactionsEndpointURL?: string | null;
  [key: string]: unknown;
}

/**
 * The bot's application. On Bisim an application is its bot: the same id names both.
 */
export class ClientApplication extends Base {
  /** The id (the same as the bot's user id). */
  public id: string;
  /** The name. */
  public name!: string | null;
  /** The description. */
  public description!: string | null;
  /** The CDN key of the icon. */
  public icon!: string | null;
  /** Always `null` on Bisim. */
  public cover!: string | null;
  /** The public key interactions are signed with (hex). */
  public verifyKey!: string | null;
  /** The address interactions are sent to, or `null` (then they arrive over the gateway). */
  public interactionsEndpointURL!: string | null;
  /** Whether anyone with Manage Server can add the bot. */
  public botPublic!: boolean | null;
  /** Always `false` on Bisim. */
  public botRequireCodeGrant!: boolean | null;
  /** The owner, when known. */
  public owner!: User | null;
  /** How many servers the bot is in, when known. */
  public approximateGuildCount!: number | null;
  /** Always empty on Bisim. */
  public tags!: string[];
  /** Always `null` on Bisim. */
  public flags!: null;
  /** Always `null` on Bisim. */
  public installParams!: null;
  /** Always `null` on Bisim. */
  public customInstallURL!: string | null;
  /** Always `null` on Bisim. */
  public roleConnectionsVerificationURL!: string | null;
  /** The bot's commands. */
  public readonly commands: ApplicationCommandManager;

  /**
   * @param client - The client
   * @param data - The application from Bisim
   */
  public constructor(client: Client, data: RawApplicationData) {
    super(client);
    this.id = data.id;
    this.commands = new ApplicationCommandManager(client);
    this.name = null;
    this.description = null;
    this.icon = null;
    this.cover = null;
    this.verifyKey = null;
    this.interactionsEndpointURL = null;
    this.botPublic = null;
    this.botRequireCodeGrant = false;
    this.owner = null;
    this.approximateGuildCount = null;
    this.tags = [];
    this.flags = null;
    this.installParams = null;
    this.customInstallURL = null;
    this.roleConnectionsVerificationURL = null;
    this._patch(data);
  }

  public override _patch(data: Partial<RawApplicationData>): void {
    if (data.name !== undefined) this.name = data.name;
    if ('description' in data) this.description = data.description ?? null;
    if ('iconKey' in data || 'avatarKey' in data) this.icon = data.iconKey ?? data.avatarKey ?? null;
    if ('publicKey' in data) this.verifyKey = data.publicKey ?? null;
    if ('interactionsUrl' in data) this.interactionsEndpointURL = data.interactionsUrl ?? null;
    if (data.botPublic !== undefined) this.botPublic = data.botPublic;
    if (data.owner) this.owner = this.client.users._add(data.owner);
    const count = data.approximateGuildCount ?? data.guildCount;
    if (count !== undefined) this.approximateGuildCount = count;
  }

  /**
   * Whether only the id is known.
   */
  public get partial(): boolean {
    return this.name === null;
  }

  /**
   * When the application was made, in milliseconds.
   */
  public get createdTimestamp(): number {
    return SnowflakeUtil.timestampFrom(this.id);
  }

  /**
   * When the application was made.
   */
  public get createdAt(): Date {
    return dateFrom(this.createdTimestamp);
  }

  /**
   * The icon URL, or `null`.
   *
   * @param options - The size to ask for
   */
  public iconURL(options: { size?: number } = {}): string | null {
    return cdnURL(this.client.options.rest.cdn, this.icon, options.size);
  }

  /**
   * Fetches the application from Bisim (`GET /applications/@me`).
   */
  public async fetch(): Promise<ClientApplication> {
    const data = (await this.client.rest.get(Routes.currentApplication())) as RawApplicationData;
    this._patch(data);
    return this;
  }

  /**
   * Edits the application.
   *
   * @param options - What to change
   */
  public async edit(options: ClientApplicationEditOptions): Promise<ClientApplication> {
    const body: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(options)) {
      if (value === undefined) continue;
      if (key === 'name') body.name = value;
      else if (key === 'description') body.description = value;
      else if (key === 'interactionsEndpointURL') body.interactionsUrl = value;
      else notSupported(`The application setting "${key}"`);
    }
    const data = (await this.client.rest.patch(Routes.application(this.id), { body })) as RawApplicationData;
    this._patch(data);
    return this;
  }

  /** Not on Bisim. */
  public fetchRoleConnectionMetadataRecords(): Promise<never> {
    return notSupported('Role connections');
  }

  /** Not on Bisim. */
  public editRoleConnectionMetadataRecords(_records: unknown): Promise<never> {
    return notSupported('Role connections');
  }

  /** Not on Bisim. */
  public fetchSKUs(): Promise<never> {
    return notSupported('SKUs');
  }

  /** Not on Bisim. */
  public fetchEntitlements(_options?: unknown): Promise<never> {
    return notSupported('Entitlements');
  }

  /**
   * The application's name.
   */
  public override toString(): string {
    return this.name ?? this.id;
  }
}
