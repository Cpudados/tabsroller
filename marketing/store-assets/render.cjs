const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const dark = fs.readFileSync(path.join(__dirname, "source", "tabscroll-dark.png")).toString("base64");
const light = fs.readFileSync(path.join(__dirname, "source", "tabscroll-light.png")).toString("base64");
const onboarding = fs.readFileSync(path.join(__dirname, "source", "tabscroll-onboarding.png")).toString("base64");

const outputs = [
  ["01-alt-tab-for-tabs.png", slideOne()],
  ["02-see-before-switch.png", slideTwo()],
  ["03-scroll-enter-done.png", slideThree()],
  ["04-local-by-design.png", slideFour()],
  ["05-light-and-night.png", slideFive()],
  ["tabscroll-small-promo-440x280.png", smallPromo()],
  ["tabscroll-marquee-1400x560.png", marqueePromo()],
];

function shell(content, background = "#06171c") {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="1280" height="800" viewBox="0 0 1280 800">
      <defs>
        <radialGradient id="glow"><stop offset="0" stop-color="#2d9cb5" stop-opacity=".38"/><stop offset="1" stop-color="#2d9cb5" stop-opacity="0"/></radialGradient>
        <filter id="shadow" x="-30%" y="-30%" width="160%" height="180%"><feDropShadow dx="0" dy="28" stdDeviation="25" flood-color="#000" flood-opacity=".42"/></filter>
        <filter id="softShadow" x="-30%" y="-30%" width="160%" height="180%"><feDropShadow dx="0" dy="20" stdDeviation="18" flood-color="#163238" flood-opacity=".22"/></filter>
      </defs>
      <rect width="1280" height="800" fill="${background}"/>
      ${content}
    </svg>`;
}

function brand(color = "#f3f1e8") {
  return `
    <g transform="translate(76 67)">
      <rect x="0" y="13" width="15" height="18" rx="3" fill="none" stroke="#75dbef" stroke-width="2" opacity=".45"/>
      <rect x="7" y="7" width="15" height="18" rx="3" fill="none" stroke="#75dbef" stroke-width="2" opacity=".72"/>
      <rect x="14" y="1" width="15" height="18" rx="3" fill="none" stroke="#75dbef" stroke-width="2"/>
      <text x="43" y="23" fill="${color}" font-family="Arial, sans-serif" font-size="20" font-weight="800">TabScroll</text>
    </g>`;
}

function shot(id, image, x, y, width, height, radius = 20) {
  return `
    <defs><clipPath id="${id}"><rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}"/></clipPath></defs>
    <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="#0b242b" stroke="#75dbef" stroke-opacity=".22" filter="url(#shadow)"/>
    <image href="data:image/png;base64,${image}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${id})"/>`;
}

function keyboard(x, y) {
  return `
    <g transform="translate(${x} ${y})" font-family="monospace" font-size="13" font-weight="700" text-anchor="middle">
      <rect width="52" height="38" rx="9" fill="#102d34" stroke="#fff" stroke-opacity=".2"/><text x="26" y="24" fill="#f3f1e8">Ctrl</text>
      <rect x="61" width="58" height="38" rx="9" fill="#102d34" stroke="#fff" stroke-opacity=".2"/><text x="90" y="24" fill="#f3f1e8">Shift</text>
      <rect x="128" width="42" height="38" rx="9" fill="#102d34" stroke="#fff" stroke-opacity=".2"/><text x="149" y="24" fill="#f3f1e8">K</text>
    </g>`;
}

function slideOne() {
  return shell(`
    <circle cx="1070" cy="120" r="490" fill="url(#glow)"/>
    ${brand()}
    <text x="76" y="205" fill="#75dbef" font-family="Arial, sans-serif" font-size="15" font-weight="800" letter-spacing="2.2">VISUAL TAB SWITCHER FOR CHROME</text>
    <text x="76" y="285" fill="#f3f1e8" font-family="Arial, sans-serif" font-size="70" font-weight="800" letter-spacing="-4.5">
      <tspan x="76">Alt-Tab for your</tspan><tspan x="76" dy="70" fill="#d9ff70">Chrome tabs.</tspan>
    </text>
    <text x="76" y="420" fill="#a8bbb8" font-family="Arial, sans-serif" font-size="20"><tspan x="76">Turn a crowded window into a</tspan><tspan x="76" dy="30">full-screen visual switcher.</tspan></text>
    ${keyboard(76, 493)}
    <text x="262" y="518" fill="#d9ff70" font-family="Arial, sans-serif" font-size="24">→</text>
    ${shot("one", dark, 570, 192, 670, 419)}
    <rect x="798" y="620" width="210" height="52" rx="13" fill="#0f2a31" stroke="#fff" stroke-opacity=".14" filter="url(#softShadow)"/>
    <text x="817" y="643" fill="#d9ff70" font-family="monospace" font-size="12" font-weight="700">SCROLL</text><text x="817" y="660" fill="#b7c6c3" font-family="Arial" font-size="12">Move through tabs</text>
  `);
}

function slideTwo() {
  return shell(`
    ${brand("#10292f")}
    <text x="76" y="180" fill="#197991" font-family="Arial" font-size="15" font-weight="800" letter-spacing="2.2">STOP GUESSING</text>
    <text x="76" y="255" fill="#10292f" font-family="Arial" font-size="65" font-weight="800" letter-spacing="-4"><tspan x="76">Recognize it</tspan><tspan x="76" dy="67" fill="#176d81">before you switch.</tspan></text>
    <text x="76" y="378" fill="#586d6e" font-family="Arial" font-size="19"><tspan x="76">Titles, sites, favicons, and a current-page</tspan><tspan x="76" dy="29">preview make tabs recognizable.</tspan></text>
    ${shot("two", light, 500, 340, 720, 410)}
    <rect x="76" y="552" width="330" height="118" rx="16" fill="#10292f" filter="url(#softShadow)"/>
    <text x="99" y="585" fill="#d9ff70" font-family="monospace" font-size="13" font-weight="700">SELECTED TAB</text>
    <text x="99" y="614" fill="#d3dcd8" font-family="Arial" font-size="16"><tspan x="99">The centered card makes your next</tspan><tspan x="99" dy="24">destination unmistakable.</tspan></text>
    <rect x="760" y="414" width="300" height="214" rx="18" fill="none" stroke="#26a4c0" stroke-width="4"/>
    <rect x="752" y="406" width="316" height="230" rx="24" fill="none" stroke="#26a4c0" stroke-width="9" stroke-opacity=".13"/>
  `, "#f3f1e8");
}

function actionCard(x, number, label, icon) {
  return `<g transform="translate(${x} 405)"><rect width="260" height="205" rx="22" fill="#fff" fill-opacity=".045" stroke="#fff" stroke-opacity=".14"/><text x="26" y="34" fill="#70878a" font-family="monospace" font-size="12" font-weight="700">0${number}</text>${icon}<text x="26" y="174" fill="#f3f1e8" font-family="Arial" font-size="26" font-weight="800">${label}</text></g>`;
}

function slideThree() {
  const openIcon = `<g transform="translate(26 72)"><rect width="46" height="34" rx="8" fill="#102d34" stroke="#fff" stroke-opacity=".2"/><text x="23" y="22" fill="#fff" font-family="monospace" font-size="11" text-anchor="middle">Ctrl</text><rect x="53" width="42" height="34" rx="8" fill="#102d34" stroke="#fff" stroke-opacity=".2"/><text x="74" y="22" fill="#fff" font-family="monospace" font-size="13" text-anchor="middle">⇧</text><rect x="102" width="36" height="34" rx="8" fill="#102d34" stroke="#fff" stroke-opacity=".2"/><text x="120" y="22" fill="#fff" font-family="monospace" font-size="12" text-anchor="middle">K</text></g>`;
  const scrollIcon = `<g transform="translate(28 63)"><rect width="40" height="64" rx="20" fill="none" stroke="#91a7aa" stroke-width="2"/><rect x="18" y="10" width="4" height="17" rx="2" fill="#d9ff70"/></g>`;
  const enterIcon = `<g transform="translate(27 74)"><rect width="96" height="42" rx="9" fill="#102d34" stroke="#d9ff70" stroke-opacity=".55"/><text x="48" y="27" fill="#fff" font-family="monospace" font-size="13" text-anchor="middle">Enter ↵</text></g>`;
  return shell(`
    <circle cx="160" cy="760" r="420" fill="url(#glow)"/>
    ${brand()}
    <text x="76" y="185" fill="#75dbef" font-family="Arial" font-size="15" font-weight="800" letter-spacing="2.2">FAST BY MUSCLE MEMORY</text>
    <text x="76" y="280" fill="#f3f1e8" font-family="Arial" font-size="82" font-weight="800" letter-spacing="-5">Open. Scroll.</text>
    <text x="523" y="280" fill="#d9ff70" font-family="Arial" font-size="82" font-weight="800" letter-spacing="-5">Done.</text>
    ${actionCard(76, 1, "Open", openIcon)}<text x="352" y="512" fill="#d9ff70" font-size="28">→</text>
    ${actionCard(390, 2, "Scroll", scrollIcon)}<text x="666" y="512" fill="#d9ff70" font-size="28">→</text>
    ${actionCard(704, 3, "Switch", enterIcon)}
    <g transform="rotate(-5 1110 620)">${shot("three", dark, 967, 450, 390, 244, 17)}</g>
  `);
}

function check(x, y, label) {
  return `<g transform="translate(${x} ${y})"><rect width="250" height="56" rx="14" fill="#fff" fill-opacity=".045" stroke="#fff" stroke-opacity=".13"/><circle cx="29" cy="28" r="13" fill="#d9ff70"/><text x="29" y="33" fill="#173018" font-family="Arial" font-size="14" font-weight="800" text-anchor="middle">✓</text><text x="53" y="34" fill="#f3f1e8" font-family="Arial" font-size="15" font-weight="700">${label}</text></g>`;
}

function slideFour() {
  return shell(`
    <circle cx="1140" cy="700" r="460" fill="url(#glow)" opacity=".75"/>
    ${brand()}
    <text x="76" y="185" fill="#75dbef" font-family="Arial" font-size="15" font-weight="800" letter-spacing="2.2">PERMISSION BEFORE ACCESS</text>
    <text x="76" y="270" fill="#f3f1e8" font-family="Arial" font-size="62" font-weight="800" letter-spacing="-4"><tspan x="76">You choose what</tspan><tspan x="76" dy="64" fill="#d9ff70">TabScroll can see.</tspan></text>
    ${check(76, 420, "No debugger access")}${check(340, 420, "No background captures")}${check(76, 490, "Optional tab details")}${check(340, 490, "No remote uploads")}
    ${shot("four", onboarding, 650, 225, 590, 369)}
    <circle cx="915" cy="645" r="83" fill="#d9ff70" filter="url(#softShadow)"/><text x="915" y="637" fill="#173018" font-family="Arial" font-size="18" font-weight="900" text-anchor="middle"><tspan x="915">CLEAR</tspan><tspan x="915" dy="22">CHOICE</tspan></text>
  `, "#0b2421");
}

function slideFive() {
  return shell(`
    ${brand("#10292f")}
    <text x="76" y="170" fill="#197991" font-family="Arial" font-size="15" font-weight="800" letter-spacing="2.2">MADE FOR YOUR WORKSPACE</text>
    <text x="76" y="245" fill="#10292f" font-family="Arial" font-size="64" font-weight="800" letter-spacing="-4">Light or night.</text>
    <text x="450" y="245" fill="#176d81" font-family="Arial" font-size="64" font-weight="800" letter-spacing="-4">Your call.</text>
    <g transform="rotate(-3 350 530)">${shot("fiveDark", dark, 62, 330, 620, 388)}</g>
    <g transform="rotate(3 930 530)">${shot("fiveLight", light, 598, 310, 620, 388)}</g>
    <rect x="100" y="698" width="112" height="36" rx="18" fill="#10292f"/><text x="156" y="721" fill="#f3f1e8" font-family="Arial" font-size="13" font-weight="800" text-anchor="middle">Night mode</text>
    <rect x="1068" y="690" width="112" height="36" rx="18" fill="#f3f1e8" filter="url(#softShadow)"/><text x="1124" y="713" fill="#10292f" font-family="Arial" font-size="13" font-weight="800" text-anchor="middle">Light mode</text>
  `, "#dfe8e9");
}

function smallPromo() {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="440" height="280" viewBox="0 0 440 280">
      <defs><radialGradient id="promoGlow"><stop offset="0" stop-color="#2d9cb5" stop-opacity=".48"/><stop offset="1" stop-color="#2d9cb5" stop-opacity="0"/></radialGradient></defs>
      <rect width="440" height="280" fill="#06171c"/><circle cx="398" cy="30" r="250" fill="url(#promoGlow)"/>
      <g transform="translate(34 30)"><rect x="0" y="13" width="15" height="18" rx="3" fill="none" stroke="#75dbef" stroke-width="2" opacity=".45"/><rect x="7" y="7" width="15" height="18" rx="3" fill="none" stroke="#75dbef" stroke-width="2" opacity=".72"/><rect x="14" y="1" width="15" height="18" rx="3" fill="none" stroke="#75dbef" stroke-width="2"/><text x="43" y="23" fill="#f3f1e8" font-family="Arial" font-size="20" font-weight="800">TabScroll</text></g>
      <text x="34" y="126" fill="#f3f1e8" font-family="Arial" font-size="43" font-weight="800" letter-spacing="-2.5"><tspan x="34">Alt-Tab for</tspan><tspan x="34" dy="45" fill="#d9ff70">Chrome tabs.</tspan></text>
      <text x="34" y="224" fill="#a8bbb8" font-family="Arial" font-size="14">Open. Scroll. Switch.</text>
      <g transform="translate(308 205)"><rect width="42" height="30" rx="7" fill="#102d34" stroke="#fff" stroke-opacity=".2"/><text x="21" y="20" fill="#fff" font-family="monospace" font-size="10" text-anchor="middle">Ctrl</text><rect x="48" width="38" height="30" rx="7" fill="#102d34" stroke="#fff" stroke-opacity=".2"/><text x="67" y="20" fill="#fff" font-family="monospace" font-size="11" text-anchor="middle">⇧ K</text></g>
    </svg>`;
}

function marqueePromo() {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="1400" height="560" viewBox="0 0 1400 560">
      <defs><radialGradient id="marqueeGlow"><stop offset="0" stop-color="#2d9cb5" stop-opacity=".42"/><stop offset="1" stop-color="#2d9cb5" stop-opacity="0"/></radialGradient><filter id="marqueeShadow" x="-30%" y="-30%" width="160%" height="180%"><feDropShadow dx="0" dy="25" stdDeviation="22" flood-color="#000" flood-opacity=".45"/></filter><clipPath id="marqueeClip"><rect x="745" y="80" width="720" height="450" rx="24"/></clipPath></defs>
      <rect width="1400" height="560" fill="#06171c"/><circle cx="1150" cy="90" r="520" fill="url(#marqueeGlow)"/>
      <g transform="translate(70 58)"><rect x="0" y="13" width="15" height="18" rx="3" fill="none" stroke="#75dbef" stroke-width="2" opacity=".45"/><rect x="7" y="7" width="15" height="18" rx="3" fill="none" stroke="#75dbef" stroke-width="2" opacity=".72"/><rect x="14" y="1" width="15" height="18" rx="3" fill="none" stroke="#75dbef" stroke-width="2"/><text x="43" y="23" fill="#f3f1e8" font-family="Arial" font-size="20" font-weight="800">TabScroll</text></g>
      <text x="70" y="205" fill="#75dbef" font-family="Arial" font-size="14" font-weight="800" letter-spacing="2.2">VISUAL TAB SWITCHER FOR CHROME</text>
      <text x="70" y="282" fill="#f3f1e8" font-family="Arial" font-size="69" font-weight="800" letter-spacing="-4"><tspan x="70">Alt-Tab for your</tspan><tspan x="70" dy="67" fill="#d9ff70">Chrome tabs.</tspan></text>
      <text x="70" y="410" fill="#a8bbb8" font-family="Arial" font-size="19">Find it. Scroll to it. Switch with confidence.</text>
      <rect x="745" y="80" width="720" height="450" rx="24" fill="#0b242b" stroke="#75dbef" stroke-opacity=".25" filter="url(#marqueeShadow)"/><image href="data:image/png;base64,${dark}" x="745" y="80" width="720" height="450" preserveAspectRatio="xMidYMid slice" clip-path="url(#marqueeClip)"/>
    </svg>`;
}

(async () => {
  fs.mkdirSync(path.join(__dirname, "output"), { recursive: true });
  for (const [name, svg] of outputs) {
    await sharp(Buffer.from(svg)).png().toFile(path.join(__dirname, "output", name));
  }
  console.log(`Rendered ${outputs.length} Chrome Web Store assets.`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
