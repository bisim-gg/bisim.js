# Modals

A modal is a form that pops up over Bisim. It holds text inputs, and its submission comes back to your bot
as an interaction.

## Building a modal

```js
const { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('bisim.js');

const modal = new ModalBuilder().setCustomId('feedback').setTitle('Send feedback');

const subjectInput = new TextInputBuilder()
  .setCustomId('subject')
  .setLabel('Subject')
  .setStyle(TextInputStyle.Short)
  .setMaxLength(80);

const detailsInput = new TextInputBuilder()
  .setCustomId('details')
  .setLabel('Tell us more')
  .setStyle(TextInputStyle.Paragraph)
  .setRequired(false)
  .setMaxLength(1000);

modal.addComponents(new ActionRowBuilder().addComponents(subjectInput), new ActionRowBuilder().addComponents(detailsInput));
```

Each text input sits in its own row. A text input has a label (up to 45 characters), a style (one line or a
paragraph), and optionally a placeholder, a starting value and length limits.

## Showing it

A modal must be the **first** answer to a command, a context menu command, a button or a select menu:

```js
if (interaction.commandName === 'feedback') {
  await interaction.showModal(modal);
}
```

You cannot defer and then show a modal, and a modal submission cannot open another modal.

## Receiving the submission

Either wait for it right where you showed it:

```js
await interaction.showModal(modal);
const submitted = await interaction
  .awaitModalSubmit({ time: 120_000, filter: (i) => i.customId === 'feedback' && i.user.id === interaction.user.id })
  .catch(() => null);
if (submitted) {
  const subject = submitted.fields.getTextInputValue('subject');
  await submitted.reply({ content: `Thanks, we got your note about "${subject}".`, flags: MessageFlags.Ephemeral });
}
```

Or handle it in `interactionCreate` like any other interaction:

```js
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isModalSubmit() || interaction.customId !== 'feedback') return;
  const subject = interaction.fields.getTextInputValue('subject');
  const details = interaction.fields.getTextInputValue('details');
  await interaction.reply({ content: `Subject: ${subject}\nDetails: ${details || 'none'}`, flags: MessageFlags.Ephemeral });
});
```

A modal submission is answered with `reply`, `deferReply`, `editReply` and `followUp`. When the modal was
opened from a button or a select menu, `interaction.isFromMessage()` is true and `update()` edits that
message.
