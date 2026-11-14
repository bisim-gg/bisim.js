# Options and subcommands

Options let members pass values to a command. Each option has a type, a name and a description.

## Option types

| Builder method | Type | Gives you |
| --- | --- | --- |
| `addStringOption` | String | text |
| `addIntegerOption` | Integer | a whole number |
| `addNumberOption` | Number | a number, fractions allowed |
| `addBooleanOption` | Boolean | `true` or `false` |
| `addUserOption` | User | a user, and the member when in a server |
| `addChannelOption` | Channel | a channel |
| `addRoleOption` | Role | a role |
| `addMentionableOption` | Mentionable | a user or a role |
| `addAttachmentOption` | Attachment | an uploaded file |

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

Required options must come before optional ones.

## Choices and limits

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

A command has at most 25 options, and an option at most 25 choices.

## Reading options

`interaction.options` is a `CommandInteractionOptionResolver`:

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

Optional options that were not filled in return `null`.

## Subcommands

Subcommands split one command into several, like `/tag save` and `/tag show`:

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

Groups add one more level, `/settings welcome enable`:

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

A command has either subcommands and groups or plain options, never both, and at most two levels.
