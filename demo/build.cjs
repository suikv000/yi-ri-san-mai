// Bundle the static demo into a double-clickable HTML file. No dependencies.
const fs=require('node:fs');
const path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,name),'utf8');
let html=read('index.html').replace('<link rel="stylesheet" href="styles.css">',()=>'<style>\n'+read('styles.css')+'\n</style>');
for(const file of ['data.js','nutrition.js','planner.js','app.js'])html=html.replace('<script defer src="'+file+'"></script>','');
const js=['data.js','nutrition.js','planner.js','app.js'].map(read).join('\n');
html=html.replace('</body>',()=>'<script>\n'+js+'\n</script>\n</body>');
const output=path.join(__dirname,'..','一日三麦-交互演示.html');
fs.writeFileSync(output,html);
console.log('Standalone HTML written. No credentials or account data are included.');
