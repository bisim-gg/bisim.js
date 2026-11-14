# Messages and reactions

## Sending

```js
const channel = client.channels.cache.get('1198765432109876543');
await channel.send('Hello!');
await channel.send({ content: 'With an embed', embeds: [embed] });
```

Text can be up to 4000 characters. `channel.isSendable()` tells you whether a channel takes messages: server
text channels and DMs do; voice channels and categories do not.

## Replying, editing, deleting

```js
client.on(Events.MessageCreate, async (message) => {
  if (message.content !== '!hello') return;
  const reply = await message.reply(`Hello, ${message.author.displayName}!`);
  await reply.edit('Hello again!');
  setTimeout(() => reply.delete(), 10_000);
});
```

A bot can edit only its own messages. Deleting someone else's needs the Manage Messages permission.

## Files

Files are uploaded with the message. bisim.js asks Bisim for an upload address, uploads the bytes, then
sends the message:

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

A file can be a path, a URL, a Buffer or a stream. Bisim takes up to 10 files per message, 10 MiB each by
default. `setSpoiler(true)` blurs a file until it is clicked.

Files can be sent with `channel.send()` and `message.reply()`. Interaction replies and webhooks take no files
yet; passing them throws a `BisimjsError`.

## Fetching messages

```js
const message = await channel.messages.fetch('1198765432109876543');
const latest = await channel.messages.fetch({ limit: 10 }); // newest first
const older = await channel.messages.fetch({ before: latest.lastKey(), limit: 50 });
const pinned = await channel.messages.fetchPinned();
```

## Deleting many at once

```js
const deleted = await channel.bulkDelete(20, true); // the last 20, skipping ones older than two weeks
```

## Mentions

Mentions are tokens in the text, such as `<@id>` for a user, `<@&id>` for a role and `<#id>` for a channel.
bisim.js reads them into `message.mentions`:

```js
const user = message.mentions.users.first();
if (message.mentions.has(client.user)) await message.reply('You called?');
```

The formatters build them for you: `userMention(id)`, `roleMention(id)`, `channelMention(id)`, as well as
`bold()`, `italic()`, `codeBlock()`, `time()` and the rest.

## Reactions

```js
const reaction = await message.react('👍');
await message.react('<:wave:123456789012345678>'); // a server's custom emoji

const users = await reaction.users.fetch();
await reaction.users.remove(someUserId); // someone else's needs Manage Messages
await message.reactions.removeAll();
```

Listen for reactions with `MessageReactionAdd` and `MessageReactionRemove`:

```js
client.on(Events.MessageReactionAdd, async (reaction, user) => {
  if (reaction.message.partial) await reaction.message.fetch();
  console.log(`${user.username} reacted with ${reaction.emoji.name}`);
});
```

To receive reactions on messages sent before the bot started, enable `Partials.Message` and
`Partials.Reaction`.

## Pins and polls

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
