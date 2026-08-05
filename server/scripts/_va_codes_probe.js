const path=require('path');
const {VirginiaClient,discoverGuideSlugs}=require('../services/virginia/fetch');
const {parseGuide}=require('../services/virginia/parseGuide');
(async()=>{
  const c=new VirginiaClient({cacheDir:path.resolve(__dirname,'../.virginia-cache')});
  const slugs=(await discoverGuideSlugs(c)).filter(s=>/guide/i.test(s));
  const codes=new Map(), prefixes=new Map();
  let guides=0;
  for(const s of slugs){
    const h=c.readCache('https://www.transfervirginia.org'+s); if(!h) continue;
    const g=parseGuide(h,{slug:s}); if(!g.has_cc_table) continue;
    guides++;
    for(const r of g.rows) for(const o of r.requirement.options||[]) for(const code of o.codes){
      codes.set(code,(codes.get(code)||0)+1);
      const p=code.split(' ')[0]; prefixes.set(p,(prefixes.get(p)||0)+1);
    }
  }
  console.log('guides parsed:',guides);
  console.log('DISTINCT course codes:',codes.size);
  console.log('distinct prefixes:',prefixes.size);
  const top=[...codes].sort((a,b)=>b[1]-a[1]);
  console.log('most-required codes:', top.slice(0,10).map(([k,v])=>k+'×'+v).join('  '));
  console.log('codes required by only one guide:', top.filter(([,v])=>v===1).length);
})();
