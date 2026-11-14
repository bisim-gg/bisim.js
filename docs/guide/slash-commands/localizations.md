# Localizations

Bisim shows commands in Persian and English. Give a command, its options and its choices a name and a
description in each language, and every member sees them in their own language.

```js
const { SlashCommandBuilder } = require('bisim.js');

const data = new SlashCommandBuilder()
  .setName('weather')
  .setNameLocalizations({ fa: 'هوا' })
  .setDescription('Shows the weather in a city')
  .setDescriptionLocalizations({ fa: 'وضعیت هوای یک شهر را نشان می‌دهد' })
  .addStringOption((option) =>
    option
      .setName('city')
      .setDescription('The city')
      .setNameLocalizations({ fa: 'شهر' })
      .setDescriptionLocalizations({ fa: 'نام شهر' })
      .addChoices(
        { name: 'Tehran', value: 'tehran', name_localizations: { fa: 'تهران' } },
        { name: 'Tabriz', value: 'tabriz', name_localizations: { fa: 'تبریز' } },
      ),
  );
```

## Languages

Bisim has two languages: `fa` and `en`.

- Use `fa` for Persian.
- `en`, `en-US` and `en-GB` all become `en`; if you give several, `en` or `en-US` wins.
- Other languages (`fr`, `de` and so on) are dropped, since Bisim does not show them.
- The name and description you set with `setName()` and `setDescription()` are the default for everyone
  else.

The `Locale` enum has `Locale.Persian` (`fa`) and `Locale.English` (`en`), plus Discord's locales so existing
code compiles.

## Answering in the member's language

`interaction.locale` is the language of the member who ran the command:

```js
async function execute(interaction) {
  const persian = interaction.locale.startsWith('fa');
  await interaction.reply(persian ? 'سلام!' : 'Hello!');
}
```

## Names in other scripts

Command and option names are sent with the Latin name you set; the translated names are what members see.
A context menu command's name may contain spaces and capital letters, and can be translated the same way.
