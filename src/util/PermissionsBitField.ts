import { BitField, type BitFieldResolvable } from './BitField.js';

/**
 * Discord's permission bits, which Bisim uses number for number. `PokeMembers` is Bisim's own (TeamSpeak's
 * poke) and sits far above Discord's numbers.
 */
export const PermissionFlagsBits = {
  CreateInstantInvite: 1n << 0n,
  KickMembers: 1n << 1n,
  BanMembers: 1n << 2n,
  Administrator: 1n << 3n,
  ManageChannels: 1n << 4n,
  ManageGuild: 1n << 5n,
  AddReactions: 1n << 6n,
  ViewAuditLog: 1n << 7n,
  PrioritySpeaker: 1n << 8n,
  Stream: 1n << 9n,
  ViewChannel: 1n << 10n,
  SendMessages: 1n << 11n,
  SendTTSMessages: 1n << 12n,
  ManageMessages: 1n << 13n,
  EmbedLinks: 1n << 14n,
  AttachFiles: 1n << 15n,
  ReadMessageHistory: 1n << 16n,
  MentionEveryone: 1n << 17n,
  UseExternalEmojis: 1n << 18n,
  ViewGuildInsights: 1n << 19n,
  Connect: 1n << 20n,
  Speak: 1n << 21n,
  MuteMembers: 1n << 22n,
  DeafenMembers: 1n << 23n,
  MoveMembers: 1n << 24n,
  UseVAD: 1n << 25n,
  ChangeNickname: 1n << 26n,
  ManageNicknames: 1n << 27n,
  ManageRoles: 1n << 28n,
  ManageWebhooks: 1n << 29n,
  ManageGuildExpressions: 1n << 30n,
  /** @deprecated Use {@link PermissionFlagsBits.ManageGuildExpressions} */
  ManageEmojisAndStickers: 1n << 30n,
  UseApplicationCommands: 1n << 31n,
  RequestToSpeak: 1n << 32n,
  ManageEvents: 1n << 33n,
  ManageThreads: 1n << 34n,
  CreatePublicThreads: 1n << 35n,
  CreatePrivateThreads: 1n << 36n,
  UseExternalStickers: 1n << 37n,
  SendMessagesInThreads: 1n << 38n,
  UseEmbeddedActivities: 1n << 39n,
  ModerateMembers: 1n << 40n,
  ViewCreatorMonetizationAnalytics: 1n << 41n,
  UseSoundboard: 1n << 42n,
  CreateGuildExpressions: 1n << 43n,
  CreateEvents: 1n << 44n,
  UseExternalSounds: 1n << 45n,
  SendVoiceMessages: 1n << 46n,
  SetVoiceChannelStatus: 1n << 48n,
  SendPolls: 1n << 49n,
  UseExternalApps: 1n << 50n,
  PinMessages: 1n << 51n,
  BypassSlowmode: 1n << 52n,
  /** Bisim's own: poke someone in the same voice channel or server. */
  PokeMembers: 1n << 60n,
} as const;

/**
 * The name of a permission flag.
 */
export type PermissionsString = keyof typeof PermissionFlagsBits;

/**
 * What a permission set can be made from: names, bigints, other sets, or lists of them.
 */
export type PermissionResolvable = BitFieldResolvable<PermissionsString, bigint>;

/** Bisim gives these to `@everyone` in a new server. */
const everyoneByDefault: PermissionsString[] = [
  'CreateInstantInvite',
  'AddReactions',
  'Stream',
  'ViewChannel',
  'SendMessages',
  'SendTTSMessages',
  'EmbedLinks',
  'AttachFiles',
  'ReadMessageHistory',
  'MentionEveryone',
  'UseExternalEmojis',
  'Connect',
  'Speak',
  'UseVAD',
  'ChangeNickname',
  'UseApplicationCommands',
  'RequestToSpeak',
  'CreatePublicThreads',
  'CreatePrivateThreads',
  'UseExternalStickers',
  'SendMessagesInThreads',
  'UseEmbeddedActivities',
  'UseSoundboard',
  'CreateGuildExpressions',
  'CreateEvents',
  'UseExternalSounds',
  'SendVoiceMessages',
  'SendPolls',
  'UseExternalApps',
  'SetVoiceChannelStatus',
];

/** One bigint with all the named permissions set. */
const packPermissions = (names: readonly PermissionsString[]): bigint =>
  names.reduce((packed, name) => packed | PermissionFlagsBits[name], 0n);

/**
 * A set of permissions: what a member may do in a server (`member.permissions`) or in one channel after
 * its overwrites (`channel.permissionsFor(member)`). The bits are Discord's. By default the administrator
 * permission counts as having every other one; pass `false` as `checkAdmin` to look at the bits alone.
 */
export class PermissionsBitField extends BitField<PermissionsString, bigint> {
  /**
   * Every permission flag, by name.
   */
  public static override Flags: typeof PermissionFlagsBits = PermissionFlagsBits;

  /**
   * Every permission at once.
   */
  public static All: bigint = packPermissions(Object.keys(PermissionFlagsBits) as PermissionsString[]);

  /**
   * The permissions Bisim gives `@everyone` when a server is created.
   */
  public static Default: bigint = packPermissions(everyoneByDefault);

  /**
   * Manage channels, mute members and move members together. Kept for code written for Discord's stages,
   * which Bisim does not have.
   */
  public static StageModerator: bigint = packPermissions(['ManageChannels', 'MuteMembers', 'MoveMembers']);

  /**
   * The value with no permission set, `0n`.
   */
  public static override DefaultBit: bigint = 0n;

  /**
   * @param bits - The permissions to start with; none when left out
   */
  public constructor(bits?: PermissionResolvable) {
    super(bits ?? 0n);
  }

  /**
   * The names of the given permissions that are not in this set. Nothing is missing for an administrator
   * unless `checkAdmin` is `false`.
   *
   * @param bits - The permissions to look for
   * @param checkAdmin - Whether the administrator permission counts as every permission
   */
  public override missing(bits: PermissionResolvable, checkAdmin = true): PermissionsString[] {
    if (checkAdmin && holdsAdministrator(this)) return [];
    return super.missing(bits);
  }

  /**
   * Whether at least one of the given permissions is in this set.
   *
   * @param permission - The permissions to look for
   * @param checkAdmin - Whether the administrator permission counts as every permission
   */
  public override any(permission: PermissionResolvable, checkAdmin = true): boolean {
    if (checkAdmin && holdsAdministrator(this)) return true;
    return super.any(permission);
  }

  /**
   * Whether all of the given permissions are in this set.
   *
   * @param permission - The permissions to look for
   * @param checkAdmin - Whether the administrator permission counts as every permission
   */
  public override has(permission: PermissionResolvable, checkAdmin = true): boolean {
    if (checkAdmin && holdsAdministrator(this)) return true;
    return super.has(permission);
  }

  /**
   * The names of the permissions actually set. An administrator's list is not filled with every permission.
   */
  public override toArray(): PermissionsString[] {
    return super.toArray(false);
  }

  /**
   * Turns anything a permission set can be made from into its bigint.
   *
   * @param permission - What to turn into a bigint
   */
  public static override resolve(permission?: unknown): bigint {
    return super.resolve(permission) as bigint;
  }
}

/** Whether the Administrator bit itself is set, without the administrator shortcut. */
function holdsAdministrator(permissions: PermissionsBitField): boolean {
  return BitField.prototype.has.call(permissions, PermissionFlagsBits.Administrator);
}
