import type { Client } from '../client/Client.js';
import { BisimjsError, ErrorCodes } from '../errors/index.js';
import { Routes } from '../rest/Routes.js';
import type { ApplicationCommand } from '../structures/ApplicationCommand.js';
import type { RawInteractionData } from '../types/raw.js';
import { type ApplicationCommandType, InteractionResponseType } from '../util/Enums.js';
import { commandTypeFromBisim, localizationsToBisim } from '../util/Transformers.js';
import { BaseInteraction, type CacheType } from './BaseInteraction.js';
import { CommandInteractionOptionResolver, transformOption, transformResolved } from './CommandInteractionOptionResolver.js';

/**
 * A suggestion for an autocomplete option.
 */
export interface ApplicationCommandOptionChoiceData<Value extends string | number = string | number> {
  name: string;
  nameLocalizations?: Record<string, string> | null;
  value: Value;
}

/**
 * A request for suggestions while a user types in an option with `autocomplete: true`.
 *
 * @example
 * ```js
 * if (interaction.isAutocomplete()) {
 *   const focused = interaction.options.getFocused();
 *   await interaction.respond(choices.filter((c) => c.startsWith(focused)).map((c) => ({ name: c, value: c })));
 * }
 * ```
 */
export class AutocompleteInteraction<Cached extends CacheType = CacheType> extends BaseInteraction<Cached> {
  /** The command's id. */
  public commandId: string;
  /** The command's name. */
  public commandName: string;
  /** The command's type. */
  public commandType: ApplicationCommandType;
  /** The server the command belongs to, or `null`. */
  public commandGuildId: string | null;
  /** Whether the bot already answered. */
  public responded = false;
  /** The options typed so far; `getFocused()` gives the one being typed. */
  public options: CommandInteractionOptionResolver;

  /**
   * @param client - The client
   * @param data - The interaction payload
   */
  public constructor(client: Client, data: RawInteractionData) {
    super(client, data);
    this.commandId = data.data?.id ?? '';
    this.commandName = data.data?.name ?? '';
    this.commandType = commandTypeFromBisim(data.data?.type);
    this.commandGuildId = data.data?.guildId ?? null;
    const resolved = transformResolved(client, this.guild as never, data.data?.resolved);
    const options = (data.data?.options ?? []).map((option) => transformOption(client, this.guild as never, option, resolved));
    this.options = new CommandInteractionOptionResolver(client, options, resolved);
  }

  /**
   * The command, when cached.
   */
  public get command(): ApplicationCommand | null {
    return this.client.application?.commands.cache.get(this.commandId) ?? null;
  }

  /**
   * Sends the suggestions (at most 25).
   *
   * @param options - The suggestions
   */
  public async respond(options: readonly ApplicationCommandOptionChoiceData[]): Promise<void> {
    if (this.responded === true) throw new BisimjsError(ErrorCodes.InteractionAlreadyReplied);
    const choices = options.slice(0, 25).map((choice) => {
      const names = localizationsToBisim(choice.nameLocalizations ?? (choice as { name_localizations?: Record<string, string> }).name_localizations);
      return names ? { name: choice.name, value: choice.value, nameLocalizations: names } : { name: choice.name, value: choice.value };
    });
    const callback = Routes.interactionCallback(this.id, this.token);
    const body = { type: InteractionResponseType.ApplicationCommandAutocompleteResult, data: { choices } };
    await this.client.rest.post(callback, { auth: false, body });
    this.responded = true;
  }
}
