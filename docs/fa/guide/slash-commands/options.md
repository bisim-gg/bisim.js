# گزینه‌ها و زیردستورها

گزینه‌ها به اعضا اجازه می‌دهند مقداری را به دستور بدهند. هر گزینه یک نوع، یک نام و یک توضیح دارد.

## نوع گزینه‌ها

| متد سازنده | نوع | چه چیزی می‌دهد |
| --- | --- | --- |
| `addStringOption` | String | متن |
| `addIntegerOption` | Integer | عدد صحیح |
| `addNumberOption` | Number | عدد، با اعشار |
| `addBooleanOption` | Boolean | `true` یا `false` |
| `addUserOption` | User | کاربر، و در سرور عضو |
| `addChannelOption` | Channel | کانال |
| `addRoleOption` | Role | نقش |
| `addMentionableOption` | Mentionable | کاربر یا نقش |
| `addAttachmentOption` | Attachment | فایل بارگذاری‌شده |

```js
const { ChannelType, SlashCommandBuilder } = require('bisim.js');

const data = new SlashCommandBuilder()
  .setName('announce')
  .setDescription('Posts an announcement')
  .addStringOption((option) =>
    option.setName('text').setDescription('What to announce').setRequired(true).setMaxLength(2000),
  )
  .addChannelOption((option) =>
    option.setName('channel').setDescription('Where to post it').addChannelTypes(ChannelType.GuildText),
  )
  .addBooleanOption((option) => option.setName('silent').setDescription('Post without pinging anyone'));
```

گزینه‌های اجباری باید پیش از گزینه‌های اختیاری بیایند.

## انتخاب‌ها و محدوده‌ها

```js
new SlashCommandBuilder()
  .setName('poll')
  .setDescription('Starts a quick poll')
  .addStringOption((option) =>
    option
      .setName('length')
      .setDescription('How long the poll stays open')
      .setRequired(true)
      .addChoices(
        { name: 'One hour', value: '1h' },
        { name: 'One day', value: '1d' },
        { name: 'One week', value: '1w' },
      ),
  )
  .addIntegerOption((option) => option.setName('answers').setDescription('How many answers').setMinValue(2).setMaxValue(10));
```

هر دستور حداکثر ۲۵ گزینه دارد و هر گزینه حداکثر ۲۵ انتخاب.

## خواندن گزینه‌ها

`interaction.options` یک `CommandInteractionOptionResolver` است:

```js
const text = interaction.options.getString('text', true); // true: throw if missing
const channel = interaction.options.getChannel('channel') ?? interaction.channel;
const silent = interaction.options.getBoolean('silent') ?? false;
const answers = interaction.options.getInteger('answers');
const person = interaction.options.getUser('person');
const asMember = interaction.options.getMember('person');
const team = interaction.options.getRole('team');
const proof = interaction.options.getAttachment('screenshot');
const either = interaction.options.getMentionable('who');
```

گزینه‌های اختیاری‌ای که پر نشده‌اند `null` برمی‌گردانند.

## زیردستورها

زیردستورها یک دستور را به چند بخش تقسیم می‌کنند؛ مثل `/tag save` و `/tag show`:

```js
const data = new SlashCommandBuilder()
  .setName('tag')
  .setDescription('Saves and shows short texts')
  .addSubcommand((sub) =>
    sub
      .setName('save')
      .setDescription('Saves a tag')
      .addStringOption((option) => option.setName('name').setDescription('The tag name').setRequired(true))
      .addStringOption((option) => option.setName('text').setDescription('What the tag says').setRequired(true)),
  )
  .addSubcommand((sub) =>
    sub
      .setName('show')
      .setDescription('Shows a tag')
      .addStringOption((option) => option.setName('name').setDescription('The tag name').setRequired(true)),
  );

const tags = new Map();

async function execute(interaction) {
  const name = interaction.options.getString('name', true);
  if (interaction.options.getSubcommand() === 'save') {
    tags.set(name, interaction.options.getString('text', true));
    await interaction.reply(`Saved the tag ${name}.`);
  } else {
    await interaction.reply(tags.get(name) ?? `There is no tag called ${name}.`);
  }
}
```

گروه‌ها یک سطح دیگر اضافه می‌کنند؛ مثل `/settings welcome enable`:

```js
new SlashCommandBuilder()
  .setName('settings')
  .setDescription('Changes how the bot behaves')
  .addSubcommandGroup((group) =>
    group
      .setName('welcome')
      .setDescription('The welcome message')
      .addSubcommand((sub) => sub.setName('enable').setDescription('Turns the welcome message on')),
  );

// interaction.options.getSubcommandGroup() === 'welcome', getSubcommand() === 'enable'
```

هر دستور یا زیردستور و گروه دارد یا گزینهٔ ساده، نه هر دو؛ و حداکثر دو سطح.
