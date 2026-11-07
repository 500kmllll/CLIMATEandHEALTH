# Beat the Heat — 骑手互动网站

这是已发布的第 3 版的静态导出（源码提交：`ea975e206662522a91273eacdcc227548c645faa`）。游戏场景、时间轴、选择、计分与结算内容取自该版。图片清单和图片文件沿用线上目录结构。

## 发布到 GitHub Pages

1. 解压 ZIP，把解压得到的文件和目录直接放到仓库根目录。确认 `index.html` 和 `.nojekyll` 位于根目录，`assets/` 不要拆散。
2. 打开仓库的 **Settings → Pages**。在 **Build and deployment** 下，将 **Source** 设为 **Deploy from a branch**，选择存放文件的分支（通常为 `main`）以及 **/ (root)**，保存。
3. 发布完成后从 Pages 设置打开站点。素材使用相对路径，支持形如 `https://用户名.github.io/仓库名/` 的项目网址。

也可将这些文件一起放到 `docs/`，发布目录对应选 **/docs**。无需安装依赖或运行构建。参见 [GitHub Pages 发布源说明](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)。

## 本地预览

在 `index.html` 所在目录运行 `python3 -m http.server 8000`，打开 `http://localhost:8000/`。请通过 HTTP 打开；直接双击 HTML 时，浏览器可能阻止 JavaScript 模块和素材清单加载。

## 留言功能

原站的匿名留言依赖服务器和数据库，GitHub Pages 不会运行该后端。静态版默认在结尾提供邮件反馈入口。它不会读取、复制或写入原站的留言数据库。现有会议二维码仍指向原站。

如需接入独立的留言服务器，把 `index.html` 中的 `feedback-endpoint` 设置为该服务的 HTTPS 地址。前端以 JSON POST 提交 `id`（UUID）、`message`、`source` 和 `website`（反垃圾字段），成功响应应为 HTTP 201 和 `{"ok":true}`。跨域服务需允许你的 GitHub Pages 来源。原站接口不能直接从不同域名调用。
