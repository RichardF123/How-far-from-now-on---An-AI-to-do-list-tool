// Shared by the local core and renderer. Templates are editable starting points.
const templates = [
 { id:'custom', label:'自定义目标', example:'例如：完成一次搬家', criteria:[
  {id:'milestones',label:'阶段成果',standard:'目标包含哪些阶段成果，怎样确认这些成果已经完成？',weight:60},
  {id:'acceptance',label:'完成质量',standard:'最终成果需要满足哪些可检查的条件？',weight:40}
 ]},
 { id:'project', label:'项目与工作', example:'例如：发布个人网站', criteria:[
  {id:'delivery',label:'成果交付',standard:'约定的功能、文档或交付物已完成，并有可查看的成果。',weight:60},
  {id:'quality',label:'验收质量',standard:'成果通过事先约定的检查或测试，关键问题已解决。',weight:40}
 ]},
 { id:'fitness', label:'运动与训练', example:'例如：完成本阶段的跑步训练', mode:'period', criteria:[
  {id:'training',label:'训练执行',standard:'在本阶段完成用户自己确认的训练安排，以实际记录为依据。',weight:40},
  {id:'performance',label:'目标表现',standard:'以用户确认的阶段表现标准和可比较记录判断，不仅按训练次数评价。',weight:60}
 ]},
 { id:'creative', label:'创作与兴趣', example:'例如：完成一篇短篇小说', criteria:[
  {id:'draft',label:'作品完成',standard:'已完成约定范围的作品或草稿，有可查看的内容。',weight:60},
  {id:'revision',label:'修改与质量',standard:'完成约定的修改并满足用户确认的作品要求。',weight:40}
 ]},
 { id:'life', label:'生活与习惯', example:'例如：本月建立规律的阅读习惯', mode:'period', criteria:[
  {id:'consistency',label:'阶段执行',standard:'在约定周期中按用户确认的安排执行，以实际记录判断。',weight:50},
  {id:'outcome',label:'实际效果',standard:'在约定周期内出现用户期望的实际变化，以具体反馈验证。',weight:50}
 ]},
 { id:'learning', label:'学习与成长', example:'例如：独立完成基础数据分析', criteria:[
  {id:'coverage',label:'内容覆盖',standard:'接触并整理目标范围的主要知识，能指出学习来源。',weight:20},
  {id:'understanding',label:'理解程度',standard:'能用自己的话解释关键概念、处理思路与适用条件。',weight:30},
  {id:'application',label:'独立应用',standard:'能独立完成对应案例或作品，并解释选择。',weight:50}
 ]}
];
const legacyLabels={coverage:'内容覆盖',understanding:'理解程度',application:'独立应用'};
function criteriaForGoal(goal){
 if(Array.isArray(goal.criteria)&&goal.criteria.length)return goal.criteria;
 return Object.keys(legacyLabels).map(id=>({id,label:legacyLabels[id],standard:goal.standards[id],weight:goal.weights[id]}));
}
function newGoalForTemplate(templateId='custom'){
 const t=templates.find(t=>t.id===templateId)||templates[0];
 return {title:'',objective:'',category:t.id,mode:t.mode||'outcome',scope:'',criteria:t.criteria.map(c=>({...c}))};
}
module.exports={templates,criteriaForGoal,newGoalForTemplate};
