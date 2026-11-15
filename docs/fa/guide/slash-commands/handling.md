# پاسخ به دستورها

وقتی عضوی دستوری را اجرا می‌کند، ربات یک رویداد `interactionCreate` دریافت می‌کند. این صفحه فایل‌های دستور را
بارگذاری می‌کند، هر تعامل را به دستور خودش می‌رساند و همهٔ راه‌های پاسخ دادن را نشان می‌دهد.

## بارگذاری دستورها

```js
const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, Events, GatewayIntentBits, MessageFlags } = require('bisim.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.commands = new Collection();

// Every .js file under commands/, one folder per category, exports { data, execute }.
function commandFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return commandFiles(full);
    return entry.name.endsWith('.js') ? [full] : [];
  });
}

for (const file of commandFiles(path.join(__dirname, 'commands'))) {
  const command = require(file);
  if (command.data && typeof command.execute === 'function') client.commands.set(command.data.name, command);
  else console.warn(`Skipped ${file}: it does not export data and execute.`);
}
```

## اجرای دستورها

```js
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return console.warn(`No handler for /${interaction.commandName}.`);

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`/${interaction.commandName} failed:`, error);
    const oops = { content: 'Something went wrong while running that command.', flags: MessageFlags.Ephemeral };
    await (interaction.replied || interaction.deferred ? interaction.followUp(oops) : interaction.reply(oops));
  }
});

client.login(process.env.BISIM_TOKEN);
```

## پاسخ دادن

هر تعامل باید **یک بار** پاسخ بگیرد، و پس از **۱۵ دقیقه** دیگر نمی‌توان کاری با آن کرد.

### پاسخ مستقیم

```js
await interaction.reply('Done!');
await interaction.reply({ content: 'Only you can see this.', flags: MessageFlags.Ephemeral });
await interaction.reply({ embeds: [embed], components: [row] });
```

`flags: MessageFlags.Ephemeral` (یا شکل قدیمی‌تر `ephemeral: true`) پاسخ را پنهان می‌کند تا فقط اجراکنندهٔ
دستور آن را ببیند. پیام‌های پنهان به اعضای دیگر نمی‌رسند و به‌صورت `messageCreate` هم به ربات نمی‌رسند.

### اعلام انتظار، سپس ویرایش

اگر کار کمی طول می‌کشد، اول اعلام انتظار کنید (defer). اعضا می‌بینند که ربات در حال فکر کردن است:

```js
await interaction.deferReply(); // or deferReply({ flags: MessageFlags.Ephemeral })
const result = await somethingSlow();
await interaction.editReply(`Done: ${result}`);
```

### پیام پیگیری

پس از پاسخ یا اعلام انتظار، می‌توانید پیام‌های بیشتری دربارهٔ همان تعامل بفرستید:

```js
await interaction.reply('Working on it...');
await interaction.followUp('One more thing.');
```

پس از `deferReply()`، نخستین `followUp()`، مثل دیسکورد، جای پیام «در حال فکر کردن» را می‌گیرد و همان حالت
دیده شدنش را نگه می‌دارد؛ followUpهای بعدی پیام تازه‌اند. پاسخ‌ها و followUpها، مثل `channel.send()`، فایل، امبد و
کامپوننت می‌پذیرند، و نظرسنجی را در یک پیام تازه: `reply({ poll })` یا `followUp({ poll })`، که هرگز ephemeral
نیست، تنها فرستاده می‌شود و نمی‌تواند همان followUp باشد که جای پیام «در حال فکر کردن» را می‌گیرد.

### گرفتن و حذف پاسخ

```js
const sent = await interaction.fetchReply(); // the answer as a Message
await interaction.deleteReply(); // removes it
```

`reply({ ..., fetchReply: true })` پاسخ را به‌صورت یک `Message` برمی‌گرداند و
`reply({ ..., withResponse: true })` یک `InteractionCallbackResponse`.

## وضعیت پاسخ

`interaction.replied` و `interaction.deferred` نشان می‌دهند چه کاری انجام شده است. پاسخ دادن دوباره یک
`BisimjsError` با کد `InteractionAlreadyReplied` می‌دهد و ویرایش پیش از پاسخ، خطای `InteractionNotReplied`.
