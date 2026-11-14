# ساخت دستورهای اسلش

دستورهای اسلش همان چیزهایی هستند که اعضا پس از `/` در کانال می‌نویسند. هر دستور یک نام و یک توضیح دارد و
می‌تواند گزینه، زیردستور و دسترسی هم داشته باشد. دستور را با `SlashCommandBuilder` توصیف می‌کنید.

## نخستین دستور

```js
const { SlashCommandBuilder } = require('bisim.js');

const data = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('Checks that the bot is awake');
```

نام دستور ۱ تا ۳۲ نویسه از حروف کوچک انگلیسی، رقم، `-` یا `_` است و توضیح آن ۱ تا ۱۰۰ نویسه.
`toJSON()` سازنده را به JSON‌ای تبدیل می‌کند که بی‌سیم نگه می‌دارد؛ معمولاً لازم نیست خودتان آن را صدا بزنید.

## هر دستور در یک فایل

وقتی ربات بزرگ‌تر می‌شود، هر دستور را با `data` و یک تابع `execute` در فایل جداگانه‌ای نگه دارید؛ همان‌طور
که راهنمای discord.js پیشنهاد می‌کند:

```
my-bot/
├── commands/
│   ├── fun/
│   │   └── roll.js
│   └── info/
│       ├── ping.js
│       └── server.js
├── deploy-commands.js
└── index.js
```

```js
// commands/info/ping.js
const { SlashCommandBuilder } = require('bisim.js');

module.exports = {
  data: new SlashCommandBuilder().setName('ping').setDescription('Checks that the bot is awake'),
  async execute(interaction) {
    await interaction.reply(`Pong! The gateway answers in ${interaction.client.ws.ping} ms.`);
  },
};
```

```js
// commands/info/server.js
const { SlashCommandBuilder } = require('bisim.js');

module.exports = {
  data: new SlashCommandBuilder().setName('server').setDescription('Shows a few facts about this server'),
  async execute(interaction) {
    const { name, memberCount, createdAt } = interaction.guild;
    await interaction.reply(`${name} has ${memberCount} members and was created on ${createdAt.toDateString()}.`);
  },
};
```

```js
// commands/fun/roll.js
const { SlashCommandBuilder } = require('bisim.js');

module.exports = {
  data: new SlashCommandBuilder().setName('roll').setDescription('Rolls a six sided die'),
  async execute(interaction) {
    const face = Math.floor(Math.random() * 6) + 1;
    await interaction.reply(`${interaction.user.displayName} rolled a ${face}.`);
  },
};
```

دستور تا وقتی در بی‌سیم **ثبت** نشود کاری نمی‌کند، و ربات هم به کدی نیاز دارد که به آن **پاسخ** دهد. دو صفحهٔ
بعد هر دو را انجام می‌دهند: [ثبت دستورها](./registering.md) و [پاسخ به دستورها](./handling.md).
