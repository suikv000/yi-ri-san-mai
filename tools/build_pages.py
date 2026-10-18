#!/usr/bin/env python3
"""Build static Pages and synchronize the standalone Skill's shared engine."""
from pathlib import Path
import json,shutil,subprocess
ROOT=Path(__file__).resolve().parents[1]
FILES=['index.html','styles.css','data.js','nutrition.js','planner.js','app.js']
def build():
    output=ROOT/'_site'
    if output.is_symlink():raise RuntimeError('Output must not be a symlink')
    if output.exists():shutil.rmtree(output)
    output.mkdir()
    for name in FILES:shutil.copyfile(ROOT/'demo'/name,output/name)
    (output/'.nojekyll').touch()
    skill=ROOT/'skills/yi-ri-san-mai'
    text=(ROOT/'demo/data.js').read_text()
    data=json.loads(text.split('window.MAI_DATA = ',1)[1].strip().removesuffix(';'))
    (skill/'references/snapshot.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
    for name in ['nutrition.js','planner.js']:shutil.copyfile(ROOT/'demo'/name,skill/'lib'/name)
    subprocess.run(['node',str(ROOT/'demo/build.cjs')],check=True)
    print('Built public static showcase and synchronized standalone Skill')
if __name__=='__main__':build()
