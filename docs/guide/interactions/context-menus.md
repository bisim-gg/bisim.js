# Context menu commands

Context menu commands appear when a member right clicks (or long presses) a user or a message and opens
**Apps**. They take no options: the target is the user or message they were used on.

## Building them

```js
const { ApplicationCommandType, ContextMenuCommandBuilder } = require('bisim.js');

const userInfo = new ContextMenuCommandBuilder().setName('User Information').setType(ApplicationCommandType.User);

const quote = new ContextMenuCommandBuilder().setName('Quote Message').setType(ApplicationCommandType.Message);
```

Unlike slash commands, the name may contain capital letters and spaces (1 to 32 characters). Register them
like any other command: put `userInfo.toJSON()` in the list you pass to the deploy script, or to
`client.application.commands.set()`.

`setDefaultMemberPermissions()`, `setContexts()` and `setNameLocalizations()` work here too.

## Handling them

```js
client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isUserContextMenuCommand()) {
    const user = interaction.targetUser;
    const member = interaction.targetMember;
    await interaction.reply({
      content: `${user.displayName} (@${user.username}) joined on ${member?.joinedAt?.toDateString() ?? 'unknown'}.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (interaction.isMessageContextMenuCommand()) {
    const message = interaction.targetMessage;
    await interaction.reply(`> ${message.content}\n${message.author}`);
  }
});
```

- `interaction.targetId` is the id of the user or message.
- `isContextMenuCommand()` is true for both kinds, `isUserContextMenuCommand()` and
  `isMessageContextMenuCommand()` for one each.
- Context menu interactions are answered with the same methods as slash commands: `reply`, `deferReply`,
  `editReply`, `followUp` and `showModal`.
