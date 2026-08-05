const fs=require('fs'), path=require('path');
const {VirginiaClient, discoverGuideSlugs}=require('../services/virginia/fetch');
const {parseGuide}=require('../services/virginia/parseGuide');
const {supplyForCode}=require('../services/virginia/courseSupply');
(async()=>{
  const c=new VirginiaClient({cacheDir:path.resolve(__dirname,'../.virginia-cache'),delayMs:2500,concurrency:1});
  const slugs=(await discoverGuideSlugs(c)).filter(s=>/guide/i.test(s));
  const codes=new Set();
  for(const s of slugs){
    const h=c.readCache('https://www.transfervirginia.org'+s); if(!h) continue;
    const g=parseGuide(h,{slug:s}); if(!g.has_cc_table) continue;
    for(const r of g.rows) for(const o of r.requirement.options||[]) for(const x of o.codes) codes.add(x);
  }
  const list=[...codes].sort();
  console.error(`${list.length} distinct codes to look up`);
  const supply={}, problems=[];
  let i=0;
  for(const code of list){
    if(++i%50===0) console.error(`  …${i}/${list.length} (blocked:${c.stats.blocked} err:${c.stats.errors})`);
    const s=await supplyForCode(c, code);
    if(!s.ok){ problems.push({code, reason:s.reason}); continue; }
    if(!s.verified) problems.push({code, reason:'not_exact', off:s.off_code_rows});
    supply[code]={ccs:s.community_colleges, all:s.institutions.length, verified:s.verified};
  }
  const counts=Object.values(supply).map(v=>v.ccs.length);
  const universal=counts.filter(n=>n>=23).length, none=counts.filter(n=>n===0).length;
  const report={
    codes:list.length, resolved:Object.keys(supply).length,
    problems:problems.length, unverified:problems.filter(p=>p.reason==='not_exact').length,
    offered_at_all_23:universal, offered_nowhere:none,
    median_colleges: counts.sort((a,b)=>a-b)[Math.floor(counts.length/2)],
    http:c.stats, sample_problems:problems.slice(0,10),
  };
  fs.writeFileSync('/tmp/va-supply.json', JSON.stringify({report,supply},null,1));
  console.log(JSON.stringify(report,null,2));
})().catch(e=>{console.error(e.stack);process.exit(1)});
