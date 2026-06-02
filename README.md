---
name: nenaught-website
description: NE Naught 音乐社网站维护指南
metadata:
  type: project
---

# NE Naught 网站维护指南

## 🏗 网站结构
```
NeNaughtweb/
├── index.html              ← 主页面（不需修改）
├── css/style.css           ← 样式文件（不需修改）
├── js/main.js              ← 脚本（不需修改）
├── content/
│   ├── posts.json          ← 📝 文章文件名清单（只列文件名，元数据来自 MD）
│   ├── posts/*.md          ← 📝 文章内容（每篇一个 .md 文件）
│   ├── photos.json         ← 📝 照片墙数据
│   └── friends.json        ← 📝 友链数据
├── img/                    ← 图片文件夹
├── _headers                ← Cloudflare 缓存配置
└── README.md               ← 本文件
```

## ✍️ 发布新文章（博客推送）

**这是最常用的更新操作**。网站采用 **MD 驱动**：标题、日期、摘要全部来自 Markdown 文件的 YAML front matter，修改即生效。

### 第 1 步：创建 Markdown 文件

在 `content/posts/` 下新建一个 `.md` 文件，命名格式：`YYYY-MM-DD-slug.md`

```markdown
---
title: 你的文章标题
date: 2026-06-15
summary: 文章摘要，显示在列表中
image: img/news/cover.jpg
---

正文内容，支持 Markdown 格式。

## 二级标题

可以放 **粗体**、*斜体*、[链接](https://...)

![图片](img/news/photo.jpg)

> 引用文字

- 列表项1
- 列表项2

---

分隔线
```

> **重要：** `title`、`date`、`summary` 在 front matter 中定义即可，**无需**再在 JSON 中重复填写。修改 MD 文件 → 网站自动更新。

### 第 2 步：注册文件名到清单

编辑 `content/posts.json`，在数组最前面添加文件名：

```json
[
  "2026-06-15-新文章.md",
  "2026-05-20-first-live.md",
  "2026-04-15-recruitment.md",
  "2026-03-01-launch.md"
]
```

> 只需要文件名，**不需要**再写 title/date/summary。所有元数据从 MD 文件的 front matter 自动读取。

### 第 3 步：推送部署

```bash
git add . && git commit -m "新文章: 标题" && git push
```

Cloudflare Pages 自动重新部署，1-2 分钟后上线。

## 📸 添加照片

编辑 `content/photos.json`：

```json
{
  "id": 4,
  "src": "img/gallery/photo4.jpg",
  "thumb": "img/gallery/thumb/photo4.jpg",
  "caption": "夏日演出",
  "date": "2026-06"
}
```

把照片放到 `img/gallery/`，缩略图（可选）放到 `img/gallery/thumb/`。

## 🔗 添加友链

编辑 `content/friends.json`：

```json
{
  "name": "乐队名称",
  "avatar": "img/friends/band.jpg",
  "url": "https://space.bilibili.com/xxxxx",
  "description": "一句简介"
}
```

## 🚀 部署到 Cloudflare Pages

1. 把项目 push 到 GitHub
2. Cloudflare Pages → 创建项目 → 连接仓库
3. **构建设置**：无需框架，输出目录留空
4. 点击部署

以后每次 push 自动部署。
