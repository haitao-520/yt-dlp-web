#!/bin/bash
# ============================================================
#  自动获取 抖音 + B站 cookies（匿名即可，无需登录）
#  用法: bash refresh-cookies.sh
#  生成项目目录下的 cookies.txt，供 yt-dlp 解析视频使用
# ============================================================
cd "$(dirname "$0")"

UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"

echo "⏳ 获取抖音 cookies..."
curl -s -c cookies.txt -o /dev/null \
  -H "User-Agent: $UA" \
  -H "Referer: https://www.douyin.com/" \
  --max-time 20 "https://www.douyin.com/"

echo "⏳ 获取B站 cookies..."
curl -s -b cookies.txt -c cookies.txt -o /dev/null \
  -H "User-Agent: $UA" \
  -H "Referer: https://www.bilibili.com/" \
  --max-time 20 "https://www.bilibili.com/"

if [ -s cookies.txt ]; then
  echo "✅ cookies.txt 已生成（$(grep -cv '^#' cookies.txt) 条 cookies，含抖音+B站）"
  echo "   解析抖音/B站不再需要登录或浏览器"
else
  echo "❌ 获取失败，请检查网络后重试"
fi
