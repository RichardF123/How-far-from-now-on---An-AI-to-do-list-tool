const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const {spawn}=require('node:child_process');const {Core,dateKey}=require('../src/core.cjs');const {newGoalForTemplate}=require('../src/goal-templates.cjs');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function main(){
 const {Client}=await import('@modelcontextprotocol/sdk/client/index.js');const {StdioClientTransport}=await import('@modelcontextprotocol/sdk/client/stdio.js');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mentor-desktop-flow-'));const core=await Core.open(dir);
 const g=core.createGoal({...newGoalForTemplate('project'),title:'发布个人网站',objective:'完成作品展示页，并通过发布前的功能验收'});
 core.setConnection(true);core.addRecord({goalId:g.id,title:'首页与交互验收',content:'完成首页和作品列表，导航正常；移动端布局和键盘访问还未验收。'});core.close();
 const env={...process.env,LEARNING_MENTOR_DATA:dir,LEARNING_MENTOR_CAPTURE_DIR:path.resolve('artifacts')};delete env.ELECTRON_RUN_AS_NODE;
 const child=spawn(process.env.MENTOR_DESKTOP_EXE||require('electron'),[...(process.env.MENTOR_DESKTOP_EXE?[]:['.']),'--capture','--live-test'],{cwd:path.resolve(__dirname,'..'),env,windowsHide:true,stdio:'pipe'});let stderr='';child.stderr.on('data',c=>stderr+=c);
 const exit=new Promise(resolve=>child.on('exit',resolve));let client;
 try{
  const deadline=Date.now()+15000;while(!fs.existsSync(path.join(dir,'connection.json'))&&Date.now()<deadline)await sleep(150);
  if(!fs.existsSync(path.join(dir,'connection.json')))throw new Error('桌面服务未启动：'+stderr);
  client=new Client({name:'desktop-flow-test',version:'1.0'});
  await client.connect(new StdioClientTransport({command:process.execPath,args:[path.resolve('src/mcp.cjs')],env}));
  const call=async(name,args={})=>{const r=await client.callTool({name,arguments:args});if(r.isError)throw new Error(r.content[0].text);return JSON.parse(r.content[0].text);};
  await call('verify_connection');const ctx=await call('begin_review',{goalId:g.id});const recordId=ctx.records[0].id;
  await call('read_evidence',{requestId:ctx.review.id,evidenceId:recordId});
  await call('commit_review',{requestId:ctx.review.id,attemptId:ctx.review.attemptId,idempotencyKey:'desktop-flow',judgements:[{dimension:'delivery',level:'developing',rationale:'首页和作品列表已有成果，剩余页面仍待确认。',evidenceIds:[recordId]},{dimension:'quality',level:'emerging',rationale:'基础导航已检查，移动端与键盘访问仍待验收。',evidenceIds:[recordId]}],confidence:'low',confidenceReason:'目前只有进展文字，尚需交付成果和验收记录佐证。',observation:'主要页面已有成果，发布前的验收仍需补充证据。',report:{facts:[{text:'完成首页与作品列表，并检查了基础导航。',evidenceIds:[recordId]}],observation:'交付已有推进，移动端布局与键盘访问仍待验收。',suggestion:'可以在自己的 Agent 中讨论现有验收记录是否足够。'}});
  await client.close();client=null;fs.writeFileSync(path.join(dir,'capture-ready'),'ready');
  const code=await Promise.race([exit,sleep(15000).then(()=>{throw new Error('桌面渲染未结束');})]);
  if(code!==0)throw new Error(`桌面进程退出${code}：${stderr}`);
  const status=JSON.parse(fs.readFileSync('artifacts/render-status.json','utf8'));
  if(status.errors.length||!status.text.includes('日报已同步')||!status.text.includes('键盘访问'))throw new Error('桌面未收到MCP同步或渲染异常：'+JSON.stringify(status));
  console.log('通过：真实 Electron 窗口启动 → MCP 读取记录 → 提交评估与日报 → UI 自动刷新。截图 artifacts/desktop.png');
 }finally{if(client)await client.close();if(child.exitCode===null)child.kill();await exit;fs.rmSync(dir,{recursive:true,force:true});}
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
