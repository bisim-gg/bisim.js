# فرم‌ها

فرم (modal) پنجره‌ای است که روی بی‌سیم باز می‌شود. فرم کادرهای متنی دارد و وقتی ارسال شود، به‌صورت یک تعامل به
ربات برمی‌گردد.

## ساختن فرم

```js
const { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('bisim.js');

const modal = new ModalBuilder().setCustomId('feedback').setTitle('Send feedback');

const subjectInput = new TextInputBuilder()
  .setCustomId('subject')
  .setLabel('Subject')
  .setStyle(TextInputStyle.Short)
  .setMaxLength(80);

const detailsInput = new TextInputBuilder()
  .setCustomId('details')
  .setLabel('Tell us more')
  .setStyle(TextInputStyle.Paragraph)
  .setRequired(false)
  .setMaxLength(1000);

modal.addComponents(new ActionRowBuilder().addComponents(subjectInput), new ActionRowBuilder().addComponents(detailsInput));
```

هر کادر متن در ردیف خودش قرار می‌گیرد. کادر متن یک برچسب (تا ۴۵ نویسه) و یک سبک (یک‌خطی یا چندخطی) دارد و
می‌تواند متن راهنما، مقدار اولیه و محدودیت طول هم داشته باشد.

## نمایش فرم

فرم باید **نخستین** پاسخ به یک دستور، یک دستور منوی راست‌کلیک، یک دکمه یا یک منوی انتخاب باشد:

```js
if (interaction.commandName === 'feedback') {
  await interaction.showModal(modal);
}
```

نمی‌توانید اول اعلام انتظار کنید و بعد فرم را نشان دهید، و ارسال یک فرم هم نمی‌تواند فرم دیگری باز کند.

## دریافت فرم ارسال‌شده

یا همان‌جا که فرم را نشان داده‌اید منتظرش بمانید:

```js
await interaction.showModal(modal);
const submitted = await interaction
  .awaitModalSubmit({ time: 120_000, filter: (i) => i.customId === 'feedback' && i.user.id === interaction.user.id })
  .catch(() => null);
if (submitted) {
  const subject = submitted.fields.getTextInputValue('subject');
  await submitted.reply({ content: `Thanks, we got your note about "${subject}".`, flags: MessageFlags.Ephemeral });
}
```

یا مثل هر تعامل دیگری در `interactionCreate` به آن رسیدگی کنید:

```js
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isModalSubmit() || interaction.customId !== 'feedback') return;
  const subject = interaction.fields.getTextInputValue('subject');
  const details = interaction.fields.getTextInputValue('details');
  await interaction.reply({ content: `Subject: ${subject}\nDetails: ${details || 'none'}`, flags: MessageFlags.Ephemeral });
});
```

به فرم ارسال‌شده با `reply`، `deferReply`، `editReply` و `followUp` پاسخ می‌دهید. اگر فرم از یک دکمه یا منوی
انتخاب باز شده باشد، `interaction.isFromMessage()` درست است و `update()` همان پیام را ویرایش می‌کند.
