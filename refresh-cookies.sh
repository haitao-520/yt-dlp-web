#!/bin/bash
# ============================================================
#  刷新 抖音 + B站 cookies（合并模式，不覆盖已有有效 cookies）
#  用法: bash refresh-cookies.sh
# ============================================================
cd "$(dirname "$0")"

UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"

echo "⏳ 刷新抖音 cookies..."
curl -sL -b cookies.txt -c cookies.txt -o /dev/null \
  -H "User-Agent: $UA" \
  -H "Referer: https://www.douyin.com/" \
  --max-time 20 "https://www.douyin.com/"

echo "⏳ 刷新B站 cookies..."
curl -sL -b cookies.txt -c cookies.txt -o /dev/null \
  -H "User-Agent: $UA" \
  -H "Referer: https://www.bilibili.com/" \
  --max-time 20 "https://www.bilibili.com/"

# 合并去重（保留旧的有效 cookies，如 ttwid）
if [ -s cookies.txt ]; then
  awk '!seen[$0]++' cookies.txt > cookies.txt.tmp && mv cookies.txt.tmp cookies.txt
  echo "✅ cookies.txt 已刷新（合并模式，$(grep -cv '^#' cookies.txt) 条）"
else
  echo "❌ 获取失败，请检查网络后重试"
fi
