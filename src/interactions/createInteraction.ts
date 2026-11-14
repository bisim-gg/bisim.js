import type { Client } from '../client/Client.js';
import type { RawInteractionData } from '../types/raw.js';
import { ApplicationCommandType, ComponentType, InteractionType } from '../util/Enums.js';
import { commandTypeFromBisim } from '../util/Transformers.js';
import { AutocompleteInteraction } from './AutocompleteInteraction.js';
import { BaseInteraction } from './BaseInteraction.js';
import { ChatInputCommandInteraction, MessageContextMenuCommandInteraction, UserContextMenuCommandInteraction } from './CommandInteraction.js';
import { ButtonInteraction, ChannelSelectMenuInteraction, MentionableSelectMenuInteraction, RoleSelectMenuInteraction, StringSelectMenuInteraction, UserSelectMenuInteraction } from './MessageComponentInteraction.js';
import { ModalSubmitInteraction } from './ModalSubmitInteraction.js';

type InteractionClass = new (client: Client, data: RawInteractionData) => BaseInteraction;

/** Context menu commands by command type; anything else is a slash command. */
const commandClasses: Partial<Record<ApplicationCommandType, InteractionClass>> = {
  [ApplicationCommandType.User]: UserContextMenuCommandInteraction,
  [ApplicationCommandType.Message]: MessageContextMenuCommandInteraction,
};

/** Select menus by component type; anything else is a button. */
const componentClasses: Partial<Record<ComponentType, InteractionClass>> = {
  [ComponentType.StringSelect]: StringSelectMenuInteraction,
  [ComponentType.UserSelect]: UserSelectMenuInteraction,
  [ComponentType.RoleSelect]: RoleSelectMenuInteraction,
  [ComponentType.MentionableSelect]: MentionableSelectMenuInteraction,
  [ComponentType.ChannelSelect]: ChannelSelectMenuInteraction,
};

/** Picks the class for each kind of interaction; unknown kinds become a plain {@link BaseInteraction}. */
const classPickers: Partial<Record<InteractionType, (data: RawInteractionData) => InteractionClass>> = {
  [InteractionType.ApplicationCommand]: (data) => commandClasses[commandTypeFromBisim(data.data?.type)] ?? ChatInputCommandInteraction,
  [InteractionType.MessageComponent]: (data) => componentClasses[data.data?.componentType as ComponentType] ?? ButtonInteraction,
  [InteractionType.ApplicationCommandAutocomplete]: () => AutocompleteInteraction,
  [InteractionType.ModalSubmit]: () => ModalSubmitInteraction,
};

/**
 * Makes the right interaction class for a payload.
 *
 * @param client - The client
 * @param data - The interaction payload
 * @internal
 */
export function createInteraction(client: Client, data: RawInteractionData): BaseInteraction {
  const Kind = classPickers[data.type as InteractionType]?.(data) ?? BaseInteraction;
  return new Kind(client, data);
}
