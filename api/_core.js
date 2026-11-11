/*
 * 大模型起名核心逻辑（OpenAI 兼容接口，国产模型改环境变量即可切换）
 *
 *   LLM_BASE_URL   例：https://api.deepseek.com
 *   LLM_API_KEY    你的 key（只放服务端，绝不下发到前端）
 *   LLM_MODEL      例：deepseek-flash / glm-4-flash / qwen-flash
 *   LLM_EXTRA_BODY 可选，合并进请求体的 JSON，如 DeepSeek 关思考：{"thinking":{"type":"disabled"}}
 *   LLM_JSON_MODE  1（默认）= 请求 JSON 模式；接口不支持时会自动降级
 *   DAILY_LIMIT    单实例每日最多调用次数，防止被刷爆账单（默认 5000）
 *
 * 请求（POST /api/names）：
 *   mode   cn = 中文名 → 外文名；foreign = 外文名（如 Emily Johnson）→ 中文名 + 各国叫法
 *   ui     zh / en：说明文字用哪种语言输出
 *   action list   为若干语言各起 3 个名字（前端分 4 组并行请求）
 *          more   某个语言“换一个”，排除已出现过的名字
 *          detail 某个名字的详细解析（点开弹窗时才请求）
 */
"use strict";

/* ---------------- 13 种语言（中文只在 foreign 模式用） ---------------- */
const LANGS = {
  zh: {
    label: "中文",
    script: "zh",
    note: "3 个地道的中文名，姓在前、名在后，共 2–3 个字，像中国人的真名：姓氏取自原姓的发音（如 Johnson→江/钟）；如果原姓本身就是中文姓的拼写（如 Huang、Chen、Lee、Wong），直接用对应的中文姓（黄、陈、李、王）。名取原名的发音或含义，雅致、常用、不生僻、避开不雅谐音。不要给“詹森·黄”这类带间隔号的音译名（音译放在 reading.zh）。roman 写带声调的拼音（如 Jiāng Měilín）",
  },
  en: { label: "英语（英美澳加通用）", script: "latin" },
  fr: { label: "法语", script: "latin" },
  de: { label: "德语", script: "latin" },
  es: { label: "西班牙语（西班牙及拉美通用）", script: "latin" },
  it: { label: "意大利语", script: "latin" },
  pt: { label: "葡萄牙语（葡萄牙/巴西通用）", script: "latin" },
  nl: { label: "荷兰语", script: "latin" },
  ru: { label: "俄语", script: "cyrillic", note: "name 用西里尔字母书写，roman 给常用拉丁转写" },
  ar: { label: "阿拉伯语", script: "arabic", note: "name 用阿拉伯字母书写，roman 给常用拉丁拼写" },
  th: { label: "泰语", script: "thai", note: "name 用泰文书写，roman 用皇家泰语转写；给泰国人日常常用的名字" },
  ja: {
    label: "日语",
    script: "ja",
    note: "日本真实常见人名，只给名不带姓，禁止用普通词语（如 偉人、英雄、美人）当名字；name 写日本汉字字形（如 偉、沢、桜，不要用简体字 伟、泽、樱），kana 写该名字的平假名读法，roman 用赫本式；优先与原名共用汉字或寓意/发音相近，但不要照搬原名的音读",
  },
  ko: {
    label: "韩语",
    script: "ko",
    note: "韩国真实常见人名，只给名不带姓，通常两个音节（如 지훈、서연、민준）；name 写韩文，hanja 写逐字对应的汉字，roman 用 RR 拼写；禁止用普通名词（如 겨울、새벽、위대）当名字，不要照搬原名的韩文汉字音，避开不雅谐音",
  },
};

const OUT_LANG = { zh: "简体中文", zht: "繁體中文（台灣、香港用字）", en: "English" };

const CN_RULES = `你是精通多国语言与命名文化的起名顾问，为中国用户起外文名。
规则：
1. 每种语言给 3 个名字。最重要：必须是该国人真实在用、比较常见的“人名”，当地人一听就知道是名字；用正确拼写（含重音符号）。
   严禁把普通单词当名字（如 Schnee、Blume、Neige、Maggio、Valiente、Morgen）。想表达某个意象，就选本身有这个含义的真实人名（雪→Nieves、Neve、Blanche；花→Flora、Fiorella；黎明→Aurora、Alba、Dawn）。
2. 3 个名字里尽量有 1 个与“名”的第一个字发音真的相近（声母、韵母都接近），1 个与汉字寓意呼应；不像就别硬凑，不要拿“姓”去谐音。
3. 不同语言的第一个名字不要全是同一个名字的各国变体，让每种语言各有特色。
4. 名字必须符合性别（m=男，f=女）。`;

const FOREIGN_RULES = `你是精通多国语言与命名文化的起名顾问。用户是外国人，请告诉 TA 自己的名字在各个国家怎么叫，并给 TA 起中文名。
规则：
1. 每种语言给 3 个名字。优先给原名在当地的同源形式（如 Emily → Émilie、Emilia、Эмилия、エミリ），第 1 个最对应；当地没有同源形式时，给发音或含义相近、当地真实常见的人名。若原名本身就是该语言的名字，第 1 个就是原名。
2. 必须是当地真实在用的人名，用正确拼写（含重音符号）；严禁把普通单词当名字。
3. 名字必须符合性别（m=男，f=女）。只处理名（given name），姓保持原样，不要翻译。`;

const FIELD_RULES = (ui) => `字段：
   name：名字本身（该语言的文字）
   roman：非拉丁文字时的拉丁转写（中文写带声调拼音），拉丁文字的语言留空
   kana：仅日语，平假名读法
   hanja：仅韩语，对应汉字
   read：${ui === "en" ? "英文发音提示，用大写标重音（如 eh-MEE-lee）；中文名留空" : "该名字常用的中文译名或近似读音（如 Wade→韦德）；中文名留空"}
   meaning：名字真实的含义，${ui === "en" ? "不超过 8 个英文单词" : "不超过 14 个字"}，不要编造
   why：为什么适合这个人，${ui === "en" ? "不超过 14 个英文单词" : "不超过 24 个字"}，具体到哪个音或哪层意思；没有关联就只说寓意，不要牵强附会
所有说明文字（meaning、why、comment，以及 read 里的中文译名）用${OUT_LANG[ui]}写。只输出 JSON，不要任何其他文字。`;

const DETAIL_RULES = (ui) => `你是精通多国语言与命名文化的起名顾问。用户已选定一个名字，请做一份有趣、具体、可信的名字解析。
要求：所有事实必须真实，不确定的内容宁可留空，不要编造；语气亲切，像朋友在介绍。所有说明文字用${OUT_LANG[ui]}写。
字段（只输出 JSON，不要其他文字）：
{
 "ipa": "国际音标",
 "say": "${ui === "en" ? "英文读音提示并说明重音，如 eh-MEE-lee (stress on MEE)" : "用中文汉字标注的读法，并说明重音，如：韦-德（重音在“韦”）"}",
 "meaning": "名字的详细含义，${ui === "en" ? "30–60 个英文单词" : "40–70 字"}",
 "origin": "词源和演变：来自哪种语言、哪个原词、怎么流传开，${ui === "en" ? "30–60 个英文单词" : "40–70 字"}",
 "vibe": "这个名字给当地人的印象和性格联想，${ui === "en" ? "15–30 个英文单词" : "20–40 字"}",
 "popularity": "在当地的流行程度和年代感，${ui === "en" ? "15–30 个英文单词" : "20–40 字"}",
 "famous": ["你确定真实存在的知名人物，格式：姓名（一句话身份），最多 3 个，没有就空数组"],
 "nicknames": ["常用昵称或爱称，最多 4 个，没有就空数组"],
 "chars": [{"c":"字","r":"读音","m":"含义"}],
 "fit": "这个名字和用户原名的缘分：结合原名的发音或含义来讲，${ui === "en" ? "30–60 个英文单词" : "40–70 字"}",
 "tip": "使用小贴士，比如书写、发音易错点或文化注意事项，${ui === "en" ? "15–30 个英文单词" : "20–40 字"}"
}
chars 只在中文、日语、韩语名字时填写（逐字讲解：c=汉字，r=读音（中文用带声调拼音），m=含义），其他语言给空数组。`;

/* ---------------- 缓存与限流（单实例内存；上量后可换成 Redis/KV） ---------------- */
const cache = new Map();
const CACHE_MAX = 5000;
function cacheGet(k) {
  const v = cache.get(k);
  if (v) { cache.delete(k); cache.set(k, v); }
  return v;
}
function cacheSet(k, v) {
  cache.set(k, v);
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
}

const hits = new Map(); // ip -> [timestamps]
function rateLimited(ip, perMinute = 40) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 10_000) hits.clear();
  return arr.length > perMinute;
}

let day = "", dayCount = 0;
function overDailyLimit() {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== day) { day = today; dayCount = 0; }
  return ++dayCount > Number(process.env.DAILY_LIMIT || 5000);
}

/* ---------------- 输出清洗：只放行预期字段，防止模型乱输出 ---------------- */
const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const SCRIPT_RE = {
  latin: /^[\p{Script=Latin}][\p{Script=Latin}' -]{0,24}$/u,
  cyrillic: /^[\p{Script=Cyrillic}][\p{Script=Cyrillic}' -]{0,24}$/u,
  arabic: /^[\p{Script=Arabic}][\p{Script=Arabic}\s]{0,24}$/u,
  thai: /^[\p{Script=Thai}][\p{Script=Thai}\s]{0,24}$/u,
  ja: /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}々]{1,5}$/u,
  ko: /^[가-힣]{1,3}$/,
  zh: /^[一-鿿]{2,4}$/,
};
const ROMAN_RE = /^[\p{Script=Latin}][\p{Script=Latin}\p{M}' ·-]{0,40}$/u;
const FOREIGN_NAME_RE = /^[\p{Script=Latin}][\p{Script=Latin}\p{M}' .-]{1,39}$/u;

// 模型偶尔会把普通单词当人名，命中即丢弃
const NOT_NAMES = new Set(
  ("neige schnee schneewittchen schneeweiss schneeweiß blume edelweiss edelweiß fleur maggio mayo mai valiente morgen nieve " +
   "sonne mond stern lune etoile étoile soleil primavera invierno inverno hiver winter sommer sneeuw bloem vaillant valente valiant").split(" ")
);
// 韩语里含义不好或明显是普通名词的
const KO_BAD = new Set("사기 위대 겨울 새벽 사망 지옥 바보 도둑 범죄 시체 사고 망신".split(" "));
// 日语里是普通词、不是人名的
const JA_BAD = new Set("偉人 偉大 英雄 天才 美人 雪花 梅花 大人 先生 太陽 月光 星空".split(" "));

function cleanItem(x, lang, ui) {
  const L = LANGS[lang];
  const f = ui === "en" ? 3 : 1; // 英文说明更长
  const it = {
    name: str(x?.name, 26),
    roman: str(x?.roman, 40),
    read: str(x?.read, 14 * (ui === "en" ? 2 : 1)),
    meaning: str(x?.meaning, 24 * f),
    why: str(x?.why, 36 * f),
  };
  if (lang === "ja") it.kana = str(x?.kana, 14);
  if (lang === "ko") {
    it.hanja = str(x?.hanja, 4);
    if ([...it.hanja].length !== [...it.name].length) it.hanja = ""; // 汉字与韩文逐字对不上就不显示
  }
  if (lang === "zh" || lang === "ja" || lang === "ko") it.read = ""; // 已有拼音/假名/韩文罗马字，不需要读音提示
  if (!SCRIPT_RE[L.script].test(it.name)) return null;
  if (L.script === "latin") it.roman = "";
  else if (!ROMAN_RE.test(it.roman)) return null;
  if (NOT_NAMES.has(it.name.toLowerCase())) return null;
  if (lang === "ko" && KO_BAD.has(it.name)) return null;
  if (lang === "ja" && JA_BAD.has(it.name)) return null;
  if (/不选|慎用|罕见|不常用|少用|改用|rarely used|not recommended/i.test(it.why + it.meaning)) return null; // 模型自己都不推荐的
  return it;
}

function cleanReading(r, script) {
  const text = str(r?.text, 30);
  const roman = str(r?.roman, 40);
  const re = { ja: /^[゠-ヿ・\s]+$/, ko: /^[가-힣\s]+$/, zh: /^[一-鿿·]+$/ }[script];
  return re.test(text) ? { text, roman: ROMAN_RE.test(roman) ? roman : "" } : null;
}

function cleanList(raw, langs, ui, exclude = [], limit = 3) {
  const seen = new Set(exclude.map((s) => s.toLowerCase()));
  const out = {};
  for (const k of langs) {
    out[k] = [];
    for (const x of Array.isArray(raw[k]) ? raw[k] : []) {
      const it = cleanItem(x, k, ui);
      if (it && !seen.has(it.name.toLowerCase())) {
        seen.add(it.name.toLowerCase());
        out[k].push(it);
      }
      if (out[k].length >= limit) break;
    }
  }
  if (raw.reading && typeof raw.reading === "object") {
    const reading = {};
    if (langs.includes("ja")) reading.ja = cleanReading(raw.reading.ja, "ja");
    if (langs.includes("ko")) reading.ko = cleanReading(raw.reading.ko, "ko");
    if (langs.includes("zh")) reading.zh = cleanReading(raw.reading.zh, "zh");
    out.reading = reading;
  }
  if (typeof raw.comment === "string") out.comment = str(raw.comment, ui === "en" ? 110 : 40);
  return out;
}

function cleanDetail(raw, ui) {
  const f = ui === "en" ? 4 : 1;
  const arr = (v, n, max) => (Array.isArray(v) ? v.map((s) => str(s, max)).filter(Boolean).slice(0, n) : []);
  return {
    ipa: str(raw.ipa, 40),
    say: str(raw.say, 40 * (ui === "en" ? 4 : 1)),
    meaning: str(raw.meaning, 120 * f),
    origin: str(raw.origin, 120 * f),
    vibe: str(raw.vibe, 70 * f),
    popularity: str(raw.popularity, 70 * f),
    famous: arr(raw.famous, 3, 40 * (ui === "en" ? 2 : 1)),
    nicknames: arr(raw.nicknames, 4, 16),
    chars: (Array.isArray(raw.chars) ? raw.chars : [])
      .map((c) => ({ c: str(c?.c, 2), r: str(c?.r, 12), m: str(c?.m, 24 * f) }))
      .filter((c) => c.c)
      .slice(0, 6),
    fit: str(raw.fit, 120 * f),
    tip: str(raw.tip, 70 * f),
  };
}

function extractJson(text) {
  const t = String(text || "").replace(/<think>[\s\S]*?<\/think>/g, "");
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a < 0 || b <= a) throw new Error("模型没有返回 JSON");
  return JSON.parse(t.slice(a, b + 1));
}

/* ---------------- 调用模型 ---------------- */
async function callLLM(system, user, maxTokens, temperature = 0.9) {
  const base = (process.env.LLM_BASE_URL || "https://api.deepseek.com").replace(/\/+$/, "");
  const key = process.env.LLM_API_KEY;
  if (!key) throw Object.assign(new Error("未配置 LLM_API_KEY"), { status: 503 });

  let extra = {};
  try { extra = JSON.parse(process.env.LLM_EXTRA_BODY || "{}"); } catch { console.error("[names] LLM_EXTRA_BODY 不是合法 JSON"); }
  const body = {
    ...extra,
    model: process.env.LLM_MODEL || "deepseek-flash",
    temperature,
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  };
  const jsonMode = process.env.LLM_JSON_MODE !== "0";

  const post = async (withJson) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), Number(process.env.LLM_TIMEOUT_MS || 25_000));
    try {
      return await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify(withJson ? { ...body, response_format: { type: "json_object" } } : body),
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  };

  let res = await post(jsonMode);
  if (res.status === 400 && jsonMode) res = await post(false); // 部分模型不支持 JSON 模式
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300);
    throw Object.assign(new Error(`模型接口错误 ${res.status}: ${detail}`), { status: 502 });
  }
  const data = await res.json();
  const u = data?.usage;
  if (u) console.log(`[names] tokens in=${u.prompt_tokens} out=${u.completion_tokens} cache_hit=${u.prompt_cache_hit_tokens ?? "-"}`);
  return data?.choices?.[0]?.message?.content || "";
}

// 调用 + 解析，解析失败重试一次
async function ask(system, user, maxTokens, parse, temperature) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const text = await callLLM(system, user, maxTokens, temperature);
    try {
      return parse(extractJson(text));
    } catch (e) {
      console.error("[names] 解析失败", e.message);
    }
  }
  return null;
}

/* ---------------- 提示词拼装 ---------------- */
function itemSchema(lang) {
  const f = ['"name":""'];
  if (LANGS[lang].script !== "latin") f.push('"roman":""');
  if (lang === "ja") f.push('"kana":""');
  if (lang === "ko") f.push('"hanja":""');
  if (!["zh", "ja", "ko"].includes(lang)) f.push('"read":""');
  f.push('"meaning":""', '"why":""');
  return `{${f.join(",")}}`;
}

function who(base) {
  return base.mode === "foreign"
    ? `用户原名：${base.name}（外国人），性别：${base.gender}`
    : `用户中文名：${base.name}${base.pinyin ? `（${base.pinyin}）` : ""}，性别：${base.gender}`;
}

function listPrompt(base, { langs, exclude, withComment }) {
  const foreign = base.mode === "foreign";
  const RD = ["zh", "ja", "ko"];
  const needReading = foreign && langs.some((k) => RD.includes(k));
  const notes = langs
    .filter((k) => LANGS[k].note)
    .map((k) => `- ${k}（${LANGS[k].label}）：${LANGS[k].note}`)
    .join("\n");
  const readingSchema = needReading
    ? `,"reading":{${langs.filter((k) => RD.includes(k)).map((k) => `"${k}":{"text":"","roman":""}`).join(",")}}`
    : "";
  const schema = `{${langs.map((k) => `"${k}":[${itemSchema(k)}]`).join(",")}${readingSchema}${withComment ? ',"comment":""' : ""}}`;
  return [
    who(base),
    `语言：${langs.map((k) => `${k}=${LANGS[k].label}`).join("，")}`,
    notes && `语言说明：\n${notes}`,
    needReading ? "reading：原名（名+姓）在当地的标准音译——zh 按新华社译名规范写“名·姓”（如 艾米莉·约翰逊），roman 为带声调拼音；ja 用片假名，名和姓之间用・；ko 用韩文，名和姓之间空格；roman 为对应拉丁转写。" : "",
    exclude?.length
      ? `这次每种语言给 5 个全新的名字：必须和下面这些已经出现过的名字都不同，也不要只改一个字或只换同音字，要换思路（换寓意、换发音角度）：${exclude.join("、")}`
      : "",
    withComment
      ? `另外 comment 用${OUT_LANG[base.out]}写一句俏皮、正面的点评（${base.ui === "en" ? "不超过 16 个英文单词" : "不超过 24 个字"}），点评的是用户输入的原名“${base.name}”本身：必须原样写出“${base.name}”来称呼用户，不要用你起的任何名字（中文名或外文名）称呼用户，也不要罗列你起的名字或它们的寓意；不要拿名字常见或土开玩笑。`
      : "",
    `输出格式：${schema}`,
  ].filter(Boolean).join("\n");
}

/* ---------------- 对外：处理一次请求 ---------------- */
function readInput(input) {
  const mode = input?.mode === "foreign" ? "foreign" : "cn";
  const ui = input?.ui === "en" ? "en" : "zh";
  const gender = input?.gender === "f" ? "f" : "m";
  if (mode === "foreign") {
    const name = String(input?.name || "").trim().replace(/\s+/g, " ");
    if (!FOREIGN_NAME_RE.test(name)) return null;
    return { mode, ui, out: ui, gender, name, pinyin: "" };
  }
  const name = String(input?.name || "").replace(/\s/g, "");
  if (!/^[㐀-鿿]{2,5}$/.test(name)) return null;
  const hant = ui === "zh" && !!input?.hant;
  return { mode, ui, out: hant ? "zht" : ui, gender, name, pinyin: str(input?.pinyin, 40) };
}

async function generate(input, ip = "unknown") {
  const base = readInput(input);
  if (!base) return { status: 400, body: { error: "bad name" } };
  const action = ["list", "more", "detail"].includes(input?.action) ? input.action : "list";
  const rules = (base.mode === "foreign" ? FOREIGN_RULES : CN_RULES) + "\n" + FIELD_RULES(base.out);
  const ck = `${base.mode}|${base.out}|${base.name.toLowerCase()}|${base.gender}`;
  const allowed = (k) => LANGS[k] && (k !== "zh" || base.mode === "foreign");

  let key, run;
  if (action === "list") {
    const langs = (Array.isArray(input.langs) ? input.langs : []).filter(allowed).slice(0, 4);
    if (!langs.length) return { status: 400, body: { error: "no langs" } };
    const withComment = !!input.withComment;
    key = `list|${ck}|${langs.join(",")}|${withComment}`;
    run = () =>
      ask(rules, listPrompt(base, { langs, withComment }), 500 + langs.length * 450, (raw) => {
        const out = cleanList(raw, langs, base.ui);
        if (langs.filter((k) => out[k].length).length < Math.ceil(langs.length / 2)) throw new Error("结果不完整");
        return out;
      });
  } else if (action === "more") {
    const lang = allowed(input.lang) ? input.lang : null;
    if (!lang) return { status: 400, body: { error: "no lang" } };
    const exclude = (Array.isArray(input.exclude) ? input.exclude : []).map((s) => str(s, 26)).filter(Boolean).slice(0, 30);
    key = null; // 每次排除列表不同，不缓存
    run = () =>
      ask(rules, listPrompt(base, { langs: [lang], exclude }), 1100, (raw) => {
        const out = cleanList(raw, [lang], base.ui, exclude, 5);
        if (!out[lang].length) throw new Error("没有新名字");
        return out;
      }, 1.1);
  } else {
    const lang = allowed(input.lang) ? input.lang : null;
    const target = str(input.foreign, 26);
    const roman = str(input.roman, 40);
    if (!lang || !target) return { status: 400, body: { error: "no target" } };
    key = `detail|${ck}|${lang}|${target}`;
    const user = `${who(base)}\n要解析的名字：${target}${roman ? `（${roman}）` : ""}，语言：${LANGS[lang].label}`;
    run = () => ask(DETAIL_RULES(base.out), user, base.ui === "en" ? 1400 : 1100, (raw) => cleanDetail(raw, base.ui));
  }

  if (key) {
    const cached = cacheGet(key);
    if (cached) return { status: 200, body: { ...cached, cached: true } };
  }
  if (rateLimited(ip)) return { status: 429, body: { error: "rate limited" } };
  if (overDailyLimit()) return { status: 503, body: { error: "daily limit" } };

  try {
    const result = await run();
    if (!result) return { status: 502, body: { error: "incomplete" } };
    if (key) cacheSet(key, result);
    return { status: 200, body: result };
  } catch (e) {
    console.error("[names]", e.message);
    return { status: e.status || 502, body: { error: e.status === 503 ? "ai off" : "ai unavailable" } };
  }
}

module.exports = { generate, cleanList, cleanDetail, extractJson, LANGS };
