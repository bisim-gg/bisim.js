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
Reading `message.content` needs the Message Content intent (see
[The gateway and intents](./gateway.md#intents)); without it the text is empty, except in DMs, in the bot's
own messages and in messages that mention it.

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

Every way of sending takes `files`: `channel.send()`, `message.reply()`, an interaction's `reply()`,
`followUp()`, `editReply()` and `update()`, and a webhook's `send()` and `editMessage()`. An embed shows a file
of its own message with `attachment://name` (see [Embeds](./embeds.md)).

When a message is edited, `attachments` is the list of files it keeps and `files` adds new ones, as on
Discord. Leave both out and every file stays; pass `files` alone and the new files replace the old ones:

```js
await message.edit({ content: 'Updated report', files: ['./report-v2.pdf'] }); // replaces the files
await message.edit({ files: ['./extra.png'], attachments: [...message.attachments.values()] }); // adds one
await message.removeAttachments(); // keeps the text, drops every file
```

## Who gets pinged

`allowedMentions` decides which mentions in the text ping anyone, as on Discord. Left out, every mention
pings; given, only what it names does, and a mention that may not ping stays in the text as plain words:

```js
await channel.send({ content: `${user} wins! @everyone`, allowedMentions: { users: [user.id] } });
await channel.send({ content: 'No pings at all, @everyone', allowedMentions: { parse: [] } });

// A default for every message the bot sends:
const client = new Client({ intents, allowedMentions: { parse: ['users'] } });
```

`parse` takes `users`, `roles` and `everyone` (which also covers `@here`). A reply pings nobody on Bisim, so
`repliedUser` changes nothing.

## Silent messages and hidden embeds

```js
const { MessageFlags } = require('bisim.js');

await channel.send({ content: 'Nightly backup done', flags: MessageFlags.SuppressNotifications }); // no notification
await channel.send({ content: 'https://example.com', flags: MessageFlags.SuppressEmbeds }); // no link preview
await message.suppressEmbeds(true); // hide a message's embeds later (only the bot's own messages)
```

Interaction answers and webhooks take the same flags. `message.flags` reads them back, and a message with
`SuppressEmbeds` has no `embeds`.

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
Bisim sends who and which roles a message mentions along with it, so `message.mentions` is right even when
the bot cannot read the text (no Message Content intent); channels are read from the text:

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
await reaction.remove(); // every reaction of this emoji, needs Manage Messages
await message.reactions.removeAll();
```

Listen for reactions with `MessageReactionAdd` and `MessageReactionRemove`, and for one emoji's reactions
cleared with `MessageReactionRemoveEmoji`:

```js
client.on(Events.MessageReactionAdd, async (reaction, user) => {
  if (reaction.message.partial) await reaction.message.fetch();
  console.log(`${user.username} reacted with ${reaction.emoji.name}`);
});
```

To receive reactions on messages sent before the bot started, enable `Partials.Message` and
`Partials.Reaction`.

## Webhooks

A webhook posts under its own name and picture. It takes text, embeds and files, and can fetch, edit and
delete what it posted, with only its id and token:

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

The picture is the webhook's own: `avatarURL` on a single message is not supported and is ignored, with a
warning. Webhook messages take no components.

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
