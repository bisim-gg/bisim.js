# دستورهای منوی راست‌کلیک

دستورهای منوی راست‌کلیک وقتی دیده می‌شوند که عضوی روی یک کاربر یا پیام راست‌کلیک کند (یا انگشتش را نگه دارد)
و بخش **برنامه‌ها** را باز کند. این دستورها گزینه ندارند: هدفشان همان کاربر یا پیامی است که رویش اجرا شده‌اند.

## ساختن دستور

```js
const { ApplicationCommandType, ContextMenuCommandBuilder } = require('bisim.js');

const userInfo = new ContextMenuCommandBuilder().setName('User Information').setType(ApplicationCommandType.User);

const quote = new ContextMenuCommandBuilder().setName('Quote Message').setType(ApplicationCommandType.Message);
```

برخلاف دستورهای اسلش، نام این دستورها می‌تواند حرف بزرگ و فاصله داشته باشد (۱ تا ۳۲ نویسه). آن‌ها را مثل هر
دستور دیگری ثبت کنید: `userInfo.toJSON()` را در فهرستی بگذارید که به اسکریپت ثبت دستورها یا به
`client.application.commands.set()` می‌دهید.

`setDefaultMemberPermissions()`، `setContexts()` و `setNameLocalizations()` این‌جا هم کار می‌کنند.

## پاسخ دادن

```js
client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isUserContextMenuCommand()) {
    const user = interaction.targetUser;
    const member = interaction.targetMember;
    await interaction.reply({
      content: `${user.displayName} (@${user.username}) joined on ${member?.joinedAt?.toDateString() ?? 'unknown'}.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (interaction.isMessageContextMenuCommand()) {
    const message = interaction.targetMessage;
    await interaction.reply(`> ${message.content}\n${message.author}`);
  }
});
```

- `interaction.targetId` شناسهٔ کاربر یا پیام است.
- `isContextMenuCommand()` برای هر دو نوع درست است و `isUserContextMenuCommand()` و
  `isMessageContextMenuCommand()` هر کدام برای یک نوع.
- به این تعامل‌ها با همان متدهای دستورهای اسلش پاسخ می‌دهید: `reply`، `deferReply`، `editReply`، `followUp` و
  `showModal`.
