const esbuild = require('esbuild');
const fs = require('node:fs');
fs.mkdirSync('dist', { recursive: true });
esbuild.buildSync({ entryPoints: ['src/ui/app.jsx'], bundle: true, outfile: 'dist/app.js', platform: 'browser', minify: false, sourcemap: false, define: { 'process.env.NODE_ENV': '"production"' } });
for (const file of ['index.html', 'style.css']) fs.copyFileSync(`src/ui/${file}`, `dist/${file}`);
