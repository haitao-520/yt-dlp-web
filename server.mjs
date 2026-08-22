#!/usr/bin/env node
// yt-dlp 局域网解析界面：异步解析 + 浅色主题 + 历史按时间排序 + 多设备隔离
import http from 'node:http'
import { spawn } from 'node:child_process'
import { readdir, stat } from 'node:fs/promises'
import { createReadStream, existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// ── 配置（可通过同目录 config.json 覆盖）─────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CONFIG_FILE = path.join(__dirname, 'config.json')
const defaultConfig = {
  port: 8090,
  host: '0.0.0.0',
  downloadDir: path.join(process.env.HOME ?? '/root', '下载', '视频'),
  // cookies: '' 不用 / 'firefox' 读浏览器 / 或填写 cookie 文件路径
  cookies: 'firefox',
  historyFile: path.join(__dirname, 'history.json'),
}
let config = { ...defaultConfig }
try { config = { ...defaultConfig, ...JSON.parse(readFileSync(CONFIG_FILE, 'utf8')) } } catch {}

const PORT = config.port
const DOWNLOAD_DIR = config.downloadDir
const HOST = config.host
// yt-dlp 路径：项目内 bin/yt-dlp 优先，其次系统安装
const YTDLP = existsSync(path.join(__dirname, 'bin', 'yt-dlp'))
  ? path.join(__dirname, 'bin', 'yt-dlp')
  : 'yt-dlp'

const jobs = new Map()
let jobSeq = 0
const HISTORY_FILE = config.historyFile
let history = {}
try { history = JSON.parse(readFileSync(HISTORY_FILE, 'utf8')) } catch {}
function saveHistory() { try { writeFileSync(HISTORY_FILE, JSON.stringify(history)) } catch {} }

async function listFiles() {
  const files = []
  for (const name of await readdir(DOWNLOAD_DIR)) {
    const p = path.join(DOWNLOAD_DIR, name)
    try {
      const s = await stat(p)
      // 只显示最终完成的文件，过滤 .part 和中间格式文件(.fXXX.)
      if (s.isFile() && !name.endsWith('.part') && !/\.f\d+(\.|$)/.test(name) && !name.startsWith('.')) {
        files.push({ name, size: (s.size / 1048576).toFixed(1) + ' MB', time: new Date(s.mtimeMs).toLocaleString('zh-CN', { hour12: false }), mtime: s.mtimeMs })
      }
    } catch {}
  }
  return files.sort((a, b) => b.mtime - a.mtime) // 按时间倒序
}

const HTML = `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>🎬 视频解析</title>
<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
<style>
*{box-sizing:border-box}
body{font-family:system-ui,-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;max-width:640px;margin:0 auto;padding:20px;background:#f5f7fa;color:#2c3e50}
h1{font-size:24px;color:#1a73e8;margin:8px 0 4px;display:flex;align-items:center;gap:8px}
.sub{color:#8a94a6;font-size:13px;margin:0 0 16px}
.input-wrap{background:#fff;border-radius:14px;padding:14px;box-shadow:0 2px 8px rgba(0,0,0,.06)}
input{width:100%;padding:12px 14px;border-radius:10px;border:1px solid #d0d7e2;background:#fafbfc;font-size:16px;outline:none;color:#2c3e50}
input:focus{border-color:#1a73e8;background:#fff}
button{width:100%;margin-top:12px;padding:14px;border:0;border-radius:10px;background:linear-gradient(135deg,#1a73e8,#4f8ff7);color:#fff;font-size:17px;font-weight:600;cursor:pointer;box-shadow:0 3px 10px rgba(26,115,232,.3);transition:opacity .2s}
button:disabled{opacity:.5;cursor:not-allowed}
#status{margin-top:14px;padding:14px;border-radius:12px;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.06);font-size:15px;display:none}
.ok{color:#1e8e3e}.err{color:#d93025}
h2{font-size:17px;color:#2c3e50;margin:24px 0 12px}
.file{background:#fff;border-radius:12px;padding:12px 14px;margin-bottom:8px;box-shadow:0 1px 4px rgba(0,0,0,.06);display:flex;flex-direction:column;gap:8px}
.fname{font-size:14px;color:#2c3e50;word-break:break-all}
.frow{display:flex;justify-content:space-between;align-items:center}
.fmeta{font-size:12px;color:#8a94a6;white-space:nowrap}
.dlbtn{display:inline-block;padding:8px 16px;background:#1a73e8;color:#fff;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;box-shadow:0 2px 6px rgba(26,115,232,.25);flex-shrink:0}
.dlbtn:active{opacity:.8}
.empty{color:#b0b8c4;text-align:center;padding:24px;font-size:14px}
</style>
</head>
<body>
<h1>🎬 视频解析</h1>
<p class="sub">粘贴视频链接（抖音 / B站 / YouTube 等），解析后保存到电脑</p>
<div class="input-wrap">
<input id="url" placeholder="粘贴完整分享文案或链接" />
<button id="btn" onclick="dl()">⚡ 解析</button>
</div>
<div id="status"></div>
<h2>📁 已解析</h2>
<div id="files"></div>
<script>
let polling=null,parsing=false;
let devId=localStorage.getItem('devId');
if(!devId){devId='dev-'+Math.random().toString(36).slice(2,10);localStorage.setItem('devId',devId);}
async function dl(){
  const url=document.getElementById('url').value.trim();
  if(!url){alert('请粘贴链接');return}
  const btn=document.getElementById('btn'),st=document.getElementById('status');
  btn.disabled=true;st.style.display='block';st.className='';st.textContent='📨 已提交，正在解析...';
  try{
    const r=await fetch('/download',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url,dev:devId})});
    const j=await r.json();
    if(!j.ok){st.className='err';st.textContent='❌ '+ (j.log||'提交失败');btn.disabled=false;return}
    parsing=true;
    st.textContent='⏳ 解析中...';
    polling=setInterval(async()=>{
      try{
        const s=await (await fetch('/status?job='+j.job)).json();
        if(s.done){
          clearInterval(polling);polling=null;parsing=false;btn.disabled=false;
          st.className=s.error?'err':'ok';
          st.textContent=s.error?'❌ 解析失败':'✅ 解析完成';
          loadFiles();
        }else if(s.progress){
          const p=s.progress;
          st.textContent='⏳ 解析中 '+p.pct+'%（'+p.size+'，'+p.speed+(p.eta?'，剩余 '+p.eta:'')+'）';
        }
      }catch(e){}
    },1000);
  }catch(e){st.className='err';st.textContent='错误: '+e.message;btn.disabled=false}
}
async function loadFiles(){
  try{
    const r=await fetch('/files?dev='+encodeURIComponent(devId));const files=await r.json();
    const el=document.getElementById('files');
    el.innerHTML=files.map(f=>'<div class="file"><div class="fname">'+f.name+'</div><div class="frow"><span class="fmeta">'+f.time+' · '+f.size+'</span><a class="dlbtn" href="/file/'+encodeURIComponent(f.name)+'">下载</a></div></div>').join('')||'<div class="empty">暂无记录</div>';
  }catch(e){}
}
loadFiles();
setInterval(()=>{ if(!parsing) loadFiles(); },5000); // 解析中不刷新列表
</script>
</body>
</html>`

function runYtDlp(url, jobId) {
  return new Promise((resolve) => {
    const args = ['--progress', '--newline']
    if (config.cookies === 'firefox') args.push('--cookies-from-browser', 'firefox')
    else if (config.cookies && existsSync(config.cookies)) args.push('--cookies', config.cookies)
    args.push(url)
    const child = spawn(YTDLP, args, { cwd: DOWNLOAD_DIR })
    let log = ''
    // yt-dlp 的进度可能输出到 stdout 或 stderr，两者都监听解析
    const onData = (d) => {
      log += d
      const text = String(d)
      const m = text.match(/\[download\]\s+(\d+(?:\.\d+)?)%\s+of\s+([\d.]+\s?[KMG]?iB)\s+at\s+([\d.]+\s?[KMG]?iB\/s)(?:\s+ETA\s+([\d:]+))?/)
      if (m) {
        const job = jobs.get(jobId)
        if (job) job.progress = { pct: m[1], size: m[2], speed: m[3], eta: m[4] ?? '' }
      }
    }
    child.stdout.on('data', onData)
    child.stderr.on('data', onData)
    child.on('error', (err) => resolve({ ok: false, log: String(err.message) }))
    child.on('close', (code) => resolve({ ok: code === 0, log: log.trim() }))
  })
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`)
  const remote = req.socket.remoteAddress
  try {
    if (req.method === 'GET' && url.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(HTML)
      return
    }
    if (req.method === 'POST' && url.pathname === '/download') {
      let body = ''
      for await (const chunk of req) body += chunk
      const { url: rawInput, dev: deviceId } = JSON.parse(body || '{}')
      const urlMatch = String(rawInput ?? '').match(/https?:\/\/[^\s，。]+/)
      const videoUrl = urlMatch ? urlMatch[0] : ''
      console.log(`[${new Date().toISOString()}] 解析请求 from=${remote} url=${videoUrl}`)
      if (!videoUrl) { res.writeHead(400); res.end(JSON.stringify({ ok: false, log: '未找到有效链接' })); return }
      const jobId = String(++jobSeq)
      jobs.set(jobId, { log: '⏳ 解析中...', done: false, error: false, dev: deviceId ?? '' })
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true, job: jobId }))
      runYtDlp(videoUrl, jobId).then((r) => {
        const job = jobs.get(jobId)
        if (r.ok && job?.dev) {
          const dests = [...r.log.matchAll(/Destination: (.+)/g)].map(m => path.basename(m[1].trim()))
          for (const f of dests) { history[f] = job.dev }
          saveHistory()
        }
        jobs.set(jobId, { log: r.log, done: true, error: !r.ok })
        if (r.ok) {
          console.log(`[${new Date().toISOString()}] 解析结束 job=${jobId} ok=true`)
        } else {
          const lines = String(r.log || '').split('\n').filter(Boolean)
          const tail = lines.slice(-3).join(' | ').slice(0, 300)
          console.log(`[${new Date().toISOString()}] 解析结束 job=${jobId} ok=false 原因: ${tail}`)
        }
      })
      return
    }
    if (req.method === 'GET' && url.pathname === '/status') {
      const job = jobs.get(url.searchParams.get('job') ?? '')
      if (!job) { res.writeHead(404); res.end(JSON.stringify({ done: true, error: true, log: '任务不存在' })); return }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(job))
      return
    }
    if (req.method === 'GET' && url.pathname === '/files') {
      const dev = url.searchParams.get('dev') ?? ''
      const all = await listFiles()
      // 只返回：本设备解析的 + 历史遗留(无归属)文件
      const files = dev ? all.filter(f => history[f.name] === undefined || history[f.name] === dev) : all
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(files))
      return
    }
    if (req.method === 'GET' && url.pathname.startsWith('/file/')) {
      const name = decodeURIComponent(url.pathname.slice(6))
      const filePath = path.join(DOWNLOAD_DIR, name)
      if (!existsSync(filePath)) { res.writeHead(404); res.end('not found'); return }
      const s = await stat(filePath)
      res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Disposition': `attachment; filename="${encodeURIComponent(name)}"`, 'Content-Length': s.size })
      createReadStream(filePath).pipe(res)
      return
    }
    res.writeHead(404); res.end('not found')
  } catch (err) {
    console.log(`[${new Date().toISOString()}] 错误 from=${remote} path=${url.pathname} err=${err.message}`)
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: false, log: String(err?.message ?? err) }))
  }
})

import { mkdirSync } from 'node:fs'
try { mkdirSync(DOWNLOAD_DIR, { recursive: true }) } catch {}
server.listen(PORT, HOST, () => console.log(`yt-dlp web 已启动: http://0.0.0.0:${PORT}`))
