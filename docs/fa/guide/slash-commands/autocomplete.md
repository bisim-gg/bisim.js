# تکمیل خودکار

با تکمیل خودکار، ربات هم‌زمان با تایپ عضو در یک گزینه، مقدارهایی را پیشنهاد می‌دهد. این امکان روی گزینه‌های
متنی، عدد صحیح و عدد کار می‌کند، به شرطی که انتخاب‌های ثابت نداشته باشند.

## فعال کردن

```js
const { SlashCommandBuilder } = require('bisim.js');

const data = new SlashCommandBuilder()
  .setName('docs')
  .setDescription('Links a page of the bisim.js guide')
  .addStringOption((option) =>
    option.setName('page').setDescription('The page to link').setAutocomplete(true).setRequired(true),
  );
```

## پاسخ دادن به پیشنهادها

با هر بار فشردن کلید، یک تعامل تکمیل خودکار فرستاده می‌شود. با `respond()` و حداکثر ۲۵ انتخاب به آن پاسخ دهید:

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

و آن را در کنترل‌کننده به دستور برسانید:

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

## چند گزینهٔ تکمیل خودکار

`getFocused(true)` کل گزینه را برمی‌گرداند تا بدانید کدام گزینه در حال تایپ است:

```js
const focused = interaction.options.getFocused(true);
if (focused.name === 'page') {
  // suggest pages
} else if (focused.name === 'section') {
  // suggest the sections of the chosen page
}
```

## نکته‌ها

- به تعامل تکمیل خودکار فقط با `respond()` می‌توان پاسخ داد؛ اعلام انتظار یا پاسخ معمولی ممکن نیست.
- پیشنهادها می‌توانند نام ترجمه‌شده داشته باشند:
  `{ name: 'Fast', nameLocalizations: { fa: 'سریع' }, value: 'fast' }`.
- اعضا هنوز می‌توانند چیزی بنویسند که پیشنهاد نداده‌اید؛ پس هنگام اجرای دستور مقدار را بررسی کنید.
