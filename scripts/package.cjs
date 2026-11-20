const path=require('node:path');
async function main(){
 const {packager}=await import('@electron/packager');
 const version=require('electron/package.json').version;
 const cache=require('node:fs').existsSync(path.resolve('artifacts',`electron-v${version}-win32-x64.zip`))?{electronZipDir:path.resolve('artifacts')}:{};
 const result=await packager({dir:'.',name:'LearningMentor',platform:'win32',arch:'x64',out:'release',overwrite:true,prune:true,asar:false,...cache,ignore:[/^\/test(?:\/|$)/,/^\/release(?:\/|$)/,/^\/artifacts(?:\/|$)/],win32metadata:{CompanyName:'Learning Mentor',FileDescription:'长期学习导师',ProductName:'Learning Mentor'}});
 console.log('便携版：'+result.join(', '));
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
