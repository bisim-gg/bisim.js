import { Routes } from '../rest/Routes.js';
import { AutoModerationRule, type RawAutoModerationRuleData, autoModerationRulesOf } from '../structures/AutoModeration.js';
import type { Guild } from '../structures/Guild.js';
import { Collection } from '../util/Collection.js';
import {
  AutoModerationActionType,
  AutoModerationRuleEventType,
  AutoModerationRuleKeywordPresetType,
  AutoModerationRuleTriggerType,
} from '../util/Enums.js';
import { attachHidden } from '../util/internal.js';
import { notSupported } from '../util/Util.js';
import { CachedManager } from './BaseManager.js';

/**
 * A rule, by structure or id.
 */
export type AutoModerationRuleResolvable = AutoModerationRule | string;

/**
 * What a rule looks for, as discord.js names it. Each trigger reads only its own fields.
 */
export interface AutoModerationTriggerMetadataOptions {
  /** Words and phrases, `*` as a wildcard (a keyword or member profile rule). */
  keywordFilter?: readonly string[];
  /** Regular expressions (a keyword or member profile rule, up to 10). */
  regexPatterns?: readonly string[];
  /** Word lists (a keyword preset rule). */
  presets?: readonly AutoModerationRuleKeywordPresetType[];
  /** Words the rule lets through. */
  allowList?: readonly string[];
  /** How many mentions one message may hold (a mention spam rule, 1 to 50). */
  mentionTotalLimit?: number | null;
  /** Not on Bisim: `true` throws. */
  mentionRaidProtectionEnabled?: boolean;
}

/**
 * Something a rule does when it matches, as discord.js names it.
 */
export interface AutoModerationActionOptions {
  /** What to do. */
  type: AutoModerationActionType;
  /** The alert channel, the timeout, or the text the sender is shown. */
  metadata?: {
    /** The channel a {@link AutoModerationActionType.SendAlertMessage} action posts in. */
    channel?: { id: string } | string;
    /** The same, by id. */
    channelId?: string;
    /** How long a {@link AutoModerationActionType.Timeout} lasts, in seconds (up to 28 days). */
    durationSeconds?: number;
    /** The text a {@link AutoModerationActionType.BlockMessage} shows its sender (up to 150 characters). */
    customMessage?: string;
  };
}

/**
 * The options for creating a rule.
 */
export interface AutoModerationRuleCreateOptions {
  /** The name (1 to 100 characters). */
  name: string;
  /** When it runs: {@link AutoModerationRuleEventType.MessageSend} or `MemberUpdate` (a member profile rule). */
  eventType: AutoModerationRuleEventType;
  /** What it looks for. */
  triggerType: AutoModerationRuleTriggerType;
  /** The words, patterns, presets and limits it uses. */
  triggerMetadata?: AutoModerationTriggerMetadataOptions;
  /** What it does when it matches. */
  actions: readonly AutoModerationActionOptions[];
  /** Whether it is on (`true` by default). */
  enabled?: boolean;
  /** Roles it skips (up to 20). */
  exemptRoles?: readonly ({ id: string } | string)[];
  /** Channels it skips (up to 50). */
  exemptChannels?: readonly ({ id: string } | string)[];
  /** Why (for the audit log). */
  reason?: string;
}

/**
 * The options for editing a rule. A rule's trigger never changes, and on Bisim neither does its event type.
 */
export interface AutoModerationRuleEditOptions extends Partial<Omit<AutoModerationRuleCreateOptions, 'triggerType'>> {}

/**
 * Options for fetching one rule.
 */
export interface FetchAutoModerationRuleOptions {
  autoModerationRule: AutoModerationRuleResolvable;
  cache?: boolean;
  force?: boolean;
}

/**
 * Options for fetching every rule.
 */
export interface FetchAutoModerationRulesOptions {
  cache?: boolean;
}

const TRIGGER_NAMES: Partial<Record<AutoModerationRuleTriggerType, string>> = {
  [AutoModerationRuleTriggerType.Keyword]: 'KEYWORD',
  [AutoModerationRuleTriggerType.Spam]: 'SPAM',
  [AutoModerationRuleTriggerType.KeywordPreset]: 'KEYWORD_PRESET',
  [AutoModerationRuleTriggerType.MentionSpam]: 'MENTION_SPAM',
  [AutoModerationRuleTriggerType.MemberProfile]: 'KEYWORD',
};

const PRESET_NAMES: Record<AutoModerationRuleKeywordPresetType, string> = {
  [AutoModerationRuleKeywordPresetType.Profanity]: 'PROFANITY',
  [AutoModerationRuleKeywordPresetType.SexualContent]: 'SEXUAL',
  [AutoModerationRuleKeywordPresetType.Slurs]: 'SLURS',
};

const idOf = (value: { id: string } | string): string => (typeof value === 'string' ? value : value.id);

function eventName(eventType: AutoModerationRuleEventType): string {
  if (eventType === AutoModerationRuleEventType.MessageSend) return 'MESSAGE_SEND';
  if (eventType === AutoModerationRuleEventType.MemberUpdate) return 'MEMBER_UPDATE';
  return notSupported(`The AutoMod event type ${String(eventType)}`);
}

/**
 * discord.js's rule options as Bisim's rule fields: the trigger and event names, the trigger's lists, and the
 * actions folded into `blockMessage`, `blockReason`, `alertChannelId` and `timeoutSec`.
 *
 * @param options - The options
 * @param current - The rule being edited, or `null` when creating one
 * @internal
 */
export function autoModerationRuleToBisim(
  options: AutoModerationRuleEditOptions & { triggerType?: AutoModerationRuleTriggerType },
  current: AutoModerationRule | null,
): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (options.name !== undefined) body.name = options.name;
  if (current === null) {
    const trigger = options.triggerType;
    const name = trigger === undefined ? undefined : TRIGGER_NAMES[trigger];
    if (!name) notSupported(`The AutoMod trigger type ${String(trigger)}`);
    body.triggerType = name;
    const memberProfile = trigger === AutoModerationRuleTriggerType.MemberProfile;
    const eventType = options.eventType ?? (memberProfile ? AutoModerationRuleEventType.MemberUpdate : AutoModerationRuleEventType.MessageSend);
    body.eventType = memberProfile ? 'MEMBER_UPDATE' : eventName(eventType);
  } else if (options.eventType !== undefined && options.eventType !== current.eventType) {
    notSupported("Changing an AutoMod rule's event type");
  }
  const metadata = options.triggerMetadata;
  if (metadata) {
    if (metadata.mentionRaidProtectionEnabled) notSupported('AutoMod mention raid protection');
    if (metadata.keywordFilter !== undefined) body.keywords = [...metadata.keywordFilter];
    if (metadata.regexPatterns !== undefined) body.regexPatterns = [...metadata.regexPatterns];
    if (metadata.presets !== undefined) {
      body.presets = metadata.presets.map((preset) => PRESET_NAMES[preset] ?? notSupported(`The AutoMod preset ${String(preset)}`));
    }
    if (metadata.allowList !== undefined) body.allowList = [...metadata.allowList];
    if (metadata.mentionTotalLimit !== undefined && metadata.mentionTotalLimit !== null) body.mentionLimit = metadata.mentionTotalLimit;
  }
  if (options.actions !== undefined) {
    let block: AutoModerationActionOptions | undefined;
    let alert: AutoModerationActionOptions | undefined;
    let timeout: AutoModerationActionOptions | undefined;
    for (const action of options.actions) {
      if (action.type === AutoModerationActionType.BlockMessage) block = action;
      else if (action.type === AutoModerationActionType.SendAlertMessage) alert = action;
      else if (action.type === AutoModerationActionType.Timeout) timeout = action;
      else notSupported(`The AutoMod action ${String(action.type)}`);
    }
    const alertChannel = alert?.metadata?.channelId ?? (alert?.metadata?.channel ? idOf(alert.metadata.channel) : undefined);
    if (alert && !alertChannel) notSupported('An AutoMod alert without a channel');
    body.blockMessage = Boolean(block);
    // Creating, a field left out means "none"; editing, the empty value clears what the rule had.
    const reason = block?.metadata?.customMessage;
    if (reason || current) body.blockReason = reason ?? '';
    if (alertChannel || current) body.alertChannelId = alertChannel ?? '';
    const seconds = timeout?.metadata?.durationSeconds;
    if (timeout && !seconds) notSupported('An AutoMod timeout without a duration');
    if (seconds || current) body.timeoutSec = seconds ?? 0;
  }
  if (options.enabled !== undefined) body.enabled = options.enabled;
  if (options.exemptRoles !== undefined) body.exemptRoles = options.exemptRoles.map(idOf);
  if (options.exemptChannels !== undefined) body.exemptChannels = options.exemptChannels.map(idOf);
  return body;
}

/**
 * Manages a server's AutoMod rules (needs Manage Server). Rules arrive in the cache from these methods and from the
 * AutoMod events.
 *
 * @example
 * ```js
 * await guild.autoModerationRules.create({
 *   name: 'No invites',
 *   eventType: AutoModerationRuleEventType.MessageSend,
 *   triggerType: AutoModerationRuleTriggerType.Keyword,
 *   triggerMetadata: { keywordFilter: ['*discord.gg*'] },
 *   actions: [{ type: AutoModerationActionType.BlockMessage, metadata: { customMessage: 'No invites here' } }],
 * });
 * ```
 */
export class AutoModerationRuleManager extends CachedManager<string, AutoModerationRule, AutoModerationRuleResolvable> {
  /** The server. */
  public declare readonly guild: Guild;

  /**
   * @param guild - The server
   */
  public constructor(guild: Guild) {
    super(guild.client);
    attachHidden(this, 'guild', guild);
  }

  /**
   * The rules the client knows of, shared with the AutoMod events.
   */
  public override get cache(): Collection<string, AutoModerationRule> {
    return autoModerationRulesOf(this.guild);
  }

  /**
   * Adds a rule to the cache, or updates the cached one.
   *
   * @internal
   */
  public _add(data: RawAutoModerationRuleData, cache = true): AutoModerationRule {
    const known = this.cache.get(data.id);
    if (known) {
      known._patch(data);
      return known;
    }
    const rule = new AutoModerationRule(this.client, data, this.guild);
    if (cache) this.cache.set(rule.id, rule);
    return rule;
  }

  /**
   * Fetches one rule, or every rule of the server.
   *
   * @param options - A rule (or its id), or options
   */
  public fetch(options: AutoModerationRuleResolvable | FetchAutoModerationRuleOptions): Promise<AutoModerationRule>;
  public fetch(options?: FetchAutoModerationRulesOptions): Promise<Collection<string, AutoModerationRule>>;
  public async fetch(
    options?: AutoModerationRuleResolvable | FetchAutoModerationRuleOptions | FetchAutoModerationRulesOptions,
  ): Promise<AutoModerationRule | Collection<string, AutoModerationRule>> {
    if (options && (typeof options === 'string' || options instanceof AutoModerationRule || 'autoModerationRule' in options)) {
      const single = typeof options === 'string' || options instanceof AutoModerationRule ? { autoModerationRule: options } : options;
      const id = idOf(single.autoModerationRule);
      if (!single.force) {
        const cached = this.cache.get(id);
        if (cached) return cached;
      }
      const data = (await this.client.rest.get(Routes.guildAutoModerationRule(this.guild.id, id))) as RawAutoModerationRuleData;
      return this._add(data, single.cache ?? true);
    }
    const data = (await this.client.rest.get(Routes.guildAutoModerationRules(this.guild.id))) as RawAutoModerationRuleData[];
    const rules = new Collection<string, AutoModerationRule>();
    for (const raw of data) rules.set(raw.id, this._add(raw, (options as FetchAutoModerationRulesOptions | undefined)?.cache ?? true));
    return rules;
  }

  /**
   * Creates a rule.
   *
   * @param options - The rule
   */
  public async create(options: AutoModerationRuleCreateOptions): Promise<AutoModerationRule> {
    const body = autoModerationRuleToBisim(options, null);
    const data = (await this.client.rest.post(Routes.guildAutoModerationRules(this.guild.id), { body, reason: options.reason })) as RawAutoModerationRuleData;
    return this._add(data);
  }

  /**
   * Edits a rule.
   *
   * @param rule - The rule
   * @param options - What to change
   */
  public async edit(rule: AutoModerationRuleResolvable, options: AutoModerationRuleEditOptions): Promise<AutoModerationRule> {
    const id = idOf(rule);
    const current = typeof rule === 'string' ? (this.cache.get(id) ?? null) : rule;
    if (options.eventType !== undefined && !current) {
      const fetched = await this.fetch({ autoModerationRule: id, force: true });
      return this.edit(fetched, options);
    }
    const body = autoModerationRuleToBisim(options, current ?? ({ eventType: options.eventType } as AutoModerationRule));
    const data = (await this.client.rest.patch(Routes.guildAutoModerationRule(this.guild.id, id), { body, reason: options.reason })) as RawAutoModerationRuleData;
    return this._add(data);
  }

  /**
   * Deletes a rule.
   *
   * @param rule - The rule
   * @param reason - Why
   */
  public async delete(rule: AutoModerationRuleResolvable, reason?: string): Promise<void> {
    const id = idOf(rule);
    await this.client.rest.delete(Routes.guildAutoModerationRule(this.guild.id, id), { reason });
    this.cache.delete(id);
  }
}

