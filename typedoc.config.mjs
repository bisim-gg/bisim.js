// The API reference, generated from the TSDoc in src/ into the docs site's public folder, so it is served
// at <base>/api/ next to the guide. DOCS_BASE is the site's base path (see docs/.vitepress/config.mts).
const base = (() => {
  const raw = (process.env.DOCS_BASE ?? '/').trim() || '/';
  if (raw.includes(':')) {
    // Git Bash on Windows turns /bisim.js/ into C:/Program Files/Git/bisim.js/.
    throw new Error(`DOCS_BASE is "${raw}". In Git Bash, write it without the leading slash (DOCS_BASE=bisim.js/).`);
  }
  const withLeading = raw.startsWith('/') ? raw : `/${raw}`;
  return withLeading.endsWith('/') ? withLeading : `${withLeading}/`;
})();

/** @type {Partial<import('typedoc').TypeDocOptions>} */
export default {
  entryPoints: ['src/index.ts'],
  out: 'docs/public/api',
  tsconfig: 'tsconfig.json',
  name: 'bisim.js',
  includeVersion: true,
  readme: 'none',
  excludeInternal: true,
  excludePrivate: true,
  excludeProtected: false,
  sort: ['kind', 'instance-first', 'alphabetical-ignoring-documents'],
  githubPages: false,
  hideGenerator: true,
  customCss: './docs/typedoc.css',
  disableSources: true,
  searchInComments: true,
  navigationLinks: {
    Guide: `${base}guide/`,
    'راهنمای فارسی': `${base}fa/guide/`,
    GitHub: 'https://github.com/bisim-gg/bisim.js',
  },
  validation: { notExported: false, invalidLink: true, notDocumented: false },
  logLevel: 'Warn',
};
