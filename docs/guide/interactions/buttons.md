# Buttons

Buttons sit under a message in **action rows**. A row holds up to five buttons, and a message up to five
rows.

## Building buttons

```js
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('bisim.js');

const going = new ButtonBuilder().setCustomId('rsvp-yes').setLabel('Going').setStyle(ButtonStyle.Success);
const notGoing = new ButtonBuilder().setCustomId('rsvp-no').setLabel('Not going').setStyle(ButtonStyle.Secondary);
const details = new ButtonBuilder().setLabel('Details').setURL('https://bisim.gg').setStyle(ButtonStyle.Link);

const row = new ActionRowBuilder().addComponents(going, notGoing, details);

await interaction.reply({ content: 'Game night is on Friday at 20:00. Are you in?', components: [row] });
```

| Style | Use |
| --- | --- |
| `ButtonStyle.Primary` | the main action |
| `ButtonStyle.Secondary` | a neutral action |
| `ButtonStyle.Success` | a positive action |
| `ButtonStyle.Danger` | a destructive action |
| `ButtonStyle.Link` | opens a URL; has no custom id and sends no interaction |

A button needs a label or an emoji (`setEmoji('👍')` or `setEmoji('<:name:id>')`), and every button except
a link button needs a custom id of up to 100 characters. `setDisabled(true)` greys it out.

Buttons work in `channel.send()`, `message.edit()`, `interaction.reply()` and every other place that takes
`components`. Only bots can send components.

## Answering a click

A click arrives as an interaction. Check `isButton()` and look at `customId`:

```js
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;

  if (interaction.customId === 'rsvp-yes') {
    await interaction.reply({ content: 'See you on Friday!', flags: MessageFlags.Ephemeral });
  } else if (interaction.customId === 'rsvp-no') {
    await interaction.reply({ content: 'Maybe next time.', flags: MessageFlags.Ephemeral });
  }
});
```

- `update()` edits the message the button is on, as the answer.
- `deferUpdate()` acknowledges the click without changing anything yet; edit later with `editReply()`.
- `reply()` sends a new message instead, for example an ephemeral one.

`interaction.message` is the message, `interaction.component` the button that was pressed, and
`interaction.user` who pressed it.

## Putting data in the custom id

A common pattern stores what the button is about in its id:

```js
new ButtonBuilder().setCustomId(`kick:${member.id}`).setLabel('Kick').setStyle(ButtonStyle.Danger);

// later, when it is pressed
if (interaction.customId.startsWith('kick:')) {
  const [, memberId] = interaction.customId.split(':');
}
```

## Disabling a button after a click

```js
const { ActionRowBuilder, ButtonBuilder } = require('bisim.js');

const disabled = ButtonBuilder.from(interaction.component).setDisabled(true);
await interaction.update({ components: [new ActionRowBuilder().addComponents(disabled)] });
```

To wait for a click inside the command that sent the buttons, see [Collectors](../topics/collectors.md).
