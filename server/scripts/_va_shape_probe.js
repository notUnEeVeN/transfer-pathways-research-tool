const path=require('path');
const {VirginiaClient, discoverGuideSlugs}=require('../services/virginia/fetch');
const {parseGuide}=require('../services/virginia/parseGuide');
(async()=>{
  const c=new VirginiaClient({cacheDir:path.resolve(__dirname,'../.virginia-cache')});
  const slugs=(await discoverGuideSlugs(c)).filter(s=>/guide/i.test(s));
  const byUniv={}, csByUniv={}, curricula={};
  let guides=0, cs=0, noUniv=0;
  const CS=/computer science|computer engineering|information (systems|technology)|cyber|software|data science/i;
  for(const s of slugs){
    const h=c.readCache('https://www.transfervirginia.org'+s); if(!h) continue;
    const g=parseGuide(h,{slug:s}); if(!g.has_cc_table) continue;
    guides++;
    const u=g.university_name||'(unresolved)'; if(u==='(unresolved)') noUniv++;
    byUniv[u]=(byUniv[u]||0)+1;
    const label=g.vccs_curriculum||g.program||'';
    curricula[label]=(curricula[label]||0)+1;
    if(CS.test(label)){ cs++; csByUniv[u]=(csByUniv[u]||0)+1; }
  }
  const u=Object.entries(byUniv).sort((a,b)=>b[1]-a[1]);
  console.log('guides parsed          :', guides);
  console.log('distinct universities  :', u.length, '(unresolved name on', noUniv, 'guides)');
  console.log('distinct VCCS curricula:', Object.keys(curricula).length);
  console.log('CS-related guides      :', cs, 'across', Object.keys(csByUniv).length, 'universities');
  console.log();
  console.log('guides per university (top 12):');
  for(const [k,v] of u.slice(0,12)) console.log('   '+String(v).padStart(3), k.slice(0,44), csByUniv[k]?`  [CS: ${csByUniv[k]}]`:'');
  console.log('   ...tail:', u.slice(12).map(([k,v])=>`${k.slice(0,18)}:${v}`).join(', ').slice(0,150));
  console.log();
  console.log('CS-related guides, by university:');
  for(const [k,v] of Object.entries(csByUniv).sort((a,b)=>b[1]-a[1])) console.log('   '+String(v).padStart(2), k.slice(0,48));
})().catch(e=>{console.error(e.stack);process.exit(1)});
