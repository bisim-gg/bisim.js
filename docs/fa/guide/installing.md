# نصب

## Node.js

bisim.js به Node.js نسخهٔ ۱۸ یا جدیدتر نیاز دارد. نسخهٔ نصب‌شده را بررسی کنید:

```sh
node --version
```

اگر این فرمان پیدا نشد یا نسخه قدیمی‌تر بود، آخرین نسخهٔ LTS را از [nodejs.org](https://nodejs.org) نصب کنید.

## پوشهٔ پروژه

یک پوشه برای ربات بسازید و داخل آن یک `package.json` ایجاد کنید:

```sh
mkdir my-bot
cd my-bot
npm init -y
```

## نصب bisim.js

کتاب‌خانه را نصب کنید:

```sh
npm install bisim.js
```

یک ربات فقط همین بسته را لازم دارد. bisim.js برای اتصال WebSocket از `ws` استفاده می‌کند و به چیز دیگری
وابسته نیست؛ درخواست‌های HTTP را `fetch` خود Node انجام می‌دهد.

## CommonJS، ماژول‌های ES و TypeScript

bisim.js هر دو قالب ماژول و تعریف تایپ‌های خودش را همراه دارد:

::: code-group

```js [CommonJS]
const { Client, GatewayIntentBits } = require('bisim.js');
```

```js [ES modules]
import { Client, GatewayIntentBits } from 'bisim.js';
```

```ts [TypeScript]
import { Client, GatewayIntentBits, type ChatInputCommandInteraction } from 'bisim.js';
```

:::

نمونه‌های این راهنما، مثل راهنمای discord.js، با CommonJS نوشته شده‌اند.

## توکن را از کد بیرون نگه دارید

ربات با یک توکن وارد می‌شود و این توکن مثل گذرواژه است. هرگز آن را در فایلی که در مخزن کد ثبت می‌شود ننویسید.
به جای آن، توکن را در یک متغیر محیطی بگذارید:

```sh
# Linux and macOS
export BISIM_TOKEN="your token"

# Windows PowerShell
$env:BISIM_TOKEN = "your token"
```

اگر `client.login()` را بدون ورودی صدا بزنید، توکن را از `BISIM_TOKEN` می‌خواند. اگر فایل را ترجیح
می‌دهید، از یک فایل `.env` و فرمان `node --env-file=.env index.js` استفاده کنید (Node نسخهٔ ۲۰٫۶ به بالا) و
`.env` را به `.gitignore` اضافه کنید.

قدم بعدی: [برنامهٔ خود را بسازید](./creating-an-application.md) و توکن آن را بگیرید.
