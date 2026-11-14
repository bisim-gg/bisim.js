# دکمه‌ها

دکمه‌ها زیر پیام و داخل **ردیف‌ها** (action rows) قرار می‌گیرند. هر ردیف حداکثر پنج دکمه دارد و هر پیام
حداکثر پنج ردیف.

## ساختن دکمه

```js
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('bisim.js');

const going = new ButtonBuilder().setCustomId('rsvp-yes').setLabel('Going').setStyle(ButtonStyle.Success);
const notGoing = new ButtonBuilder().setCustomId('rsvp-no').setLabel('Not going').setStyle(ButtonStyle.Secondary);
const details = new ButtonBuilder().setLabel('Details').setURL('https://bisim.gg').setStyle(ButtonStyle.Link);

const row = new ActionRowBuilder().addComponents(going, notGoing, details);

await interaction.reply({ content: 'Game night is on Friday at 20:00. Are you in?', components: [row] });
```

| سبک | کاربرد |
| --- | --- |
| `ButtonStyle.Primary` | کار اصلی |
| `ButtonStyle.Secondary` | کار خنثی |
| `ButtonStyle.Success` | کار مثبت |
| `ButtonStyle.Danger` | کار برگشت‌ناپذیر |
| `ButtonStyle.Link` | یک نشانی را باز می‌کند؛ شناسهٔ سفارشی ندارد و تعاملی نمی‌فرستد |

هر دکمه یک برچسب یا یک ایموجی لازم دارد (`setEmoji('👍')` یا `setEmoji('<:name:id>')`) و همهٔ دکمه‌ها به‌جز
دکمهٔ پیوند یک شناسهٔ سفارشی تا ۱۰۰ نویسه می‌خواهند. `setDisabled(true)` دکمه را غیرفعال و کم‌رنگ می‌کند.

دکمه‌ها در `channel.send()`، `message.edit()`، `interaction.reply()` و هر جای دیگری که `components` می‌گیرد
کار می‌کنند. فقط ربات‌ها می‌توانند اجزای تعاملی بفرستند.

## پاسخ به کلیک

هر کلیک به‌صورت یک تعامل می‌رسد. `isButton()` را بررسی کنید و به `customId` نگاه کنید:

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

- `update()` پیامی را که دکمه رویش است به‌عنوان پاسخ ویرایش می‌کند.
- `deferUpdate()` کلیک را تأیید می‌کند بی‌آنکه فعلاً چیزی را تغییر دهد؛ بعداً با `editReply()` ویرایش کنید.
- `reply()` به جای آن پیام تازه‌ای می‌فرستد؛ مثلاً یک پیام پنهان.

`interaction.message` همان پیام است، `interaction.component` دکمه‌ای که فشرده شد و `interaction.user` کسی که
آن را فشرد.

## گذاشتن داده در شناسهٔ سفارشی

روشی رایج این است که موضوع دکمه را در شناسه‌اش نگه دارید:

```js
new ButtonBuilder().setCustomId(`kick:${member.id}`).setLabel('Kick').setStyle(ButtonStyle.Danger);

// later, when it is pressed
if (interaction.customId.startsWith('kick:')) {
  const [, memberId] = interaction.customId.split(':');
}
```

## غیرفعال کردن دکمه پس از کلیک

```js
const { ActionRowBuilder, ButtonBuilder } = require('bisim.js');

const disabled = ButtonBuilder.from(interaction.component).setDisabled(true);
await interaction.update({ components: [new ActionRowBuilder().addComponents(disabled)] });
```

برای منتظر ماندن برای کلیک داخل همان دستوری که دکمه‌ها را فرستاده است، صفحهٔ [جمع‌کننده‌ها](../topics/collectors.md)
را ببینید.
