import type { RawComponentData } from '../types/raw.js';
import { ButtonStyle, ChannelType, ComponentType, TextInputStyle } from '../util/Enums.js';
import { channelTypeFromBisim } from '../util/Transformers.js';

/**
 * A component on a message, as Bisim sent it (read only; build one with the builders). `data` is Bisim's
 * camelCase JSON.
 */
export class Component<Data extends RawComponentData = RawComponentData> {
  /** The component data. */
  public readonly data: Readonly<Data>;

  /**
   * @param data - The component from Bisim
   */
  public constructor(data: Data) {
    this.data = data;
  }

  /** The type of the component. */
  public get type(): ComponentType {
    return this.data.type;
  }

  /** Always `null` on Bisim. */
  public get id(): number | null {
    return null;
  }

  /**
   * Whether this component is the same as another.
   *
   * @param other - The other component
   */
  public equals(other: Component | RawComponentData): boolean {
    const data = other instanceof Component ? other.data : other;
    return JSON.stringify(this.data) === JSON.stringify(data);
  }

  /**
   * The component as JSON.
   */
  public toJSON(): RawComponentData {
    return { ...this.data };
  }
}

/**
 * A button.
 */
export class ButtonComponent extends Component {
  /** The style. */
  public get style(): ButtonStyle {
    return this.data.style as ButtonStyle;
  }

  /** The label. */
  public get label(): string | null {
    return valueOrNull(this.data.label);
  }

  /** The emoji. */
  public get emoji(): { id?: string | null; name?: string | null; animated?: boolean } | null {
    return valueOrNull(this.data.emoji);
  }

  /** Whether the button is disabled. */
  public get disabled(): boolean {
    return Boolean(this.data.disabled);
  }

  /** The custom id. */
  public get customId(): string | null {
    return valueOrNull(this.data.customId);
  }

  /** The address of a link button. */
  public get url(): string | null {
    return valueOrNull(this.data.url);
  }

  /** Always `null` on Bisim. */
  public get skuId(): string | null {
    return null;
  }
}

/**
 * The parts every select menu has.
 */
export class BaseSelectMenuComponent extends Component {
  /** The placeholder. */
  public get placeholder(): string | null {
    return valueOrNull(this.data.placeholder);
  }

  /** The most items that can be selected. */
  public get maxValues(): number | null {
    return valueOrNull(this.data.maxValues);
  }

  /** The fewest items that must be selected. */
  public get minValues(): number | null {
    return this.data.minValues ?? null;
  }

  /** The custom id. */
  public get customId(): string {
    return this.data.customId ?? '';
  }

  /** Whether the menu is disabled. */
  public get disabled(): boolean {
    return Boolean(this.data.disabled);
  }
}

/**
 * A select menu of the bot's own options.
 */
export class StringSelectMenuComponent extends BaseSelectMenuComponent {
  /** The options. */
  public get options(): NonNullable<RawComponentData['options']> {
    return this.data.options ?? [];
  }
}

/**
 * The old name of {@link StringSelectMenuComponent}.
 *
 * @deprecated Use {@link StringSelectMenuComponent}
 */
export const SelectMenuComponent = StringSelectMenuComponent;

/** A select menu of members. */
export class UserSelectMenuComponent extends BaseSelectMenuComponent {
  /** The members the menu shows as picked. */
  public get defaultValues(): NonNullable<RawComponentData['defaultValues']> {
    return this.data.defaultValues ?? [];
  }
}
/** A select menu of roles. */
export class RoleSelectMenuComponent extends BaseSelectMenuComponent {
  /** The roles the menu shows as picked. */
  public get defaultValues(): NonNullable<RawComponentData['defaultValues']> {
    return this.data.defaultValues ?? [];
  }
}
/** A select menu of users and roles. */
export class MentionableSelectMenuComponent extends BaseSelectMenuComponent {
  /** The users and roles the menu shows as picked. */
  public get defaultValues(): NonNullable<RawComponentData['defaultValues']> {
    return this.data.defaultValues ?? [];
  }
}

/** A select menu of channels. */
export class ChannelSelectMenuComponent extends BaseSelectMenuComponent {
  /** The channels the menu shows as picked. */
  public get defaultValues(): NonNullable<RawComponentData['defaultValues']> {
    return this.data.defaultValues ?? [];
  }

  /** The channel types the menu shows. */
  public get channelTypes(): ChannelType[] | null {
    return this.data.channelTypes?.map((type) => channelTypeFromBisim(type)) ?? null;
  }
}

/**
 * A text input, in a modal.
 */
export class TextInputComponent extends Component {
  /** The custom id. */
  public get customId(): string {
    return this.data.customId ?? '';
  }

  /** The value the user typed (in a modal submission). */
  public get value(): string {
    return this.data.value ?? '';
  }

  /** The style. */
  public get style(): TextInputStyle {
    return (this.data.style as TextInputStyle) ?? TextInputStyle.Short;
  }
}

/**
 * A row of components.
 */
export class ActionRow<Inner extends Component = Component> extends Component {
  /** The components in the row. */
  public readonly components: Inner[];

  /**
   * @param data - The row from Bisim
   */
  public constructor(data: RawComponentData) {
    const { components, ...rest } = data;
    super({ ...rest, type: ComponentType.ActionRow } as RawComponentData);
    this.components = (components ?? []).map((component) => createComponent(component) as Inner);
  }

  public override toJSON(): RawComponentData {
    return { ...this.data, components: this.components.map((component) => component.toJSON()) };
  }
}

/**
 * Makes the right component structure for Bisim's component JSON.
 *
 * @param data - The component
 */
export function createComponent(data: RawComponentData): Component {
  const Structure = componentClasses[data.type as ComponentType] ?? Component;
  return new Structure(data);
}

/** The structure class for each component type; anything else is a plain {@link Component}. */
const componentClasses: Partial<Record<ComponentType, new (data: RawComponentData) => Component>> = {
  [ComponentType.ActionRow]: ActionRow,
  [ComponentType.Button]: ButtonComponent,
  [ComponentType.TextInput]: TextInputComponent,
  [ComponentType.StringSelect]: StringSelectMenuComponent,
  [ComponentType.UserSelect]: UserSelectMenuComponent,
  [ComponentType.RoleSelect]: RoleSelectMenuComponent,
  [ComponentType.MentionableSelect]: MentionableSelectMenuComponent,
  [ComponentType.ChannelSelect]: ChannelSelectMenuComponent,
};

/** `null` in place of a missing value. */
function valueOrNull<Value>(value: Value | undefined): Value | null {
  return value === undefined ? null : value;
}
