/**
 * The version of bisim.js.
 */
export const version = '0.1.0';

/**
 * Where bisim.js talks to by default. Every one of these can be changed in the client options
 * (`rest.api`, `rest.cdn`, `ws.gateway`), for example to a local Bisim stack.
 */
export const DefaultURLs = {
  /** Bisim's REST API. */
  api: 'https://api.bisim.gg/api',
  /** Bisim's gateway (the WebSocket). */
  gateway: 'wss://ws.bisim.gg/ws',
  /** Where avatars, icons, emojis and attachments are served. */
  cdn: 'https://cdn.bisim.gg',
  /** The web app, used for message links and install links. */
  web: 'https://bisim.gg',
} as const;

/**
 * The user agent bisim.js sends.
 */
export const DefaultUserAgent = `BisimBot (https://github.com/bisim-gg/bisim.js, ${version})`;

/**
 * The longest content Bisim accepts in a message.
 */
export const MaxMessageLength = 4000;

/**
 * Sweepable cache types and other constants discord.js exposes as `Constants`.
 */
export const Constants = {
  version,
  DefaultURLs,
  MaxMessageLength,
  /** Bisim's channel types that can hold messages. */
  TextBasedChannelTypes: [0, 1, 3] as const,
  /** Bisim's channel types that are voice channels. */
  VoiceBasedChannelTypes: [2] as const,
  /** Bisim's channel types that live in a server. */
  GuildChannelTypes: [0, 2, 4] as const,
  /** Bisim's channel types that are direct messages. */
  DMChannelTypes: [1, 3] as const,
  /** No thread types exist on Bisim. */
  ThreadChannelTypes: [] as const,
  /** Channel types a message can be sent to. */
  SendableChannels: [0, 1, 3] as const,
};
