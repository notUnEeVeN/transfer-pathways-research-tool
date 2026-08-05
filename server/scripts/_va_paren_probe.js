const fs=require('fs'),path=require('path');
const {VirginiaClient,discoverGuideSlugs}=require('../services/virginia/fetch');
const {parseGuide}=require('../services/virginia/parseGuide');
(async()=>{
  const c=new VirginiaClient({cacheDir:path.resolve(__dirname,'../.virginia-cache')});
  const slugs=(await discoverGuideSlugs(c)).filter(s=>/guide/i.test(s));
  const NUMLIST=/^[\s\d,;\/&\-]*\d{3}[\s\d,;\/&\-]*$/;
  const CODE=/\b[A-Za-z]{2,4}\s?\d{3}\b/;
  const buckets={numlist:[],code:[],prose:[]};
  let rowsWithParen=0,totalRows=0;
  for(const s of slugs){
    const h=c.readCache('https://www.transfervirginia.org'+s); if(!h) continue;
    const g=parseGuide(h,{slug:s}); if(!g.has_cc_table) continue;
    for(const r of g.rows){
      if(r.requirement.kind==='summary') continue;
      totalRows++;
      const ps=r.requirement.parentheticals||[];
      if(!ps.length) continue;
      rowsWithParen++;
      for(const pz of ps){
        const rec={paren:pz,raw:r.requirement.raw,kind:r.requirement.kind,univ:g.university_name};
        if(NUMLIST.test(pz)) buckets.numlist.push(rec);
        else if(CODE.test(pz)) buckets.code.push(rec);
        else buckets.prose.push(rec);
      }
    }
  }
  console.log('requirement rows total:',totalRows);
  console.log('rows with a parenthetical:',rowsWithParen,'('+(100*rowsWithParen/totalRows).toFixed(2)+'%)');
  console.log();
  console.log('  bare NUMBER LIST (paren IS the course list):',buckets.numlist.length);
  console.log('  contains a full COURSE CODE:',buckets.code.length);
  console.log('  plain prose, no codes:',buckets.prose.length);
  fs.writeFileSync('/tmp/va-paren.json',JSON.stringify(buckets,null,1));
})();
