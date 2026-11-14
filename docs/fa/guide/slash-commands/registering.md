# ثبت دستورها

بی‌سیم باید دستورهای شما را بشناسد تا اعضا آن‌ها را ببینند. دستورها را یک بار ثبت می‌کنید و هر بار که نام،
توضیح یا گزینه‌ای را تغییر دادید دوباره. لازم نیست هر بار که ربات روشن می‌شود این کار را تکرار کنید.

## اسکریپت ثبت دستورها

این اسکریپت را با نام `deploy-commands.js` کنار `index.js` ذخیره کنید. همهٔ فایل‌های دستور را پیدا
می‌کند و همه را با یک درخواست ثبت می‌کند:

```js
const fs = require('node:fs');
const path = require('node:path');
const { REST, Routes } = require('bisim.js');

const token = process.env.BISIM_TOKEN;
const clientId = process.env.BISIM_CLIENT_ID; // the application id
const guildId = process.env.BISIM_GUILD_ID; // a server to test in

// The same walk over commands/ as in index.js.
function commandFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return commandFiles(full);
    return entry.name.endsWith('.js') ? [full] : [];
  });
}

const body = commandFiles(path.join(__dirname, 'commands')).map((file) => require(file).data.toJSON());

new REST()
  .setToken(token)
  .put(Routes.applicationGuildCommands(clientId, guildId), { body })
  .then((saved) => console.log(`Registered ${saved.length} commands in the test server.`))
  .catch((error) => console.error('Could not register the commands:', error));
```

با `node deploy-commands.js` اجرایش کنید. درخواست `PUT` کل مجموعه را جایگزین می‌کند: هر دستوری که در فهرست
نباشد حذف می‌شود.

## دستورهای سرور و دستورهای سراسری

- `Routes.applicationGuildCommands(clientId, guildId)` دستورها را فقط در یک سرور ثبت می‌کند. هنگام توسعه از
  همین استفاده کنید.
- `Routes.applicationCommands(clientId)` دستورهای سراسری را ثبت می‌کند که در همهٔ سرورهای ربات در دسترس‌اند.

اگر دستور سرور با یک دستور سراسری هم‌نام باشد، در آن سرور جای آن را می‌گیرد.

## بدون REST

همین کار را از داخل ربات در حال اجرا و با `client.application.commands` هم می‌توان انجام داد:

```js
client.once(Events.ClientReady, async (readyClient) => {
  const commands = [pingCommand.data, serverCommand.data];
  await readyClient.application.commands.set(commands); // global
  await readyClient.application.commands.set(commands, guildId); // one server
});
```

با همین ابزار می‌توانید تک‌تک دستورها را بسازید، ویرایش یا حذف کنید:

```js
const created = await client.application.commands.create(data, guildId);
await client.application.commands.edit(created, { description: 'A better description' }, guildId);
await client.application.commands.delete(created, guildId);
const all = await client.application.commands.fetch();
```

`guild.commands` همین کارها را برای یک سرور انجام می‌دهد، بی‌آنکه `guildId` را بفرستید.

## حذف همهٔ دستورها

یک فهرست خالی ثبت کنید:

```js
await new REST().setToken(token).put(Routes.applicationCommands(clientId), { body: [] });
```

## بی‌سیمِ محلی

`new REST({ api: 'http://localhost:3000/api' })` اسکریپت را به بی‌سیمی وصل می‌کند که روی دستگاه خودتان اجرا
می‌شود.
