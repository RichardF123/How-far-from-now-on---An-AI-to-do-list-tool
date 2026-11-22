const { app, BrowserWindow, ipcMain, dialog, clipboard, Tray, Menu, nativeImage } = require('electron');
const { Core } = require('./core.cjs');
const { startBridge } = require('./bridge.cjs');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const capture = process.argv.includes('--capture');
const dataDir = process.env.LEARNING_MENTOR_DATA || path.join(app.getPath('appData'), 'LearningMentor');
let core, bridge, win, tray, exiting = false, token;
const selected = new Map();
const root = path.resolve(__dirname, '..');
const captureDir = process.env.LEARNING_MENTOR_CAPTURE_DIR || path.join(root, 'artifacts');
if (!capture && !app.requestSingleInstanceLock()) app.quit();
else app.whenReady().then(async () => {
 try {
  fs.mkdirSync(dataDir, { recursive: true });
  if (process.platform === 'win32') {
   const who = execFileSync('whoami', ['/user','/fo','csv','/nh'], { encoding: 'utf8', windowsHide: true });
   const sid = who.match(/S-1-[\d-]+/)?.[0]; if (!sid) throw new Error('无法确认当前用户的数据目录权限');
   execFileSync('icacls', [dataDir, '/inheritance:r', '/grant:r', `*${sid}:(OI)(CI)F`], { windowsHide: true, stdio: 'ignore' });
  }
  core = await Core.open(dataDir, revision => { if (win && !win.isDestroyed()) win.webContents.send('state-changed', revision); });
  token = crypto.randomBytes(32).toString('hex');
  bridge = await startBridge(core, token);
  fs.writeFileSync(path.join(dataDir, 'connection.json'), JSON.stringify({ port: bridge.address().port, token }), { mode: 0o600 });
  win = new BrowserWindow({ width: 1180, height: 820, minWidth: 780, minHeight: 640, show: !capture, frame: false, backgroundColor: '#edf2fb', title: '长期目标助手', webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: !capture } });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', e => e.preventDefault());
  win.webContents.on('console-message', (_event, level, message) => { if (capture) process.stderr.write(`renderer: ${message}\n`); });
  win.webContents.on('render-process-gone', () => { dialog.showErrorBox('界面已停止', '目标记录已保存在本机，请重新打开应用。'); });
  const handle = (name, fn) => ipcMain.handle(name, async (event, ...args) => {
   if (event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame) throw new Error('无效来源');
   try { return { ok: true, value: await fn(...args) }; } catch(e) { return { ok: false, code: e.code || 'LOCAL_ERROR', message: e.code ? e.message : '操作失败，请检查文件、磁盘空间或连接后重试' }; }
  });
  handle('snapshot', () => core.snapshot());
  handle('create-goal', a => core.createGoal(a));
  handle('choose-files', async () => {
   const result = await dialog.showOpenDialog(win, { title: '添加相关材料', properties: ['openFile','multiSelections'] });
   if (result.canceled) return [];
   return result.filePaths.map(f => { const key = crypto.randomUUID(); selected.set(key, f); return { id: key, name: path.basename(f), size: fs.statSync(f).size }; });
  });
  handle('save-record', a => {
   const files = (a.fileIds || []).map(key => { const f = selected.get(key); if (!f) throw new Error('附件选择已过期'); return f; });
   const record = core.addRecord(a, files); for (const key of a.fileIds || []) selected.delete(key); return record;
  });
  handle('request-review', a => core.request(a));
  handle('cancel-review', key => core.cancel(key));
  handle('connection', enabled => core.setConnection(enabled));
  handle('setup', () => {
   const command = process.execPath.replaceAll('\\','/');
   const script = path.join(root, 'src', 'mcp.cjs').replaceAll('\\','/');
   const dir = dataDir.replaceAll('\\','/');
   return { config: `[mcp_servers.learning_mentor]\ncommand = ${JSON.stringify(command)}\nargs = [${JSON.stringify(script)}]\n\n[mcp_servers.learning_mentor.env]\nELECTRON_RUN_AS_NODE = "1"\nLEARNING_MENTOR_DATA = ${JSON.stringify(dir)}\n`, dataDir };
  });
  handle('copy', value => { if (typeof value !== 'string' || value.length > 100000) throw new Error('复制内容无效'); clipboard.writeText(value); });
  handle('window-action', action => { if(action === 'minimize') win.minimize(); if(action === 'hide') win.hide(); if(action === 'quit') { exiting = true; app.quit(); } if(action === 'pin') { win.setAlwaysOnTop(!win.isAlwaysOnTop()); return win.isAlwaysOnTop(); } if(action === 'compact') { const compact = win.getBounds().width > 500; win.setMinimumSize(compact ? 350 : 780, compact ? 430 : 640); win.setSize(compact ? 390 : 1180, compact ? 540 : 820); return compact; } });
  if (!capture) {
   const pixels = Buffer.alloc(16 * 16 * 4);
   for(let y=1;y<15;y++)for(let x=1;x<15;x++){ const i=(y*16+x)*4; const book=y>3&&y<12&&((x>3&&x<7)||(x>8&&x<12)); pixels[i]=book?255:255; pixels[i+1]=book?255:122; pixels[i+2]=book?255:0; pixels[i+3]=255; }
   const icon = nativeImage.createFromBitmap(pixels, { width:16, height:16 });
   tray = new Tray(icon); tray.setToolTip('长期目标助手');
   tray.setContextMenu(Menu.buildFromTemplate([{ label: '打开目标助手', click: () => win.show() }, { label: '退出', click: () => { exiting = true; app.quit(); } }]));
   tray.on('click', () => win.show());
   win.on('close', event => { if(!exiting) { event.preventDefault(); win.hide(); } });
  }
  await win.loadFile(path.join(root, 'dist', 'index.html'));
  if (capture) {
   if(process.argv.includes('--live-test')) {
    const deadline = Date.now() + 25000;
    while(!fs.existsSync(path.join(dataDir, 'capture-ready')) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 200));
   }
   await new Promise(resolve => setTimeout(resolve, 1200));
   await win.webContents.capturePage();
   await new Promise(resolve => setTimeout(resolve, 250));
   const image = await win.webContents.capturePage(); fs.mkdirSync(captureDir, { recursive: true });
   fs.writeFileSync(path.join(captureDir, 'desktop.png'), image.toPNG());
   const status = await win.webContents.executeJavaScript(`({ text: document.body.innerText, errors: window.__uiErrors || [], layout: [...document.querySelectorAll('.track span,.widget-actions,.widget-actions button')].map(el=>({class:el.className,text:el.innerText,style:el.getAttribute('style'),width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height,x:el.getBoundingClientRect().x,y:el.getBoundingClientRect().y,visibility:getComputedStyle(el).visibility,opacity:getComputedStyle(el).opacity})) })`);
   fs.writeFileSync(path.join(captureDir, 'render-status.json'), JSON.stringify(status, null, 2));
   for(const [label, filename] of [['进度详情','progress.png'],['记录','record.png'],['Agent 设置','connection.png'],['__create_goal__','create-goal.png']]) {
    await win.webContents.executeJavaScript(`(()=>{const close=document.querySelector('[aria-label="关闭面板"]');if(close)close.click();const b=${JSON.stringify(label)}==='__create_goal__'?document.querySelector('button[title="添加目标"]'):[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(label)});if(b)b.click();})()`);
    await new Promise(resolve=>setTimeout(resolve,400));
    fs.writeFileSync(path.join(captureDir,filename),(await win.webContents.capturePage()).toPNG());
   }
   app.quit();
  }
 } catch(e) { if(capture) process.stderr.write(`${e.stack}\n`); else dialog.showErrorBox('无法启动目标助手', e.message); app.exit(1); }
});
app.on('second-instance', () => { win?.show(); win?.focus(); });
app.on('before-quit', () => { exiting = true; if(bridge) { bridge.close(); try { const f=path.join(dataDir,'connection.json'); if(JSON.parse(fs.readFileSync(f,'utf8')).token===token)fs.unlinkSync(f); } catch {} } core?.close(); });
app.on('window-all-closed', () => { if(!tray) app.quit(); });
