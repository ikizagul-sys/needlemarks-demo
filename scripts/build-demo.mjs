import {cp,mkdir,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
const root=process.cwd(),target=resolve(root,'docs');
if(!target.startsWith(root+'\\')&&!target.startsWith(root+'/'))throw new Error('Geçersiz çıktı yolu');
await mkdir(target,{recursive:true});
for(const name of ['index.html','styles.css','app.js','data.js','catalog-rules.js','admin-catalog.js','content-defaults.js','store-content.js','config.js','.nojekyll','assets','data'])await cp(resolve(root,name),resolve(target,name),{recursive:true});
console.log('GitHub Pages demosu docs/ içinde hazır. Sunucu, kullanıcılar ve veritabanı dahil edilmedi.');
