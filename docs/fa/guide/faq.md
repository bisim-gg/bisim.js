# پرسش‌های رایج

## وضعیت ربات را چطور تنظیم کنم؟

```js
client.user.setPresence({ activities: [{ name: 'with bisim.js' }], status: 'idle' });
client.user.setActivity('the server', { type: ActivityType.Watching });
client.user.setStatus('dnd');
```

## چطور به یک کانال مشخص پیام بفرستم؟

```js
const channel = client.channels.cache.get('1198765432109876543');
await channel.send('Hello!');
```

## چطور پیام خصوصی بفرستم؟

```js
await user.send('Hello!');
await member.send('Hello!');
```

بی‌سیم به ربات اجازه می‌دهد به کسی پیام بدهد که با او در یک سرور مشترک است، به شرطی که تنظیمات حریم خصوصی او
اجازه بدهد.

## چطور به کسی اشاره کنم؟

کاربر، عضو، نقش یا کانال را در یک رشتهٔ قالبی بگذارید: `${user}` به `<@id>` تبدیل می‌شود. یا از قالب‌سازها
استفاده کنید: `userMention(id)`، `roleMention(id)`، `channelMention(id)`.

## تصویر پروفایل کسی را چطور بگیرم؟

```js
const url = user.displayAvatarURL({ size: 256 });
```

## چرا به اینتنت Message Content نیازی ندارم؟

بی‌سیم اینتنت ندارد. ربات محتوای همهٔ پیام‌ها را در کانال‌هایی که می‌تواند بخواند می‌بیند.

## ربات یک کانال را نمی‌بیند. چرا؟

ربات یک عضو معمولی است: هر چیزی را می‌بیند که نقش‌هایش اجازه بدهند. به نقش ربات در آن کانال دسترسی دیدن کانال
(View Channel) بدهید.

## دستورهایم دیده نمی‌شوند.

- اسکریپت ثبت دستورها را اجرا کنید و ببینید تعداد دستورها را چاپ کرده باشد.
- دستورهای سرور فوراً دیده می‌شوند؛ مطمئن شوید شناسهٔ سرور درست است.
- `setDefaultMemberPermissions()` دستور را از اعضایی که آن دسترسی‌ها را ندارند پنهان می‌کند.
- عضو در آن کانال دسترسی استفاده از دستورهای برنامه‌ها را لازم دارد.

## «برنامه پاسخ نداد»

ربات باید ظرف سه ثانیه به تعامل پاسخ دهد. اگر کار بیشتر طول می‌کشد، اول `deferReply()` را صدا بزنید و وقتی کار
تمام شد `editReply()` را.

## چطور بفهمم کدام امکانات نیست؟

صفحهٔ [آمدن از discord.js](./moving-from-discord-js.md) آن‌ها را فهرست کرده است. هر کدام یک `BisimjsError` با کد
`NotSupported` می‌دهد:

```js
const { BisimjsError, ErrorCodes } = require('bisim.js');

try {
  await message.startThread({ name: 'Discussion' });
} catch (error) {
  if (error instanceof BisimjsError && error.code === ErrorCodes.NotSupported) {
    await message.reply('Threads are not available here.');
  }
}
```

## خطاهای API را چطور مدیریت کنم؟

```js
const { BisimAPIError } = require('bisim.js');

try {
  await member.kick();
} catch (error) {
  if (error instanceof BisimAPIError && error.status === 403) {
    console.log(`Missing permissions: ${error.message} (${error.code})`);
  }
}
```

## می‌توانم ربات را روی بی‌سیمِ محلی اجرا کنم؟

بله. کلاینت را با `rest.api` و `ws.gateway` به آن وصل کنید:

```js
new Client({ intents: [], rest: { api: 'http://localhost:3000/api' }, ws: { gateway: 'ws://localhost:4000/ws' } });
```

## مرجع کامل API کجاست؟

در [مرجع API](/api/index.html){target="_self"} (به انگلیسی) که از توضیحات خود کتاب‌خانه ساخته شده است. API و
وب‌هوک‌های بی‌سیم در [docs.bisim.gg](https://docs.bisim.gg) توضیح داده شده‌اند.
