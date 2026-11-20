const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const {spawn}=require('node:child_process');const {Core,dateKey}=require('../src/core.cjs');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function main(){
 const {Client}=await import('@modelcontextprotocol/sdk/client/index.js');const {StdioClientTransport}=await import('@modelcontextprotocol/sdk/client/stdio.js');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mentor-desktop-flow-'));const core=await Core.open(dir);
 const g=core.createGoal({title:'Python 数据分析',objective:'独立完成基础数据分析，并解释自己的处理选择',standards:{coverage:'接触数据读取、清洗与可视化的基本方法。',understanding:'能解释处理选择与适用条件。',application:'能独立完成陌生数据的分析案例。'}});
 core.setConnection(true);core.addRecord({goalId:g.id,title:'数据清洗笔记',content:'今天练习了缺失值处理，能解释删除缺失行的代价。但还没有尝试陌生数据。'});core.close();
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
  await call('commit_review',{requestId:ctx.review.id,attemptId:ctx.review.attemptId,idempotencyKey:'desktop-flow',judgements:[{dimension:'coverage',level:'developing',rationale:'有清洗学习记录，其他内容尚待补充。',evidenceIds:[recordId]},{dimension:'understanding',level:'emerging',rationale:'能自述处理代价，还需要问答验证。',evidenceIds:[recordId]},{dimension:'application',level:'unknown',rationale:'尚无陌生数据上的独立作品。',evidenceIds:[]}],confidence:'low',confidenceReason:'目前主要是文字自述，独立应用证据有限。',observation:'概念理解在推进，独立应用还需要更多证据。',report:{facts:[{text:'完成了缺失值处理学习笔记，讨论了删除样本的代价。',evidenceIds:[recordId]}],observation:'你已经开始解释处理选择。能否独立分析陌生数据，还需要更多证据。',suggestion:'如果愿意，可以在原 Agent 会话里讨论一个具体的处理选择。'}});
  await client.close();client=null;fs.writeFileSync(path.join(dir,'capture-ready'),'ready');
  const code=await Promise.race([exit,sleep(15000).then(()=>{throw new Error('桌面渲染未结束');})]);
  if(code!==0)throw new Error(`桌面进程退出${code}：${stderr}`);
  const status=JSON.parse(fs.readFileSync('artifacts/render-status.json','utf8'));
  if(status.errors.length||!status.text.includes('日报已同步')||!status.text.includes('陌生数据'))throw new Error('桌面未收到MCP同步或渲染异常：'+JSON.stringify(status));
  console.log('通过：真实 Electron 窗口启动 → MCP 读取记录 → 提交评估与日报 → UI 自动刷新。截图 artifacts/desktop.png');
 }finally{if(client)await client.close();if(child.exitCode===null)child.kill();await exit;fs.rmSync(dir,{recursive:true,force:true});}
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
