"""
从 Unicode Unihan 数据库生成 data/hanzi.js

用法：
  curl -L -o Unihan.zip https://www.unicode.org/Public/UCD/latest/ucd/Unihan.zip
  unzip Unihan.zip -d unihan
  python3 tools/build_hanzi.py unihan data/hanzi.js

输出：window.HANZI = { "张": ["zhāng", "張", "チョウ", "장"], ... }
  [0] 普通话拼音（带声调）
  [1] 日本汉字字形（新字体优先）
  [2] 日语音读（片假名）
  [3] 韩语汉字音（谚文）
"""
import json
import os
import re
import sys

src_dir, out_path = sys.argv[1], sys.argv[2]

FIELDS = {
    "kTGHZ2013", "kMandarin", "kHangul", "kJapanese", "kJapaneseOn",
    "kTraditionalVariant", "kSimplifiedVariant", "kSemanticVariant",
    "kZVariant", "kJoyoKanji", "kJinmeiyoKanji",
}

data = {}
for fn in os.listdir(src_dir):
    if not fn.startswith("Unihan_") or not fn.endswith(".txt"):
        continue
    with open(os.path.join(src_dir, fn), encoding="utf-8") as f:
        for line in f:
            if line.startswith("#") or not line.strip():
                continue
            cp, field, value = line.rstrip("\n").split("\t", 2)
            if field in FIELDS:
                ch = chr(int(cp[2:], 16))
                data.setdefault(ch, {})[field] = value


def cps(value):
    """'U+5F35<kMatthews U+5F36' -> ['張', '張']"""
    return [chr(int(m, 16)) for m in re.findall(r"U\+([0-9A-F]+)", value or "")]


def is_kanji(ch):
    d = data.get(ch, {})
    return "kJoyoKanji" in d or "kJinmeiyoKanji" in d


KATA = re.compile(r"^[゠-ヿ]+$")


def ja_kana(ch):
    for tok in data.get(ch, {}).get("kJapanese", "").split():
        if KATA.match(tok):
            return tok
    return ""


# 常见的简体字 → 日本新字体（Unihan 变体链里找不到的补丁）
JA_PATCH = {
    "泽": "沢", "广": "広", "荣": "栄", "乐": "楽", "樱": "桜", "惠": "恵",
    "晓": "暁", "滨": "浜", "龙": "竜", "艺": "芸", "经": "経", "实": "実",
    "发": "発", "应": "応", "关": "関", "气": "気", "边": "辺", "恋": "恋",
    "铁": "鉄", "传": "伝", "顺": "順", "丰": "豊", "义": "義", "宝": "宝",
    "円": "円", "圆": "円", "绘": "絵", "让": "譲", "坚": "堅", "钢": "鋼",
    "辉": "輝", "兴": "興", "礼": "礼", "觉": "覚", "团": "団", "将": "将",
    "单": "単", "乡": "郷", "严": "厳", "庄": "荘", "壮": "壮", "敛": "斂",
    "涛": "濤", "伟": "偉", "张": "張", "刘": "劉", "陈": "陳", "杨": "楊",
    "黄": "黄", "赵": "趙", "吴": "呉", "周": "周", "郑": "鄭", "孙": "孫",
    "马": "馬", "罗": "羅", "梁": "梁", "宋": "宋", "谢": "謝", "韩": "韓",
    "冯": "馮", "邓": "鄧", "许": "許", "苏": "蘇", "卢": "盧", "蒋": "蒋",
    "蔡": "蔡", "贾": "賈", "叶": "葉", "钟": "鍾", "汪": "汪", "陆": "陸",
    "顾": "顧", "孟": "孟", "龚": "龔", "万": "万", "钱": "銭", "邹": "鄒",
    "冈": "岡", "岚": "嵐", "凤": "鳳", "丽": "麗", "颖": "穎", "莹": "瑩",
    "静": "静", "婷": "婷", "娟": "娟", "伦": "倫", "宁": "寧", "华": "華",
}


# 起名场景下更常用的音读
KANA_PATCH = {"曾": "ソウ", "娜": "ナ", "涛": "トウ", "濤": "トウ", "乐": "ラク", "楽": "ラク", "樂": "ラク"}


def ja_form(ch):
    if ch in JA_PATCH:
        return JA_PATCH[ch]
    d = data.get(ch, {})
    cands = [ch] + cps(d.get("kTraditionalVariant"))
    # 再找繁体字的语义变体/字形变体（新字体常藏在这里）
    for c in list(cands[1:]):
        dc = data.get(c, {})
        cands += cps(dc.get("kSemanticVariant")) + cps(dc.get("kZVariant"))
    for c in cands:
        if is_kanji(c):
            return c
    for c in cands:
        if ja_kana(c):
            return c
    return ch


def first_hangul(ch):
    d = data.get(ch, {})
    # 简体字优先用繁体字的读音（如 广 本身是部首“엄”，廣 才是“광”）
    trad = [c for c in cps(d.get("kTraditionalVariant")) if c != ch]
    for c in trad + [ch]:
        v = data.get(c, {}).get("kHangul")
        if v:
            return v.split()[0].split(":")[0]
    return ""


def mandarin(ch):
    v = data.get(ch, {}).get("kMandarin", "")
    return v.split()[0] if v else ""


# 收录范围：《通用规范汉字表》8105 字 + 它们的繁体字（照顾港台用户输入）
keys = [ch for ch, d in data.items() if "kTGHZ2013" in d]
extra = []
for ch in keys:
    for t in cps(data[ch].get("kTraditionalVariant")):
        if t not in data or "kTGHZ2013" not in data[t]:
            extra.append(t)

out = {}
for ch in keys + extra:
    p = mandarin(ch)
    if not p:
        continue
    jf = ja_form(ch)
    kana = KANA_PATCH.get(ch) or ja_kana(jf) or ja_kana(ch)
    out[ch] = [p, jf if jf != ch else "", kana, first_hangul(ch)]

with open(out_path, "w", encoding="utf-8") as f:
    f.write("/* 由 tools/build_hanzi.py 从 Unicode Unihan 生成，勿手改。Unicode License v3，见 THIRD_PARTY_NOTICES.txt */\n")
    f.write("window.HANZI=")
    json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    f.write(";\n")

print(f"{len(out)} chars -> {out_path} ({os.path.getsize(out_path)//1024} KB)")
