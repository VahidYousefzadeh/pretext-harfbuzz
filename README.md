# pretext + HarfBuzz

Text measurement without a browser. [pretext](https://github.com/chenglou/pretext) measures words with
[HarfBuzz](https://github.com/harfbuzz/harfbuzzjs) (WebAssembly) instead of a canvas, so it runs in Node
and gives the same layout as the browser.

**Live demo:** [vahidyousefzadeh.com/pretext-harfbuzz](https://vahidyousefzadeh.com/pretext-harfbuzz)

```sh
npm install github:VahidYousefzadeh/pretext-harfbuzz @chenglou/pretext
```

```ts
import { readFile } from "node:fs/promises";
import { measureLineStats, prepareWithSegments } from "@chenglou/pretext";
import { FontBook, installHarfBuzzMeasurer } from "pretext-harfbuzz";

const fonts = new FontBook();
await fonts.add({ family: "Inter" }, await readFile("Inter-Regular.ttf"));
installHarfBuzzMeasurer(fonts, { locale: "en" });

const text = prepareWithSegments("Hello, headless world. No browser measured this.", "16px Inter");
const { lineCount, maxLineWidth } = measureLineStats(text, 200); // 2 lines, widest 193.09375 px
```

Run the demo with `npm install` and `npm run dev`.

MIT licensed. Built on pretext (MIT), harfbuzzjs (MIT) and the Inter typeface
([SIL Open Font License](public/fonts/OFL.txt)).
