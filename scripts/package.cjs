const path=require('node:path');
async function main(){
 const {packager}=await import('@electron/packager');
 const version=require('electron/package.json').version;
 const cache=require('node:fs').existsSync(path.resolve('artifacts',`electron-v${version}-win32-x64.zip`))?{electronZipDir:path.resolve('artifacts')}:{};
 const result=await packager({dir:'.',name:'LearningMentor',platform:'win32',arch:'x64',out:process.env.MENTOR_RELEASE_DIR||'release-v0.2',overwrite:true,prune:true,asar:false,...cache,ignore:[/^\/test(?:\/|$)/,/^\/release(?:-[^/]+)?(?:\/|$)/,/^\/artifacts(?:\/|$)/],win32metadata:{CompanyName:'Learning Mentor',FileDescription:'长期目标助手',ProductName:'Learning Mentor'}});
 console.log('便携版：'+result.join(', '));
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
