import type { Client } from '../client/Client.js';
import type { RawPresenceData } from '../types/raw.js';
import { ActivityType } from '../util/Enums.js';
import { parseEmoji } from '../util/Util.js';
import { Base } from './Base.js';
import type { Guild } from './Guild.js';
import type { GuildMember } from './GuildMember.js';
import type { User } from './User.js';
import { attachHidden, dateFrom } from '../util/internal.js';

/**
 * A presence status.
 */
export type PresenceStatus = 'online' | 'idle' | 'dnd' | 'invisible' | 'offline';

/**
 * A presence status a bot can set.
 */
export type PresenceStatusData = 'online' | 'idle' | 'dnd' | 'invisible';

/**
 * An emoji in a custom status.
 */
export interface ActivityEmoji {
  name: string | null;
  id: string | null;
  animated: boolean;
}

/**
 * Data for an activity.
 */
export interface ActivityData {
  name: string;
  type?: ActivityType;
  url?: string | null;
  state?: string | null;
  details?: string | null;
  emoji?: ActivityEmoji | null;
  createdTimestamp?: number;
}

/**
 * What someone is doing: playing, listening, watching, competing, or a custom status.
 */
export class Activity {
  /** The presence this activity belongs to. */
  public declare readonly presence: Presence;
  /** The name of the activity (`Custom Status` for a custom status). */
  public name!: string;
  /** The type of the activity. */
  public type: ActivityType;
  /** A stream URL (Bisim does not show it). */
  public url!: string | null;
  /** The text of a custom status. */
  public state!: string | null;
  /** Always `null` on Bisim. */
  public details!: string | null;
  /** The emoji of a custom status. */
  public emoji!: ActivityEmoji | null;
  /** When the activity was seen. */
  public createdTimestamp: number;
  /** Always `null` on Bisim. */
  public applicationId: string | null = null;
  /** Always `null` on Bisim. */
  public timestamps: null = null;
  /** Always `null` on Bisim. */
  public party: null = null;
  /** Always `null` on Bisim. */
  public assets: null = null;
  /** Always empty on Bisim. */
  public buttons: string[] = [];

  /**
   * @param presence - The presence the activity belongs to
   * @param data - The activity
   */
  public constructor(presence: Presence, data: ActivityData) {
    attachHidden(this, 'presence', presence);
    const { name, url = null, state = null, details = null, emoji = null } = data;
    this.type = data.type ?? ActivityType.Playing;
    Object.assign(this, { name, url, state, details, emoji });
    this.createdTimestamp = data.createdTimestamp ?? Date.now();
  }

  /**
   * When the activity was seen.
   */
  public get createdAt(): Date {
    return dateFrom(this.createdTimestamp);
  }

  /**
   * Whether this activity is the same as another.
   *
   * @param activity - The other activity
   */
  public equals(activity: Activity): boolean {
    return (
      this === activity ||
      (activity && this.name === activity.name && this.type === activity.type && this.url === activity.url && this.state === activity.state)
    );
  }

  /**
   * The name of the activity.
   */
  public toString(): string {
    return this.name;
  }
}

/**
 * The presence data a {@link Presence} is built from.
 */
export interface PresenceData {
  userId: string;
  guildId?: string | null;
  status?: PresenceStatus;
  activities?: ActivityData[];
}

/**
 * Turns a presence from Bisim's gateway into the status and activities discord.js shows.
 *
 * @internal
 */
export function presenceFromBisim(data: RawPresenceData): PresenceData {
  const activities: ActivityData[] = [];
  if (data.customText || data.customEmoji) {
    const parsed = data.customEmoji ? parseEmoji(data.customEmoji) : null;
    activities.push({
      name: 'Custom Status',
      type: ActivityType.Custom,
      state: data.customText || null,
      emoji: parsed ? { name: parsed.name, id: parsed.id ?? null, animated: parsed.animated } : null,
    });
  }
  if (data.activityName) activities.push({ name: data.activityName, type: data.activityType ?? ActivityType.Playing });
  return {
    userId: data.userId,
    guildId: data.guildId || null,
    status: (data.status as PresenceStatus | undefined) ?? 'offline',
    activities,
  };
}

/**
 * Someone's status and what they are doing, in one server.
 */
export class Presence extends Base {
  /** The id of the user. */
  public userId: string;
  /** The server the presence is for. */
  public guild: Guild | null;
  /** The status. */
  public status!: PresenceStatus;
  /** What the user is doing. */
  public activities!: Activity[];
  /** Always `null` on Bisim (it does not say which device). */
  public clientStatus!: null;

  /**
   * @param client - The client
   * @param data - The presence
   */
  public constructor(client: Client, data: PresenceData) {
    super(client);
    this.userId = data.userId;
    this.guild = data.guildId ? (client.guilds.cache.get(data.guildId) ?? null) : null;
    this.status = 'offline';
    this.activities = [];
    this.clientStatus = null;
    this._patch(data);
  }

  public override _patch(data: Partial<PresenceData>): this {
    if (data.status) this.status = data.status;
    if (data.activities) this.activities = data.activities.map((activity) => new Activity(this, activity));
    return this;
  }

  /**
   * The user.
   */
  public get user(): User | null {
    return this.client.users.cache.get(this.userId) ?? null;
  }

  /**
   * The member, in the presence's server.
   */
  public get member(): GuildMember | null {
    return this.guild?.members.cache.get(this.userId) ?? null;
  }

  /**
   * Whether this presence is the same as another.
   *
   * @param presence - The other presence
   */
  public equals(presence: Presence): boolean {
    if (presence === this) return true;
    if (!presence || presence.status !== this.status) return false;
    const theirs = presence.activities;
    return theirs.length === this.activities.length && this.activities.every((activity, index) => activity.equals(theirs[index]!));
  }

  /**
   * The id of the user.
   */
  public override valueOf(): string {
    return this.userId;
  }
}

/**
 * Activity data a bot sets on itself.
 */
export interface ActivitiesOptions {
  name: string;
  type?: ActivityType;
  url?: string;
  state?: string;
}

/**
 * Activity data a bot sets with `setActivity`.
 */
export interface ActivityOptions extends ActivitiesOptions {
  shardId?: number | readonly number[];
}

/**
 * Presence data a bot sets on itself.
 */
export interface PresenceUpdateData {
  status?: PresenceStatusData;
  afk?: boolean;
  activities?: readonly ActivitiesOptions[];
  shardId?: number | readonly number[];
}

/**
 * The bot's own presence. Setting it sends Bisim's presence frame (op 7).
 */
export class ClientPresence extends Presence {
  /** Whether the bot said it is away (Bisim does not use this). */
  public afk = false;

  /**
   * @param client - The client
   * @param data - The starting presence
   */
  public constructor(client: Client, data: PresenceUpdateData = {}) {
    super(client, { userId: client.user?.id ?? '0', status: data.status ?? 'online', activities: [] });
    this._apply(data);
  }

  /**
   * Sets the presence and sends it to Bisim when connected.
   *
   * @param presence - The presence
   */
  public set(presence: PresenceUpdateData): this {
    this._apply(presence);
    this.client.ws?.sendPresence(this.toBisim());
    return this;
  }

  /**
   * Stores presence data without sending it.
   *
   * @internal
   */
  public _apply(presence: PresenceUpdateData): void {
    if (presence.status) this.status = presence.status;
    if (presence.afk !== undefined) this.afk = presence.afk;
    if (presence.activities) {
      this.activities = presence.activities.map(
        (activity) =>
          new Activity(this, {
            name: activity.name,
            type: activity.type ?? ActivityType.Playing,
            url: activity.url ?? null,
            state: activity.state ?? null,
          }),
      );
    }
    if (this.client.user) this.userId = this.client.user.id;
  }

  /**
   * The presence as Bisim's op 7 payload.
   *
   * @internal
   */
  public toBisim(): {
    status: PresenceStatusData;
    customText?: string;
    customEmoji?: string;
    activity?: { type: number; name: string };
  } {
    const payload: ReturnType<ClientPresence['toBisim']> = {
      status: (this.status === 'offline' ? 'invisible' : this.status) as PresenceStatusData,
    };
    for (const activity of this.activities) {
      if (activity.type === ActivityType.Custom) {
        const text = activity.state ?? (activity.name !== 'Custom Status' ? activity.name : null);
        if (text) payload.customText = text;
        if (activity.emoji?.name) {
          payload.customEmoji = activity.emoji.id ? `<:${activity.emoji.name}:${activity.emoji.id}>` : activity.emoji.name;
        }
      } else if (!payload.activity && activity.name) {
        payload.activity = { type: activity.type, name: activity.name };
      }
    }
    return payload;
  }
}
