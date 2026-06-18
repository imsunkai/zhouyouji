# Codex Project Memory

This file captures portable project memory migrated from the old computer.
Use it as local guidance when working on the user's uni-app / WeChat mini-program projects.

## User Preferences

- For WeChat mini-program UI fixes, prioritize visual balance and centered text, especially for buttons. Do not stop at the smallest functional change if the result still looks visually off.
- If the current working directory is inside generated output such as `unpackage`, return to the source project root before editing.
- When runtime preview or build verification has not been performed, clearly say the result is source-level only or unverified.

## Uni-App / Uvue Project Guidance

- Source-of-truth UI files are usually `App.uvue` and `pages/**/*.uvue`.
- Avoid editing generated files under `unpackage` unless the user explicitly asks for a temporary generated-output patch.
- For button text that is off-center or visually inconsistent in WeChat mini-programs, first inspect native `button` default styles before making page-by-page tweaks.
- A useful global reset pattern in `App.uvue` is:

```css
button {
  margin: 0;
  padding: 0;
  min-height: 0;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  vertical-align: middle;
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", Arial, sans-serif;
}

button::after {
  border: 0;
}
```

## Verification Notes

- Some migrated projects may not have a usable root `package.json` or `npm` scripts.
- If command-line build scripts are absent, avoid spending too long searching for `npm run` paths. Verification likely needs HBuilderX or WeChat DevTools.
- For UI work, prefer confirming with a real preview, screenshot, or rebuild before calling the visual result fully verified.

## Migrated Context

- Old project path: `D:\小程序\舟游记1.0`
- Known task memory: button size and font-centering fixes were applied at the source level, mainly through a global `button` reset in `App.uvue`.
- Known limitation: that previous task did not receive runtime visual validation.
