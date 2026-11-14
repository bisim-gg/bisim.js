# Collectors

Collectors gather messages, reactions or interactions for a while, without a global event handler.

## Messages

```js
const collector = interaction.channel.createMessageCollector({
  filter: (message) => message.author.id === interaction.user.id,
  time: 15_000,
  max: 3,
});

collector.on('collect', (message) => console.log(`Collected ${message.content}`));
collector.on('end', (collected, reason) => console.log(`Collected ${collected.size} messages (${reason})`));
```

Or wait for them with a promise:

```js
const collected = await channel
  .awaitMessages({ filter: (message) => message.content === 'yes', max: 1, time: 30_000, errors: ['time'] })
  .catch(() => null);
if (!collected) await channel.send('No one said yes.');
```

## Reactions

```js
const message = await channel.send('React with 👍 or 👎');
await message.react('👍');
await message.react('👎');

const reactions = await message.awaitReactions({
  filter: (reaction, user) => ['👍', '👎'].includes(reaction.emoji.name) && !user.bot,
  max: 1,
  time: 60_000,
});
console.log(reactions.first()?.emoji.name);
```

`createReactionCollector()` works like the message collector, with `maxEmojis` and `maxUsers` as extra limits.

## Buttons and select menus

Wait for one click on the message you just sent:

```js
const response = await interaction.reply({ content: 'Delete the last 10 messages?', components: [row], withResponse: true });

try {
  const answer = await response.resource.message.awaitMessageComponent({
    filter: (click) => click.user.id === interaction.user.id,
    time: 60_000,
  });
  const confirmed = answer.customId === 'purge-yes';
  if (confirmed) await interaction.channel.bulkDelete(10);
  await answer.update({ content: confirmed ? 'Deleted.' : 'Kept them.', components: [] });
} catch {
  await interaction.editReply({ content: 'No answer within a minute, so nothing was deleted.', components: [] });
}
```

Or collect many:

```js
const { ComponentType } = require('bisim.js');

const collector = message.createMessageComponentCollector({ componentType: ComponentType.Button, time: 3_600_000 });
collector.on('collect', async (click) => {
  await click.reply({ content: `${click.user.displayName} pressed ${click.customId}.`, flags: MessageFlags.Ephemeral });
});
```

`channel.createMessageComponentCollector()` and `channel.awaitMessageComponent()` do the same for a whole
channel.

## Modals

```js
await interaction.showModal(modal);
const submitted = await interaction.awaitModalSubmit({ time: 60_000 }).catch(() => null);
```

`awaitModalSubmit` only receives submissions from the same user, and needs a `time`.

## Options every collector takes

| Option | Meaning |
| --- | --- |
| `filter` | which items count |
| `time` | stop after this many milliseconds |
| `idle` | stop after this many milliseconds without a new item |
| `max` | stop after this many items |
| `dispose` | also track items that are deleted or removed |

`collector.stop()` ends a collector early, and `collector.endReason` says why it ended.
