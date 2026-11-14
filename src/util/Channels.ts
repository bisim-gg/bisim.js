import type { Client } from '../client/Client.js';
import { CategoryChannel } from '../structures/channels/CategoryChannel.js';
import { DMChannel, PartialGroupDMChannel } from '../structures/channels/DMChannel.js';
import { GuildChannel } from '../structures/channels/GuildChannel.js';
import type { Channel } from '../structures/channels/index.js';
import { TextChannel } from '../structures/channels/TextChannel.js';
import { VoiceChannel } from '../structures/channels/VoiceChannel.js';
import type { Guild } from '../structures/Guild.js';
import type { RawChannelData } from '../types/raw.js';
import { ChannelType } from './Enums.js';
import { channelTypeFromBisim } from './Transformers.js';

/**
 * Makes the right channel structure for Bisim's channel data.
 *
 * @param client - The client
 * @param data - The channel
 * @param guild - The server, for server channels
 * @internal
 */
export function createChannel(client: Client, data: RawChannelData, guild?: Guild | null): Channel {
  const type = channelTypeFromBisim(data.type);
  switch (type) {
    case ChannelType.DM:
      return new DMChannel(client, data);
    case ChannelType.GroupDM:
      return new PartialGroupDMChannel(client, data);
    default:
      break;
  }
  const resolvedGuild = guild ?? (data.guildId ? client.guilds.cache.get(data.guildId) : undefined);
  if (!resolvedGuild) return new DMChannel(client, data);
  if (type === ChannelType.GuildText) return new TextChannel(resolvedGuild, data, client);
  if (type === ChannelType.GuildVoice) return new VoiceChannel(resolvedGuild, data, client);
  if (type === ChannelType.GuildCategory) return new CategoryChannel(resolvedGuild, data, client);
  return new GuildChannel(resolvedGuild, data, client) as unknown as Channel;
}
