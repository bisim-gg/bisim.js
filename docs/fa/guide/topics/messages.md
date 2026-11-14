# پیام‌ها و واکنش‌ها

## فرستادن پیام

```js
const channel = client.channels.cache.get('1198765432109876543');
await channel.send('Hello!');
await channel.send({ content: 'With an embed', embeds: [embed] });
```

متن پیام حداکثر ۴۰۰۰ نویسه است. `channel.isSendable()` می‌گوید یک کانال پیام می‌پذیرد یا نه: کانال‌های متنی
سرور و پیام‌های خصوصی می‌پذیرند؛ کانال‌های صوتی و دسته‌ها نه.

## پاسخ، ویرایش و حذف

```js
client.on(Events.MessageCreate, async (message) => {
  if (message.content !== '!hello') return;
  const reply = await message.reply(`Hello, ${message.author.displayName}!`);
  await reply.edit('Hello again!');
  setTimeout(() => reply.delete(), 10_000);
});
```

ربات فقط پیام‌های خودش را می‌تواند ویرایش کند. حذف پیام دیگران دسترسی مدیریت پیام‌ها (Manage Messages) می‌خواهد.

## فایل‌ها

فایل‌ها همراه پیام بارگذاری می‌شوند. bisim.js از بی‌سیم یک نشانی بارگذاری می‌گیرد، فایل را بارگذاری می‌کند و
سپس پیام را می‌فرستد:

```js
const { AttachmentBuilder } = require('bisim.js');

await channel.send({
  content: 'Here is the report.',
  files: [
    new AttachmentBuilder('./report.pdf'),
    new AttachmentBuilder(Buffer.from('hello'), { name: 'hello.txt', description: 'A greeting' }),
    { attachment: 'https://example.com/cat.png', name: 'cat.png' },
  ],
});
```

فایل می‌تواند یک مسیر، یک نشانی، یک Buffer یا یک stream باشد. بی‌سیم در هر پیام حداکثر ۱۰ فایل و هر کدام به‌طور
پیش‌فرض تا ۱۰ مگابایت می‌پذیرد. `setSpoiler(true)` فایل را تا زمان کلیک تار نشان می‌دهد.

فایل را با `channel.send()` و `message.reply()` می‌توان فرستاد. پاسخ تعامل‌ها و وب‌هوک‌ها هنوز فایل نمی‌پذیرند و
فرستادن فایل در آن‌ها یک `BisimjsError` می‌دهد.

## گرفتن پیام‌ها

```js
const message = await channel.messages.fetch('1198765432109876543');
const latest = await channel.messages.fetch({ limit: 10 }); // newest first
const older = await channel.messages.fetch({ before: latest.lastKey(), limit: 50 });
const pinned = await channel.messages.fetchPinned();
```

## حذف چند پیام با هم

```js
const deleted = await channel.bulkDelete(20, true); // the last 20, skipping ones older than two weeks
```

## اشاره‌ها (منشن)

اشاره‌ها نشانه‌هایی داخل متن‌اند؛ مثل `<@id>` برای کاربر، `<@&id>` برای نقش و `<#id>` برای کانال. bisim.js
آن‌ها را در `message.mentions` می‌خواند:

```js
const user = message.mentions.users.first();
if (message.mentions.has(client.user)) await message.reply('You called?');
```

قالب‌سازها آن‌ها را برایتان می‌سازند: `userMention(id)`، `roleMention(id)`، `channelMention(id)`، و همچنین
`bold()`، `italic()`، `codeBlock()`، `time()` و بقیه.

## واکنش‌ها

```js
const reaction = await message.react('👍');
await message.react('<:wave:123456789012345678>'); // a server's custom emoji

const users = await reaction.users.fetch();
await reaction.users.remove(someUserId); // someone else's needs Manage Messages
await message.reactions.removeAll();
```

برای شنیدن واکنش‌ها از `MessageReactionAdd` و `MessageReactionRemove` استفاده کنید:

```js
client.on(Events.MessageReactionAdd, async (reaction, user) => {
  if (reaction.message.partial) await reaction.message.fetch();
  console.log(`${user.username} reacted with ${reaction.emoji.name}`);
});
```

برای دریافت واکنش روی پیام‌هایی که پیش از روشن شدن ربات فرستاده شده‌اند، `Partials.Message` و
`Partials.Reaction` را فعال کنید.

## سنجاق و نظرسنجی

```js
await message.pin();
await message.unpin();

await channel.send({
  poll: {
    question: { text: 'Lunch?' },
    answers: [{ text: 'Pizza', emoji: '🍕' }, { text: 'Salad' }],
    duration: 24,
    allowMultiselect: false,
  },
});
```
