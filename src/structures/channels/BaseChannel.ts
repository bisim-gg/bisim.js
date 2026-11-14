import type { Client } from '../../client/Client.js';
import type { RawChannelData } from '../../types/raw.js';
import { ChannelType } from '../../util/Enums.js';
import { channelLink } from '../../util/Formatters.js';
import { SnowflakeUtil } from '../../util/SnowflakeUtil.js';
import { channelTypeFromBisim } from '../../util/Transformers.js';
import { Base } from '../Base.js';
import type { CategoryChannel } from './CategoryChannel.js';
import type { DMChannel, PartialGroupDMChannel } from './DMChannel.js';
import type { GuildChannel } from './GuildChannel.js';
import type { TextChannel } from './TextChannel.js';
import type { VoiceChannel } from './VoiceChannel.js';
import { dateFrom } from '../../util/internal.js';

/**
 * The base of every channel.
 */
export class BaseChannel extends Base {
  /** The channel's id. */
  public id: string;
  /** The type of the channel. */
  public type!: ChannelType;
  /** Always `null` on Bisim (no channel flags). */
  public flags!: null;

  /**
   * @param client - The client
   * @param data - The channel from Bisim
   * @param immediatePatch - Whether to apply the data now
   */
  public constructor(client: Client, data: RawChannelData, immediatePatch = true) {
    super(client);
    this.id = data.id;
    this.flags = null;
    this.type = channelTypeFromBisim(data.type);
    if (immediatePatch) this._patch(data);
  }

  public override _patch(data: Partial<RawChannelData>): void {
    if (data.type !== undefined) this.type = channelTypeFromBisim(data.type);
  }

  /**
   * When the channel was made, in milliseconds.
   */
  public get createdTimestamp(): number {
    return SnowflakeUtil.timestampFrom(this.id);
  }

  /**
   * When the channel was made.
   */
  public get createdAt(): Date {
    return dateFrom(this.createdTimestamp);
  }

  /**
   * The link to the channel.
   */
  public get url(): string {
    return channelLink(this.id, (this as unknown as { guildId?: string }).guildId ?? undefined);
  }

  /**
   * Whether this channel is partial.
   */
  public get partial(): boolean {
    return false;
  }

  /**
   * Always `false` on Bisim (no threads).
   */
  public isThread(): false {
    return false;
  }

  /**
   * Always `false` on Bisim (no forum or media channels).
   */
  public isThreadOnly(): false {
    return false;
  }

  /**
   * Whether the channel holds messages: server text channels and DMs.
   */
  public isTextBased(): this is TextChannel | DMChannel | PartialGroupDMChannel {
    return this.type === ChannelType.GuildText || this.type === ChannelType.DM || this.type === ChannelType.GroupDM;
  }

  /**
   * Whether the channel is a DM.
   */
  public isDMBased(): this is DMChannel | PartialGroupDMChannel {
    return this.type === ChannelType.DM || this.type === ChannelType.GroupDM;
  }

  /**
   * Whether the channel is a voice channel.
   */
  public isVoiceBased(): this is VoiceChannel {
    return this.type === ChannelType.GuildVoice;
  }

  /**
   * Whether messages can be sent to the channel (a text channel or a DM).
   */
  public isSendable(): this is TextChannel | DMChannel | PartialGroupDMChannel {
    return this.isTextBased();
  }

  /**
   * Whether the channel belongs to a server.
   */
  public isGuildBased(): this is GuildChannel {
    return 'guild' in this;
  }

  /**
   * Whether the channel is a category.
   */
  public isCategory(): this is CategoryChannel {
    return this.type === ChannelType.GuildCategory;
  }

  /**
   * Fetches the channel from Bisim.
   *
   * @param force - Whether to skip the cache
   */
  public fetch(force = true): Promise<this> {
    return this.client.channels.fetch(this.id, { force }) as unknown as Promise<this>;
  }

  /**
   * The channel as a mention, `<#id>`.
   */
  public override toString(): `<#${string}>` {
    return `<#${this.id}>`;
  }
}
