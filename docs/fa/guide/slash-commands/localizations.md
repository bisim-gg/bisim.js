# ترجمه‌ها

بی‌سیم دستورها را به فارسی و انگلیسی نشان می‌دهد. برای دستور، گزینه‌ها و انتخاب‌هایش در هر زبان یک نام و یک
توضیح بگذارید تا هر عضو آن‌ها را به زبان خودش ببیند.

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

## زبان‌ها

بی‌سیم دو زبان دارد: `fa` و `en`.

- برای فارسی از `fa` استفاده کنید.
- `en`، `en-US` و `en-GB` همگی به `en` تبدیل می‌شوند؛ اگر چند تا بدهید، `en` یا `en-US` برنده است.
- زبان‌های دیگر (`fr`، `de` و غیره) کنار گذاشته می‌شوند، چون بی‌سیم آن‌ها را نشان نمی‌دهد.
- نام و توضیحی که با `setName()` و `setDescription()` می‌گذارید، برای بقیهٔ اعضا مقدار پیش‌فرض است.

نوع شمارشی `Locale` شامل `Locale.Persian` (`fa`) و `Locale.English` (`en`) است، به‌اضافهٔ زبان‌های دیسکورد تا
کدهای موجود بدون تغییر کامپایل شوند.

## پاسخ به زبان عضو

`interaction.locale` زبان عضوی است که دستور را اجرا کرده است:

```js
async function execute(interaction) {
  const persian = interaction.locale.startsWith('fa');
  await interaction.reply(persian ? 'سلام!' : 'Hello!');
}
```

## نام‌ها با خط دیگر

نام دستورها و گزینه‌ها همان نام لاتینی است که گذاشته‌اید و نام‌های ترجمه‌شده چیزی است که اعضا می‌بینند. نام
دستور منوی راست‌کلیک می‌تواند فاصله و حرف بزرگ داشته باشد و به همین شیوه ترجمه شود.
