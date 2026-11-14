import type { BaseInteraction } from '../interactions/BaseInteraction.js';
import { InteractionType } from '../util/Enums.js';
import type { InteractionCollectorOptions } from './Collectors.js';

/**
 * Settings for collecting button clicks and menu choices, narrowed to a message or a channel.
 *
 * @internal
 */
export function onComponents<Interaction extends BaseInteraction>(
  options: object,
  scope: Pick<InteractionCollectorOptions, 'message' | 'channel'>,
): InteractionCollectorOptions<Interaction> {
  return { ...options, ...scope, interactionType: InteractionType.MessageComponent };
}
