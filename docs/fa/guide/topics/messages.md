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
خواندن `message.content` به اینتنت Message Content نیاز دارد (صفحهٔ [گیت‌وی و اینتنت‌ها](./gateway.md) را
ببینید)؛ بدون آن متن خالی است، مگر در پیام‌های خصوصی، پیام‌های خود ربات و پیام‌هایی که به آن اشاره می‌کنند.

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

همهٔ راه‌های فرستادن `files` می‌پذیرند: `channel.send()`، `message.reply()`، و در تعامل‌ها `reply()`،
`followUp()`، `editReply()` و `update()`، و در وب‌هوک‌ها `send()` و `editMessage()`. امبد با `attachment://name`
فایلی از همان پیام را نشان می‌دهد ([امبدها](./embeds.md) را ببینید).

در ویرایش پیام، مثل دیسکورد، `attachments` فهرست فایل‌هایی است که پیام نگه می‌دارد و `files` فایل تازه اضافه
می‌کند. اگر هیچ‌کدام را ندهید همهٔ فایل‌ها می‌مانند؛ اگر فقط `files` را بدهید، فایل‌های تازه جای فایل‌های قبلی را
می‌گیرند:

```js
await message.edit({ content: 'Updated report', files: ['./report-v2.pdf'] }); // replaces the files
await message.edit({ files: ['./extra.png'], attachments: [...message.attachments.values()] }); // adds one
await message.removeAttachments(); // keeps the text, drops every file
```

## چه کسی صدا زده می‌شود

`allowedMentions`، مثل دیسکورد، تعیین می‌کند کدام اشاره‌های متن کسی را صدا بزنند. اگر آن را ندهید، همهٔ اشاره‌ها
صدا می‌زنند؛ اگر بدهید، فقط آنچه نام برده صدا می‌زند و اشاره‌ای که اجازه ندارد به شکل متن ساده در پیام می‌ماند:

```js
await channel.send({ content: `${user} wins! @everyone`, allowedMentions: { users: [user.id] } });
await channel.send({ content: 'No pings at all, @everyone', allowedMentions: { parse: [] } });

// A default for every message the bot sends:
const client = new Client({ intents, allowedMentions: { parse: ['users'] } });
```

`parse` مقدارهای `users`، `roles` و `everyone` (که `@here` را هم در بر می‌گیرد) را می‌پذیرد. در بی‌سیم پاسخ
دادن به پیام کسی را صدا نمی‌زند، پس `repliedUser` اثری ندارد.

## پیام بی‌صدا و پنهان کردن امبدها

```js
const { MessageFlags } = require('bisim.js');

await channel.send({ content: 'Nightly backup done', flags: MessageFlags.SuppressNotifications }); // no notification
await channel.send({ content: 'https://example.com', flags: MessageFlags.SuppressEmbeds }); // no link preview
await message.suppressEmbeds(true); // hide a message's embeds later (only the bot's own messages)
```

پاسخ تعامل‌ها و وب‌هوک‌ها هم همین پرچم‌ها را می‌پذیرند. `message.flags` آن‌ها را برمی‌گرداند، و پیامی که
`SuppressEmbeds` دارد `embeds` ندارد.

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

اشاره‌ها نشانه‌هایی داخل متن‌اند؛ مثل `<@id>` برای کاربر، `<@&id>` برای نقش و `<#id>` برای کانال. بی‌سیم
اینکه پیام به چه کسانی و چه نقش‌هایی اشاره می‌کند را همراه آن می‌فرستد، پس `message.mentions` حتی وقتی ربات
نمی‌تواند متن را بخواند (اینتنت Message Content ندارد) درست است؛ کانال‌ها از متن خوانده می‌شوند:

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
await reaction.remove(); // every reaction of this emoji, needs Manage Messages
await message.reactions.removeAll();
```

برای شنیدن واکنش‌ها از `MessageReactionAdd` و `MessageReactionRemove` استفاده کنید، و برای پاک شدن همهٔ
واکنش‌های یک ایموجی از `MessageReactionRemoveEmoji`:

```js
client.on(Events.MessageReactionAdd, async (reaction, user) => {
  if (reaction.message.partial) await reaction.message.fetch();
  console.log(`${user.username} reacted with ${reaction.emoji.name}`);
});
```

برای دریافت واکنش روی پیام‌هایی که پیش از روشن شدن ربات فرستاده شده‌اند، `Partials.Message` و
`Partials.Reaction` را فعال کنید.

## وب‌هوک‌ها

وب‌هوک با نام و تصویر خودش پیام می‌فرستد. متن، امبد و فایل می‌پذیرد و می‌تواند پیام‌هایی را که فرستاده، فقط با
شناسه و توکن خودش، بگیرد، ویرایش کند و حذف کند:

```js
const webhook = await channel.createWebhook({ name: 'Reports', avatar: './reports.png' });
const sent = await webhook.send({ content: 'Daily report', files: ['./report.pdf'] });
await webhook.editMessage(sent, { content: 'Daily report (corrected)' });
await webhook.deleteMessage(sent);
await webhook.edit({ avatar: null }); // removes the picture

const { WebhookClient } = require('bisim.js');
const hook = new WebhookClient({ url: process.env.WEBHOOK_URL });
const message = await hook.fetchMessage('123456789012345678');
```

تصویر مال خود وب‌هوک است: `avatarURL` روی یک پیام پشتیبانی نمی‌شود و با یک هشدار نادیده گرفته می‌شود. پیام
وب‌هوک کامپوننت نمی‌پذیرد.

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
