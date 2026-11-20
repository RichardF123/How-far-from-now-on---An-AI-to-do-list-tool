const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Core, dateKey } = require('../src/core.cjs');
async function fixture(t) {
 const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mentor-test-'));
 const core = await Core.open(dir); t.after(() => { core.close(); fs.rmSync(dir, { recursive: true, force: true }); });
 const goal = core.createGoal({ title: 'Python 数据分析', objective: '独立完成数据分析', standards: { coverage:'接触主要内容', understanding:'解释处理选择', application:'独立完成案例' } });
 core.setConnection(true);
 const record = core.addRecord({ goalId: goal.id, content: '学习了缺失值处理，能解释删除样本的取舍。', date: dateKey(new Date(), goal.timezone) });
 return { core, dir, goal, record };
}
function submission(ctx, record, key = 'review-one') {
 return { requestId: ctx.review.id, attemptId: ctx.review.attemptId, idempotencyKey: key,
  judgements: [{ dimension:'coverage',level:'developing',rationale:'有笔记佐证',evidenceIds:[record.id] }, { dimension:'understanding',level:'emerging',rationale:'初步解释，尚缺少核验',evidenceIds:[record.id] }, { dimension:'application',level:'unknown',rationale:'没有独立作品证据',evidenceIds:[] }],
  confidence:'low',confidenceReason:'仅有自述记录',observation:'已有初步理解，独立应用待验证。',report:{facts:[{text:'记录了缺失值处理的理解。',evidenceIds:[record.id]}],observation:'应通过更多证据判断独立能力。',suggestion:''} };
}
test('atomic review, evidence references, weighted score and idempotency survive restart', async t => {
 const {core,dir,goal,record}=await fixture(t);const ctx=core.tool('begin_review',{goalId:goal.id});const body=submission(ctx,record);
 const receipt=core.tool('commit_review',body);assert.equal(receipt.score,19.5);assert.equal(receipt.displayScore,20);
 assert.deepEqual(core.tool('commit_review',body),receipt);assert.equal(core.state.assessments.length,1);assert.equal(core.state.reports.length,1);
 assert.throws(()=>core.tool('commit_review',{...body,observation:'changed'}),{code:'IDEMPOTENCY_CONFLICT'});
 const reopened=await Core.open(dir);assert.equal(reopened.state.reports[0].facts[0].evidenceIds[0],record.id);assert.equal(reopened.state.receipts['review-one'].score,19.5);reopened.close();
});
test('untrusted and out-of-snapshot evidence cannot mutate progress or report',async t=>{
 const {core,goal,record}=await fixture(t);const ctx=core.tool('begin_review',{goalId:goal.id});const body=submission(ctx,record);body.report.facts[0].evidenceIds=['outside'];
 assert.throws(()=>core.tool('commit_review',body),{code:'INVALID_EVIDENCE'});assert.equal(core.state.assessments.length,0);assert.equal(core.state.reports.length,0);
});
test('cancelled reviews and changed target versions reject late commits',async t=>{
 const {core,goal,record}=await fixture(t);let ctx=core.tool('begin_review',{goalId:goal.id});core.cancel(ctx.review.id);
 assert.throws(()=>core.tool('commit_review',submission(ctx,record)),{code:'INVALID_STATE'});
 ctx=core.tool('begin_review',{goalId:goal.id});core.mutate(s=>{s.goals[0].version++;});
 assert.throws(()=>core.tool('commit_review',submission(ctx,record)),{code:'GOAL_CHANGED'});
});
test('new records remain pending when an earlier snapshot is submitted',async t=>{
 const {core,goal,record}=await fixture(t);const ctx=core.tool('begin_review',{goalId:goal.id});const newer=core.addRecord({goalId:goal.id,content:'后来又完成了新练习'});
 core.tool('commit_review',submission(ctx,record));assert.ok(!core.state.assessments[0].recordIds.includes(newer.id));assert.equal(core.state.records.length,2);
});
test('daily-only review preserves assessment timestamp; unknown does not produce zero percent',async t=>{
 const {core,goal,record}=await fixture(t);let ctx=core.tool('begin_review',{goalId:goal.id});let body=submission(ctx,record);
 body.judgements=body.judgements.map(j=>({...j,level:'unknown',evidenceIds:[]}));core.tool('commit_review',body);assert.equal(core.state.assessments[0].score,null);
 const old=core.state.assessments[0].createdAt;ctx=core.tool('begin_review',{goalId:goal.id});body=submission(ctx,record,'daily-two');delete body.judgements;core.tool('commit_review',body);
 assert.equal(core.state.assessments.length,1);assert.equal(core.state.assessments[0].createdAt,old);assert.equal(core.state.reports.length,2);
});
test('attachment remains after original is removed; unsupported files cannot become evidence',async t=>{
 const {core,dir,goal}=await fixture(t);const source=path.join(dir,'sample.py');fs.writeFileSync(source,'print("学习")');const r=core.addRecord({goalId:goal.id,content:''},[source]);fs.unlinkSync(source);
 const ctx=core.tool('begin_review',{goalId:goal.id});assert.equal(core.tool('read_evidence',{requestId:ctx.review.id,evidenceId:r.attachments[0].id}).content,'print("学习")');
 assert.throws(()=>core.tool('read_evidence',{requestId:ctx.review.id,evidenceId:'../../secret'}),{code:'NOT_FOUND'});
});
test('failed persistence leaves prior in-memory state unchanged',async t=>{
 const {core,goal}=await fixture(t);const revision=core.state.revision,records=core.state.records.length;const prior=core.file;core.file=path.join(core.dir,'nonexistent','no.sqlite');
 assert.throws(()=>core.addRecord({goalId:goal.id,content:'写入应失败'}));assert.equal(core.state.revision,revision);assert.equal(core.state.records.length,records);core.file=prior;
});
test('revocation blocks tools and validation rejects future and invalid dates',async t=>{
 const {core,goal}=await fixture(t);core.setConnection(false);assert.throws(()=>core.tool('list_learning_goals'),{code:'PERMISSION_DENIED'});
 assert.throws(()=>core.addRecord({goalId:goal.id,content:'future',date:'2999-01-01'}),{code:'INVALID_DATE'});
 assert.throws(()=>core.addRecord({goalId:goal.id,content:'invalid',date:'2026-02-30'}),{code:'INVALID_DATE'});
});
module.exports={submission};
