/* 名中注定 Namesake · 界面文案（中 / 英） */
(function () {
  "use strict";

  const S = {
    zh: {
      title: "名中注定 · 你的名字在 12 个国家怎么叫",
      brand: "名中注定",
      navTag: "12 国 · AI 起名",
      kicker: "名中注定",
      h1: '你的名字，<br class="m" />在 <em>12</em> 个国家怎么叫',
      sub: "输入中文名或外文名 · 每个名字都能听发音、看详解、换一个",
      ph: "输入名字，如 张伟 / Emily Johnson",
      male: "男",
      female: "女",
      go: "生成名片",
      ncLabel: "名中注定",
      heroSubForeign: "你在世界各地的名字",
      commentWait: "AI 正在为你挑选各国的名字…",
      progress: (d, n) => `正在起名 ${d}/${n}`,
      ready: (n) => `✨ ${n} 张名片已就绪 · 点卡片看名字详解`,
      fallbackComment: "一个名字，十二种人生。",
      badgeAI: "AI 起名",
      badgeLocal: "词库",
      bornIn: (c) => `如果你生在${c}`,
      readingIn: (c) => (c === "中国" ? "你的名字在中文里的标准音译" : `你的名字在${c}读作`),
      say: (r) => `读作「${r}」`,
      shuffle: "换一个",
      thinking: "起名中",
      detail: "详解",
      aiWorking: "AI 正在起名…",
      cardFail: "这个国家的名字暂时没起出来",
      retry: "重试",
      yourChinese: "你的中文名",
      toastCycle: "已经看完所有候选，从头再来",
      toastNoMore: "暂时想不出新的了，从头再来",
      toastNoTTS: "当前浏览器不支持朗读",
      toastNoVoice: "你的设备可能没有这个语言的语音包",
      toastCopied: "链接已复制，发给朋友试试",
      toastCopyFail: "复制失败，请手动复制地址栏",
      toastPending: (n) => `还有 ${n} 个国家在起名，长图里会先空着`,
      share: "生成分享长图",
      copy: "复制链接",
      again: "换个名字",
      footer: "日语音读、韩语汉字音基于 Unicode Unihan 字典；名字与详解由 AI 生成，仅供娱乐参考。",
      sheetShuffle: "↻ 换一个",
      sheetBusy: "起名中…",
      sheetKeep: "就叫这个",
      sheetLoading: "AI 正在研究这个名字…",
      sheetFail: "详细解析暂时没加载出来，稍后再点开试试。",
      secMeaning: "📖 名字含义",
      secOrigin: "🌱 词源与来历",
      secChars: "🈶 逐字解读",
      secFit: "🔗 和你原名的缘分",
      secVibe: "🎭 给人的印象",
      secPop: "📈 流行度",
      secFamous: "⭐ 同名的知名人物",
      secNick: "💬 常用昵称",
      secTip: "💡 使用小贴士",
      secWhy: "✦ 为什么适合你",
      shareTagline: "测测你的名字在 12 个国家怎么叫",
      shareTip: "手机上长按图片即可保存",
      download: "下载图片",
      fileName: (n) => `${n}的名中注定.png`,
      errInput: "请输入中文名（2–5 个汉字）或外文名（字母）",
      errChinese: "请输入 2–5 个汉字的中文姓名",
      errChar: (c) => `暂不支持这个字：${c}`,
      langBtn: "EN",
      quotaLine: (n, s) => `免费体验：还能生成 ${n} 个名字 · 换一个 ${s} 次`,
      payTitle: "免费次数用完啦",
      payGenerate: "每人可以免费生成 1 个名字，并换 3 次。付费版即将上线，到时可以给更多名字起名、无限换。",
      payShuffle: "免费的 3 次“换一个”已经用完。付费版即将上线，到时可以无限换、看完整详解。",
      payRepo: "⭐ 点个 Star",
      starAsk: "喜欢的话，去 GitHub 帮忙点个 Star 吧，这是对开源作者最大的鼓励 🙏",
      payOk: "知道了",
    },
    en: {
      title: "Namesake · Your name in 12 countries",
      brand: "Namesake",
      navTag: "12 countries · AI naming",
      kicker: "NAMESAKE",
      h1: 'Your name in <em>12</em> countries<br class="m" /> — including Chinese',
      sub: "Type your name · hear it, explore its meaning, shuffle for more",
      ph: "Your name, e.g. Emily Johnson",
      male: "Male",
      female: "Female",
      go: "Create",
      ncLabel: "NAMESAKE",
      heroSubForeign: "Your names around the world",
      commentWait: "AI is picking your names around the world…",
      progress: (d, n) => `Naming ${d}/${n}`,
      ready: (n) => `✨ ${n} cards ready · tap a card for the story behind the name`,
      fallbackComment: "One name, twelve lives.",
      badgeAI: "AI pick",
      badgeLocal: "Classic",
      bornIn: (c) => `If you were born in ${c}`,
      readingIn: (c) => (c === "China" ? "Standard Chinese transliteration" : `Your name in ${c}`),
      say: (r) => `Say: ${r}`,
      shuffle: "Shuffle",
      thinking: "Thinking",
      detail: "Details",
      aiWorking: "AI is naming…",
      cardFail: "Couldn't come up with a name here yet",
      retry: "Retry",
      yourChinese: "Your Chinese name",
      toastCycle: "That's all of them — starting over",
      toastNoMore: "No new ideas right now — starting over",
      toastNoTTS: "Your browser can't read text aloud",
      toastNoVoice: "Your device may not have a voice for this language",
      toastCopied: "Link copied — send it to a friend",
      toastCopyFail: "Couldn't copy — please copy the address bar",
      toastPending: (n) => `${n} countries are still loading and will be blank`,
      share: "Share image",
      copy: "Copy link",
      again: "Try another name",
      footer: "Japanese and Korean character readings come from the Unicode Unihan database; names and explanations are AI-generated, for fun.",
      sheetShuffle: "↻ Shuffle",
      sheetBusy: "Thinking…",
      sheetKeep: "Keep this one",
      sheetLoading: "AI is researching this name…",
      sheetFail: "Couldn't load the details. Try again in a moment.",
      secMeaning: "📖 Meaning",
      secOrigin: "🌱 Origin",
      secChars: "🈶 Character by character",
      secFit: "🔗 How it connects to your name",
      secVibe: "🎭 Vibe",
      secPop: "📈 Popularity",
      secFamous: "⭐ Famous namesakes",
      secNick: "💬 Nicknames",
      secTip: "💡 Tips",
      secWhy: "✦ Why it suits you",
      shareTagline: "Find your name in 12 countries",
      shareTip: "On mobile, long-press the image to save it",
      download: "Download",
      fileName: (n) => `${n} - Namesake.png`,
      errInput: "Please enter a name in letters (or a Chinese name in characters)",
      errChinese: "Please enter a Chinese name of 2–5 characters",
      errChar: (c) => `This character isn't supported yet: ${c}`,
      langBtn: "中文",
      quotaLine: (n, s) => `Free: ${n} name left · ${s} shuffles left`,
      payTitle: "You've used your free tries",
      payGenerate: "Everyone gets 1 free name and 3 shuffles. A paid version is coming soon with more names and unlimited shuffles.",
      payShuffle: "You've used your 3 free shuffles. A paid version is coming soon with unlimited shuffles and full details.",
      payRepo: "⭐ Star on GitHub",
      starAsk: "Enjoying Namesake? A GitHub star means a lot to an indie open-source maker 🙏",
      payOk: "Got it",
    },
  };

  const COUNTRY_TEXT = {
    zh: { zh: ["中国", "中文名"], en: ["China", "Chinese name"] },
    en: { zh: ["英语", "英美澳加通用"], en: ["English", "UK · US · Canada · Australia"] },
    ja: { zh: ["日本", "日语"], en: ["Japan", "Japanese"] },
    ko: { zh: ["韩国", "韩语"], en: ["Korea", "Korean"] },
    fr: { zh: ["法国", "法语"], en: ["France", "French"] },
    de: { zh: ["德国", "德语"], en: ["Germany", "German"] },
    es: { zh: ["西班牙", "西语 · 含拉美"], en: ["Spain", "Spanish · incl. Latin America"] },
    it: { zh: ["意大利", "意大利语"], en: ["Italy", "Italian"] },
    pt: { zh: ["葡萄牙", "葡语 · 含巴西"], en: ["Portugal", "Portuguese · incl. Brazil"] },
    nl: { zh: ["荷兰", "荷兰语"], en: ["Netherlands", "Dutch"] },
    ru: { zh: ["俄罗斯", "俄语"], en: ["Russia", "Russian"] },
    th: { zh: ["泰国", "泰语"], en: ["Thailand", "Thai"] },
    ar: { zh: ["阿联酋", "阿拉伯语"], en: ["UAE", "Arabic"] },
  };

  let ui = "zh";
  try {
    ui = localStorage.getItem("wn-ui") || (/^zh/i.test(navigator.language || "") ? "zh" : "en");
  } catch {
    ui = /^zh/i.test(navigator.language || "") ? "zh" : "en";
  }
  if (!S[ui]) ui = "en";

  const I18N = {
    get ui() { return ui; },
    set(lang) {
      ui = S[lang] ? lang : "en";
      try { localStorage.setItem("wn-ui", ui); } catch {}
      I18N.apply();
    },
    t(key, ...args) {
      const v = S[ui][key] ?? S.zh[key] ?? key;
      return typeof v === "function" ? v(...args) : v;
    },
    country(k) {
      const [name, area] = COUNTRY_TEXT[k][ui];
      return { name, area };
    },
    apply() {
      document.documentElement.lang = ui === "zh" ? "zh-CN" : "en";
      document.title = I18N.t("title");
      document.querySelectorAll("[data-i18n]").forEach((el) => (el.textContent = I18N.t(el.dataset.i18n)));
      document.querySelectorAll("[data-i18n-html]").forEach((el) => (el.innerHTML = I18N.t(el.dataset.i18nHtml)));
      document.querySelectorAll("[data-i18n-ph]").forEach((el) => (el.placeholder = I18N.t(el.dataset.i18nPh)));
    },
  };
  window.I18N = I18N;
})();
