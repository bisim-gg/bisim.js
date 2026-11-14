import { BitField, type BitFieldResolvable } from './BitField.js';
import { GatewayIntentBits, MessageFlags } from './Enums.js';

/**
 * The name of a gateway intent.
 */
export type GatewayIntentsString = keyof typeof GatewayIntentBits;

/**
 * A set of gateway intents, as passed to `new Client({ intents })`. Bisim takes intents so discord.js code
 * runs unchanged, but does not filter by them: a bot gets every event its permissions allow.
 */
export class IntentsBitField extends BitField<GatewayIntentsString> {
  /**
   * Every intent flag, by name.
   */
  public static override Flags = GatewayIntentBits as unknown as Record<string, number>;

  /**
   * The value with no intent set, `0`.
   */
  public static override DefaultBit = 0;

  /**
   * @param bits - The intents to start with; none when left out
   */
  public constructor(bits?: BitFieldResolvable<GatewayIntentsString, number>) {
    super(bits ?? 0);
  }
}

/**
 * The name of a message flag.
 */
export type MessageFlagsString = keyof typeof MessageFlags;

/**
 * The flags of a message, such as `Ephemeral` or `SuppressEmbeds`.
 */
export class MessageFlagsBitField extends BitField<MessageFlagsString> {
  /**
   * Every message flag, by name.
   */
  public static override Flags = MessageFlags as unknown as Record<string, number>;

  /**
   * The value with no flag set, `0`.
   */
  public static override DefaultBit = 0;

  /**
   * @param bits - The flags to start with; none when left out
   */
  public constructor(bits?: BitFieldResolvable<MessageFlagsString, number>) {
    super(bits ?? 0);
  }
}
