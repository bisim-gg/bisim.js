import { isRouteMissing } from '../rest/missing.js';
import { Routes } from '../rest/Routes.js';
import type { Guild } from '../structures/Guild.js';
import type { GuildMember } from '../structures/GuildMember.js';
import type { Role } from '../structures/Role.js';
import type { RawMemberData } from '../types/raw.js';
import { Collection } from '../util/Collection.js';
import { DataManager } from './BaseManager.js';
import { attachHidden } from '../util/internal.js';

/**
 * A role, by structure or id.
 */
export type RoleResolvable = Role | string;

/**
 * Manages the roles of a member.
 */
export class GuildMemberRoleManager extends DataManager<string, Role, RoleResolvable> {
  /** The member. */
  public declare readonly member: GuildMember;
  /** The server. */
  public declare readonly guild: Guild;

  /**
   * @param member - The member
   */
  public constructor(member: GuildMember) {
    super(member.client);
    attachHidden(this, 'member', member);
    attachHidden(this, 'guild', member.guild);
  }

  /**
   * The member's roles, `@everyone` included.
   */
  public override get cache(): Collection<string, Role> {
    const everyone = this.guild.roles.everyone;
    const roles = this.guild.roles.cache.filter((role) => this.member._roles.includes(role.id));
    if (everyone) roles.set(everyone.id, everyone);
    return roles;
  }

  /**
   * The highest role that lists members apart, or `null`.
   */
  public get hoist(): Role | null {
    const hoisted = this.cache.filter((role) => role.hoist);
    return hoisted.size ? hoisted.reduce<Role>((prev, role) => (role.comparePositionTo(prev) > 0 ? role : prev)) : null;
  }

  /**
   * Always `null` on Bisim (no role icons).
   */
  public get icon(): Role | null {
    return null;
  }

  /**
   * The highest role with a color, or `null`.
   */
  public get color(): Role | null {
    const colored = this.cache.filter((role) => role.color !== 0);
    return colored.size ? colored.reduce<Role>((prev, role) => (role.comparePositionTo(prev) > 0 ? role : prev)) : null;
  }

  /**
   * The member's highest role.
   */
  public get highest(): Role {
    return this.cache.reduce<Role>((prev, role) => (role.comparePositionTo(prev) > 0 ? role : prev), this.cache.first()!);
  }

  /**
   * Always `null` on Bisim (no boosts).
   */
  public get premiumSubscriberRole(): Role | null {
    return null;
  }

  /**
   * The role Bisim made for this bot when it was added, or `null`.
   */
  public get botRole(): Role | null {
    if (!this.member.user.bot) return null;
    return this.cache.find((role) => role.managed) ?? null;
  }

  /**
   * Gives the member a role, or several.
   *
   * @param roleOrRoles - The role(s)
   * @param reason - Why
   */
  public async add(roleOrRoles: RoleResolvable | readonly RoleResolvable[] | Collection<string, Role>, reason?: string): Promise<GuildMember> {
    const ids = this.resolveIds(roleOrRoles);
    if (ids.length === 1) {
      try {
        const data = (await this.client.rest.put(Routes.guildMemberRole(this.guild.id, this.member.id, ids[0]!), { reason })) as RawMemberData | undefined;
        return this.applied(data, [...this.member._roles, ids[0]!]);
      } catch (error) {
        if (!isRouteMissing(error)) throw error;
      }
    }
    return this.set([...new Set([...this.member._roles, ...ids])], reason);
  }

  /**
   * Takes a role, or several, from the member.
   *
   * @param roleOrRoles - The role(s)
   * @param reason - Why
   */
  public async remove(roleOrRoles: RoleResolvable | readonly RoleResolvable[] | Collection<string, Role>, reason?: string): Promise<GuildMember> {
    const ids = this.resolveIds(roleOrRoles);
    if (ids.length === 1) {
      try {
        const data = (await this.client.rest.delete(Routes.guildMemberRole(this.guild.id, this.member.id, ids[0]!), { reason })) as RawMemberData | undefined;
        return this.applied(data, this.member._roles.filter((id) => id !== ids[0]));
      } catch (error) {
        if (!isRouteMissing(error)) throw error;
      }
    }
    return this.set(this.member._roles.filter((id) => !ids.includes(id)), reason);
  }

  /**
   * Replaces the member's roles.
   *
   * @param roles - The roles to have
   * @param reason - Why
   */
  public set(roles: readonly RoleResolvable[] | Collection<string, Role>, reason?: string): Promise<GuildMember> {
    return this.member.edit({ roles, reason });
  }

  private applied(data: RawMemberData | undefined, fallbackRoles: string[]): GuildMember {
    if (data && typeof data === 'object' && 'userId' in data) this.member._patch(data);
    else this.member._roles = [...new Set(fallbackRoles)].filter((id) => id !== this.guild.id);
    return this.member;
  }

  private resolveIds(roleOrRoles: RoleResolvable | readonly RoleResolvable[] | Collection<string, Role>): string[] {
    const list =
      roleOrRoles instanceof Collection ? [...roleOrRoles.keys()] : Array.isArray(roleOrRoles) ? roleOrRoles : [roleOrRoles as RoleResolvable];
    return list.map((role) => {
      const id = typeof role === 'string' ? role : role.id;
      if (!id) throw new TypeError('Could not resolve a role.');
      return id;
    });
  }

  /**
   * Gives a copy of this manager for another member (internal, used by update events).
   *
   * @internal
   */
  public clone(): GuildMemberRoleManager {
    const clone = new GuildMemberRoleManager(this.member);
    return clone;
  }

  public override valueOf(): Collection<string, Role> {
    return this.cache;
  }
}
