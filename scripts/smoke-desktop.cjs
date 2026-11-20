const { Core, dateKey } = require('../src/core.cjs');
const fs = require('node:fs'); const path = require('node:path'); const os = require('node:os'); const { spawn } = require('node:child_process');
async function main() {
 const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mentor-desktop-'));
 const core = await Core.open(dir);
 const g = core.createGoal({ title: 'Python 数据分析 · 测试', objective: '独立完成基础数据分析，并解释处理选择', standards: { coverage:'接触主要知识并整理来源', understanding:'解释概念和取舍', application:'独立完成陌生案例' } });
 core.setConnection(true);
 const record = core.addRecord({goalId:g.id,title:'缺失值处理练习 · 测试记录',content:'这是界面测试材料：完成课程示例，能够初步解释删除样本和填充的差别。',date:dateKey(new Date(),g.timezone)});
 const ctx=core.tool('begin_review',{goalId:g.id});
 core.tool('commit_review',{requestId:ctx.review.id,attemptId:ctx.review.attemptId,idempotencyKey:'smoke',judgements:[{dimension:'coverage',level:'developing',rationale:'测试材料显示接触相关概念。',evidenceIds:[record.id]},{dimension:'understanding',level:'emerging',rationale:'初步解释，仍需验证。',evidenceIds:[record.id]},{dimension:'application',level:'unknown',rationale:'没有独立作品证据。',evidenceIds:[]}],confidence:'low',confidenceReason:'测试数据，仅用于核验界面与协议链路。',observation:'概念理解有所推进，独立应用仍待验证。',report:{facts:[{text:'提交了一份缺失值处理练习记录。',evidenceIds:[record.id]}],observation:'这份材料展示了初步理解，陌生数据上的独立应用还需要更多证据。'}});
 core.close();
 const env={...process.env,LEARNING_MENTOR_DATA:dir};delete env.ELECTRON_RUN_AS_NODE;
 const child=spawn(require('electron'),['.','--capture'],{cwd:path.resolve(__dirname,'..'),env,windowsHide:true,stdio:'pipe'});
 let stderr='';child.stderr.on('data',c=>{stderr+=c.toString();});
 const timer=setTimeout(()=>child.kill(),30000);
 const code=await new Promise(resolve=>child.on('exit',resolve));clearTimeout(timer);
 try {
  if(code!==0)throw new Error(`Electron exited ${code}: ${stderr}`);
  const status=JSON.parse(fs.readFileSync('artifacts/render-status.json','utf8'));
  if(status.errors.length || !status.text.includes('导师观察') || !status.text.includes('日报已同步')) throw new Error(`渲染异常 ${JSON.stringify(status)}`);
  console.log('Electron 渲染通过，评估与日报可见，无 UI 异常；截图 artifacts/desktop.png');
 } finally {fs.rmSync(dir,{recursive:true,force:true});}
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
