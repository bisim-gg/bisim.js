# Contributing to bisim.js

Thank you for helping. bisim.js is the official Node.js library for Bisim bots, and contributions of every
size are welcome: a typo fix, a test, a missing method, a translation of a guide page.

## The rule that shapes everything

bisim.js mirrors the public surface of discord.js v14: class, method, property, event, option and builder
names, signatures, defaults and behaviour. A discord.js bot should run on Bisim by changing the import and the
token. The one renaming rule: a word "Discord" in a name becomes "Bisim" (`DiscordAPIError` is
`BisimAPIError`). Nothing else is renamed.

When Bisim does not have a feature, the method exists and throws a `BisimjsError` with the code
`NotSupported` and a message naming the feature. It never silently does nothing.

Please read discord.js and its guide to match names and behaviour, then write your own implementation.
Do not copy code from discord.js.

## Getting started

```sh
git clone https://github.com/bisim-gg/bisim.js.git
cd bisim.js
npm install
npm test
```

Useful scripts:

| Script | What it does |
| --- | --- |
| `npm run typecheck` | TypeScript, strict |
| `npm test` | the test suite (vitest), with a fake gateway and recorded responses |
| `npm run build` | ESM, CommonJS and type declarations in `dist/` |
| `npm run docs:build` | the guide and the API reference in `docs/.vitepress/dist/` |

The tests never call a live Bisim service. If you need to see a change working end to end, run a bot against
a local Bisim with `rest.api` and `ws.gateway` pointing at it.

## Making a change

1. Open an issue first for anything bigger than a small fix, so we can agree on the approach.
2. Create a branch, make the change, and add or update tests.
3. Document every public member with TSDoc: the API reference is generated from it.
4. If the change affects how a bot is written, update the guide in `docs/guide/` and its Persian version in
   `docs/fa/guide/`. If you cannot write Persian, say so in the pull request and we will translate it.
5. Add a line to `CHANGELOG.md` under an "Unreleased" heading.
6. Run `npm run typecheck`, `npm test` and `npm run build` before opening the pull request.

## Style

- TypeScript, strict, Node.js 18 or newer, no new runtime dependencies without a discussion.
- Write in plain English. Do not use the long dash or the short dash characters anywhere (code comments,
  docs, commit messages); use a comma, a colon or a full stop. A plain hyphen is fine.
- Persian text uses half-spaces (ZWNJ) where they belong, such as «می‌شود» and «پیام‌ها».
- Commit messages say what a user of the library gets, in a sentence or two.

## Reporting a security problem

Please do not open a public issue. See [SECURITY.md](./SECURITY.md).

## Code of conduct

Everyone taking part is expected to follow the [code of conduct](./CODE_OF_CONDUCT.md).
