import type { CategoryChannel } from './CategoryChannel.js';
import type { DMChannel, PartialGroupDMChannel } from './DMChannel.js';
import type { TextChannel } from './TextChannel.js';
import type { VoiceChannel } from './VoiceChannel.js';

/**
 * Any channel bisim.js makes.
 */
export type Channel = CategoryChannel | DMChannel | PartialGroupDMChannel | TextChannel | VoiceChannel;

/**
 * A channel that holds messages.
 */
export type TextBasedChannel = DMChannel | PartialGroupDMChannel | TextChannel;

/**
 * A channel messages can be sent to.
 */
export type SendableChannels = TextBasedChannel;

/**
 * A channel in a server.
 */
export type GuildBasedChannel = CategoryChannel | TextChannel | VoiceChannel;

/**
 * A channel in a server that holds messages.
 */
export type GuildTextBasedChannel = TextChannel;

/**
 * A voice channel.
 */
export type VoiceBasedChannel = VoiceChannel;

/**
 * A DM channel.
 */
export type DMBasedChannel = DMChannel | PartialGroupDMChannel;

/**
 * A server channel that is not a thread (every server channel on Bisim).
 */
export type NonThreadGuildBasedChannel = GuildBasedChannel;

/**
 * A text channel kind in a server (Bisim has one).
 */
export type GuildTextChannelType = TextChannel['type'];
