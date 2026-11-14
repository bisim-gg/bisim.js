# نشانی دستورها

تعامل‌ها به‌طور پیش‌فرض از راه گیت‌وی به ربات می‌رسند؛ همان WebSocket که پیام‌ها و رویدادهای دیگر را می‌آورد.
به جای آن می‌توانید برای برنامه‌تان یک **نشانی دستورها** (Interactions URL) تعیین کنید: در این حالت بی‌سیم هر
تعامل را با یک درخواست HTTP امضاشده به آن نشانی می‌فرستد و چیزی از راه گیت‌وی نمی‌فرستد.

این روش برای رباتی مناسب است که به‌صورت یک سرویس وب به دستورها پاسخ می‌دهد و لازم نیست همیشه وصل بماند.

## راه‌اندازی

1. در بی‌سیم به **تنظیمات**، **برنامه‌ها** و برنامهٔ خودتان بروید و در **نشانی دستورها** یک نشانی عمومی `https`
   بنویسید.
2. بی‌سیم هنگام ذخیره، نشانی را آزمایش می‌کند: یک **PING** می‌فرستد که باید با `{ "type": 1 }` پاسخ بگیرد، و یک
   درخواست با امضای عمداً نادرست که باید با کد وضعیت ۴۰۱ رد شود.
3. **کلید عمومی** را از همان صفحه کپی کنید. برای بررسی امضاها به آن نیاز دارید.

## بررسی امضا

هر درخواست یک امضای Ed25519 روی زمان (timestamp) و پس از آن بدنهٔ خام درخواست دارد که در سرآیندهای
`X-Signature-Ed25519` و `X-Signature-Timestamp` می‌آید. این دقیقاً همان روش دیسکورد است. `verifyKey` آن را بررسی
می‌کند:

```js
const { verifyKey } = require('bisim.js');

const valid = await verifyKey(rawBody, signature, timestamp, process.env.BISIM_PUBLIC_KEY);
```

همیشه از بدنهٔ درخواست **دقیقاً همان‌طور که رسیده** استفاده کنید، پیش از آنکه آن را تجزیه کنید.

## یک سرور کامل

`client.handleInteraction()` بدنهٔ درخواست را می‌گیرد و درست مثل گیت‌وی رویداد `interactionCreate` را منتشر
می‌کند، پس بقیهٔ ربات بدون تغییر می‌ماند. برای PING مقدار `{ type: 1 }` را برمی‌گرداند:

```js
const { createServer } = require('node:http');
const { Client, Events, verifyKey } = require('bisim.js');

const client = new Client({ intents: [] });
client.rest.setToken(process.env.BISIM_TOKEN);

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isChatInputCommand() && interaction.commandName === 'ping') {
    await interaction.reply('Pong, over HTTP.');
  }
});

createServer((req, res) => {
  let body = '';
  req.on('data', (chunk) => (body += chunk));
  req.on('end', async () => {
    const valid = await verifyKey(
      body,
      req.headers['x-signature-ed25519'],
      req.headers['x-signature-timestamp'],
      process.env.BISIM_PUBLIC_KEY,
    );
    if (!valid) {
      res.writeHead(401).end('invalid request signature');
      return;
    }
    const answer = client.handleInteraction(body);
    res.writeHead(200, { 'content-type': 'application/json' }).end(answer ? JSON.stringify(answer) : '{}');
  });
}).listen(8787);
```

بی‌سیم حداکثر سه ثانیه منتظر پاسخ HTTP می‌ماند. مثل نمونهٔ بالا اول به درخواست پاسخ دهید و بگذارید متدهای
تعامل (`reply`، `deferReply` و بقیه) پاسخ اصلی را از راه API بی‌سیم بفرستند.

::: tip ورود اختیاری است
رباتی که فقط به تعامل‌ها پاسخ می‌دهد به `client.login()` نیازی ندارد. همان‌طور که در نمونه آمده، گذاشتن توکن روی
`client.rest` برای ثبت دستورها و پاسخ دادن به آن‌ها کافی است. اگر رویدادها، حافظهٔ موقت و بقیهٔ امکانات گیت‌وی
را هم می‌خواهید، `login()` را صدا بزنید.
:::

## بازگشت به گیت‌وی

نشانی دستورها را در تنظیمات برنامه خالی کنید. از آن پس تعامل‌ها دوباره از راه گیت‌وی و به‌صورت
`interactionCreate` می‌رسند.
