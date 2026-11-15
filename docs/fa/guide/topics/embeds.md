# امبدها

امبد کارتی است که زیر پیام نشان داده می‌شود: عنوان، توضیح، فیلدها، رنگ، پانویس و تصویر.

## ساختن امبد

```js
const { EmbedBuilder } = require('bisim.js');

const rules = new EmbedBuilder()
  .setColor(0x3f5600)
  .setTitle('Server rules')
  .setURL('https://bisim.gg/')
  .setAuthor({ name: 'The moderators', url: 'https://bisim.gg', iconURL: 'https://example.com/mods.png' })
  .setDescription('Please read these before you post.')
  .setThumbnail('https://example.com/logo.png')
  .addFields(
    { name: 'Be kind', value: 'No insults and no harassment.' },
    { name: 'Stay on topic', value: 'Use the right channel.', inline: true },
    { name: 'No spam', value: 'Say it once.', inline: true },
  )
  .setImage('https://example.com/banner.png')
  .setTimestamp()
  .setFooter({ text: 'Questions? Ask a moderator.', iconURL: 'https://example.com/help.png' });

await channel.send({ embeds: [rules] });
```

شیء ساده هم کار می‌کند:

```js
await interaction.reply({
  embeds: [{ title: 'Server rules', description: 'Please read these before you post.', color: 0x3f5600 }],
});
```

## چه چیزهایی در بی‌سیم دیده می‌شود

| بخش | نمایش |
| --- | --- |
| عنوان و نشانی آن | بله |
| توضیح | بله |
| رنگ | بله |
| نام، نشانی و آیکون نویسنده | بله |
| فیلدها، در یک خط یا جدا | بله |
| متن و آیکون پانویس | بله |
| زمان | بله |
| تصویر کوچک، کنار متن | بله |
| تصویر بزرگ، زیر فیلدها | بله |

هر تصویر یک پیوند `http` یا `https` با حداکثر ۲۰۴۸ نویسه است و برنامهٔ هر خواننده آن را از همان نشانی بارگذاری
می‌کند، همان‌طور که در دیسکورد بود. `attachment://name.png` دیسکورد هنوز پشتیبانی نمی‌شود: bisim.js چنین تصویری را
از پیام کنار می‌گذارد و یک بار هشدار می‌دهد. برای نشان دادن فایلی که ساخته‌اید، آن را به‌صورت فایل بفرستید
(صفحهٔ [پیام‌ها و واکنش‌ها](./messages.md) را ببینید)، یا اول آن را جایی با پیوند عمومی بگذارید.

## رنگ‌ها

`setColor()` یک عدد، یک رشتهٔ هگز، یک آرایهٔ `[r, g, b]` یا نامی از `Colors` می‌گیرد:

```js
const { Colors } = require('bisim.js');

embed.setColor(Colors.Blurple);
embed.setColor('#2ecc71');
embed.setColor('Random');
```

## محدودیت‌ها

| بخش | حداکثر |
| --- | --- |
| عنوان | ۲۵۶ نویسه |
| توضیح | ۴۰۹۶ نویسه |
| فیلدها | ۲۵ |
| نام فیلد | ۲۵۶ نویسه |
| مقدار فیلد | ۱۰۲۴ نویسه |
| متن پانویس | ۲۰۴۸ نویسه |
| نام نویسنده | ۲۵۶ نویسه |

اگر از یکی از این محدودیت‌ها بگذرید، سازنده یک `BisimjsRangeError` می‌دهد. هر پیام حداکثر ۱۰ امبد دارد.

## ویرایش امبدی که دریافت کرده‌اید

```js
const received = message.embeds[0];
const edited = EmbedBuilder.from(received).setTitle('A new title');
await message.edit({ embeds: [edited] });
```

`message.embeds` پیش‌نمایش پیوندهایی را هم که بی‌سیم برای پیوندهای داخل پیام ساخته نگه می‌دارد؛ در آن‌ها
`image` و `provider` پر شده‌اند.
