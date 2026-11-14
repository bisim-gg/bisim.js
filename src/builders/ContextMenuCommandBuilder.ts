import { BisimjsRangeError, ErrorCodes } from '../errors/index.js';
import type { RawApplicationCommandData } from '../types/raw.js';
import { ApplicationCommandType, InteractionContextType } from '../util/Enums.js';
import { PermissionsBitField, type PermissionResolvable } from '../util/PermissionsBitField.js';
import { contextToBisim, localizationsToBisim } from '../util/Transformers.js';
import type { LocalizationMap } from './SlashCommandBuilder.js';

/**
 * The type of a context menu command: on a user or on a message.
 */
export type ContextMenuCommandType = ApplicationCommandType.User | ApplicationCommandType.Message;

const CONTEXT_MENU_NAME = /^[\p{L}\p{N}_\- ]{1,32}$/u;

/**
 * Builds a context menu command (right click on a user or a message), the discord.js way.
 *
 * @example
 * ```js
 * const data = new ContextMenuCommandBuilder().setName('User Information').setType(ApplicationCommandType.User);
 * ```
 */
export class ContextMenuCommandBuilder {
  /** The name, 1 to 32 characters, spaces and capitals allowed. */
  public readonly name!: string;
  /** The name in other languages. */
  public readonly name_localizations?: LocalizationMap;
  /** The type of the command. */
  public readonly type!: ContextMenuCommandType;
  /** Where the command can run. */
  public readonly contexts?: InteractionContextType[];
  /** Who may run the command by default, as a decimal permission string. */
  public readonly default_member_permissions?: string | null;
  /** @deprecated Use {@link ContextMenuCommandBuilder.contexts} */
  public readonly dm_permission?: boolean;
  /** Accepted for compatibility. */
  public readonly integration_types?: number[];

  /**
   * Sets the name.
   *
   * @param name - The name
   */
  public setName(name: string): this {
    if (typeof name !== 'string' || !CONTEXT_MENU_NAME.test(name)) throw new BisimjsRangeError(ErrorCodes.CommandName, name);
    Reflect.set(this, 'name', name);
    return this;
  }

  /**
   * Sets the type: {@link ApplicationCommandType.User} or {@link ApplicationCommandType.Message}.
   *
   * @param type - The type
   */
  public setType(type: ContextMenuCommandType): this {
    Reflect.set(this, 'type', type);
    return this;
  }

  /**
   * Sets where the command can run.
   *
   * @param contexts - Where the command can be used
   */
  public setContexts(...contexts: (InteractionContextType | InteractionContextType[])[]): this {
    Reflect.set(this, 'contexts', contexts.flat());
    return this;
  }

  /**
   * Accepted for compatibility: Bisim installs bots in servers only.
   *
   * @param integrationTypes - How the app must be installed for the command to show
   */
  public setIntegrationTypes(...integrationTypes: (number | number[])[]): this {
    Reflect.set(this, 'integration_types', integrationTypes.flat());
    return this;
  }

  /**
   * Sets who may run the command by default.
   *
   * @param permissions - The permissions, or `null` / `undefined` for everyone
   */
  public setDefaultMemberPermissions(permissions: PermissionResolvable | bigint | number | string | null | undefined): this {
    Reflect.set(
      this,
      'default_member_permissions',
      permissions === null || permissions === undefined ? permissions : PermissionsBitField.resolve(permissions).toString(),
    );
    return this;
  }

  /**
   * @deprecated Use {@link ContextMenuCommandBuilder.setContexts}
   * @param enabled - Whether it can run in DMs
   */
  public setDMPermission(enabled: boolean | null | undefined): this {
    Reflect.set(this, 'dm_permission', enabled ?? undefined);
    return this;
  }

  /**
   * Sets the name in one language.
   *
   * @param locale - The language
   * @param localizedName - The name, or `null` to remove it
   */
  public setNameLocalization(locale: string, localizedName: string | null): this {
    const map: LocalizationMap = { ...(this.name_localizations ?? {}) };
    if (localizedName === null) delete map[locale];
    else map[locale] = localizedName;
    Reflect.set(this, 'name_localizations', map);
    return this;
  }

  /**
   * Sets the name in several languages.
   *
   * @param localizedNames - The names by language, or `null` to remove them
   */
  public setNameLocalizations(localizedNames: LocalizationMap | null): this {
    Reflect.set(this, 'name_localizations', localizedNames === null ? undefined : { ...localizedNames });
    return this;
  }

  /**
   * The command as Bisim's JSON.
   */
  public toJSON(): Omit<RawApplicationCommandData, 'id'> {
    if (this.name === undefined) throw new BisimjsRangeError(ErrorCodes.CommandName, 'undefined');
    const json: Omit<RawApplicationCommandData, 'id'> = { name: this.name, type: this.type ?? ApplicationCommandType.User };
    if (this.default_member_permissions !== undefined && this.default_member_permissions !== null) {
      json.defaultMemberPermissions = this.default_member_permissions;
    }
    let contexts = this.contexts;
    if (!contexts?.length && this.dm_permission === false) contexts = [InteractionContextType.Guild];
    if (contexts?.length) {
      json.contexts = contexts.map((context) => contextToBisim(context)).filter((context): context is 'GUILD' | 'BOT_DM' => context !== null);
    }
    const names = localizationsToBisim(this.name_localizations);
    if (names) json.nameLocalizations = names;
    return json;
  }
}
