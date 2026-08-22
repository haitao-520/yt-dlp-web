#!/bin/bash
# ============================================================
#  自动获取抖音 cookies（匿名即可，无需登录）
#  用法: bash refresh-cookies.sh
#  生成项目目录下的 cookies.txt，供 yt-dlp 解析抖音使用
# ============================================================
cd "$(dirname "$0")"

UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"

echo "⏳ 正在获取抖音 cookies（匿名）..."
curl -s -c cookies.txt -o /dev/null \
  -H "User-Agent: $UA" \
  -H "Referer: https://www.douyin.com/" \
  --max-time 20 "https://www.douyin.com/"

if [ -s cookies.txt ]; then
  echo "✅ cookies.txt 已生成（$(grep -cv '^#' cookies.txt) 条 cookies）"
  echo "   解析抖音不再需要登录或浏览器"
else
  echo "❌ 获取失败，请检查网络后重试"
fi
