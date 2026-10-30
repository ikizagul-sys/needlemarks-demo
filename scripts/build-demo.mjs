import {cp,mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const root=process.cwd(),target=resolve(root,'docs');
if(!target.startsWith(root+'\\')&&!target.startsWith(root+'/'))throw new Error('Geçersiz çıktı yolu');
const modules=['product-options.js','options-ui.js','app.js','data.js','catalog-rules.js','admin-catalog.js','content-defaults.js','store-content.js','config.js'];
const digest=createHash('sha256');
for(const name of [...modules,'index.html','styles.css','data/catalog.json'])digest.update(await readFile(resolve(root,name)));
const version=digest.digest('hex').slice(0,12);
await mkdir(target,{recursive:true});
for(const name of ['index.html','styles.css',...modules,'.nojekyll','assets','data'])await cp(resolve(root,name),resolve(target,name),{recursive:true});
for(const name of modules){const path=resolve(target,name);let code=await readFile(path,'utf8');code=code.replace(/from\s+(["'])(\.\/[^"']+\.js)\1/g,(_,quote,url)=>`from ${quote}${url}?v=${version}${quote}`).replace(/(["'])\.\/data\/catalog\.json\1/g,(_,quote)=>`${quote}./data/catalog.json?v=${version}${quote}`);await writeFile(path,code);}
const entry=resolve(target,'index.html');let html=await readFile(entry,'utf8');html=html.replace(/((?:src|href)=["'])(app\.js|config\.js|styles\.css)(["'])/g,(_,prefix,file,quote)=>`${prefix}${file}?v=${version}${quote}`);await writeFile(entry,html);
console.log(`GitHub Pages demosu docs/ içinde hazır. Sürüm: ${version}. Özel veriler dahil edilmedi.`);
