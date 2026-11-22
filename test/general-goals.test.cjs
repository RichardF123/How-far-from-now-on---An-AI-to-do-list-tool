const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const {Core}=require('../src/core.cjs');
const {newGoalForTemplate}=require('../src/goal-templates.cjs');
async function setup(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'generic-goals-'));const core=await Core.open(dir);t.after(()=>{core.close();fs.rmSync(dir,{recursive:true,force:true});});return{dir,core};}
function review(ctx,record,levels,key='generic'){
 return {requestId:ctx.review.id,attemptId:ctx.review.attemptId,idempotencyKey:key,judgements:ctx.goal.criteria.map((c,i)=>({dimension:c.id,level:levels[i],rationale:'按本目标已确认标准与记录进行判断。',evidenceIds:levels[i]==='unknown'?[]:[record.id]})),confidence:'low',confidenceReason:'仍需要更多证据。',observation:'本阶段有成果，仍有未核验部分。',report:{facts:[{text:'提交了目标相关的进展材料。',evidenceIds:[record.id]}],observation:'仅按当前目标与阶段评价，不推断永久完成。'}};
}
test('project goals use two goal-specific criteria and service-calculated normalized weights',async t=>{
 const{core}=await setup(t);const goal=core.createGoal({...newGoalForTemplate('project'),title:'发布个人网站',objective:'页面可用且完成验收'});
 assert.deepEqual(goal.criteria.map(c=>c.id),['delivery','quality']);assert.deepEqual(goal.weights,{delivery:.6,quality:.4});
 core.setConnection(true);const record=core.tool('append_goal_record',{goalId:goal.id,content:'完成首页，仍有测试未通过。'});const ctx=core.tool('begin_review',{goalId:goal.id});
 const receipt=core.tool('commit_review',review(ctx,record,['developing','emerging']));assert.equal(receipt.score,46);assert.equal(receipt.displayScore,45);
 assert.equal(core.tool('list_goals').goals[0].category,'project');assert.equal(core.state.reports.length,1);
});
test('arbitrary count, labels and weights work without learning dimension names',async t=>{
 const{core}=await setup(t);const goal=core.createGoal({title:'搬家',objective:'物品迁移并完成交接',criteria:[{id:'packing',label:'物品整理',standard:'物品打包',weight:2},{id:'moving',label:'运输',standard:'完成运输',weight:3},{id:'handover',label:'交接',standard:'完成交接',weight:4},{id:'settled',label:'安置',standard:'必需品可用',weight:1}]});
 assert.equal(goal.category,'custom');assert.deepEqual(goal.criteria.map(c=>c.weight),[.2,.3,.4,.1]);
 core.setConnection(true);const record=core.addRecord({goalId:goal.id,content:'整理完成，交接暂未开始。'});const ctx=core.tool('begin_review',{goalId:goal.id});
 const result=core.tool('commit_review',review(ctx,record,['demonstrated','developing','unknown','emerging']));assert.equal(result.score,40.5);
});
test('period goals require a scope and carry it into the Agent context',async t=>{
 const{core}=await setup(t);const a={...newGoalForTemplate('fitness'),title:'本阶段跑步训练',objective:'按自行确认的计划推进'};
 assert.throws(()=>core.createGoal(a),{code:'INVALID_INPUT'});
 const goal=core.createGoal({...a,scope:'未来四周；只评价本阶段已确认的训练与表现。'});core.setConnection(true);
 const ctx=core.tool('begin_review',{goalId:goal.id});assert.equal(ctx.goal.mode,'period');assert.equal(ctx.goal.scope,goal.scope);assert.match(ctx.instructions,/scope/);
});
test('invalid goal criteria are rejected before persistence',async t=>{
 const{core}=await setup(t);const a={...newGoalForTemplate('project'),title:'项目',objective:'交付'};
 for(const criteria of [[],[{...a.criteria[0],weight:0}],[{...a.criteria[0],weight:Infinity}],[a.criteria[0],a.criteria[0]],[{...a.criteria[0],id:'constructor'}]])assert.throws(()=>core.createGoal({...a,criteria}),{code:'INVALID_CRITERIA'});
 assert.equal(core.state.goals.length,0);
});
test('learning-only judgements cannot be used to score a project',async t=>{
 const{core}=await setup(t);const goal=core.createGoal({...newGoalForTemplate('project'),title:'项目',objective:'交付'});core.setConnection(true);const record=core.addRecord({goalId:goal.id,content:'有初步成果'});const ctx=core.tool('begin_review',{goalId:goal.id});const body=review(ctx,record,['emerging','unknown']);body.judgements[0].dimension='coverage';
 assert.throws(()=>core.tool('commit_review',body),{code:'INVALID_REVIEW'});assert.equal(core.state.assessments.length,0);assert.equal(core.state.reports.length,0);
});
test('ongoing goals preserve the review scope and never mark the lifetime goal complete',async t=>{
 const{core}=await setup(t);const input={...newGoalForTemplate('fitness'),title:'阶段训练',objective:'完成自己确认的阶段训练',scope:'本月四周，以实际训练和阶段表现为依据'};
 assert.throws(()=>core.createGoal({...input,scope:''}),{code:'INVALID_INPUT'});
 const goal=core.createGoal(input);core.setConnection(true);const record=core.addRecord({goalId:goal.id,content:'本阶段已完成约定训练与表现验证，附文字说明。'});const ctx=core.tool('begin_review',{goalId:goal.id});
 assert.equal(ctx.goal.scope,input.scope);assert.equal(ctx.goal.mode,'period');
 const result=core.tool('commit_review',review(ctx,record,['demonstrated','demonstrated'],'period'));
 assert.equal(result.score,100);assert.equal(core.state.goals[0].mode,'period');assert.equal(core.state.goals[0].completed,undefined);
});
test('custom goals accept four independent criteria rather than a fixed rubric length',async t=>{
 const{core}=await setup(t);const goal=core.createGoal({title:'整理搬家',objective:'完成搬迁并验收',category:'custom',criteria:['packing','moving','settling','handover'].map((id,i)=>({id,label:id,standard:'按双方确认的验收条件完成这一部分',weight:i+1}))});
 assert.equal(goal.criteria.length,4);assert.equal(goal.weights.handover,.4);core.setConnection(true);const record=core.addRecord({goalId:goal.id,content:'整理打包和搬运进展说明'});const ctx=core.tool('begin_review',{goalId:goal.id});const result=core.tool('commit_review',review(ctx,record,['demonstrated','developing','unknown','unknown'],'custom-four'));
 assert.equal(result.score,22);assert.equal(core.state.assessments[0].judgements.length,4);
});
test('legacy data migrates with a backup, preserving scores, reports and criteria',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'legacy-goals-'));let core=await Core.open(dir);
 try{
  const g=core.createGoal({title:'原学习目标',objective:'保留旧记录',standards:{coverage:'覆盖',understanding:'理解',application:'应用'}});core.setConnection(true);const r=core.addRecord({goalId:g.id,content:'旧记录'});const ctx=core.tool('begin_review',{goalId:g.id});core.tool('commit_review',review(ctx,r,['developing','emerging','unknown'],'legacy'));
  const assessment=structuredClone(core.state.assessments[0]);const report=structuredClone(core.state.reports[0]);
  core.mutate(s=>{s.schema=1;delete s.goals[0].criteria;delete s.goals[0].category;delete s.goals[0].mode;delete s.goals[0].scope;});core.close();core=await Core.open(dir);
  assert.equal(core.state.schema,2);assert.equal(core.state.goals[0].category,'learning');assert.deepEqual(core.state.assessments[0],assessment);assert.deepEqual(core.state.reports[0],report);assert.deepEqual(core.state.goals[0].criteria.map(c=>c.id),['coverage','understanding','application']);
  assert.ok(fs.existsSync(path.join(dir,'learning.sqlite.before-generic-goals.bak')));
 }finally{core.close();fs.rmSync(dir,{recursive:true,force:true});}
});
