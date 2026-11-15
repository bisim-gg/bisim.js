# Embeds

An embed is a card under a message: a title, a description, fields, a colour, a footer and pictures.

## Building one

```js
const { EmbedBuilder } = require('bisim.js');

const rules = new EmbedBuilder()
  .setColor(0x3f5600)
  .setTitle('Server rules')
  .setURL('https://bisim.gg/')
  .setAuthor({ name: 'The moderators', url: 'https://bisim.gg', iconURL: 'https://example.com/mods.png' })
  .setDescription('Please read these before you post.')
  .setThumbnail('https://example.com/logo.png')
  .addFields(
    { name: 'Be kind', value: 'No insults and no harassment.' },
    { name: 'Stay on topic', value: 'Use the right channel.', inline: true },
    { name: 'No spam', value: 'Say it once.', inline: true },
  )
  .setImage('https://example.com/banner.png')
  .setTimestamp()
  .setFooter({ text: 'Questions? Ask a moderator.', iconURL: 'https://example.com/help.png' });

await channel.send({ embeds: [rules] });
```

Plain objects work too:

```js
await interaction.reply({
  embeds: [{ title: 'Server rules', description: 'Please read these before you post.', color: 0x3f5600 }],
});
```

## What Bisim shows

| Part | Shown |
| --- | --- |
| title and URL | yes |
| description | yes |
| colour | yes |
| author name, URL and icon | yes |
| fields, inline or not | yes |
| footer text and icon | yes |
| timestamp | yes |
| thumbnail, beside the text | yes |
| image, below the fields | yes |

A picture is an `http` or `https` link of at most 2048 characters, and every reader's app loads it from that
address, as Discord's did. Discord's `attachment://name.png` is not supported yet: bisim.js leaves such a picture
out of the message and writes a warning once. To show a file you made, send it as a file (see
[Messages and reactions](./messages.md)), or put it somewhere with a public link first.

## Colours

`setColor()` takes a number, a hex string, an `[r, g, b]` array, or a name from `Colors`:

```js
const { Colors } = require('bisim.js');

embed.setColor(Colors.Blurple);
embed.setColor('#2ecc71');
embed.setColor('Random');
```

## Limits

| Part | Limit |
| --- | --- |
| title | 256 characters |
| description | 4096 characters |
| fields | 25 |
| field name | 256 characters |
| field value | 1024 characters |
| footer text | 2048 characters |
| author name | 256 characters |

The builder throws a `BisimjsRangeError` when a limit is crossed. A message carries up to 10 embeds.

## Editing an embed you received

```js
const received = message.embeds[0];
const edited = EmbedBuilder.from(received).setTitle('A new title');
await message.edit({ embeds: [edited] });
```

`message.embeds` also holds link previews Bisim made for links in the message; their `image` and
`provider` are filled in.
