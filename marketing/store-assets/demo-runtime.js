(function () {
  const params = new URLSearchParams(window.location.search);
  const theme = params.get("theme") === "light" ? "white" : "night";
  const showOnboarding = params.get("onboarding") === "1";

  window.localStorage.setItem("tabscroll:theme", theme);

  if (showOnboarding) {
    window.localStorage.removeItem("tabscroll:onboarding-v1");
  } else {
    window.localStorage.setItem("tabscroll:onboarding-v1", "complete");
  }

  const tabs = [
    demoTab(101, "Release checklist", "notion.so/product/release-checklist", "N", "#f2f2ef"),
    demoTab(102, "Pull request · tab switcher", "github.com/acme/browser-tools/pull/42", "G", "#24292f"),
    demoTab(103, "Q3 product research", "docs.google.com/document/d/research", "D", "#4285f4"),
    demoTab(104, "Launch dashboard", "linear.app/acme/project/launch", "L", "#6e5cf6", true),
    demoTab(105, "Design review", "figma.com/file/tabscroll", "F", "#f24e1e"),
    demoTab(106, "Team discussion", "slack.com/client/workspace/product", "S", "#4a154b"),
    demoTab(107, "Competitor notes", "notion.so/product/competitors", "N", "#f2f2ef"),
  ];

  window.chrome = {
    permissions: {
      request: async () => true,
    },
    runtime: {
      sendMessage: async (message) => {
        if (message?.type === "tabscroll:get-session") {
          return {
            ok: true,
            payload: {
              activeIndex: 3,
              detailsAccess: !showOnboarding,
              tabs: showOnboarding
                ? tabs.map((tab, index) => ({
                    ...tab,
                    title: index === 3 ? tab.title : `Tab ${index + 1}`,
                    url: index === 3 ? tab.url : "",
                    favicon: index === 3 ? tab.favicon : "",
                    detailsAvailable: index === 3,
                  }))
                : tabs,
            },
          };
        }

        return { ok: true };
      },
    },
  };

  function demoTab(id, title, url, letter, color, active = false) {
    return {
      id,
      title,
      url: `https://${url}`,
      favicon: iconDataUrl(letter, color),
      preview: active ? previewDataUrl() : "",
      active,
      detailsAvailable: true,
    };
  }

  function iconDataUrl(letter, color) {
    const ink = color === "#f2f2ef" ? "#17191c" : "#ffffff";
    return svgDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
        <rect width="64" height="64" rx="16" fill="${color}"/>
        <text x="32" y="41" fill="${ink}" font-family="Arial, sans-serif" font-size="28" font-weight="800" text-anchor="middle">${letter}</text>
      </svg>
    `);
  }

  function previewDataUrl() {
    return svgDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="750" viewBox="0 0 1200 750">
        <rect width="1200" height="750" fill="#f7f8fa"/>
        <rect width="1200" height="68" fill="#ffffff"/>
        <circle cx="42" cy="34" r="13" fill="#6e5cf6"/>
        <text x="68" y="42" fill="#202329" font-family="Arial" font-size="22" font-weight="700">Launch dashboard</text>
        <rect x="940" y="19" width="104" height="32" rx="16" fill="#ece9ff"/>
        <rect x="1062" y="19" width="106" height="32" rx="16" fill="#202329"/>
        <rect x="28" y="98" width="246" height="622" rx="18" fill="#202329"/>
        <rect x="54" y="132" width="156" height="15" rx="7" fill="#ffffff" opacity=".9"/>
        <rect x="54" y="181" width="184" height="38" rx="10" fill="#6e5cf6"/>
        <rect x="54" y="239" width="140" height="12" rx="6" fill="#ffffff" opacity=".33"/>
        <rect x="54" y="277" width="164" height="12" rx="6" fill="#ffffff" opacity=".33"/>
        <rect x="54" y="315" width="120" height="12" rx="6" fill="#ffffff" opacity=".33"/>
        <text x="310" y="135" fill="#202329" font-family="Arial" font-size="30" font-weight="800">Launch overview</text>
        <text x="310" y="169" fill="#727780" font-family="Arial" font-size="17">Everything the team needs for release week</text>
        <g transform="translate(310 210)">
          <rect width="250" height="140" rx="16" fill="#ffffff" stroke="#e4e6eb"/>
          <rect x="22" y="22" width="88" height="11" rx="5" fill="#90949c"/>
          <text x="22" y="88" fill="#202329" font-family="Arial" font-size="42" font-weight="800">84%</text>
          <rect x="22" y="108" width="206" height="8" rx="4" fill="#ece9ff"/><rect x="22" y="108" width="173" height="8" rx="4" fill="#6e5cf6"/>
        </g>
        <g transform="translate(580 210)">
          <rect width="250" height="140" rx="16" fill="#ffffff" stroke="#e4e6eb"/>
          <rect x="22" y="22" width="106" height="11" rx="5" fill="#90949c"/>
          <text x="22" y="88" fill="#202329" font-family="Arial" font-size="42" font-weight="800">126</text>
          <rect x="22" y="108" width="132" height="9" rx="4" fill="#b8efcc"/>
        </g>
        <g transform="translate(850 210)">
          <rect width="318" height="140" rx="16" fill="#ffffff" stroke="#e4e6eb"/>
          <rect x="22" y="22" width="122" height="11" rx="5" fill="#90949c"/>
          <circle cx="43" cy="83" r="21" fill="#ffc857"/><circle cx="82" cy="83" r="21" fill="#6ed6a6"/><circle cx="121" cy="83" r="21" fill="#8ec5ff"/>
        </g>
        <rect x="310" y="380" width="858" height="340" rx="18" fill="#ffffff" stroke="#e4e6eb"/>
        <text x="336" y="425" fill="#202329" font-family="Arial" font-size="20" font-weight="700">Release tasks</text>
        <g fill="#f3f4f7"><rect x="336" y="456" width="806" height="52" rx="10"/><rect x="336" y="520" width="806" height="52" rx="10"/><rect x="336" y="584" width="806" height="52" rx="10"/><rect x="336" y="648" width="806" height="52" rx="10"/></g>
        <g fill="#6e5cf6"><circle cx="362" cy="482" r="8"/><circle cx="362" cy="546" r="8"/><circle cx="362" cy="610" r="8"/><circle cx="362" cy="674" r="8"/></g>
      </svg>
    `);
  }

  function svgDataUrl(svg) {
    return `data:image/svg+xml,${encodeURIComponent(svg.replace(/\s+/g, " ").trim())}`;
  }
})();
