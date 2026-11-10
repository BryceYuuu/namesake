/*
 * 名中注定 Namesake · 本地起名引擎（纯前端、零成本）
 * - 日语音读 / 韩语汉字音：查 Unihan 字典，有标准答案
 * - 英法德西意：按“音近 + 义近”从本地名字库匹配（大模型不可用时的兜底）
 */
(function () {
  "use strict";
  const H = window.HANZI;

  /* ---------------- 通用工具 ---------------- */
  const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
  const deaccent = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

  // 带声调拼音 → 无声调，ü 记作 v
  function plainPinyin(p) {
    return deaccent(p.replace(/[ǖǘǚǜü]/g, "v")).toLowerCase();
  }
  // 拼音显示：去声调、ü→u（护照写法）
  const pyDisplay = (p) => plainPinyin(p).replace(/v/g, "u");

  function joinPinyin(list) {
    return cap(
      list
        .map(pyDisplay)
        .reduce((acc, s, i) => acc + (i > 0 && /^[aoe]/.test(s) ? "'" : "") + s, "")
    );
  }

  // 稳定的伪随机：同一个名字每次结果一致，不同名字有变化
  function hash(str) {
    let h = 2166136261;
    for (const ch of str) h = Math.imul(h ^ ch.codePointAt(0), 16777619);
    return (h >>> 0) / 4294967295;
  }

  /* ---------------- 名字解析 ---------------- */
  function parseName(raw) {
    const s = (raw || "").replace(/[\s·・]/g, "");
    if (!/^[㐀-鿿]{2,5}$/.test(s)) {
      return { error: "请输入 2–5 个汉字的中文姓名" };
    }
    const unknown = [...s].filter((c) => !H[c]);
    if (unknown.length) return { error: `暂不支持这个字：${unknown.join("、")}` };

    const two = s.slice(0, 2);
    const surLen = s.length >= 3 && window.COMPOUND_SURNAMES.includes(two) ? 2 : 1;
    const sur = s.slice(0, surLen);
    const given = s.slice(surLen);
    const SP = window.SURNAME_PINYIN;

    let surPy;
    if (SP[sur] && surLen === 2) {
      // 复姓整体读音，如 万俟 mòqí → 拆成两个音节
      const m = SP[sur].match(/[^aeiouüāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]*[aeiouüāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]+(?:ng|n|r)?(?![aeiouüāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ])/g);
      surPy = m && m.length === 2 ? m : [...sur].map((c) => H[c][0]);
    } else {
      surPy = [...sur].map((c) => SP[c] || H[c][0]);
    }
    const givenPy = [...given].map((c) => H[c][0]);
    return { full: s, sur, given, surPy, givenPy };
  }

  function guessGender(given) {
    const G = window.GENDER_HINT;
    let f = 0, m = 0;
    for (const c of given) {
      if (G.f.includes(c)) f++;
      if (G.m.includes(c)) m++;
    }
    return f > m ? "f" : m > f ? "m" : "";
  }

  const TAG_OF = {};
  for (const [tag, chars] of Object.entries(window.CHAR_TAGS)) {
    for (const c of chars) (TAG_OF[c] = TAG_OF[c] || []).push(tag);
  }
  const charTags = (str) => [...new Set([...str].flatMap((c) => TAG_OF[c] || []))];

  /* ---------------- 日语 ---------------- */
  const KANA = {
    ア:"a",イ:"i",ウ:"u",エ:"e",オ:"o",カ:"ka",キ:"ki",ク:"ku",ケ:"ke",コ:"ko",
    ガ:"ga",ギ:"gi",グ:"gu",ゲ:"ge",ゴ:"go",サ:"sa",シ:"shi",ス:"su",セ:"se",ソ:"so",
    ザ:"za",ジ:"ji",ズ:"zu",ゼ:"ze",ゾ:"zo",タ:"ta",チ:"chi",ツ:"tsu",テ:"te",ト:"to",
    ダ:"da",ヂ:"ji",ヅ:"zu",デ:"de",ド:"do",ナ:"na",ニ:"ni",ヌ:"nu",ネ:"ne",ノ:"no",
    ハ:"ha",ヒ:"hi",フ:"fu",ヘ:"he",ホ:"ho",バ:"ba",ビ:"bi",ブ:"bu",ベ:"be",ボ:"bo",
    パ:"pa",ピ:"pi",プ:"pu",ペ:"pe",ポ:"po",マ:"ma",ミ:"mi",ム:"mu",メ:"me",モ:"mo",
    ヤ:"ya",ユ:"yu",ヨ:"yo",ラ:"ra",リ:"ri",ル:"ru",レ:"re",ロ:"ro",ワ:"wa",ヰ:"i",
    ヱ:"e",ヲ:"o",ン:"n",
  };
  const SMALL = { ャ: "a", ュ: "u", ョ: "o" };

  function kataToRomaji(k) {
    let out = "";
    let gem = false;
    for (let i = 0; i < k.length; i++) {
      const c = k[i];
      if (c === "ッ") { gem = true; continue; }
      let r = KANA[c] || "";
      if (SMALL[k[i + 1]]) {
        const v = SMALL[k[i + 1]];
        if (/^(shi|chi)$/.test(r)) r = r.slice(0, -1) + v;
        else if (r === "ji") r = "j" + v;
        else r = r.slice(0, -1) + "y" + v;
        i++;
      }
      if (gem) { r = (r.startsWith("ch") ? "t" : r[0]) + r; gem = false; }
      if (out.endsWith("n") && k[i - 1] === "ン" && /^[aeiouy]/.test(r)) out += "'";
      out += r;
    }
    return out.replace(/ou|oo/g, "ō").replace(/uu/g, "ū");
  }

  function japanese(p) {
    const form = (c) => H[c][1] || c;
    const kana = (str) => [...str].map((c) => H[c][2]).join("");
    const parts = [p.sur, p.given];
    const kanji = parts.map((s) => [...s].map(form).join("")).join(" ");
    const kanaStr = parts.map(kana).join("・");
    const romaji = parts.map((s) => cap(kataToRomaji(kana(s)))).join(" ");
    const missing = [...p.full].some((c) => !H[c][2]);
    return { kanji, kana: kanaStr, romaji, speak: kanaStr.replace("・", " "), partial: missing };
  }

  /* ---------------- 韩语 ---------------- */
  const RR_L = ["g","kk","n","d","tt","r","m","b","pp","s","ss","","j","jj","ch","k","t","p","h"];
  const RR_V = ["a","ae","ya","yae","eo","e","yeo","ye","o","wa","wae","oe","yo","u","wo","we","wi","yu","eu","ui","i"];
  const RR_T = ["","k","k","k","n","n","n","t","l","k","m","l","l","l","p","l","m","p","p","t","t","ng","t","t","k","t","p","t"];
  const I_TYPE = new Set([2, 6, 7, 12, 17, 20]); // ㅑㅕㅖㅛㅠㅣ

  function decompose(ch) {
    const code = ch.charCodeAt(0) - 0xac00;
    if (code < 0 || code > 11171) return null;
    return [Math.floor(code / 588), Math.floor((code % 588) / 28), code % 28];
  }
  const compose = (l, v, t) => String.fromCharCode(0xac00 + l * 588 + v * 28 + t);

  // 头音法则：词首 ㄹ/ㄴ 的变化（李 리→이，林 림→임，罗 라→나）
  function initialLaw(ch) {
    const d = decompose(ch);
    if (!d) return ch;
    let [l, v, t] = d;
    if (l === 5) l = I_TYPE.has(v) ? 11 : 2;
    else if (l === 2 && I_TYPE.has(v)) l = 11;
    return compose(l, v, t);
  }

  function rr(syl) {
    const d = decompose(syl);
    if (!d) return "";
    return RR_L[d[0]] + RR_V[d[1]] + RR_T[d[2]];
  }

  const KO_SURNAME = {
    김:"Kim",이:"Lee",박:"Park",최:"Choi",정:"Jung",강:"Kang",조:"Cho",윤:"Yoon",장:"Jang",
    임:"Lim",한:"Han",오:"Oh",서:"Seo",신:"Shin",권:"Kwon",황:"Hwang",안:"Ahn",송:"Song",
    유:"Yoo",전:"Jeon",홍:"Hong",고:"Ko",문:"Moon",양:"Yang",손:"Son",배:"Bae",백:"Baek",
    허:"Heo",노:"Noh",남:"Nam",심:"Shim",하:"Ha",곽:"Kwak",성:"Sung",차:"Cha",주:"Joo",
    우:"Woo",구:"Koo",민:"Min",진:"Jin",나:"Na",지:"Ji",엄:"Um",변:"Byun",채:"Chae",
    원:"Won",방:"Bang",공:"Kong",현:"Hyun",함:"Ham",여:"Yeo",염:"Yeom",석:"Seok",소:"So",
    마:"Ma",왕:"Wang",육:"Yook",위:"Wi",도:"Do",연:"Yeon",용:"Yong",탁:"Tak",표:"Pyo",반:"Ban",
    진:"Jin",설:"Seol",경:"Kyung",당:"Dang",범:"Beom",
  };

  function korean(p) {
    const read = (str) => [...str].map((c) => H[c][3] || "");
    const sur = read(p.sur);
    const given = read(p.given);
    if (sur[0]) sur[0] = initialLaw(sur[0]);
    if (given[0]) given[0] = initialLaw(given[0]);
    const surH = sur.join("");
    const givenH = given.join("");
    const surR = KO_SURNAME[surH] || cap(sur.map(rr).join(""));
    const givenR = cap(given.map(rr).filter(Boolean).join("-"));
    const partial = [...sur, ...given].some((x) => !x);
    return { hangul: `${surH} ${givenH}`.trim(), romaji: `${surR} ${givenR}`.trim(), speak: surH + givenH, partial };
  }

  /* ---------------- 西语名字：音近 + 义近 ---------------- */
  const PY_INITS = ["zh","ch","sh","b","p","m","f","d","t","n","l","g","k","h","j","q","x","r","z","c","s","y","w"];
  const PY_ON = { zh: "j", j: "j", q: "ch", x: "sh", c: "ts" };
  const PY_V = {
    a:"a",ia:"a",ua:"a",an:"a",uan:"a",ang:"a",iang:"a",uang:"a",ai:"ai",uai:"ai",ao:"ao",iao:"ao",
    e:"e",ie:"e",ve:"e",ue:"e",ei:"ei",ui:"ei",en:"e",eng:"e",ian:"e",van:"e",i:"i",in:"i",ing:"i",
    vn:"i",o:"o",uo:"o",ou:"o",iu:"o",ong:"o",iong:"o",u:"u",un:"u",v:"u",er:"e",
  };

  function pyParts(p) {
    const syl = plainPinyin(p);
    const init = PY_INITS.find((i) => syl.startsWith(i)) || "";
    let fin = syl.slice(init.length);
    if (/^[jqxy]$/.test(init) && fin.startsWith("u")) fin = "v" + fin.slice(1);
    let v = PY_V[fin] || "a";
    if (/^(zh|ch|sh|r|z|c|s)$/.test(init) && fin === "i") v = "e";
    if (init === "y" && fin === "i") v = "i";
    return { syl, on: PY_ON[init] || init, v };
  }

  function nameParts(name, lang) {
    let n = deaccent(name).toLowerCase();
    let on = "";
    let rest = n;
    const take = (len, sound) => { on = sound; rest = n.slice(len); };
    if (/^chr/.test(n)) take(2, "k");
    else if (lang === "de" && n.startsWith("sch")) take(3, "sh");
    else if (n.startsWith("ch")) take(2, { fr: "sh", de: "k", it: "k" }[lang] || "ch");
    else if (n.startsWith("sh")) take(2, "sh");
    else if (n.startsWith("ph")) take(2, "f");
    else if (n.startsWith("th")) take(2, "t");
    else if (n.startsWith("wh")) take(2, "w");
    else if (n.startsWith("qu")) take(2, "k");
    else if (lang === "es" && n.startsWith("ll")) take(2, "y");
    else if (n[0] === "j") take(1, { de: "y", es: "h", it: "y" }[lang] || "j");
    else if (n[0] === "g" && /[eiy]/.test(n[1])) take(1, lang === "es" ? "h" : lang === "de" ? "g" : "j");
    else if (n[0] === "c" && /[eiy]/.test(n[1])) take(1, lang === "it" ? "ch" : "s");
    else if (n[0] === "c") take(1, "k");
    else if (n[0] === "w") take(1, lang === "de" ? "v" : "w");
    else if (n[0] === "x") take(1, lang === "en" ? "z" : "ks");
    else if (n[0] === "z") take(1, lang === "de" || lang === "it" ? "ts" : "z");
    else if (n[0] === "h") take(1, ["fr", "es", "it"].includes(lang) ? "" : "h");
    else if (/[aeiou]/.test(n[0])) take(0, "");
    else take(1, n[0]);

    // 意大利语 gio/cia：i 只是软化符号
    if (lang === "it" && /^i[aou]/.test(rest) && (on === "j" || on === "ch")) rest = rest.slice(1);
    const m = rest.match(/[aeiouy]+/);
    let vg = m ? m[0] : "";
    const after = m ? rest.slice(m.index + vg.length) : "";
    let v;
    if (/^(ai|ay|ei|ey)/.test(vg)) v = lang === "de" ? "ai" : "ei";
    else if (/^(au|aw)/.test(vg)) v = "ao";
    else if (/^(oo|ou)/.test(vg)) v = "u";
    else if (/^(ee|ea|ie)/.test(vg)) v = "i";
    else {
      v = { a: "a", e: "e", i: "i", o: "o", u: "u", y: "i" }[vg[0]] || "";
      // 英语的“魔法 e”：Wade / Mike / Jane
      if (lang === "en" && vg.length === 1 && /^[^aeiouy]e$/.test(after)) {
        v = { a: "ei", i: "ai", o: "o", u: "u", e: "i" }[vg] || v;
      }
    }
    return { n, on, v };
  }

  const ON_GROUPS = [["j","ch","zh","g"],["sh","s","ch"],["z","ts","s"],["l","r"],["b","p"],["d","t"],["g","k"],["w","v"],["y",""],["h",""],["f","v"],["m","n"]];
  const V_GROUPS = [["a","ai","ao"],["e","ei","i"],["o","u","ao"],["ei","ai"]];
  const sim = (groups, a, b) => groups.some((g) => g.includes(a) && g.includes(b));

  function soundScore(py, name, lang) {
    const a = pyParts(py[0]);
    const b = nameParts(name, lang);
    let s = 0;
    if (a.on === b.on) s += 3;
    else if (sim(ON_GROUPS, a.on, b.on)) s += 1.5;
    if (a.v === b.v) s += 2;
    else if (sim(V_GROUPS, a.v, b.v)) s += 1;
    if (a.syl.length >= 2 && b.n.startsWith(a.syl)) s += 2;
    if (py[1]) {
      const c = pyParts(py[1]);
      const tail = b.n.slice(2);
      if (c.on && tail.includes(c.on[0])) s += 0.8;
    }
    return s;
  }

  const LANGS = [
    { k: "en", i: 1, label: "英语", flag: "🇬🇧", tts: "en-US" },
    { k: "fr", i: 2, label: "法语", flag: "🇫🇷", tts: "fr-FR" },
    { k: "de", i: 3, label: "德语", flag: "🇩🇪", tts: "de-DE" },
    { k: "es", i: 4, label: "西班牙语", flag: "🇪🇸", tts: "es-ES" },
    { k: "it", i: 5, label: "意大利语", flag: "🇮🇹", tts: "it-IT" },
  ];

  function western(p, gender, tags) {
    const py = p.givenPy;
    const out = {};
    for (const L of LANGS) {
      const pool = window.NAME_FAMILIES.filter((f) => f[L.i] && (!gender || f[0] === gender));
      const scored = pool.map((f) => {
        const name = f[L.i];
        const ftags = f[7].split(" ");
        const overlap = ftags.filter((t) => tags.includes(t));
        const s = soundScore(py, name, L.k);
        const m = Math.min(overlap.length, 2) * 3;
        return { name, zh: f[6], s, m, overlap, total: s + m + hash(p.full + name) * 0.6 };
      });
      const by = (key) => [...scored].sort((x, y) => y[key] - x[key] || y.total - x.total)[0];
      const picks = [];
      const add = (x) => x && !picks.some((y) => y.name === x.name) && picks.push(x);
      add(by("total"));
      add(by("s"));
      if (by("m") && by("m").m > 0) add(by("m"));
      for (const x of [...scored].sort((a, b) => b.total - a.total)) {
        if (picks.length >= 3) break;
        add(x);
      }
      out[L.k] = picks.slice(0, 3).map((x) => ({
        name: x.name,
        meaning: x.zh,
        why: reason(x, p),
      }));
    }
    return out;
  }

  function reason(x, p) {
    const syl = cap(pyDisplay(p.givenPy[0]));
    const chars = [...p.given].filter((c) => (TAG_OF[c] || []).some((t) => x.overlap.includes(t)));
    const parts = [];
    if (x.s >= 4) parts.push(`发音接近「${syl}」`);
    if (x.m > 0 && chars.length) parts.push(`呼应「${chars.join("")}」的寓意`);
    return parts.length ? parts.join("，") : "经典名字，易读好记";
  }

  function japaneseStyle(p, gender, tags) {
    const forms = new Set([...p.given].map((c) => H[c][1] || c));
    const py = p.givenPy;
    return window.JA_NAMES.filter((n) => !gender || n[3] === gender)
      .map((n) => {
        const kanjiHit = [...n[0]].filter((c) => forms.has(c)).length;
        const tagHit = n[4].split(" ").filter((t) => tags.includes(t)).length;
        const snd = soundScore(py, n[1], "en");
        return {
          kanji: n[0], romaji: n[1], kana: n[2],
          kanjiHit, tagHit,
          total: kanjiHit * 5 + Math.min(tagHit, 2) * 3 + snd * 0.4 + hash(p.full + n[0]),
        };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 2)
      .map((x) => ({
        kanji: x.kanji, kana: x.kana, romaji: x.romaji,
        why: x.kanjiHit ? "和你的名字共用汉字" : x.tagHit ? "寓意和你的名字相近" : "发音或气质相近",
      }));
  }

  /* ---------------- 对外接口 ---------------- */
  function analyze(raw, genderInput) {
    const p = parseName(raw);
    if (p.error) return p;
    const guessed = guessGender(p.given);
    const gender = genderInput || guessed;
    const tags = charTags(p.given);
    return {
      ...p,
      gender,
      guessedGender: guessed,
      tags,
      pinyin: `${joinPinyin(p.surPy)} ${joinPinyin(p.givenPy)}`,
      surnameLatin: joinPinyin(p.surPy),
      givenLatin: joinPinyin(p.givenPy),
      ja: japanese(p),
      ko: korean(p),
      west: western(p, gender, tags),
      jaStyle: japaneseStyle(p, gender, tags),
    };
  }

  window.WorldName = { analyze, guessGender, parseName, LANGS, kataToRomaji, korean };
})();
