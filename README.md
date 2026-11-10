# 名中注定 · Namesake

<img src="assets/logo-512.png" width="96" alt="Namesake logo" />

**👉 立即体验 / Try it：<!-- LIVE_URL -->（即将上线 / coming soon）**

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FBryceYuuu%2Fnamesake&project-name=namesake&env=LLM_API_KEY,LLM_BASE_URL,LLM_MODEL,LLM_EXTRA_BODY&envDescription=OpenAI-compatible%20LLM%20settings%2C%20see%20.env.example)

**你的名字在 12 个国家怎么叫。** 输入中文名，生成英、日、韩、法、德、西、意、葡、荷、俄、泰、阿拉伯 12 种语言的名字；
输入外文名（如 Emily Johnson），得到地道的中文名，以及这个名字在 12 个国家的叫法。
每张卡片都能听发音、“换一个”、点开看详解（含义、词源、逐字解读、名人、昵称、和原名的缘分），最后生成分享长图。

**Your name in 12 countries — and in Chinese.** Type a Chinese name to get names in 12 languages, or type a name in
letters (e.g. *Emily Johnson*) to get an authentic Chinese name plus how your name is said around the world.
Every card can be heard aloud, shuffled, and opened for a detailed story behind the name. The UI switches between
Chinese and English automatically.

## 结果怎么来的

| 部分 | 来源 | 说明 |
|---|---|---|
| 日语音读、韩语汉字音 | 本地 Unicode Unihan 字典 | 有标准答案，不走大模型，100% 稳定 |
| 12 国名字 | 大模型（4 组并行，约 5 秒出齐） | 中文名模式下，英法德西意和日本名有本地词库兜底 |
| 外文名 → 中文名 | 大模型 | 地道中文名（姓在前，可无限换）；新华社规范音译、日语片假名、韩文音译显示在对应卡片顶部 |
| 界面与解释语言 | 按浏览器语言自动中/英，可手动切换 | AI 的解释文字跟随界面语言输出 |
| 换一个 | 先轮换已有候选，用完再请求 AI（排除已出现过的） | 约 2 秒 |
| 名字详解 | 点开弹窗时才请求，结果缓存 | 约 4 秒 |
| 发音 | 浏览器自带朗读 | 自动挑选高质量声音，检测到没声音会换下一个 |

接口挂了、额度用完或纯静态部署时，英法德西意和日本名退回本地词库，其余国家显示“重试”。

## 本地运行

```bash
cp .env.example .env    # 填入任一国产模型的 key（不填也能跑，只用本地词库）
node server.js          # http://localhost:5173
```

零依赖，Node 18+ 即可。

## 切换模型

`.env` 里改三行即可，支持任何 OpenAI 兼容接口：DeepSeek、智谱 GLM-4-Flash、通义千问、豆包、Kimi（示例见 `.env.example`）。
一次完整起名（4 组）约 4K tokens；详解每次约 1.5K tokens。同名同性别结果会缓存。

## 部署

- **Vercel（推荐）**：点上面的 “Deploy with Vercel” 按钮，或在 Vercel 导入本仓库。`api/names.js` 会自动成为函数。
  在项目设置 → Environment Variables 里填：`LLM_BASE_URL`、`LLM_MODEL`、`LLM_API_KEY`、`LLM_EXTRA_BODY`（DeepSeek 关思考用，见 `.env.example`），
  建议再加 `DAILY_LIMIT`（如 `2000`）控制每日花费。
- **自己的服务器**：`node server.js`，前面挂 Nginx。
- **纯静态（GitHub Pages 等）**：直接上传，AI 部分会自动关闭，只用本地词库。

## 免费额度与防刷

官方网站上每台设备可免费生成 1 个名字、换一个 3 次（记在浏览器本地，打开别人分享的链接不消耗额度）。这是体验层面的“软限制”，
真正的成本兜底在服务端：

`api/_core.js` 内置单 IP 每分钟 40 次请求限流、单实例每日调用上限（`DAILY_LIMIT`）、结果缓存，以及输出清洗（只放行预期字段，过滤非法名字）。
上量后建议把内存缓存/限流换成 Redis 或 Vercel KV。

## 目录

```
index.html  css/  js/engine.js（本地起名引擎） js/app.js（页面交互、分享卡片）
data/hanzi.js   汉字读音数据（由 tools/build_hanzi.py 从 Unihan 生成，约 1.1 万字）
data/names.js   本地名字库、汉字寓意标签、复姓与姓氏多音字表、日本名字库
api/            大模型后端
```

更新汉字数据：

```bash
curl -L -o Unihan.zip https://www.unicode.org/Public/UCD/latest/ucd/Unihan.zip && unzip Unihan.zip -d unihan
python3 tools/build_hanzi.py unihan data/hanzi.js
```

## 许可证

本项目以 [AGPL-3.0](LICENSE) 开源：可以自由使用和修改，但如果把修改后的版本部署成网站对外提供服务，必须同样公开源代码。
`data/hanzi.js` 由 Unicode Unihan 数据生成，适用 Unicode License v3，见 [THIRD_PARTY_NOTICES.txt](THIRD_PARTY_NOTICES.txt)。

**部署时请使用你自己的 API key**，填在 `.env` 或托管平台的环境变量里；仓库中不包含任何 key。
