import type { Client } from '../client/Client.js';
import type { AutoModerationActionOptions, AutoModerationRuleEditOptions } from '../managers/AutoModerationRuleManager.js';
import { Collection } from '../util/Collection.js';
import {
  AutoModerationActionType,
  AutoModerationRuleEventType,
  AutoModerationRuleKeywordPresetType,
  AutoModerationRuleTriggerType,
} from '../util/Enums.js';
import { attachHidden } from '../util/internal.js';
import { Base } from './Base.js';
import type { GuildBasedChannel } from './channels/index.js';
import type { Guild } from './Guild.js';
import type { GuildMember } from './GuildMember.js';
import type { Role } from './Role.js';
import type { User } from './User.js';

/**
 * An AutoMod rule as Bisim describes it, in its own words.
 */
export interface RawAutoModerationRuleData {
  id: string;
  guildId?: string;
  name?: string;
  creatorId?: string;
  eventType?: string;
  triggerType?: string;
  keywords?: string[];
  regexPatterns?: string[];
  presets?: string[];
  allowList?: string[];
  mentionLimit?: number;
  blockMessage?: boolean;
  blockReason?: string;
  alertChannelId?: string;
  timeoutSec?: number;
  enabled?: boolean;
  exemptRoles?: string[];
  exemptChannels?: string[];
}

/**
 * One AutoMod action as Bisim reports it running.
 */
export interface RawAutoModerationActionExecutionData {
  guildId?: string;
  actionType?: number;
  ruleId?: string;
  ruleTriggerType?: string;
  userId?: string;
  channelId?: string;
  messageId?: string;
  alertSystemMessageId?: string;
  content?: string;
  matchedKeyword?: string;
  matchedContent?: string;
  alertChannelId?: string;
  durationSeconds?: number;
  customMessage?: string;
}

const TRIGGERS: Readonly<Record<string, AutoModerationRuleTriggerType>> = {
  KEYWORD: AutoModerationRuleTriggerType.Keyword,
  SPAM: AutoModerationRuleTriggerType.Spam,
  KEYWORD_PRESET: AutoModerationRuleTriggerType.KeywordPreset,
  MENTION_SPAM: AutoModerationRuleTriggerType.MentionSpam,
};

const PRESETS: Readonly<Record<string, AutoModerationRuleKeywordPresetType>> = {
  PROFANITY: AutoModerationRuleKeywordPresetType.Profanity,
  SEXUAL: AutoModerationRuleKeywordPresetType.SexualContent,
  SLURS: AutoModerationRuleKeywordPresetType.Slurs,
};

/** Discord's number for Bisim's trigger name (a keyword rule when the name is unknown). */
function triggerOf(name: string | undefined): AutoModerationRuleTriggerType {
  return TRIGGERS[name ?? ''] ?? AutoModerationRuleTriggerType.Keyword;
}

/**
 * What an AutoMod action is given: the alert channel, the timeout, or the text the sender was shown.
 */
export interface AutoModerationActionMetadata {
  channelId: string | null;
  durationSeconds: number | null;
  customMessage: string | null;
}

/**
 * Something an AutoMod rule does when it matches.
 */
export interface AutoModerationAction {
  type: AutoModerationActionType;
  metadata: AutoModerationActionMetadata;
}

/**
 * What an AutoMod rule looks for.
 */
export interface AutoModerationTriggerMetadata {
  /** The words and phrases (a keyword rule). */
  keywordFilter: string[];
  /** The regular expressions (a keyword rule). */
  regexPatterns: string[];
  /** The word lists (a keyword preset rule). */
  presets: AutoModerationRuleKeywordPresetType[];
  /** Words the rule lets through. */
  allowList: string[];
  /** How many mentions one message may have (a mention spam rule), or `null`. */
  mentionTotalLimit: number | null;
  /** Always `false` on Bisim. */
  mentionRaidProtectionEnabled: boolean;
}

function metadata(partial: Partial<AutoModerationActionMetadata>): AutoModerationActionMetadata {
  return { channelId: partial.channelId ?? null, durationSeconds: partial.durationSeconds ?? null, customMessage: partial.customMessage ?? null };
}

/** The rules each server's events told the client about, so an update can hand out the old rule. */
const knownRules = new WeakMap<Guild, Collection<string, AutoModerationRule>>();

/**
 * The AutoMod rules of a server that the client has seen in events.
 *
 * @internal
 */
export function autoModerationRulesOf(guild: Guild): Collection<string, AutoModerationRule> {
  let rules = knownRules.get(guild);
  if (!rules) {
    rules = new Collection();
    knownRules.set(guild, rules);
  }
  return rules;
}

/**
 * A server's AutoMod rule, from the `AutoModerationRuleCreate`, `AutoModerationRuleUpdate` and
 * `AutoModerationRuleDelete` events. Bisim's names for triggers, events and presets are turned into
 * Discord's numbers; its block, alert and timeout settings become {@link AutoModerationRule.actions}.
 */
export class AutoModerationRule extends Base {
  /** The id. */
  public id: string;
  /** The server. */
  public declare readonly guild: Guild;
  /** The name. */
  public name!: string;
  /** Who made it. */
  public creatorId!: string | null;
  /** When it runs. */
  public eventType!: AutoModerationRuleEventType;
  /** What it looks for. */
  public triggerType!: AutoModerationRuleTriggerType;
  /** The words, patterns, presets and limits it uses. */
  public triggerMetadata!: AutoModerationTriggerMetadata;
  /** What it does when it matches. */
  public actions!: AutoModerationAction[];
  /** Whether it is on. */
  public enabled!: boolean;
  /** The ids of the roles it skips. */
  public exemptRoleIds!: string[];
  /** The ids of the channels it skips. */
  public exemptChannelIds!: string[];

  /**
   * @param client - The client
   * @param data - The rule from Bisim
   * @param guild - The server
   */
  public constructor(client: Client, data: RawAutoModerationRuleData, guild: Guild) {
    super(client);
    attachHidden(this, 'guild', guild);
    this.id = data.id;
    this._patch(data);
  }

  public override _patch(data: RawAutoModerationRuleData): void {
    this.name = data.name ?? '';
    this.creatorId = data.creatorId || null;
    this.eventType = data.eventType === 'MEMBER_UPDATE' ? AutoModerationRuleEventType.MemberUpdate : AutoModerationRuleEventType.MessageSend;
    this.triggerType = triggerOf(data.triggerType);
    this.triggerMetadata = {
      keywordFilter: data.keywords ?? [],
      regexPatterns: data.regexPatterns ?? [],
      presets: (data.presets ?? []).map((preset) => PRESETS[preset]).filter((preset): preset is AutoModerationRuleKeywordPresetType => preset !== undefined),
      allowList: data.allowList ?? [],
      mentionTotalLimit: data.mentionLimit || null,
      mentionRaidProtectionEnabled: false,
    };
    const actions: AutoModerationAction[] = [];
    if (data.blockMessage) actions.push({ type: AutoModerationActionType.BlockMessage, metadata: metadata({ customMessage: data.blockReason || null }) });
    if (data.alertChannelId) actions.push({ type: AutoModerationActionType.SendAlertMessage, metadata: metadata({ channelId: data.alertChannelId }) });
    if (data.timeoutSec) actions.push({ type: AutoModerationActionType.Timeout, metadata: metadata({ durationSeconds: data.timeoutSec }) });
    this.actions = actions;
    this.enabled = Boolean(data.enabled);
    this.exemptRoleIds = data.exemptRoles ?? [];
    this.exemptChannelIds = data.exemptChannels ?? [];
  }

  /**
   * The roles it skips (those cached).
   */
  public get exemptRoles(): Collection<string, Role> {
    const known = this.guild.roles.cache;
    return new Collection(this.exemptRoleIds.filter((id) => known.has(id)).map((id) => [id, known.get(id)!]));
  }

  /**
   * The channels it skips (those cached).
   */
  public get exemptChannels(): Collection<string, GuildBasedChannel> {
    const channels = this.guild.channels.cache;
    return new Collection(this.exemptChannelIds.filter((id) => channels.has(id)).map((id) => [id, channels.get(id)!]));
  }

  /**
   * Edits the rule (needs Manage Server).
   *
   * @param options - What to change
   */
  public edit(options: AutoModerationRuleEditOptions): Promise<AutoModerationRule> {
    return this.guild.autoModerationRules.edit(this, options);
  }

  /**
   * Deletes the rule.
   *
   * @param reason - Why
   */
  public async delete(reason?: string): Promise<AutoModerationRule> {
    await this.guild.autoModerationRules.delete(this, reason);
    return this;
  }

  /** Renames the rule. */
  public setName(name: string, reason?: string): Promise<AutoModerationRule> {
    return this.edit({ name, reason });
  }

  /** Not on Bisim: a rule keeps its event type (`MemberUpdate` is a member profile rule from the start). */
  public setEventType(eventType: AutoModerationRuleEventType, reason?: string): Promise<AutoModerationRule> {
    return this.edit({ eventType, reason });
  }

  /** Sets the words and phrases of a keyword rule. */
  public setKeywordFilter(keywordFilter: readonly string[], reason?: string): Promise<AutoModerationRule> {
    return this.edit({ triggerMetadata: { keywordFilter }, reason });
  }

  /** Sets the regular expressions of a keyword rule. */
  public setRegexPatterns(regexPatterns: readonly string[], reason?: string): Promise<AutoModerationRule> {
    return this.edit({ triggerMetadata: { regexPatterns }, reason });
  }

  /** Sets the word lists of a keyword preset rule. */
  public setPresets(presets: readonly AutoModerationRuleKeywordPresetType[], reason?: string): Promise<AutoModerationRule> {
    return this.edit({ triggerMetadata: { presets }, reason });
  }

  /** Sets the words the rule lets through. */
  public setAllowList(allowList: readonly string[], reason?: string): Promise<AutoModerationRule> {
    return this.edit({ triggerMetadata: { allowList }, reason });
  }

  /** Sets how many mentions one message may hold (a mention spam rule). */
  public setMentionTotalLimit(mentionTotalLimit: number, reason?: string): Promise<AutoModerationRule> {
    return this.edit({ triggerMetadata: { mentionTotalLimit }, reason });
  }

  /** Not on Bisim: mention raid protection (`false` changes nothing). */
  public setMentionRaidProtectionEnabled(mentionRaidProtectionEnabled: boolean, reason?: string): Promise<AutoModerationRule> {
    return this.edit({ triggerMetadata: { mentionRaidProtectionEnabled }, reason });
  }

  /** Replaces what the rule does when it matches. */
  public setActions(actions: readonly AutoModerationActionOptions[], reason?: string): Promise<AutoModerationRule> {
    return this.edit({ actions, reason });
  }

  /** Turns the rule on or off. */
  public setEnabled(enabled = true, reason?: string): Promise<AutoModerationRule> {
    return this.edit({ enabled, reason });
  }

  /** Sets the roles the rule skips. */
  public setExemptRoles(roles: readonly ({ id: string } | string)[], reason?: string): Promise<AutoModerationRule> {
    return this.edit({ exemptRoles: roles, reason });
  }

  /** Sets the channels the rule skips. */
  public setExemptChannels(channels: readonly ({ id: string } | string)[], reason?: string): Promise<AutoModerationRule> {
    return this.edit({ exemptChannels: channels, reason });
  }
}

/**
 * One action an AutoMod rule took, from the `AutoModerationActionExecution` event. A rule that blocks a
 * message and alerts a channel sends one of these for each. `content` and `matchedContent` are empty
 * without the Message Content intent, as on Discord.
 */
export class AutoModerationActionExecution {
  /** The server. */
  public declare readonly guild: Guild;
  /** The action it took. */
  public action: AutoModerationAction;
  /** The rule's id. */
  public ruleId: string;
  /** What the rule looks for. */
  public ruleTriggerType: AutoModerationRuleTriggerType;
  /** The member whose message or profile set it off. */
  public userId: string;
  /** Where, or `null` for a profile rule. */
  public channelId: string | null;
  /** Always `null` on Bisim: a blocked message is never saved. */
  public messageId: string | null;
  /** The alert the rule posted, or `null`. */
  public alertSystemMessageId: string | null;
  /** What the member wrote. */
  public content: string;
  /** The keyword that matched, or `null`. */
  public matchedKeyword: string | null;
  /** The part of the text that matched, or `null`. */
  public matchedContent: string | null;

  /**
   * @param data - The execution from Bisim
   * @param guild - The server
   */
  public constructor(data: RawAutoModerationActionExecutionData, guild: Guild) {
    attachHidden(this, 'guild', guild);
    const type = (data.actionType ?? AutoModerationActionType.BlockMessage) as AutoModerationActionType;
    this.action = {
      type,
      metadata: metadata({
        channelId: type === AutoModerationActionType.SendAlertMessage ? data.alertChannelId || null : null,
        durationSeconds: type === AutoModerationActionType.Timeout ? data.durationSeconds || null : null,
        customMessage: type === AutoModerationActionType.BlockMessage ? data.customMessage || null : null,
      }),
    };
    this.ruleId = data.ruleId ?? '';
    this.ruleTriggerType = triggerOf(data.ruleTriggerType);
    this.userId = data.userId ?? '';
    this.channelId = data.channelId || null;
    this.messageId = data.messageId || null;
    this.alertSystemMessageId = data.alertSystemMessageId || null;
    this.content = data.content ?? '';
    this.matchedKeyword = data.matchedKeyword || null;
    this.matchedContent = data.matchedContent || null;
  }

  /**
   * The rule, when an event told the client about it.
   */
  public get autoModerationRule(): AutoModerationRule | null {
    return autoModerationRulesOf(this.guild).get(this.ruleId) ?? null;
  }

  /**
   * The member's user, when cached.
   */
  public get user(): User | null {
    return this.guild.client.users.resolve(this.userId);
  }

  /**
   * The member, when cached.
   */
  public get member(): GuildMember | null {
    return this.guild.members.resolve(this.userId);
  }

  /**
   * The channel, when cached.
   */
  public get channel(): GuildBasedChannel | null {
    return this.channelId ? (this.guild.channels.cache.get(this.channelId) ?? null) : null;
  }
}
