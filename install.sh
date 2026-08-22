#!/bin/bash
# ============================================================
#  yt-dlp 视频解析网站 部署脚本（手动启动，无开机自启）
#  用法: bash install.sh
#  部署后: 运行下面提示的启动命令，然后浏览器打开
# ============================================================
set -e
cd "$(dirname "$0")"

echo "======================================"
echo "  🎬 yt-dlp 视频解析网站 部署"
echo "======================================"

# 1. 检查 Node.js
if ! command -v node >/dev/null 2>&1; then
  echo "❌ 未找到 Node.js（需要 18+）。请先安装 Node.js。"
  exit 1
fi
NODE_VER=$(node -v)
echo "✅ Node.js: $NODE_VER"

# 2. 准备 yt-dlp（项目内置 bin/yt-dlp 优先）
mkdir -p bin
if [ -x bin/yt-dlp ]; then
  echo "✅ yt-dlp 已内置: bin/yt-dlp ($(bin/yt-dlp --version 2>/dev/null || echo '?'))"
else
  echo "⏳ 正在下载 yt-dlp 到项目 bin/ ..."
  if curl -sL --max-time 300 -o bin/yt-dlp "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp"; then
    chmod +x bin/yt-dlp
    echo "✅ 下载完成: $(bin/yt-dlp --version 2>/dev/null || echo '?')"
  else
    rm -f bin/yt-dlp
    echo "⚠️ GitHub 下载失败，尝试 pip 安装..."
    pip install --user -i https://pypi.tuna.tsinghua.edu.cn/simple yt-dlp 2>/dev/null \
      || pip install --user yt-dlp 2>/dev/null \
      || sudo apt-get install -y yt-dlp 2>/dev/null \
      || { echo "❌ yt-dlp 安装失败，请手动安装后重试"; exit 1; }
    echo "✅ yt-dlp 已通过系统安装"
  fi
fi

# 3. 创建配置文件（不存在时）
if [ ! -f config.json ]; then
  cat > config.json <<EOF
{
  "port": 8090,
  "host": "0.0.0.0",
  "downloadDir": "$HOME/下载/视频",
  "cookies": "firefox"
}
EOF
  echo "✅ 已生成 config.json（可修改端口/下载目录/cookies）"
fi

# 4. 创建下载目录
DL_DIR=$(node -e "try{const c=require('./config.json');console.log(c.downloadDir||'')}catch(e){console.log('')}")
if [ -n "$DL_DIR" ] && [ ! -d "$DL_DIR" ]; then
  mkdir -p "$DL_DIR" 2>/dev/null || true
fi

# 5. 启动说明（手动启动，不做开机自启）
PORT=$(node -e "try{const c=require('./config.json');console.log(c.port||8090)}catch(e){console.log('8090')}")
echo "======================================"
echo "  ✅ 部署完成！"
echo "======================================"
echo "启动网站（前台运行）:"
echo "  node server.mjs"
echo
echo "后台运行（关闭终端不退出）:"
echo "  nohup node server.mjs >/dev/null 2>&1 &"
echo
echo "访问地址:"
echo "  本机:      http://127.0.0.1:${PORT}"
echo "  局域网IP:  http://$(hostname -I 2>/dev/null | awk '{print $1}'):${PORT}"
echo
echo "说明:"
echo "  - cookies 配置为 firefox 时可解析抖音等需验证的站点"
echo "  - 如需改端口/下载目录，编辑 config.json 后重启"
echo "  - 本项目不做开机自启（兼容无 systemd 的环境，如 Termux/容器）"
