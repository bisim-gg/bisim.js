import type { Client } from '../client/Client.js';
import { Routes } from '../rest/Routes.js';
import type { Guild } from '../structures/Guild.js';
import { Presence, type PresenceData } from '../structures/Presence.js';
import { VoiceState } from '../structures/VoiceState.js';
import type { RawVoiceStateData } from '../types/raw.js';
import type { Collection } from '../util/Collection.js';
import { CachedManager } from './BaseManager.js';
import type { UserResolvable } from './UserManager.js';
import { attachHidden } from '../util/internal.js';

/**
 * Manages who is in the voice channels of a server.
 */
export class VoiceStateManager extends CachedManager<string, VoiceState, VoiceState | string> {
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
   * Adds a voice state to the cache, or updates the cached one.
   *
   * @internal
   */
  public _add(data: RawVoiceStateData, cache = true): VoiceState {
    const known = this.cache.get(data.userId);
    if (known !== undefined) return known._patch(data);
    const state = new VoiceState(this.guild, data);
    if (cache) this.cache.set(state.id, state);
    return state;
  }

  /**
   * Loads who is in voice now (a Bisim addition), or one member's state.
   *
   * @param member - A member, to return their state
   */
  public async fetch(member?: UserResolvable | 'me'): Promise<VoiceState | Collection<string, VoiceState> | null> {
    const data = (await this.client.rest.get(Routes.guildVoiceStates(this.guild.id))) as { states?: RawVoiceStateData[] } | RawVoiceStateData[];
    const states = Array.isArray(data) ? data : (data?.states ?? []);
    const seen = new Set<string>();
    for (const raw of states) {
      this._add({ ...raw, guildId: this.guild.id });
      seen.add(raw.userId);
    }
    for (const [id, state] of this.cache) {
      if (!seen.has(id)) state.channelId = null;
    }
    if (member === undefined) return this.cache;
    const id = member === 'me' ? this.client.user.id : this.client.users.resolveId(member);
    return id ? (this.cache.get(id) ?? null) : null;
  }
}

/**
 * Manages the presences of a server's members.
 */
export class PresenceManager extends CachedManager<string, Presence, Presence | UserResolvable> {
  /**
   * @param client - The client
   */
  public constructor(client: Client) {
    super(client);
  }

  /**
   * Adds a presence to the cache, or updates the cached one.
   *
   * @internal
   */
  public _add(data: PresenceData, cache = true): Presence {
    const known = this.cache.get(data.userId);
    if (known !== undefined) return known._patch(data);
    const presence = new Presence(this.client, data);
    if (cache) this.cache.set(data.userId, presence);
    return presence;
  }

  /**
   * Resolves a presence from a presence, user or id.
   *
   * @param presence - The presence
   */
  public override resolve(presence: Presence | UserResolvable): Presence | null {
    if (presence instanceof Presence) return presence;
    const id = this.client.users.resolveId(presence);
    return id ? (this.cache.get(id) ?? null) : null;
  }
}
