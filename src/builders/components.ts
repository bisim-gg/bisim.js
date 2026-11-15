import { BisimjsRangeError, ErrorCodes } from '../errors/index.js';
import type { RawComponentData } from '../types/raw.js';
import { ButtonStyle, ChannelType, ComponentType, SelectMenuDefaultValueType, TextInputStyle } from '../util/Enums.js';
import { channelTypeToBisim, toBisimComponent, toBisimComponentEmoji } from '../util/Transformers.js';
import { notSupported } from '../util/Util.js';

/**
 * An emoji on a button or a select option: a Unicode emoji, a custom emoji token `<:name:id>`, or an object.
 */
export type ComponentEmojiResolvable = string | { id?: string | null; name?: string | null; animated?: boolean };

/**
 * Anything that turns into component JSON.
 */
export interface JSONEncodable<Value> {
  toJSON(): Value;
}

/**
 * The base of every component builder. `data` and `toJSON()` use Bisim's camelCase shape (`customId`,
 * `minValues`, ...).
 */
export abstract class ComponentBuilder<Data extends Partial<RawComponentData> = Partial<RawComponentData>> {
  /**
   * The component data.
   */
  public readonly data: Data;

  protected constructor(data: Data) {
    this.data = data;
  }

  /**
   * Sets the id of this component (accepted for compatibility; Bisim does not use component ids).
   *
   * @param id - The id
   */
  public setId(id: number): this {
    (this.data as Record<string, unknown>).id = id;
    return this;
  }

  /**
   * The component as Bisim's JSON.
   */
  public abstract toJSON(): RawComponentData;
}

/** Writes one field of a builder's data and hands the builder back, so setters chain. */
function setField<Builder extends { data: object }>(builder: Builder, key: string, value: unknown): Builder {
  (builder.data as Record<string, unknown>)[key] = value;
  return builder;
}

function checkCustomId(customId: string | undefined, code: (typeof ErrorCodes)[keyof typeof ErrorCodes]): void {
  if (typeof customId !== 'string' || customId.length < 1 || customId.length > 100) throw new BisimjsRangeError(code);
}

function plain(other: JSONEncodable<unknown> | Record<string, unknown>): Record<string, unknown> {
  return { ...((typeof (other as JSONEncodable<unknown>).toJSON === 'function' ? (other as JSONEncodable<unknown>).toJSON() : other) as Record<string, unknown>) };
}

function fromInput(data: Record<string, unknown> | undefined): Partial<RawComponentData> {
  if (!data) return {};
  const converted = toBisimComponent({ type: 0, ...data });
  if (data.type === undefined) delete (converted as Partial<RawComponentData>).type;
  return converted;
}

/**
 * Builds a button, the discord.js way.
 *
 * @example
 * ```js
 * const join = new ButtonBuilder().setCustomId('join-event').setLabel('Count me in').setStyle(ButtonStyle.Success);
 * ```
 */
export class ButtonBuilder extends ComponentBuilder {
  /**
   * Makes a builder from an existing component (for example `interaction.component`) or its JSON.
   *
   * @param other - The component to copy
   */
  public static from(other: JSONEncodable<unknown> | Record<string, unknown>): ButtonBuilder {
    return new ButtonBuilder(plain(other));
  }

  /**
   * @param data - Button data to start from (camelCase or Discord's snake_case)
   */
  public constructor(data?: Record<string, unknown>) {
    super({ ...fromInput(data), type: ComponentType.Button });
  }

  /** Sets the style. */
  public setStyle(style: ButtonStyle): this {
    return setField(this, 'style', style);
  }

  /** Sets the address of a link button. */
  public setURL(url: string): this {
    return setField(this, 'url', url);
  }

  /** Sets the custom id the bot gets back when the button is pressed (up to 100 characters). */
  public setCustomId(customId: string): this {
    return setField(this, 'customId', customId);
  }

  /** Not on Bisim: premium buttons need SKUs. */
  public setSKUId(_skuId: string): this {
    return notSupported('Premium buttons (SKUs)');
  }

  /** Sets the emoji. */
  public setEmoji(emoji: ComponentEmojiResolvable): this {
    return setField(this, 'emoji', toBisimComponentEmoji(emoji));
  }

  /** Sets whether the button is disabled. */
  public setDisabled(disabled = true): this {
    return setField(this, 'disabled', disabled);
  }

  /** Sets the label (up to 80 characters). */
  public setLabel(label: string): this {
    return setField(this, 'label', label);
  }

  public toJSON(): RawComponentData {
    const { style, url, customId, label, emoji } = this.data;
    if (style === ButtonStyle.Link) {
      if (!url || customId) throw new BisimjsRangeError(ErrorCodes.ButtonURL);
    } else {
      if (url) throw new BisimjsRangeError(ErrorCodes.ButtonURL);
      checkCustomId(customId, ErrorCodes.ButtonCustomId);
    }
    if (!label && !emoji) throw new BisimjsRangeError(ErrorCodes.ButtonLabel);
    if (style === ButtonStyle.Premium) notSupported('Premium buttons');
    return toBisimComponent({ ...this.data, type: ComponentType.Button });
  }
}

/**
 * Builds one option of a string select menu.
 */
export class StringSelectMenuOptionBuilder implements JSONEncodable<NonNullable<RawComponentData['options']>[number]> {
  /** The option data. */
  public readonly data: Partial<NonNullable<RawComponentData['options']>[number]>;

  /**
   * @param data - Option data to start from
   */
  public constructor(data: Partial<NonNullable<RawComponentData['options']>[number]> = {}) {
    this.data = { ...data };
  }

  /** Sets the label the user sees (up to 100 characters). */
  public setLabel(label: string): this {
    return setField(this, 'label', label);
  }

  /** Sets the value the bot gets back (up to 100 characters). */
  public setValue(value: string): this {
    return setField(this, 'value', value);
  }

  /** Sets the description under the label (up to 100 characters). */
  public setDescription(description: string): this {
    return setField(this, 'description', description);
  }

  /** Sets whether this option is selected by default. */
  public setDefault(isDefault = true): this {
    return setField(this, 'default', isDefault);
  }

  /** Sets the emoji. */
  public setEmoji(emoji: ComponentEmojiResolvable): this {
    return setField(this, 'emoji', toBisimComponentEmoji(emoji));
  }

  public toJSON(): NonNullable<RawComponentData['options']>[number] {
    const { label, value, description } = this.data;
    if (typeof label !== 'string' || label.length < 1 || label.length > 100) throw new BisimjsRangeError(ErrorCodes.SelectOptionLabel);
    if (typeof value !== 'string' || value.length < 1 || value.length > 100) throw new BisimjsRangeError(ErrorCodes.SelectOptionValue);
    if (description !== undefined && description.length > 100) throw new BisimjsRangeError(ErrorCodes.SelectOptionDescription);
    return { ...this.data } as NonNullable<RawComponentData['options']>[number];
  }
}

/**
 * The base of the select menu builders.
 */
export abstract class BaseSelectMenuBuilder extends ComponentBuilder {
  /** Sets the custom id the bot gets back (up to 100 characters). */
  public setCustomId(customId: string): this {
    return setField(this, 'customId', customId);
  }

  /** Sets the text shown when nothing is selected (up to 150 characters). */
  public setPlaceholder(placeholder: string): this {
    if (placeholder.length > 150) throw new BisimjsRangeError(ErrorCodes.SelectMenuPlaceholder);
    return setField(this, 'placeholder', placeholder);
  }

  /** Sets the fewest items that must be selected. */
  public setMinValues(minValues: number): this {
    return setField(this, 'minValues', minValues);
  }

  /** Sets the most items that can be selected. */
  public setMaxValues(maxValues: number): this {
    return setField(this, 'maxValues', maxValues);
  }

  /** Sets whether the menu is disabled. */
  public setDisabled(disabled = true): this {
    return setField(this, 'disabled', disabled);
  }

  /** Not on Bisim yet: whether a select menu inside a modal is required. */
  public setRequired(_required = true): this {
    return notSupported('Select menus in modals');
  }

  public toJSON(): RawComponentData {
    checkCustomId(this.data.customId, ErrorCodes.SelectMenuCustomId);
    return toBisimComponent({ ...this.data });
  }
}

/**
 * Builds a select menu of your own options.
 */
export class StringSelectMenuBuilder extends BaseSelectMenuBuilder {
  /**
   * Makes a builder from an existing component (for example `interaction.component`) or its JSON.
   *
   * @param other - The component to copy
   */
  public static from(other: JSONEncodable<unknown> | Record<string, unknown>): StringSelectMenuBuilder {
    return new StringSelectMenuBuilder(plain(other));
  }

  /** The options. */
  public readonly options: StringSelectMenuOptionBuilder[];

  /**
   * @param data - Menu data to start from
   */
  public constructor(data?: Record<string, unknown>) {
    const { options, ...rest } = data ?? {};
    super({ ...fromInput(rest), type: ComponentType.StringSelect });
    this.options = ((options as Record<string, unknown>[] | undefined) ?? []).map(
      (option) => new StringSelectMenuOptionBuilder(fromInput({ type: 0, options: [option] }).options?.[0]),
    );
  }

  /** Adds options (at most 25 in all). */
  public addOptions(...options: (StringSelectMenuOptionBuilder | Record<string, unknown> | (StringSelectMenuOptionBuilder | Record<string, unknown>)[])[]): this {
    const flat = options.flat().map((option) =>
      option instanceof StringSelectMenuOptionBuilder ? option : new StringSelectMenuOptionBuilder(fromInput({ type: 0, options: [option] }).options?.[0]),
    );
    if (this.options.length + flat.length > 25) throw new RangeError('A select menu has at most 25 options.');
    this.options.push(...flat);
    return this;
  }

  /** Replaces the options. */
  public setOptions(...options: (StringSelectMenuOptionBuilder | Record<string, unknown> | (StringSelectMenuOptionBuilder | Record<string, unknown>)[])[]): this {
    this.options.splice(0, this.options.length);
    return this.addOptions(...options);
  }

  /** Removes, replaces or inserts options, like `Array.prototype.splice()`. */
  public spliceOptions(index: number, deleteCount: number, ...options: (StringSelectMenuOptionBuilder | Record<string, unknown>)[]): this {
    const built = options.map((option) =>
      option instanceof StringSelectMenuOptionBuilder ? option : new StringSelectMenuOptionBuilder(fromInput({ type: 0, options: [option] }).options?.[0]),
    );
    this.options.splice(index, deleteCount, ...built);
    return this;
  }

  public override toJSON(): RawComponentData {
    checkCustomId(this.data.customId, ErrorCodes.SelectMenuCustomId);
    return toBisimComponent({ ...this.data, options: this.options.map((option) => option.toJSON()) });
  }
}

/**
 * A value a user, role, mentionable or channel select shows as picked when it is drawn.
 */
export interface SelectMenuDefaultValue {
  /** The user's, role's or channel's id. */
  id: string;
  /** What the id is. */
  type: SelectMenuDefaultValueType | `${SelectMenuDefaultValueType}`;
}

/** A user, role or channel to preselect: its id, or anything with an `id`. */
export type SelectMenuDefaultValueResolvable = string | { id: string };

const defaultIds = (values: readonly (SelectMenuDefaultValueResolvable | readonly SelectMenuDefaultValueResolvable[])[]): string[] =>
  (values.flat() as SelectMenuDefaultValueResolvable[]).map((value) => (typeof value === 'string' ? value : value.id));

abstract class AutoSelectMenuBuilder extends BaseSelectMenuBuilder {
  /** The default values the builder holds now. */
  protected get defaults(): SelectMenuDefaultValue[] {
    return ((this.data as { defaultValues?: SelectMenuDefaultValue[] }).defaultValues ??= []);
  }

  /** Adds default values of one kind (at most 25 in all). */
  protected addDefaults(type: SelectMenuDefaultValueType, ids: readonly string[]): this {
    const values = [...this.defaults, ...ids.map((id) => ({ id, type }))];
    if (values.length > 25) throw new RangeError('A select menu has at most 25 default values.');
    (this.data as { defaultValues?: SelectMenuDefaultValue[] }).defaultValues = values;
    return this;
  }

  /** Replaces the default values (the menu's count must lie between its min and max values). */
  public setDefaultValues(...values: (SelectMenuDefaultValue | readonly SelectMenuDefaultValue[])[]): this {
    const flat = (values.flat() as SelectMenuDefaultValue[]).map((value) => ({ id: value.id, type: value.type }));
    if (flat.length > 25) throw new RangeError('A select menu has at most 25 default values.');
    (this.data as { defaultValues?: SelectMenuDefaultValue[] }).defaultValues = flat;
    return this;
  }
}

/**
 * Builds a select menu of the server's members.
 */
export class UserSelectMenuBuilder extends AutoSelectMenuBuilder {
  /**
   * Makes a builder from an existing component (for example `interaction.component`) or its JSON.
   *
   * @param other - The component to copy
   */
  public static from(other: JSONEncodable<unknown> | Record<string, unknown>): UserSelectMenuBuilder {
    return new UserSelectMenuBuilder(plain(other));
  }

  public constructor(data?: Record<string, unknown>) {
    super({ ...fromInput(data), type: ComponentType.UserSelect });
  }

  /** Adds members the menu shows as picked. */
  public addDefaultUsers(...users: (SelectMenuDefaultValueResolvable | readonly SelectMenuDefaultValueResolvable[])[]): this {
    return this.addDefaults(SelectMenuDefaultValueType.User, defaultIds(users));
  }

  /** Replaces the members the menu shows as picked. */
  public setDefaultUsers(...users: (SelectMenuDefaultValueResolvable | readonly SelectMenuDefaultValueResolvable[])[]): this {
    (this.data as { defaultValues?: unknown[] }).defaultValues = [];
    return this.addDefaultUsers(...users);
  }
}

/**
 * Builds a select menu of the server's roles.
 */
export class RoleSelectMenuBuilder extends AutoSelectMenuBuilder {
  /**
   * Makes a builder from an existing component (for example `interaction.component`) or its JSON.
   *
   * @param other - The component to copy
   */
  public static from(other: JSONEncodable<unknown> | Record<string, unknown>): RoleSelectMenuBuilder {
    return new RoleSelectMenuBuilder(plain(other));
  }

  public constructor(data?: Record<string, unknown>) {
    super({ ...fromInput(data), type: ComponentType.RoleSelect });
  }

  /** Adds roles the menu shows as picked. */
  public addDefaultRoles(...roles: (SelectMenuDefaultValueResolvable | readonly SelectMenuDefaultValueResolvable[])[]): this {
    return this.addDefaults(SelectMenuDefaultValueType.Role, defaultIds(roles));
  }

  /** Replaces the roles the menu shows as picked. */
  public setDefaultRoles(...roles: (SelectMenuDefaultValueResolvable | readonly SelectMenuDefaultValueResolvable[])[]): this {
    (this.data as { defaultValues?: unknown[] }).defaultValues = [];
    return this.addDefaultRoles(...roles);
  }
}

/**
 * Builds a select menu of users and roles.
 */
export class MentionableSelectMenuBuilder extends AutoSelectMenuBuilder {
  /**
   * Makes a builder from an existing component (for example `interaction.component`) or its JSON.
   *
   * @param other - The component to copy
   */
  public static from(other: JSONEncodable<unknown> | Record<string, unknown>): MentionableSelectMenuBuilder {
    return new MentionableSelectMenuBuilder(plain(other));
  }

  public constructor(data?: Record<string, unknown>) {
    super({ ...fromInput(data), type: ComponentType.MentionableSelect });
  }

  /** Adds members the menu shows as picked. */
  public addDefaultUsers(...users: (SelectMenuDefaultValueResolvable | readonly SelectMenuDefaultValueResolvable[])[]): this {
    return this.addDefaults(SelectMenuDefaultValueType.User, defaultIds(users));
  }

  /** Adds roles the menu shows as picked. */
  public addDefaultRoles(...roles: (SelectMenuDefaultValueResolvable | readonly SelectMenuDefaultValueResolvable[])[]): this {
    return this.addDefaults(SelectMenuDefaultValueType.Role, defaultIds(roles));
  }

  /** Adds users and roles the menu shows as picked, each with its type. */
  public addDefaultValues(...values: (SelectMenuDefaultValue | readonly SelectMenuDefaultValue[])[]): this {
    const flat = values.flat() as SelectMenuDefaultValue[];
    const merged = [...this.defaults, ...flat.map((value) => ({ id: value.id, type: value.type }))];
    return this.setDefaultValues(merged);
  }
}

/**
 * Builds a select menu of the server's channels.
 */
export class ChannelSelectMenuBuilder extends AutoSelectMenuBuilder {
  /**
   * Makes a builder from an existing component (for example `interaction.component`) or its JSON.
   *
   * @param other - The component to copy
   */
  public static from(other: JSONEncodable<unknown> | Record<string, unknown>): ChannelSelectMenuBuilder {
    return new ChannelSelectMenuBuilder(plain(other));
  }

  public constructor(data?: Record<string, unknown>) {
    super({ ...fromInput(data), type: ComponentType.ChannelSelect });
  }

  /** Limits the menu to these channel types. */
  public addChannelTypes(...types: (ChannelType | ChannelType[])[]): this {
    const names = (types.flat() as ChannelType[]).map((type) => channelTypeToBisim(type)).filter((type): type is NonNullable<typeof type> => type !== null);
    return setField(this, 'channelTypes', [...((this.data.channelTypes as string[] | undefined) ?? []), ...names]);
  }

  /** Replaces the channel types the menu shows. */
  public setChannelTypes(...types: (ChannelType | ChannelType[])[]): this {
    this.data.channelTypes = [];
    return this.addChannelTypes(...types);
  }

  /** Adds channels the menu shows as picked. */
  public addDefaultChannels(...channels: (SelectMenuDefaultValueResolvable | readonly SelectMenuDefaultValueResolvable[])[]): this {
    return this.addDefaults(SelectMenuDefaultValueType.Channel, defaultIds(channels));
  }

  /** Replaces the channels the menu shows as picked. */
  public setDefaultChannels(...channels: (SelectMenuDefaultValueResolvable | readonly SelectMenuDefaultValueResolvable[])[]): this {
    (this.data as { defaultValues?: unknown[] }).defaultValues = [];
    return this.addDefaultChannels(...channels);
  }
}

/**
 * The old name of {@link StringSelectMenuBuilder}.
 *
 * @deprecated Use {@link StringSelectMenuBuilder}
 */
export const SelectMenuBuilder = StringSelectMenuBuilder;
/**
 * The old name of {@link StringSelectMenuOptionBuilder}.
 *
 * @deprecated Use {@link StringSelectMenuOptionBuilder}
 */
export const SelectMenuOptionBuilder = StringSelectMenuOptionBuilder;

/**
 * Builds a text input, for modals.
 *
 * @example
 * ```js
 * const input = new TextInputBuilder().setCustomId('nickname').setLabel('Name for the scoreboard').setStyle(TextInputStyle.Short);
 * ```
 */
export class TextInputBuilder extends ComponentBuilder {
  /**
   * Makes a builder from an existing component (for example `interaction.component`) or its JSON.
   *
   * @param other - The component to copy
   */
  public static from(other: JSONEncodable<unknown> | Record<string, unknown>): TextInputBuilder {
    return new TextInputBuilder(plain(other));
  }

  public constructor(data?: Record<string, unknown>) {
    super({ ...fromInput(data), type: ComponentType.TextInput });
  }

  /** Sets the custom id the bot reads the value by. */
  public setCustomId(customId: string): this {
    return setField(this, 'customId', customId);
  }

  /** Sets the label above the input (up to 45 characters). */
  public setLabel(label: string): this {
    return setField(this, 'label', label);
  }

  /** Sets the style: one line or a paragraph. */
  public setStyle(style: TextInputStyle): this {
    return setField(this, 'style', style);
  }

  /** Sets the shortest allowed text. */
  public setMinLength(minLength: number): this {
    return setField(this, 'minLength', minLength);
  }

  /** Sets the longest allowed text. */
  public setMaxLength(maxLength: number): this {
    return setField(this, 'maxLength', maxLength);
  }

  /** Sets the text shown when the input is empty. */
  public setPlaceholder(placeholder: string): this {
    return setField(this, 'placeholder', placeholder);
  }

  /** Sets the text the input starts with. */
  public setValue(value: string): this {
    return setField(this, 'value', value);
  }

  /** Sets whether the input must be filled in. */
  public setRequired(required = true): this {
    return setField(this, 'required', required);
  }

  public toJSON(): RawComponentData {
    checkCustomId(this.data.customId, ErrorCodes.TextInputCustomId);
    if (typeof this.data.label !== 'string' || this.data.label.length < 1 || this.data.label.length > 45) {
      throw new BisimjsRangeError(ErrorCodes.TextInputLabel);
    }
    return toBisimComponent({ style: TextInputStyle.Short, ...this.data, type: ComponentType.TextInput });
  }
}

/**
 * A component that can sit in an action row.
 */
export type AnyComponentBuilder = ButtonBuilder | BaseSelectMenuBuilder | TextInputBuilder;

/**
 * Builds an action row: up to five buttons, or one select menu (or, in a modal, one text input).
 *
 * @example
 * ```js
 * const row = new ActionRowBuilder().addComponents(cancel, confirm);
 * await interaction.reply({ content: 'Are you sure?', components: [row] });
 * ```
 */
export class ActionRowBuilder<Component extends AnyComponentBuilder | JSONEncodable<RawComponentData> = AnyComponentBuilder> extends ComponentBuilder {
  /** The components in the row. */
  public readonly components: Component[];

  /**
   * @param data - Row data to start from, optionally with components
   */
  public constructor(data: { components?: (Component | Record<string, unknown>)[] } & Record<string, unknown> = {}) {
    const { components, ...rest } = data;
    super({ ...fromInput(rest), type: ComponentType.ActionRow });
    this.components = (components ?? []).map((component) => createComponentBuilder(component) as Component);
  }

  /** Adds components to the row. */
  public addComponents(...components: (Component | Component[])[]): this {
    this.components.push(...(components.flat() as Component[]));
    return this;
  }

  /** Replaces the components of the row. */
  public setComponents(...components: (Component | Component[])[]): this {
    this.components.splice(0, this.components.length, ...(components.flat() as Component[]));
    return this;
  }

  public toJSON(): RawComponentData {
    return { type: ComponentType.ActionRow, components: this.components.map((component) => component.toJSON()) };
  }

  /**
   * Makes a builder from an existing row or its JSON.
   *
   * @param other - The row to copy
   */
  public static from<Component extends AnyComponentBuilder = AnyComponentBuilder>(
    other: JSONEncodable<RawComponentData> | Record<string, unknown>,
  ): ActionRowBuilder<Component> {
    const data = typeof (other as JSONEncodable<RawComponentData>).toJSON === 'function' ? (other as JSONEncodable<RawComponentData>).toJSON() : other;
    return new ActionRowBuilder<Component>(data as never);
  }
}

/**
 * Makes the right builder for component JSON.
 *
 * @param data - The component, as JSON or a builder
 */
export function createComponentBuilder(data: unknown): AnyComponentBuilder | ActionRowBuilder | JSONEncodable<RawComponentData> {
  if (data instanceof ComponentBuilder) return data as AnyComponentBuilder;
  if (data && typeof data === 'object' && typeof (data as JSONEncodable<unknown>).toJSON === 'function' && !('type' in data)) {
    return data as JSONEncodable<RawComponentData>;
  }
  const json = (data && typeof (data as JSONEncodable<unknown>).toJSON === 'function' ? (data as JSONEncodable<RawComponentData>).toJSON() : data) as Record<string, unknown>;
  const Builder = builderClasses()[json.type as ComponentType];
  return Builder ? new Builder(json as never) : { toJSON: () => toBisimComponent(json) };
}

type BuilderClass = new (data: never) => AnyComponentBuilder | ActionRowBuilder;
let builderTable: Partial<Record<ComponentType, BuilderClass>> | undefined;

/** The builder class for each component type, made on first use. */
function builderClasses(): Partial<Record<ComponentType, BuilderClass>> {
  builderTable ??= {
    [ComponentType.ActionRow]: ActionRowBuilder,
    [ComponentType.Button]: ButtonBuilder,
    [ComponentType.TextInput]: TextInputBuilder,
    [ComponentType.StringSelect]: StringSelectMenuBuilder,
    [ComponentType.UserSelect]: UserSelectMenuBuilder,
    [ComponentType.RoleSelect]: RoleSelectMenuBuilder,
    [ComponentType.MentionableSelect]: MentionableSelectMenuBuilder,
    [ComponentType.ChannelSelect]: ChannelSelectMenuBuilder,
  };
  return builderTable;
}

/**
 * Builds a modal (a form that pops up), the discord.js way. Show it with `interaction.showModal(modal)`.
 *
 * @example
 * ```js
 * const modal = new ModalBuilder().setCustomId('signup').setTitle('Tournament sign up');
 * modal.addComponents(new ActionRowBuilder().addComponents(nicknameInput));
 * await interaction.showModal(modal);
 * ```
 */
export class ModalBuilder implements JSONEncodable<{ customId: string; title: string; components: RawComponentData[] }> {
  /** The modal data. */
  public readonly data: { customId?: string; title?: string };
  /** The rows of the modal. */
  public readonly components: ActionRowBuilder<TextInputBuilder>[];

  /**
   * @param data - Modal data to start from
   */
  public constructor(data: { customId?: string; custom_id?: string; title?: string; components?: unknown[] } = {}) {
    this.data = { customId: data.customId ?? data.custom_id, title: data.title };
    this.components = (data.components ?? []).map((row) => createComponentBuilder(row) as ActionRowBuilder<TextInputBuilder>);
  }

  /** Sets the custom id the bot gets back on submit (up to 100 characters). */
  public setCustomId(customId: string): this {
    return setField(this, 'customId', customId);
  }

  /** Sets the title (up to 45 characters). */
  public setTitle(title: string): this {
    return setField(this, 'title', title);
  }

  /** Adds rows (each holding one text input). */
  public addComponents(...components: (ActionRowBuilder<TextInputBuilder> | ActionRowBuilder<TextInputBuilder>[])[]): this {
    this.components.push(...(components.flat() as ActionRowBuilder<TextInputBuilder>[]));
    return this;
  }

  /** Replaces the rows. */
  public setComponents(...components: (ActionRowBuilder<TextInputBuilder> | ActionRowBuilder<TextInputBuilder>[])[]): this {
    this.components.splice(0, this.components.length, ...(components.flat() as ActionRowBuilder<TextInputBuilder>[]));
    return this;
  }

  /** Not on Bisim yet: labelled components in modals. */
  public addLabelComponents(..._components: unknown[]): this {
    return notSupported('Label components in modals');
  }

  /** Not on Bisim yet: text displays in modals. */
  public addTextDisplayComponents(..._components: unknown[]): this {
    return notSupported('Text displays in modals');
  }

  /**
   * Makes a builder from an existing modal or its JSON.
   *
   * @param other - The modal to copy
   */
  public static from(other: JSONEncodable<Record<string, unknown>> | Record<string, unknown>): ModalBuilder {
    const data = typeof (other as JSONEncodable<unknown>).toJSON === 'function' ? (other as JSONEncodable<Record<string, unknown>>).toJSON() : other;
    return new ModalBuilder(data as never);
  }

  public toJSON(): { customId: string; title: string; components: RawComponentData[] } {
    checkCustomId(this.data.customId, ErrorCodes.ModalCustomId);
    if (typeof this.data.title !== 'string' || this.data.title.length < 1 || this.data.title.length > 45) {
      throw new BisimjsRangeError(ErrorCodes.ModalTitle);
    }
    return {
      customId: this.data.customId!,
      title: this.data.title,
      components: this.components.map((row) => row.toJSON()),
    };
  }
}
