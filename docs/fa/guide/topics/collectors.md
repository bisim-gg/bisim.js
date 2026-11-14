# جمع‌کننده‌ها

جمع‌کننده‌ها (collectors) برای مدتی پیام‌ها، واکنش‌ها یا تعامل‌ها را جمع می‌کنند، بی‌آنکه به کنترل‌کنندهٔ سراسری
رویدادها نیاز باشد.

## پیام‌ها

```js
const collector = interaction.channel.createMessageCollector({
  filter: (message) => message.author.id === interaction.user.id,
  time: 15_000,
  max: 3,
});

collector.on('collect', (message) => console.log(`Collected ${message.content}`));
collector.on('end', (collected, reason) => console.log(`Collected ${collected.size} messages (${reason})`));
```

یا با یک promise منتظرشان بمانید:

```js
const collected = await channel
  .awaitMessages({ filter: (message) => message.content === 'yes', max: 1, time: 30_000, errors: ['time'] })
  .catch(() => null);
if (!collected) await channel.send('No one said yes.');
```

## واکنش‌ها

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

`createReactionCollector()` مثل جمع‌کنندهٔ پیام کار می‌کند و `maxEmojis` و `maxUsers` را هم به‌عنوان محدودیت دارد.

## دکمه‌ها و منوهای انتخاب

منتظر یک کلیک روی پیامی بمانید که همین الان فرستاده‌اید:

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

یا چند کلیک را جمع کنید:

```js
const { ComponentType } = require('bisim.js');

const collector = message.createMessageComponentCollector({ componentType: ComponentType.Button, time: 3_600_000 });
collector.on('collect', async (click) => {
  await click.reply({ content: `${click.user.displayName} pressed ${click.customId}.`, flags: MessageFlags.Ephemeral });
});
```

`channel.createMessageComponentCollector()` و `channel.awaitMessageComponent()` همین کار را برای کل یک کانال
انجام می‌دهند.

## فرم‌ها

```js
await interaction.showModal(modal);
const submitted = await interaction.awaitModalSubmit({ time: 60_000 }).catch(() => null);
```

`awaitModalSubmit` فقط ارسال‌های همان کاربر را می‌گیرد و گزینهٔ `time` را لازم دارد.

## گزینه‌هایی که همهٔ جمع‌کننده‌ها می‌گیرند

| گزینه | معنا |
| --- | --- |
| `filter` | کدام موردها حساب شوند |
| `time` | پس از این چند میلی‌ثانیه متوقف شود |
| `idle` | اگر این چند میلی‌ثانیه مورد تازه‌ای نیامد متوقف شود |
| `max` | پس از این تعداد مورد متوقف شود |
| `dispose` | موردهای حذف‌شده یا برداشته‌شده را هم دنبال کند |

`collector.stop()` جمع‌کننده را زودتر تمام می‌کند و `collector.endReason` می‌گوید چرا تمام شد.
