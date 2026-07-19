# Chrome Web Store screenshots

The five PNG files in `output/` are 1280×800 and ready for the Chrome Web Store. They use real TabScroll screenshots and short explanatory captions.

The same folder also contains a 440×280 small promotional tile and a 1400×560 marquee tile.

## Order

1. `01-alt-tab-for-tabs.png` — primary promise
2. `02-see-before-switch.png` — visual recognition
3. `03-scroll-enter-done.png` — interaction
4. `04-local-by-design.png` — privacy and trust
5. `05-light-and-night.png` — theme choice

`template.html` is the editable source. Open it with `?slide=1` through `?slide=5` at a 1280×800 viewport to reproduce each export. The real product captures used by the template are stored in `source/`.

To render all exports:

```bash
npm install
npm run render
```

Keep all text accurate to the current extension behavior. If the interface changes, recapture the product before publishing updated screenshots.
