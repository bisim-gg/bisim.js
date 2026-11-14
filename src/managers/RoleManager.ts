import { Routes } from '../rest/Routes.js';
import type { Guild } from '../structures/Guild.js';
import { Role } from '../structures/Role.js';
import type { User } from '../structures/User.js';
import type { RawRoleData } from '../types/raw.js';
import { Collection } from '../util/Collection.js';
import { PermissionsBitField, type PermissionResolvable } from '../util/PermissionsBitField.js';
import { type ColorResolvable, notSupported, resolveColor } from '../util/Util.js';
import { CachedManager } from './BaseManager.js';
import type { RoleResolvable } from './GuildMemberRoleManager.js';
import type { BaseFetchOptions } from './UserManager.js';
import { attachHidden } from '../util/internal.js';

/**
 * Data for creating or editing a role.
 */
export interface RoleData {
  name?: string;
  color?: ColorResolvable;
  /** Not on Bisim: gradient role colors. */
  colors?: unknown;
  hoist?: boolean;
  position?: number;
  permissions?: PermissionResolvable;
  mentionable?: boolean;
  /** Not on Bisim. */
  icon?: unknown;
  /** Not on Bisim. */
  unicodeEmoji?: string | null;
}

/**
 * Options for creating a role.
 */
export interface RoleCreateOptions extends RoleData {
  reason?: string;
}

/**
 * Options for moving a role.
 */
export interface SetRolePositionOptions {
  relative?: boolean;
  reason?: string;
}

/**
 * A role's new place, for {@link RoleManager.setPositions}.
 */
export interface RolePosition {
  role: RoleResolvable;
  position: number;
}

function roleBody(data: RoleData): Record<string, unknown> {
  if (data.icon !== undefined && data.icon !== null) notSupported('Role icons');
  if (data.unicodeEmoji !== undefined && data.unicodeEmoji !== null) notSupported('Role emoji');
  if (data.colors !== undefined) notSupported('Gradient role colors');
  const body: Record<string, unknown> = {};
  if (data.name !== undefined) body.name = data.name;
  if (data.color !== undefined) body.color = data.color === null ? 0 : resolveColor(data.color);
  if (data.hoist !== undefined) body.hoist = data.hoist;
  if (data.permissions !== undefined) body.permissions = PermissionsBitField.resolve(data.permissions).toString();
  if (data.mentionable !== undefined) body.mentionable = data.mentionable;
  return body;
}

/**
 * Manages the roles of a server.
 */
export class RoleManager extends CachedManager<string, Role, RoleResolvable> {
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
   * Adds a role to the cache, or updates the cached one.
   *
   * @internal
   */
  public _add(data: RawRoleData, cache = true): Role {
    const refreshed = this.refreshCached(data.id, data);
    if (refreshed) return refreshed;
    const role = new Role(this.client, data, this.guild);
    if (cache) this.cache.set(role.id, role);
    return role;
  }

  /**
   * The `@everyone` role.
   */
  public get everyone(): Role {
    return this.cache.get(this.guild.id)!;
  }

  /**
   * The highest role of the server.
   */
  public get highest(): Role {
    return this.cache.reduce((prev, role) => (this.comparePositions(role, prev) > 0 ? role : prev), this.cache.first()!);
  }

  /**
   * Always `null` on Bisim (no boosts).
   */
  public get premiumSubscriberRole(): Role | null {
    return null;
  }

  /**
   * The role Bisim made for a bot when it was added, or `null`.
   *
   * @param user - The bot
   */
  public botRoleFor(user: User | string): Role | null {
    const id = typeof user === 'string' ? user : user.id;
    const member = this.guild.members.cache.get(id);
    return member?.roles.botRole ?? null;
  }

  /**
   * Fetches one role by id, or every role of the server.
   *
   * @param id - The role's id
   * @param options - Whether to cache or skip the cache
   */
  public fetch(id: string, options?: BaseFetchOptions): Promise<Role | null>;
  public fetch(id?: undefined, options?: BaseFetchOptions): Promise<Collection<string, Role>>;
  public async fetch(id?: string, options: BaseFetchOptions = {}): Promise<Role | null | Collection<string, Role>> {
    if (id && !options.force) {
      const cached = this.fromCache(id);
      if (cached) return cached;
    }
    const data = (await this.client.rest.get(Routes.guildRoles(this.guild.id))) as RawRoleData[];
    const roles = new Collection<string, Role>();
    for (const raw of data) {
      const role = this._add(raw, options.cache ?? true);
      roles.set(role.id, role);
    }
    return id ? (roles.get(id) ?? null) : roles;
  }

  /**
   * Creates a role.
   *
   * @param options - The role
   * @example
   * ```js
   * await guild.roles.create({ name: 'Super Cool Blue People', color: Colors.Blue, reason: 'we needed a role' });
   * ```
   */
  public async create(options: RoleCreateOptions = {}): Promise<Role> {
    const body = roleBody(options);
    body.name ??= 'new role';
    const data = (await this.client.rest.post(Routes.guildRoles(this.guild.id), { body, reason: options.reason })) as RawRoleData;
    const role = this._add(data);
    if (options.position !== undefined) await this.setPosition(role, options.position, { reason: options.reason });
    return role;
  }

  /**
   * Edits a role.
   *
   * @param role - The role
   * @param options - What to change
   */
  public async edit(role: RoleResolvable, options: RoleData & { reason?: string }): Promise<Role> {
    const id = this.resolveId(role)!;
    const body = roleBody(options);
    let result = this.cache.get(id);
    if (Object.keys(body).length) {
      const data = (await this.client.rest.patch(Routes.guildRole(this.guild.id, id), { body, reason: options.reason })) as RawRoleData;
      result = this._add(data);
    }
    if (options.position !== undefined) result = await this.setPosition(id, options.position, { reason: options.reason });
    return result ?? (await this.fetch(id, { force: true }))!;
  }

  /**
   * Deletes a role.
   *
   * @param role - The role
   * @param reason - Why
   */
  public async delete(role: RoleResolvable, reason?: string): Promise<void> {
    const id = this.resolveId(role)!;
    await this.client.rest.delete(Routes.guildRole(this.guild.id, id), { reason });
    this.cache.delete(id);
    for (const member of this.guild.members.cache.values()) member._roles = member._roles.filter((roleId) => roleId !== id);
  }

  /**
   * Moves a role.
   *
   * @param role - The role
   * @param position - The new position (counted from the bottom)
   * @param options - Whether it is relative, and why
   */
  public async setPosition(role: RoleResolvable, position: number, options: SetRolePositionOptions = {}): Promise<Role> {
    const resolved = this.resolve(role);
    if (!resolved) throw new TypeError('Could not resolve the role.');
    const ordered = [...this.cache.values()].filter((other) => other.id !== this.guild.id).sort((a, b) => this.comparePositions(a, b));
    const from = ordered.indexOf(resolved);
    ordered.splice(from, 1);
    const target = Math.max(0, Math.min(ordered.length, options.relative ? from + position : position - 1));
    ordered.splice(target, 0, resolved);
    await this.setPositions(ordered.map((other, index) => ({ role: other.id, position: index + 1 })));
    return resolved;
  }

  /**
   * Moves several roles at once.
   *
   * @param rolePositions - The new places
   */
  public async setPositions(rolePositions: readonly RolePosition[]): Promise<Guild> {
    const roles = rolePositions.map((entry) => ({ id: this.resolveId(entry.role)!, position: entry.position }));
    await this.client.rest.patch(Routes.guildRolePositions(this.guild.id), { body: { roles } });
    for (const item of roles) {
      const role = this.cache.get(item.id);
      if (role) role.rawPosition = item.position;
    }
    return this.guild;
  }

  /**
   * Compares two roles' positions: positive when the first is higher.
   *
   * @param role1 - The first role
   * @param role2 - The second role
   */
  public comparePositions(role1: RoleResolvable, role2: RoleResolvable): number {
    const first = this.resolve(role1);
    const second = this.resolve(role2);
    if (!first || !second) throw new TypeError('Could not resolve the roles to compare.');
    if (first.rawPosition === second.rawPosition) {
      const a = BigInt(first.id);
      const b = BigInt(second.id);
      return a === b ? 0 : a < b ? 1 : -1;
    }
    return first.rawPosition - second.rawPosition;
  }
}
