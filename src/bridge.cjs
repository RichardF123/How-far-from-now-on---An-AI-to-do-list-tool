const http = require('node:http');
const crypto = require('node:crypto');
function equal(a, b) { const aa = Buffer.from(a || ''), bb = Buffer.from(b || ''); return aa.length === bb.length && crypto.timingSafeEqual(aa, bb); }
async function startBridge(core, token) {
 const server = http.createServer(async (req, res) => {
  const send = (status, value) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); };
  if (req.headers.origin || req.method !== 'POST' || req.url !== '/tool') return send(403, { code: 'FORBIDDEN', message: '仅允许本地MCP适配器访问' });
  if (!equal(req.headers.authorization, `Bearer ${token}`)) return send(401, { code: 'UNAUTHORIZED', message: '连接凭据无效，请重新连接' });
  let size = 0, chunks = [];
  try {
   for await (const chunk of req) { size += chunk.length; if (size > 1024 * 1024) return send(413, { code: 'TOO_LARGE', message: '提交内容超过1MB' }); chunks.push(chunk); }
   const { name, arguments: args } = JSON.parse(Buffer.concat(chunks).toString('utf8'));
   const result = core.tool(name, args); send(200, { result });
  } catch (e) { send(e.code ? 400 : 500, { code: e.code || 'INTERNAL_ERROR', message: e.code ? e.message : '本地保存失败，请检查磁盘和权限后重试' }); }
 });
 server.requestTimeout = 15000;
 await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
 return server;
}
module.exports = { startBridge };
