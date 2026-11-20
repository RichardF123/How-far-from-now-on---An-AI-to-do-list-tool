// Fetch the official release using Node's native HTTP client and verify the npm-supplied checksum.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
async function main() {
 const base = path.dirname(require.resolve('electron/package.json'));
 const { version } = require('electron/package.json');
 const filename = `electron-v${version}-win32-x64.zip`;
 const dest = path.resolve('artifacts', filename); fs.mkdirSync(path.dirname(dest), { recursive: true });
 const url = `https://github.com/electron/electron/releases/download/v${version}/${filename}`;
 const chunkSize = 1024 * 1024;
 const fetchPart = async (start, end) => {
  for(let attempt=0;attempt<3;attempt++) {
   try { const res=await fetch(`${url}?part=${start}`, { headers: {Range:`bytes=${start}-${end}`}, signal:AbortSignal.timeout(45000) });
    if(res.status!==206) throw new Error(`范围下载失败 ${res.status}`);
    const match=res.headers.get('content-range')?.match(/^bytes (\d+)-(\d+)\/(\d+)$/);
    if(!match || Number(match[1])!==start) throw new Error('下载范围不符');
    const bytes=Buffer.from(await res.arrayBuffer());
    if(bytes.length!==Number(match[2])-start+1) throw new Error('分段长度不符');
    return {bytes,total:Number(match[3])};
   } catch(e) { if(attempt===2) throw e; }
  }
 };
 const first=await fetchPart(0,chunkSize-1);const fd=fs.openSync(dest,'w');let next=chunkSize,done=first.bytes.length;
 try { fs.ftruncateSync(fd,first.total);fs.writeSync(fd,first.bytes,0,first.bytes.length,0);
  await Promise.all(Array.from({length:8},async()=>{while(next<first.total){const start=next;next+=chunkSize;const part=await fetchPart(start,Math.min(start+chunkSize-1,first.total-1));fs.writeSync(fd,part.bytes,0,part.bytes.length,start);done+=part.bytes.length;if(Math.floor(done/chunkSize)%20===0)console.log(`已下载 ${Math.round(done/first.total*100)}%`);}}));
  fs.fsyncSync(fd);
 } finally {fs.closeSync(fd);}
 const checksum = crypto.createHash('sha256').update(fs.readFileSync(dest)).digest('hex');
 if(checksum !== require(path.join(base, 'checksums.json'))[filename]) throw new Error('Electron 校验失败');
 const { extract } = require(require.resolve('@electron-internal/extract-zip', { paths: [base] }));
 await extract(dest, { dir: path.join(base, 'dist') });
 fs.writeFileSync(path.join(base, 'path.txt'), 'electron.exe'); console.log('Electron 已下载并通过 SHA-256 校验');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
