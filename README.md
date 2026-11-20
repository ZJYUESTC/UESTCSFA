# 成电幻协官网内容

公开内容仓库，供银杏科幻官网读取。不要上传密码或非公开信息。

## 更新方法

在 GitHub 打开 `events.json`（活动通知）或 `news.json`（资讯），点击编辑，修改后提交。每个文件必须保持为合法 JSON 数组；没有内容时写 `[]`。无需重新部署官网。

每篇内容包含 `id`（唯一标识）、`title`、`publishedAt`（YYYY-MM-DD）、`body`。正文换行用 JSON 的 `\n`。可选 `image`（如 `media/photo.jpg`）、`imageAlt`（图片说明）。图片先上传到 media 文件夹。

官网读取 main 分支的已提交文件，按日期倒序展示；网络或缓存可能使更新延迟。删除一篇内容时删除对应对象，注意逗号。仓库内容公开，图片也公开。

## 游戏更新

`games.json` 管理官网的游戏列表。`kind: "quiz"` 表示官网内置问答；`kind: "link"` 配合 `url`（完整 HTTPS 地址）打开游戏。设置 `published: false` 可隐藏入口，删除条目也会移除入口。

远星航路文件在 `games/star-routes/`。更新游戏时上传替换该目录中对应文件，保持 index.html 及依赖文件齐全。GitHub Pages 从 main 分支根目录发布，提交后等待 Pages 部署完成即可生效；官网页面和 Netlify 不必重新部署。请保留原游戏说明和音乐署名。

内容数据可能有数分钟缓存。小游戏本体更新依赖 GitHub Pages 的部署，和 JSON 列表更新不同。

## 官网

官网地址：https://zjyuestc.github.io/UESTCSFA/

根目录 index.html 与 assets 为官网发布文件；games 为游戏文件。活动、资讯、游戏列表继续使用根目录的 JSON 更新，通常无需重建官网。

官网 Vue 源码位于 website-source。如需调整布局，在该目录执行 npm ci 和 npm run build，将 dist/index.html 和 dist/assets 复制到仓库根目录后提交。请保留 media、games、JSON 数据和 .nojekyll。GitHub Pages 从 main 分支根目录发布。
