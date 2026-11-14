# Autocomplete

Autocomplete lets your bot suggest values while a member types in an option. It works on string, integer
and number options that have no fixed choices.

## Turn it on

```js
const { SlashCommandBuilder } = require('bisim.js');

const data = new SlashCommandBuilder()
  .setName('docs')
  .setDescription('Links a page of the bisim.js guide')
  .addStringOption((option) =>
    option.setName('page').setDescription('The page to link').setAutocomplete(true).setRequired(true),
  );
```

## Answer the suggestions

Each keystroke sends an autocomplete interaction. Answer it with `respond()` and up to 25 choices:

```js
const pages = ['Installing', 'Your first bot', 'Slash commands', 'Buttons', 'Select menus', 'Modals', 'Embeds'];

module.exports = {
  data,
  autocomplete: async (interaction) => {
    const typed = interaction.options.getFocused().toLowerCase();
    const matches = pages.filter((page) => page.toLowerCase().includes(typed)).slice(0, 25);
    await interaction.respond(matches.map((page) => ({ name: page, value: page })));
  },
  execute: async (interaction) => {
    await interaction.reply(`Here you go: ${interaction.options.getString('page')}`);
  },
};
```

And route it in your handler:

```js
client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isAutocomplete()) {
    try {
      await client.commands.get(interaction.commandName)?.autocomplete?.(interaction);
    } catch (error) {
      console.error('Autocomplete failed:', error);
    }
    return;
  }
  // ... slash commands as before
});
```

## Several autocomplete options

`getFocused(true)` returns the whole option, so you know which one is being typed:

```js
const focused = interaction.options.getFocused(true);
if (focused.name === 'page') {
  // suggest pages
} else if (focused.name === 'section') {
  // suggest the sections of the chosen page
}
```

## Things to know

- An autocomplete interaction can only be answered with `respond()`; it cannot be deferred or replied to.
- Suggestions can have translated names: `{ name: 'Fast', nameLocalizations: { fa: 'سریع' }, value: 'fast' }`.
- Members can still type something you did not suggest, so check the value when the command runs.
