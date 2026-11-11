/* 名中注定 Namesake · 页面交互（中文名 → 外文名 / 外文名 → 中文名 + 各国叫法） */
(function () {
  "use strict";
  const WN = window.WorldName;
  const I18N = window.I18N;
  const T = (...a) => I18N.t(...a);
  const $ = (id) => document.getElementById(id);
  const API = "/api/names";
  const SITE = location.host || "worldname";

  /* ---------------- 国家 ---------------- */
  const COUNTRIES = {
    zh: { flag: "🇨🇳", color: "#d2421a", tts: "zh-CN", script: "cjk" },
    en: { flag: "🇬🇧", color: "#27407a", tts: "en-US", script: "latin" },
    ja: { flag: "🇯🇵", color: "#bc1f3a", tts: "ja-JP", script: "cjk" },
    ko: { flag: "🇰🇷", color: "#3c5fb0", tts: "ko-KR", script: "other" },
    fr: { flag: "🇫🇷", color: "#5866d6", tts: "fr-FR", script: "latin" },
    de: { flag: "🇩🇪", color: "#b98a1e", tts: "de-DE", script: "latin" },
    es: { flag: "🇪🇸", color: "#d4512f", tts: "es-ES", script: "latin" },
    it: { flag: "🇮🇹", color: "#1f8a5b", tts: "it-IT", script: "latin" },
    pt: { flag: "🇵🇹", color: "#0e7a72", tts: "pt-PT", script: "latin" },
    nl: { flag: "🇳🇱", color: "#e5731f", tts: "nl-NL", script: "latin" },
    ru: { flag: "🇷🇺", color: "#8a3a6b", tts: "ru-RU", script: "latin" },
    th: { flag: "🇹🇭", color: "#5b3fa6", tts: "th-TH", script: "other" },
    ar: { flag: "🇦🇪", color: "#2f7d4f", tts: "ar-SA", script: "other" },
  };
  const MODES = {
    cn: {
      list: ["en", "ja", "ko", "fr", "de", "es", "it", "pt", "nl", "ru", "th", "ar"],
      groups: [["en", "fr", "de"], ["es", "it", "pt"], ["nl", "ru", "ar"], ["ja", "ko", "th"]],
    },
    foreign: {
      list: ["zh", "ja", "ko", "fr", "de", "es", "it", "pt", "nl", "ru", "th", "ar"],
      groups: [["zh", "fr", "de"], ["ja", "ko", "es"], ["it", "pt", "nl"], ["ru", "th", "ar"]],
    },
  };
  const LATIN_LANGS = new Set(["en", "fr", "de", "es", "it", "pt", "nl"]);
  const FOREIGN_RE = /^[\p{Script=Latin}][\p{Script=Latin}\p{M}' .-]{1,39}$/u;

  const ICON = {
    speak: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>',
    shuffle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>',
  };

  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  let state = null; // { mode, ui, r, gender, mods, readings, comment, shared }

  /* ---------------- 免费额度 ----------------
   * 每台设备免费生成 1 个名字、换一个 3 次（存在浏览器本地，属于“软限制”；
   * 真正的成本兜底在服务端：单 IP 限流 + 每日调用上限 DAILY_LIMIT）。
   * 打开别人分享的链接不消耗额度，方便传播。
   */
  const REPO_URL = "https://github.com/BryceYuuu/namesake";
  const FREE = { names: 1, shuffles: 3 };
  const QKEY = "wn-quota-v1";
  const nameKey = (s) => String(s || "").trim().replace(/\s+/g, " ").toLowerCase();
  let quota = { names: [], shuffles: 0 };
  try { quota = { ...quota, ...JSON.parse(localStorage.getItem(QKEY) || "{}") }; } catch {}
  const saveQuota = () => { try { localStorage.setItem(QKEY, JSON.stringify(quota)); } catch {} };
  const shufflesLeft = () => Math.max(0, FREE.shuffles - quota.shuffles);
  const canGenerate = (full) => quota.names.includes(nameKey(full)) || quota.names.length < FREE.names;
  function useGenerate(full) {
    const k = nameKey(full);
    if (!quota.names.includes(k)) { quota.names.push(k); saveQuota(); }
  }
  function renderQuota() {
    const namesLeft = Math.max(0, FREE.names - quota.names.length);
    $("quota").textContent = T("quotaLine", namesLeft, shufflesLeft());
    document.querySelectorAll("[data-act=shuffle] .left").forEach((el) => (el.textContent = shufflesLeft()));
  }
  function showPaywall(kind) {
    $("payTitle").textContent = T("payTitle");
    $("payText").textContent = T(kind === "shuffle" ? "payShuffle" : "payGenerate");
    $("payStarAsk").textContent = T("starAsk");
    $("payRepo").href = REPO_URL;
    renderStarButton();
    loadStars().then(renderStarButton);
    $("paywall").hidden = false;
    document.body.style.overflow = "hidden";
  }
  // GitHub 当前 Star 数（公开接口，会话内缓存；拿不到就只显示按钮文字）
  let stars = null;
  try { stars = JSON.parse(sessionStorage.getItem("wn-stars") || "null"); } catch {}
  async function loadStars() {
    if (stars !== null) return;
    try {
      const res = await fetch(REPO_URL.replace("https://github.com/", "https://api.github.com/repos/"));
      if (!res.ok) return;
      stars = (await res.json()).stargazers_count;
      if (typeof stars === "number") sessionStorage.setItem("wn-stars", JSON.stringify(stars));
      else stars = null;
    } catch {}
  }
  function renderStarButton() {
    $("payRepo").innerHTML = esc(T("payRepo")) + (typeof stars === "number" && stars >= 10 ? `<span class="star-n">${stars}</span>` : "") // 少于 10 个不显示，避免反向社交证明;
  }

  function closePaywall() {
    $("paywall").hidden = true;
    if ($("sheet").hidden && $("modal").hidden) document.body.style.overflow = "";
  }
  let gender = "m";
  let genderTouched = false;
  let runId = 0;
  const detailCache = new Map();

  /* ---------------- 语言 ---------------- */
  I18N.apply();
  $("langBtn").addEventListener("click", () => {
    I18N.set(I18N.ui === "zh" ? "en" : "zh");
    renderQuota();
    if (state) rerun();
  });

  /* ---------------- 输入识别 & 性别 ---------------- */
  function detectMode(raw) {
    const s = (raw || "").trim();
    if (/[㐀-鿿]/.test(s)) return "cn";
    if (FOREIGN_RE.test(s.replace(/\s+/g, " "))) return "foreign";
    return null;
  }

  const F_NAMES = new Set(
    ("mary emma olivia ava sophia isabella mia amelia harper evelyn abigail emily ella elizabeth camila luna sofia avery mila aria " +
     "scarlett penelope layla chloe victoria madison eleanor grace nora riley zoey hannah hazel lily ellie violet lillian zoe stella " +
     "aurora natalie emilia everly leah aubrey willow addison lucy audrey bella nova brooklyn paisley savannah claire skylar isla " +
     "naomi elena caroline eliana anna maya valentina ruby ivy ariana aaliyah cora alice hailey gabriella allison gianna samantha " +
     "sarah autumn eva piper sophie sadie delilah josephine adeline lydia clara vivian madeline julia jessica laura maria marie anne " +
     "julie lisa linda susan karen nancy betty helen sandra donna carol ruth sharon michelle kimberly amy angela melissa rebecca " +
     "stephanie kate katie jennifer jenny lena lea léa chloé manon camille inès jade louise zoé lina rose nina giulia chiara " +
     "francesca alessia martina lucia paula carmen ana marta irene sara emilie amélie charlotte margaux juliette hanna lotte femke " +
     "anastasia olga natasha tatiana svetlana ingrid astrid freya elise heidi greta").split(" ")
  );
  const M_ENDING_A = new Set("luca andrea joshua nikita ilya sasha jonah noah elijah ezra mustafa musa isa yahya hamza zakaria dima kosta".split(" "));
  function guessForeignGender(name) {
    const first = name.trim().split(/\s+/)[0].toLowerCase();
    if (F_NAMES.has(first)) return "f";
    if (/a$/.test(first) && !M_ENDING_A.has(first)) return "f";
    return "";
  }

  function guessGender(raw) {
    const mode = detectMode(raw);
    if (mode === "cn") {
      const p = WN.parseName(raw);
      return p.error ? "" : WN.guessGender(p.given);
    }
    if (mode === "foreign") return guessForeignGender(raw);
    return "";
  }

  function setGender(g) {
    gender = g;
    document.querySelectorAll(".gender button").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.g === g)));
  }
  document.querySelectorAll(".gender button").forEach((b) =>
    b.addEventListener("click", () => {
      genderTouched = true;
      setGender(b.dataset.g);
      if (state) rerun();
    })
  );
  $("name").addEventListener("input", () => {
    if (!genderTouched) setGender(guessGender($("name").value) || "m");
  });
  setGender("m");

  /* ---------------- 请求 ---------------- */
  async function api(body, timeout = 30000) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeout);
    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: state.mode, ui: state.ui, name: state.r.full, gender: state.gender, pinyin: state.r.pinyin,
          hant: state.mode === "cn" && WN.isHant(state.r.full), ...body,
        }),
        signal: ctrl.signal,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || data.error) return null;
      return data;
    } catch {
      return null;
    } finally {
      clearTimeout(t);
    }
  }

  function cached(key, fn) {
    try {
      const v = sessionStorage.getItem(key);
      if (v) return Promise.resolve(JSON.parse(v));
    } catch {}
    return fn().then((v) => {
      if (v) try { sessionStorage.setItem(key, JSON.stringify(v)); } catch {}
      return v;
    });
  }

  /* ---------------- 本地兜底（仅中文名模式） ---------------- */
  function localList(k) {
    if (state.mode !== "cn") return [];
    const r = state.r;
    if (r.west[k]) return r.west[k].map((x) => ({ name: x.name, meaning: x.meaning, why: x.why }));
    if (k === "ja") return r.jaStyle.map((x) => ({ name: x.kanji, kana: x.kana, roman: x.romaji, why: x.why }));
    return [];
  }

  // 去掉照搬原名读音的日/韩名（读音已在卡片顶部展示）
  function notDuplicate(k, x) {
    if (state.mode !== "cn") {
      const rd = state.readings[k];
      if (!rd) return true;
      const given = rd.text.split(/[・·\s]/)[0];
      return x.name !== given && x.name !== rd.text;
    }
    const r = state.r;
    if (k === "ko") return x.name !== r.ko.hangul.split(" ").pop();
    if (k === "ja") return x.name !== r.ja.kanji.split(" ").pop() && x.name !== r.given;
    return true;
  }

  /* ---------------- 主流程 ---------------- */
  $("form").addEventListener("submit", (e) => {
    e.preventDefault();
    const v = $("name").value;
    // 对着别人分享的名字再点一次“生成”，不算用掉自己的免费次数
    run(v, false, { shared: !!state?.shared && nameKey(v) === nameKey(state.r.full) });
  });

  function showError(msg) {
    $("error").hidden = !msg;
    $("error").textContent = msg || "";
  }

  function buildSubject(raw, mode) {
    if (mode === "cn") {
      const r = WN.analyze(raw, gender);
      if (r.error) {
        const bad = r.error.match(/：(.+)$/);
        return { error: r.error.startsWith("暂不支持") && bad ? T("errChar", bad[1]) : T("errChinese") };
      }
      return r;
    }
    const full = raw.trim().replace(/\s+/g, " ");
    const parts = full.split(" ");
    return { full, pinyin: "", given: parts[0], surnameLatin: parts.length > 1 ? parts[parts.length - 1] : "" };
  }

  // 切语言/性别时重跑当前名字：如果当前是别人分享的名字，继续不消耗额度
  function rerun() {
    const v = $("name").value;
    run(v, true, { shared: !!state?.shared && nameKey(v) === nameKey(state.r.full) });
  }

  function run(raw, keepScroll, opts = {}) {
    const mode = detectMode(raw);
    if (!mode) return showError(T("errInput"));
    const r = buildSubject(raw, mode);
    if (r.error) return showError(r.error);
    showError("");
    if (!opts.shared) {
      if (!canGenerate(r.full)) return showPaywall("generate");
      useGenerate(r.full);
      renderQuota();
    }

    const id = ++runId;
    const M = MODES[mode];
    state = { mode, ui: I18N.ui, r, gender, comment: "", readings: {}, mods: {}, shared: !!opts.shared };
    for (const k of M.list) state.mods[k] = { list: [], idx: 0, status: "loading", src: "", busy: false, exhausted: false };
    history.replaceState(null, "", `?n=${encodeURIComponent(r.full)}&g=${gender}`);

    $("result").hidden = false;
    $("heroName").textContent = r.full;
    $("heroName").className = mode === "foreign" ? "nc-name latin" : "nc-name";
    $("heroPy").textContent = mode === "foreign" ? T("heroSubForeign") : r.pinyin;
    $("comment").textContent = "";
    $("comment").dataset.wait = T("commentWait");
    $("cards").innerHTML = M.list
      .map((k) => `<article class="card" id="card-${k}" style="--c:${COUNTRIES[k].color}"></article>`)
      .join("");
    M.list.forEach((k) => renderCard(k));
    renderProgress();
    if (!keepScroll) setTimeout(() => $("result").scrollIntoView({ behavior: "smooth" }), 60);

    M.groups.forEach((langs, gi) => {
      const key = `wn4:list:${mode}|${state.ui}|${r.full}|${gender}|${gi}`;
      cached(key, () => api({ action: "list", langs, withComment: gi === 0 })).then((data) => {
        if (id !== runId) return;
        if (data?.comment) {
          state.comment = data.comment;
          $("comment").textContent = data.comment;
        }
        if (data?.reading) Object.assign(state.readings, data.reading);
        langs.forEach((k, i) => {
          const m = state.mods[k];
          const ai = (data?.[k] || []).filter((x) => notDuplicate(k, x));
          const local = localList(k);
          if (ai.length) {
            const seen = new Set(ai.map((x) => x.name.toLowerCase()));
            m.list = [...ai, ...local.filter((x) => !seen.has(x.name.toLowerCase()))];
            m.src = "ai";
            m.status = "ready";
          } else if (local.length) {
            m.list = local;
            m.src = "local";
            m.status = "ready";
          } else {
            m.status = "error";
          }
          setTimeout(() => renderCard(k, true), i * 120);
        });
        renderProgress();
      });
    });
  }

  function renderProgress() {
    const list = MODES[state.mode].list;
    const done = list.filter((k) => state.mods[k].status !== "loading").length;
    $("progress").innerHTML =
      done < list.length
        ? `<span>${T("progress", done, list.length)}</span><span class="bar"><b style="width:${(done / list.length) * 100}%"></b></span>`
        : `<span>${T("ready", list.length)}</span>`;
    if (done === list.length && !state.comment) $("comment").textContent = T("fallbackComment");
  }

  /* ---------------- 卡片渲染 ---------------- */
  const current = (k) => {
    const m = state.mods[k];
    return m.list[m.idx] || null;
  };

  function nameClass(k) {
    const s = COUNTRIES[k].script;
    return s === "cjk" ? "nm cjk" : s === "other" ? "nm other" : "nm";
  }

  function subLine(k, x) {
    if (k === "ja") return [x.kana, x.roman].filter(Boolean).join(" · ");
    if (k === "ko") return [x.hanja, x.roman].filter(Boolean).join(" · ");
    return x.roman || "";
  }

  function speakText(k, x) {
    if (k === "ja") return x.kana || x.name;
    if (k === "zh") return x.name.replace(/·/g, "");
    return x.name;
  }

  function surnameFor(k) {
    return LATIN_LANGS.has(k) && state.r.surnameLatin ? state.r.surnameLatin : "";
  }

  function readingBlock(k) {
    if (!["ja", "ko", "zh"].includes(k)) return "";
    const label = T("readingIn", I18N.country(k).name);
    let main, sub, say;
    if (state.mode === "cn") {
      const r = state.r;
      if (k === "ja") [main, sub, say] = [r.ja.kanji, `${r.ja.kana} · ${r.ja.romaji}`, r.ja.speak];
      else [main, sub, say] = [r.ko.hangul, r.ko.romaji, r.ko.speak];
    } else {
      const rd = state.readings[k];
      if (!rd) return "";
      [main, sub, say] = [rd.text, rd.roman, rd.text.replace(/·/g, "")];
    }
    return `<div class="reading"><div><div class="rl">${esc(label)}</div><span class="rv">${esc(main)}</span>
      <span class="rs">${esc(sub)}</span></div>
      <button class="speak" data-act="say" data-text="${esc(say)}" data-lang="${COUNTRIES[k].tts}" aria-label="play">${ICON.speak}</button></div>`;
  }

  function actions(k, x, m) {
    return `<div class="card-actions">
      <button class="icon-btn" data-act="say" data-text="${esc(speakText(k, x))}" data-lang="${COUNTRIES[k].tts}" aria-label="play">${ICON.speak}</button>
      <button class="pill-btn ${m.busy ? "busy" : ""}" data-act="shuffle">${ICON.shuffle}${m.busy ? T("thinking") : T("shuffle")}<span class="left">${shufflesLeft()}</span></button>
      <button class="pill-btn solid" data-act="detail">${T("detail")} ${ICON.arrow}</button>
    </div>`;
  }

  function renderCard(k, reveal) {
    const el = $(`card-${k}`);
    if (!el) return;
    const c = COUNTRIES[k];
    const ct = I18N.country(k);
    const m = state.mods[k];
    const head = `<header class="card-top"><span class="flag">${c.flag}</span>
      <div><div class="ct-name">${esc(ct.name)}</div><div class="ct-area">${esc(ct.area)}</div></div>
      ${m.status === "ready" ? `<span class="badge">${m.src === "ai" ? T("badgeAI") : T("badgeLocal")}</span>` : ""}</header>`;
    let body = "";

    if (m.status === "loading") {
      body = `<div class="card-body" style="cursor:default"><div class="sk h1"></div><div class="sk l"></div><div class="sk l s"></div></div>
        <div class="card-actions"><span class="count">${T("aiWorking")}</span></div>`;
    } else if (m.status === "error") {
      body = `<div class="card-msg">${T("cardFail")}<br/><button class="pill-btn" data-act="retry">${ICON.shuffle}${T("retry")}</button></div>`;
    } else {
      const x = current(k);
      const sur = surnameFor(k) ? `<span class="sur">${esc(surnameFor(k))}</span>` : "";
      const sub = subLine(k, x);
      const style =
        k === "zh" ? `<div class="eyebrow">${esc(T("yourChinese"))}</div>`
        : k === "ja" || k === "ko" ? `<div class="eyebrow">${esc(T("bornIn", ct.name))}</div>` : "";
      body = `<div class="card-body" data-act="detail" role="button" tabindex="0">
          ${style}
          <div class="nm-row"><span class="${nameClass(k)}" dir="auto">${esc(x.name)}</span>${sur}</div>
          ${sub ? `<div class="roman">${esc(sub)}</div>` : ""}
          ${x.read ? `<span class="read-pill">${esc(T("say", x.read))}</span>` : ""}
          ${x.meaning ? `<p class="mean">${esc(x.meaning)}</p>` : ""}
          ${x.why ? `<p class="why">${esc(x.why)}</p>` : ""}
        </div>${actions(k, x, m)}`;
    }
    el.innerHTML = head + (m.status === "ready" || state.mode === "cn" ? readingBlock(k) : "") + body;
    el.dataset.k = k;
    if (reveal) {
      el.classList.remove("reveal");
      void el.offsetWidth;
      el.classList.add("reveal");
    }
  }

  /* ---------------- 换一个 ---------------- */
  async function shuffle(k) {
    const m = state.mods[k];
    if (m.busy || m.status !== "ready") return;
    if (shufflesLeft() <= 0) return showPaywall("shuffle");
    quota.shuffles++;
    saveQuota();
    renderQuota();
    if (m.idx + 1 < m.list.length) {
      m.idx++;
      return afterShuffle(k);
    }
    if (m.exhausted) {
      m.idx = 0;
      toast(T("toastCycle"));
      return afterShuffle(k);
    }
    m.busy = true;
    renderCard(k);
    syncSheetBusy(k, true);
    const id = runId;
    const data = await api({ action: "more", lang: k, exclude: m.list.map((x) => x.name) });
    if (id !== runId) return;
    m.busy = false;
    syncSheetBusy(k, false);
    const fresh = (data?.[k] || []).filter((x) => notDuplicate(k, x));
    if (fresh.length) {
      m.list.push(...fresh);
      m.src = "ai";
      m.idx++;
    } else {
      m.exhausted = true;
      m.idx = 0;
      toast(T("toastNoMore"));
    }
    afterShuffle(k);
  }

  function afterShuffle(k) {
    renderCard(k, true);
    if (sheetLang === k) openDetail(k);
  }

  /* ---------------- 卡片事件 ---------------- */
  $("cards").addEventListener("click", (e) => {
    const t = e.target.closest("[data-act]");
    if (!t) return;
    const k = t.closest(".card")?.dataset.k;
    const act = t.dataset.act;
    if (act === "say") return speak(t.dataset.text, t.dataset.lang);
    if (act === "shuffle") return shuffle(k);
    if (act === "detail") return openDetail(k);
    if (act === "retry") return retry(k);
  });
  $("cards").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.matches(".card-body")) openDetail(e.target.closest(".card").dataset.k);
  });

  async function retry(k) {
    const m = state.mods[k];
    m.status = "loading";
    renderCard(k);
    const data = await api({ action: "list", langs: [k] });
    if (data?.reading) Object.assign(state.readings, data.reading);
    const ai = (data?.[k] || []).filter((x) => notDuplicate(k, x));
    if (ai.length) Object.assign(m, { list: ai, idx: 0, src: "ai", status: "ready" });
    else m.status = "error";
    renderCard(k, true);
    renderProgress();
  }

  /* ---------------- 发音 ----------------
   * 浏览器自带语音质量参差：Mac 上有一批怪声音（Eddy、Grandma、Bubbles…），
   * 且语音列表是异步加载的。这里等列表加载完，再按质量给同语言的声音打分选最好的。
   */
  const synth = window.speechSynthesis;
  let voices = [];
  const loadVoices = () => (voices = synth ? synth.getVoices() : []);
  if (synth) {
    loadVoices();
    if (synth.addEventListener) synth.addEventListener("voiceschanged", loadVoices);
    else synth.onvoiceschanged = loadVoices;
  }
  // 搞怪声音：除非别无选择，否则不用
  const NOVELTY_VOICE = /^(Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Deranged|Good News|Hysterical|Jester|Organ|Superstar|Trinoids|Whisper|Wobble|Zarvox|Fred|Junior|Ralph|Kathy)(\b|\s|\(|$)/i;
  // Mac 的 Eloquence 机器腔：能用但不自然，只在高质量声音不可用时兜底
  const ROBOT_VOICE = /^(Eddy|Flo|Grandma|Grandpa|Reed|Rocko|Sandy|Shelley|奶奶|爷爷)(\b|\s|\(|$)/i;
  const GREAT_VOICE = /(Google|Premium|Enhanced|Neural|Natural|Siri|Online)/i;
  const GOOD_VOICE = /^(Samantha|Daniel|Karen|Moira|Kyoko|O-Ren|Yuna|Tingting|Ting-Ting|Meijia|Mei-Jia|Lilian|Li-Mu|Yu-shu|Thomas|Amélie|Audrey|Anna|Helena|Mónica|Monica|Paulina|Jorge|Alice|Luca|Federica|Joana|Luciana|Felipe|Xander|Ellen|Milena|Yuri|Kanya|Maged|Majed|Laila)\b/i;

  // 有些声音只是“列”在系统里、实际没下载（如 Mac 上的 Kyoko、Yuna），一读就秒结束没有声音。
  // 检测到后记下来，下次直接跳过。
  // 只记在本次会话里：用户之后下载了这个声音，重新打开页面就会再试
  let brokenSaved = [];
  try { brokenSaved = JSON.parse(sessionStorage.getItem("wn-broken-voices") || "[]"); } catch {}
  const brokenVoices = new Set(brokenSaved);
  const markBroken = (v) => {
    brokenVoices.add(v.voiceURI || v.name);
    try { sessionStorage.setItem("wn-broken-voices", JSON.stringify([...brokenVoices])); } catch {}
  };

  function rankVoices(lang) {
    const want = lang.toLowerCase();
    const base = want.slice(0, 2);
    return voices
      .filter((v) => v.lang.replace("_", "-").toLowerCase().startsWith(base) && !brokenVoices.has(v.voiceURI || v.name))
      .map((v) => {
        let score = v.lang.replace("_", "-").toLowerCase() === want ? 40 : 0;
        if (GREAT_VOICE.test(v.name)) score += 30;
        if (GOOD_VOICE.test(v.name)) score += 20;
        if (ROBOT_VOICE.test(v.name)) score -= /^(Flo|Shelley|Sandy)/i.test(v.name) ? 90 : 100;
        if (NOVELTY_VOICE.test(v.name)) score -= 300;
        return { v, score };
      })
      .sort((a, b) => b.score - a.score)
      .map((x) => x.v);
  }

  // 用指定声音读一遍；返回是否真的发出了声音
  function sayWith(text, lang, voice) {
    return new Promise((resolve) => {
      let done = false;
      const finish = (ok) => { if (!done) { done = true; resolve(ok); } };
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang;
      if (voice) u.voice = voice;
      u.rate = 0.95;
      let started = 0;
      u.onstart = () => (started = performance.now());
      u.onend = () => finish(started > 0 && performance.now() - started > 200);
      u.onerror = (e) => finish(e.error === "interrupted" || e.error === "canceled");
      setTimeout(() => synth.speak(u), 80); // cancel 后立刻 speak 在 Chrome 上偶尔会被吞
      setTimeout(() => finish(true), 8000);
    });
  }

  let speakSeq = 0;
  async function speak(text, lang) {
    if (!synth) return toast(T("toastNoTTS"));
    if (!voices.length) {
      loadVoices();
      if (!voices.length) await new Promise((r) => setTimeout(r, 400)).then(loadVoices);
    }
    const seq = ++speakSeq;
    const candidates = rankVoices(lang).slice(0, 4);
    if (!candidates.length) {
      await sayWith(text, lang, null);
      if (voices.length) toast(T("toastNoVoice"));
      return;
    }
    for (const v of candidates) {
      if (seq !== speakSeq) return; // 用户又点了别的
      const ok = await sayWith(text, lang, v);
      if (ok || seq !== speakSeq) return;
      markBroken(v);
    }
    toast(T("toastNoVoice"));
  }

  /* ---------------- 详解弹窗 ---------------- */
  let sheetLang = null;

  function openDetail(k) {
    const x = current(k);
    if (!x) return;
    const c = COUNTRIES[k];
    const ct = I18N.country(k);
    sheetLang = k;
    const sheet = document.querySelector("#sheet .sheet");
    sheet.style.setProperty("--c", c.color);
    const surname = surnameFor(k);
    const sur = surname ? ` <span style="opacity:.75;font-size:.5em;font-style:italic">${esc(surname)}</span>` : "";
    const sub = subLine(k, x);
    const cls = c.script === "cjk" ? "sh-name cjk" : c.script === "other" ? "sh-name other" : "sh-name";
    $("sheetHero").dataset.mark = x.roman || x.name;
    $("sheetHero").innerHTML = `
      <div class="sh-flag"><span>${c.flag}</span>${esc(ct.name)} · ${esc(ct.area)}</div>
      <div class="${cls}" id="sheetName" dir="auto">${esc(x.name)}${sur}</div>
      <div class="sh-sub">${esc([sub, x.read && T("say", x.read)].filter(Boolean).join(" · "))}</div>
      <div class="sh-say">
        <button class="speak" data-act="say" data-text="${esc(speakText(k, x))}" data-lang="${c.tts}" aria-label="play">${ICON.speak}</button>
        <span class="ipa" id="shIpa" hidden></span><span class="say" id="shSay"></span>
      </div>`;
    $("sheetBody").innerHTML = skeletonDetail();
    $("sheetBody").scrollTop = 0;
    syncSheetBusy(k, state.mods[k].busy);
    $("sheet").hidden = false;
    document.body.style.overflow = "hidden";

    const key = `${state.mode}|${state.ui}|${state.r.full}|${state.gender}|${k}|${x.name}`;
    const load = detailCache.get(key) ||
      cached(`wn4:detail:${key}`, () => api({ action: "detail", lang: k, foreign: x.name, roman: x.roman || x.kana || "" }));
    detailCache.set(key, load);
    load.then((d) => {
      if (sheetLang !== k || current(k) !== x) return;
      if (!d) {
        detailCache.delete(key);
        $("sheetBody").innerHTML = basicDetail(x) + `<p class="sec" style="color:var(--muted)">${T("sheetFail")}</p>`;
        return;
      }
      renderDetail(k, x, d);
    });
  }

  function skeletonDetail() {
    return `<div class="sec"><div class="sk l s" style="width:30%"></div><div class="sk l"></div><div class="sk l"></div></div>
      <div class="sec"><div class="sk l s" style="width:30%"></div><div class="sk l"></div><div class="sk l s"></div></div>
      <div class="duo"><div class="sec"><div class="sk l"></div><div class="sk l s"></div></div><div class="sec"><div class="sk l"></div><div class="sk l s"></div></div></div>
      <p style="text-align:center;color:var(--muted);font-size:13px">${T("sheetLoading")}</p>`;
  }

  function basicDetail(x) {
    return `${x.meaning ? sec(T("secMeaning"), x.meaning) : ""}${x.why ? sec(T("secWhy"), x.why) : ""}`;
  }

  const sec = (title, text) => (text ? `<div class="sec"><h4>${title}</h4><p>${esc(text)}</p></div>` : "");
  const chips = (title, arr) =>
    arr && arr.length ? `<div class="sec"><h4>${title}</h4><div class="chips">${arr.map((s) => `<span class="chip">${esc(s)}</span>`).join("")}</div></div>` : "";

  function renderDetail(k, x, d) {
    if (d.ipa) { $("shIpa").hidden = false; $("shIpa").textContent = `/${d.ipa.replace(/^\/|\/$/g, "")}/`; }
    $("shSay").textContent = d.say || "";
    const charsHtml = d.chars?.length
      ? `<div class="sec"><h4>${T("secChars")}</h4><div class="chars">${d.chars
          .map((c) => `<div class="char"><b>${esc(c.c)}</b><div class="cr">${esc(c.r)}</div><div class="cm">${esc(c.m)}</div></div>`)
          .join("")}</div></div>`
      : "";
    const duo = d.vibe || d.popularity ? `<div class="duo">${sec(T("secVibe"), d.vibe)}${sec(T("secPop"), d.popularity)}</div>` : "";
    $("sheetBody").innerHTML = `
      ${sec(T("secMeaning"), d.meaning || x.meaning)}
      ${charsHtml}
      ${sec(T("secOrigin"), d.origin)}
      ${d.fit ? `<div class="fit"><h4>${T("secFit")}</h4><p>${esc(d.fit)}</p></div>` : ""}
      ${duo}
      ${chips(T("secFamous"), d.famous)}
      ${chips(T("secNick"), d.nicknames)}
      ${sec(T("secTip"), d.tip)}`;
  }

  function syncSheetBusy(k, busy) {
    if (sheetLang !== k) return;
    $("sheetShuffle").textContent = busy ? T("sheetBusy") : T("sheetShuffle");
    $("sheetShuffle").disabled = busy;
  }

  function closeSheet() {
    sheetLang = null;
    $("sheet").hidden = true;
    if ($("modal").hidden) document.body.style.overflow = "";
  }
  $("sheetShuffle").addEventListener("click", () => sheetLang && shuffle(sheetLang));
  $("sheet").addEventListener("click", (e) => {
    if (e.target === $("sheet") || e.target.closest("[data-close]")) return closeSheet();
    const say = e.target.closest("[data-act=say]");
    if (say) speak(say.dataset.text, say.dataset.lang);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!$("sheet").hidden) closeSheet();
    if (!$("modal").hidden) closeModal();
    if (!$("paywall").hidden) closePaywall();
  });

  /* ---------------- 分享长图（Canvas） ---------------- */
  function fitText(ctx, text, maxW) {
    if (ctx.measureText(text).width <= maxW) return text;
    let t = text;
    while (t.length > 1 && ctx.measureText(t + "…").width > maxW) t = t.slice(0, -1);
    return t + "…";
  }
  function roundRect(ctx, x, y, w, h, rad) {
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h, rad);
    ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad);
    ctx.arcTo(x, y, x + w, y, rad);
    ctx.closePath();
  }

  const logoImg = new Image();
  logoImg.src = "assets/logo-512.png";

  /* 简约海报：品牌 → 原名 → 12 国名字网格 → 标语 */
  async function drawCard() {
    await document.fonts?.ready;
    const r = state.r;
    const zhUI = state.ui === "zh";
    const foreign = state.mode === "foreign";
    const list = MODES[state.mode].list;
    const W = 1080, H = 1440, M = 90;
    const cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    const ctx = cv.getContext("2d");
    const CN = '"Noto Serif SC", "Songti SC", serif';
    const LAT = '"Playfair Display", Georgia, serif';
    const SANS = '-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
    const INK = "#1c1814", MUTED = "#9a8f82", LINE = "rgba(60, 40, 20, .12)";
    const spaced = (px) => { if ("letterSpacing" in ctx) ctx.letterSpacing = `${px}px`; };

    // 底色 + 细边框
    ctx.fillStyle = "#f7f2ea"; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = LINE; ctx.lineWidth = 2;
    roundRect(ctx, 36, 36, W - 72, H - 72, 28); ctx.stroke();

    // 顶部：logo + 品牌名（只用当前界面语言）
    if (logoImg?.complete && logoImg.naturalWidth) {
      ctx.save(); roundRect(ctx, M, 84, 44, 44, 11); ctx.clip();
      ctx.drawImage(logoImg, M, 84, 44, 44); ctx.restore();
    }
    ctx.textAlign = "left"; ctx.fillStyle = INK;
    ctx.font = zhUI ? `800 28px ${CN}` : `italic 700 30px ${LAT}`;
    ctx.fillText(T("brand"), M + 58, 116);
    ctx.textAlign = "right"; ctx.fillStyle = MUTED; ctx.font = `600 18px ${SANS}`; spaced(4);
    ctx.fillText(zhUI ? "十二国名字" : "12 COUNTRIES", W - M, 113);
    spaced(0);

    // 中间：原名
    ctx.textAlign = "center"; ctx.fillStyle = INK;
    if (foreign) {
      ctx.font = `700 112px ${LAT}`;
      ctx.fillText(fitText(ctx, r.full, W - 2 * M), W / 2, 330);
    } else {
      ctx.font = `800 140px ${CN}`; spaced(18);
      ctx.fillText(r.full, W / 2 + 9, 340);
      spaced(0);
    }
    ctx.fillStyle = MUTED; ctx.font = `italic 500 36px ${LAT}`;
    ctx.fillText(foreign ? T("heroSubForeign") : r.pinyin, W / 2, 404);
    const bar = ctx.createLinearGradient(W / 2 - 40, 0, W / 2 + 40, 0);
    bar.addColorStop(0, "#d2421a"); bar.addColorStop(1, "#f5a01f");
    ctx.fillStyle = bar; roundRect(ctx, W / 2 - 40, 446, 80, 6, 3); ctx.fill();

    // 网格：3 列 × 4 行，每格只放国家名 + 名字（非拉丁文字加一行拼写）
    const cols = 3, top = 530, colW = (W - 2 * M) / cols, rowH = 186;
    list.slice(0, 12).forEach((k, i) => {
      const c = COUNTRIES[k];
      const x = current(k);
      const cx = M + (i % cols) * colW + 18;
      const cy = top + Math.floor(i / cols) * rowH;
      ctx.textAlign = "left";
      ctx.fillStyle = c.color; ctx.beginPath(); ctx.arc(cx + 5, cy - 7, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = MUTED; ctx.font = `600 20px ${SANS}`; spaced(zhUI ? 2 : 1.5);
      ctx.fillText(zhUI ? I18N.country(k).name : I18N.country(k).name.toUpperCase(), cx + 18, cy);
      spaced(0);
      if (!x) return;
      ctx.fillStyle = INK;
      ctx.font = c.script === "cjk" ? `800 46px ${CN}` : c.script === "other" ? `700 42px ${SANS}` : `700 44px ${LAT}`;
      if (k === "ar") ctx.direction = "rtl"; // 从右往左书写，但整体和同列对齐（左边缘对齐）
      ctx.fillText(fitText(ctx, x.name, colW - 40), cx, cy + 62);
      ctx.direction = "ltr"; ctx.textAlign = "left";
      const roman = LATIN_LANGS.has(k) ? "" : (k === "ja" ? x.roman || x.kana : x.roman) || "";
      if (roman) {
        ctx.textAlign = "left"; ctx.fillStyle = MUTED; ctx.font = `italic 500 22px ${LAT}`;
        ctx.fillText(fitText(ctx, roman, colW - 40), cx, cy + 100);
      }
    });

    // 底部：分隔线 + 标语 + 网址
    ctx.strokeStyle = LINE; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(M, H - 150); ctx.lineTo(W - M, H - 150); ctx.stroke();
    ctx.textAlign = "left"; ctx.fillStyle = INK; ctx.font = zhUI ? `700 26px ${CN}` : `italic 600 28px ${LAT}`;
    ctx.fillText(T("shareTagline"), M, H - 92);
    ctx.textAlign = "right"; ctx.fillStyle = "#d2421a"; ctx.font = `600 24px ${SANS}`;
    ctx.fillText(SITE, W - M, H - 92);
    return cv.toDataURL("image/png");
  }

  $("shareBtn").addEventListener("click", async () => {
    const pending = MODES[state.mode].list.filter((k) => state.mods[k].status === "loading").length;
    if (pending) toast(T("toastPending", pending));
    const url = await drawCard();
    $("cardImg").src = url;
    $("downloadBtn").href = url;
    $("downloadBtn").download = T("fileName", state.r.full);
    $("modal").hidden = false;
    document.body.style.overflow = "hidden";
  });
  function closeModal() {
    $("modal").hidden = true;
    if ($("sheet").hidden) document.body.style.overflow = "";
  }
  $("modal").addEventListener("click", (e) => {
    if (e.target === $("modal") || e.target.closest("[data-close]")) closeModal();
  });

  $("copyBtn").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      toast(T("toastCopied"));
    } catch {
      toast(T("toastCopyFail"));
    }
  });
  $("againBtn").addEventListener("click", () => {
    $("name").value = "";
    window.scrollTo({ top: 0, behavior: "smooth" });
    setTimeout(() => $("name").focus(), 400);
  });

  $("paywall").addEventListener("click", (e) => {
    if (e.target === $("paywall") || e.target.closest("[data-close]")) closePaywall();
  });
  renderQuota();

  let toastTimer;
  function toast(msg) {
    $("toast").textContent = msg;
    $("toast").hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ($("toast").hidden = true), 2200);
  }

  /* ---------------- 分享链接直达 ---------------- */
  const q = new URLSearchParams(location.search);
  if (q.get("n")) {
    $("name").value = q.get("n");
    if (q.get("g") === "f" || q.get("g") === "m") {
      genderTouched = true;
      setGender(q.get("g"));
    } else {
      setGender(guessGender(q.get("n")) || "m");
    }
    run(q.get("n"), true, { shared: true });
  }
})();
