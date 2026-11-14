import { type DefaultTheme, defineConfig } from 'vitepress';

/**
 * The site's base path comes from DOCS_BASE, so one build serves GitHub Pages (`/bisim.js/`) and
 * docs.bisim.gg (`/js/`). Without it the site is built for the root.
 */
function normalizeBase(raw: string | undefined): string {
  const value = (raw ?? '/').trim() || '/';
  if (value.includes(':')) {
    // Git Bash on Windows turns /bisim.js/ into C:/Program Files/Git/bisim.js/.
    throw new Error(`DOCS_BASE is "${value}". In Git Bash, write it without the leading slash (DOCS_BASE=bisim.js/).`);
  }
  const withLeading = value.startsWith('/') ? value : `/${value}`;
  return withLeading.endsWith('/') ? withLeading : `${withLeading}/`;
}

const base = normalizeBase(process.env.DOCS_BASE);
const repo = 'https://github.com/bisim-gg/bisim.js';

function sidebarEn(): DefaultTheme.SidebarItem[] {
  return [
    {
      text: 'Getting started',
      items: [
        { text: 'Introduction', link: '/guide/' },
        { text: 'Installing', link: '/guide/installing' },
        { text: 'Creating your application', link: '/guide/creating-an-application' },
        { text: 'Your first bot', link: '/guide/your-first-bot' },
      ],
    },
    {
      text: 'Slash commands',
      items: [
        { text: 'Creating commands', link: '/guide/slash-commands/' },
        { text: 'Registering commands', link: '/guide/slash-commands/registering' },
        { text: 'Handling commands', link: '/guide/slash-commands/handling' },
        { text: 'Options and subcommands', link: '/guide/slash-commands/options' },
        { text: 'Autocomplete', link: '/guide/slash-commands/autocomplete' },
        { text: 'Permissions', link: '/guide/slash-commands/permissions' },
        { text: 'Localizations', link: '/guide/slash-commands/localizations' },
      ],
    },
    {
      text: 'Interactions',
      items: [
        { text: 'Context menu commands', link: '/guide/interactions/context-menus' },
        { text: 'Buttons', link: '/guide/interactions/buttons' },
        { text: 'Select menus', link: '/guide/interactions/select-menus' },
        { text: 'Modals', link: '/guide/interactions/modals' },
        { text: 'Interactions URL', link: '/guide/interactions/interactions-url' },
      ],
    },
    {
      text: 'Topics',
      items: [
        { text: 'Event handling', link: '/guide/topics/events' },
        { text: 'Embeds', link: '/guide/topics/embeds' },
        { text: 'Messages and reactions', link: '/guide/topics/messages' },
        { text: 'Members and roles', link: '/guide/topics/members-and-roles' },
        { text: 'Collectors', link: '/guide/topics/collectors' },
        { text: 'The gateway and intents', link: '/guide/topics/gateway' },
      ],
    },
    {
      text: 'More',
      items: [
        { text: 'Moving from discord.js', link: '/guide/moving-from-discord-js' },
        { text: 'FAQ', link: '/guide/faq' },
        { text: 'API reference', link: '/api/index.html', target: '_self' },
      ],
    },
  ];
}

function sidebarFa(): DefaultTheme.SidebarItem[] {
  return [
    {
      text: 'شروع کار',
      items: [
        { text: 'معرفی', link: '/fa/guide/' },
        { text: 'نصب', link: '/fa/guide/installing' },
        { text: 'ساخت برنامه', link: '/fa/guide/creating-an-application' },
        { text: 'نخستین ربات', link: '/fa/guide/your-first-bot' },
      ],
    },
    {
      text: 'دستورهای اسلش',
      items: [
        { text: 'ساخت دستورها', link: '/fa/guide/slash-commands/' },
        { text: 'ثبت دستورها', link: '/fa/guide/slash-commands/registering' },
        { text: 'پاسخ به دستورها', link: '/fa/guide/slash-commands/handling' },
        { text: 'گزینه‌ها و زیردستورها', link: '/fa/guide/slash-commands/options' },
        { text: 'تکمیل خودکار', link: '/fa/guide/slash-commands/autocomplete' },
        { text: 'دسترسی‌ها', link: '/fa/guide/slash-commands/permissions' },
        { text: 'ترجمه‌ها', link: '/fa/guide/slash-commands/localizations' },
      ],
    },
    {
      text: 'تعامل‌ها',
      items: [
        { text: 'دستورهای منوی راست‌کلیک', link: '/fa/guide/interactions/context-menus' },
        { text: 'دکمه‌ها', link: '/fa/guide/interactions/buttons' },
        { text: 'منوهای انتخاب', link: '/fa/guide/interactions/select-menus' },
        { text: 'فرم‌ها', link: '/fa/guide/interactions/modals' },
        { text: 'نشانی دستورها', link: '/fa/guide/interactions/interactions-url' },
      ],
    },
    {
      text: 'موضوع‌ها',
      items: [
        { text: 'رویدادها', link: '/fa/guide/topics/events' },
        { text: 'امبدها', link: '/fa/guide/topics/embeds' },
        { text: 'پیام‌ها و واکنش‌ها', link: '/fa/guide/topics/messages' },
        { text: 'اعضا و نقش‌ها', link: '/fa/guide/topics/members-and-roles' },
        { text: 'جمع‌کننده‌ها', link: '/fa/guide/topics/collectors' },
        { text: 'گیت‌وی و اینتنت‌ها', link: '/fa/guide/topics/gateway' },
      ],
    },
    {
      text: 'بیشتر',
      items: [
        { text: 'آمدن از discord.js', link: '/fa/guide/moving-from-discord-js' },
        { text: 'پرسش‌های رایج', link: '/fa/guide/faq' },
        { text: 'مرجع API (انگلیسی)', link: '/api/index.html', target: '_self' },
      ],
    },
  ];
}

export default defineConfig({
  base,
  title: 'bisim.js',
  description: 'The official Node.js library for Bisim bots, written the discord.js way.',
  cleanUrls: false,
  lastUpdated: false,
  ignoreDeadLinks: [/\/api\//],
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: `${base}logo.svg` }],
    ['meta', { name: 'theme-color', content: '#c8f53c' }],
  ],
  markdown: {
    theme: { light: 'github-light', dark: 'github-dark' },
  },
  themeConfig: {
    logo: { src: '/logo.svg', alt: 'bisim.js' },
    socialLinks: [{ icon: 'github', link: repo }],
    search: {
      provider: 'local',
      options: {
        locales: {
          fa: {
            translations: {
              button: { buttonText: 'جستجو', buttonAriaLabel: 'جستجو' },
              modal: {
                displayDetails: 'نمایش جزئیات',
                resetButtonTitle: 'پاک کردن',
                backButtonTitle: 'بستن',
                noResultsText: 'چیزی پیدا نشد',
                footer: { selectText: 'انتخاب', navigateText: 'جابه‌جایی', closeText: 'بستن' },
              },
            },
          },
        },
      },
    },
  },
  locales: {
    root: {
      label: 'English',
      lang: 'en-US',
      themeConfig: {
        nav: [
          { text: 'Guide', link: '/guide/', activeMatch: '/guide/' },
          { text: 'API reference', link: '/api/index.html', target: '_self' },
          { text: 'Moving from discord.js', link: '/guide/moving-from-discord-js' },
          {
            text: '0.1.0',
            items: [
              { text: 'Changelog', link: `${repo}/blob/main/CHANGELOG.md` },
              { text: 'npm', link: 'https://www.npmjs.com/package/bisim.js' },
              { text: 'Bisim developer docs', link: 'https://docs.bisim.gg' },
            ],
          },
        ],
        sidebar: { '/guide/': sidebarEn() },
        editLink: { pattern: `${repo}/edit/main/docs/:path`, text: 'Edit this page on GitHub' },
        footer: { message: 'Released under the MIT License.', copyright: 'Copyright © 2026 Bisim' },
        outline: { level: [2, 3], label: 'On this page' },
      },
    },
    fa: {
      label: 'فارسی',
      lang: 'fa-IR',
      dir: 'rtl',
      title: 'bisim.js',
      description: 'کتاب‌خانهٔ رسمی Node.js برای ساخت ربات‌های بی‌سیم، به سبک discord.js.',
      themeConfig: {
        nav: [
          { text: 'راهنما', link: '/fa/guide/', activeMatch: '/fa/guide/' },
          { text: 'مرجع API', link: '/api/index.html', target: '_self' },
          { text: 'آمدن از discord.js', link: '/fa/guide/moving-from-discord-js' },
          {
            text: '0.1.0',
            items: [
              { text: 'تغییرات', link: `${repo}/blob/main/CHANGELOG.md` },
              { text: 'npm', link: 'https://www.npmjs.com/package/bisim.js' },
              { text: 'مستندات توسعه‌دهندگان بی‌سیم', link: 'https://docs.bisim.gg' },
            ],
          },
        ],
        sidebar: { '/fa/guide/': sidebarFa() },
        editLink: { pattern: `${repo}/edit/main/docs/:path`, text: 'ویرایش این صفحه در GitHub' },
        footer: { message: 'منتشرشده با پروانهٔ MIT.', copyright: 'Copyright © 2026 Bisim' },
        outline: { level: [2, 3], label: 'در این صفحه' },
        docFooter: { prev: 'صفحهٔ قبل', next: 'صفحهٔ بعد' },
        darkModeSwitchLabel: 'پوسته',
        lightModeSwitchTitle: 'پوستهٔ روشن',
        darkModeSwitchTitle: 'پوستهٔ تیره',
        sidebarMenuLabel: 'فهرست',
        returnToTopLabel: 'بازگشت به بالا',
        langMenuLabel: 'زبان',
        notFound: {
          title: 'این صفحه پیدا نشد',
          quote: 'نشانی را بررسی کنید یا از فهرست صفحه‌ها استفاده کنید.',
          linkLabel: 'بازگشت به صفحهٔ اصلی',
          linkText: 'صفحهٔ اصلی',
        },
      },
    },
  },
});
