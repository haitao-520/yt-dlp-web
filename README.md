# 🎬 yt-dlp 视频解析网站

一个基于 **yt-dlp** 的局域网视频解析/下载网页。手机或其他设备连同一局域网，浏览器打开页面即可粘贴视频链接（抖音 / B站 / YouTube 等）解析下载，文件保存到电脑。

## ✨ 功能

- 📱 手机浏览器直接用（浅色主题，移动端适配）
- ⚡ 粘贴整段分享文案自动提取链接
- ⏳ 实时下载进度（百分比 / 大小 / 速度 / 剩余时间）
- 📁 解析历史按时间排序，完成后才显示
- 🔒 多设备隔离：每个设备只看到自己解析的视频
- 🔄 开机自启（systemd 用户服务）
- 🍪 支持 cookies（抖音等需验证的站点）

## 🚀 一键部署

```bash
bash install.sh
```

脚本会自动：
1. 检测 Node.js（需 18+）
2. 下载 yt-dlp 到项目 `bin/`（失败则回退 pip / apt）
3. 生成 `config.json` 配置
4. 注册 systemd 用户服务（开机自启）

部署后浏览器打开 `http://本机局域网IP:8090` 即可使用。

## ⚙️ 配置（config.json）

```json
{
  "port": 8090,          // 端口
  "host": "0.0.0.0",     // 监听地址（0.0.0.0 = 局域网可访问）
  "downloadDir": "下载/视频",  // 下载保存目录
  "cookies": "firefox"   // cookies 来源: "" 不用 / "firefox" 读浏览器 / 或 cookie 文件路径
}
```

修改配置后重启服务：`systemctl --user restart yt-dlp-web`

## 📂 项目结构

```
yt-dlp-web/
├── server.mjs      # 网页服务器（核心）
├── install.sh      # 一键部署脚本
├── config.json     # 配置（可修改）
├── bin/yt-dlp      # 内置的 yt-dlp（部署时自动下载）
├── history.json    # 设备-文件归属记录（自动生成）
└── README.md
```

## 🔧 手动部署

```bash
npm i -g pnpm  # 无需
node server.mjs           # 直接运行（需已安装 yt-dlp）
# 或注册服务
systemctl --user enable --now yt-dlp-web
```

## ⚠️ 注意

- 依赖 **ffmpeg**（合并音视频）：`sudo apt install ffmpeg`
- 抖音等站点需要 cookies：配置 `"cookies": "firefox"`（读取本机浏览器登录态）
- 局域网内任何人都可访问（家用 Wi-Fi 没问题，公共网络慎用）
