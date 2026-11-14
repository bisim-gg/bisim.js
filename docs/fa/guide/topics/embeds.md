# امبدها

امبد کارتی است که زیر پیام نشان داده می‌شود: عنوان، توضیح، فیلدها، رنگ و پانویس.

## ساختن امبد

```js
const { EmbedBuilder } = require('bisim.js');

const rules = new EmbedBuilder()
  .setColor(0x3f5600)
  .setTitle('Server rules')
  .setURL('https://bisim.gg/')
  .setAuthor({ name: 'The moderators', url: 'https://bisim.gg' })
  .setDescription('Please read these before you post.')
  .addFields(
    { name: 'Be kind', value: 'No insults and no harassment.' },
    { name: 'Stay on topic', value: 'Use the right channel.', inline: true },
    { name: 'No spam', value: 'Say it once.', inline: true },
  )
  .setTimestamp()
  .setFooter({ text: 'Questions? Ask a moderator.' });

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
| نام و نشانی نویسنده | بله |
| فیلدها، در یک خط یا جدا | بله |
| متن پانویس | بله |
| زمان | بله |
| تصویر و تصویر کوچک | روی سازنده می‌ماند، نمایش داده نمی‌شود |
| آیکون نویسنده و پانویس | روی سازنده می‌ماند، نمایش داده نمی‌شود |

`setImage()` و `setThumbnail()` مقدار را نگه می‌دارند تا کدی که از آن‌ها استفاده می‌کند همچنان اجرا شود، و
bisim.js یک بار هشدار می‌دهد که بی‌سیم آن‌ها را نشان نمی‌دهد. برای نشان دادن تصویر، آن را به‌صورت فایل بفرستید
(صفحهٔ [پیام‌ها و واکنش‌ها](./messages.md) را ببینید).

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
