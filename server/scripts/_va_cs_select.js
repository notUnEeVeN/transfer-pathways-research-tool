const path=require('path'), cheerio=require('cheerio');
const {VirginiaClient, discoverGuideSlugs}=require('../services/virginia/fetch');
const {parseGuide}=require('../services/virginia/parseGuide');
const {parseRequirementCell}=require('../services/virginia/rowGrammar');
const clean=(s)=>String(s??'').replace(/ /g,' ').replace(/\s+/g,' ').trim();
(async()=>{
  const c=new VirginiaClient({cacheDir:path.resolve(__dirname,'../.virginia-cache')});
  const slugs=(await discoverGuideSlugs(c)).filter(s=>/guide/i.test(s));
  const rows=[];
  for(const s of slugs){
    const h=c.readCache('https://www.transfervirginia.org'+s); if(!h) continue;
    const g=parseGuide(h,{slug:s}); if(!g.has_cc_table) continue;
    const label=`${g.vccs_curriculum||''} ${g.program||''} ${g.title||''}`;
    // Core CS only: the words "computer science", and NOT a sibling discipline.
    if(!/computer science/i.test(label)) continue;
    if(/engineering|information systems|information technology|cyber|data science|secondary education|education/i.test(label)) continue;
    // table-2 reconciliation: do the row credits reproduce the stated total?
    const $=cheerio.load(h);
    const t2=$('table').toArray().find(t=>/complete at\s+(?!a virginia community college)/i
      .test($(t).find('tr').first().find('td,th').map((_,x)=>clean($(x).text())).get().join(' | ')));
    let stated=null, sum=0, sumHi=0, t2rows=0, t2unparsed=0;
    for(const tr of (t2?$(t2).find('tr').toArray().slice(1):[])){
      const cells=$(tr).find('td,th').map((_,x)=>clean($(x).text())).get();
      if(!cells[0]) continue;
      const p=parseRequirementCell(cells[0]);
      const cell=cells[1]||'';
      const m=/^(\d+)/.exec(cell);
      const hi=/(\d+)\s*-\s*(\d+)/.exec(cell);
      if(p.kind==='summary'){ if(m) stated=+m[1]; continue; }
      t2rows++; if(p.kind==='unparsed') t2unparsed++;
      if(m) sum+=+m[1];
      if(hi) sumHi+=+hi[2]; else if(m) sumHi+=+m[1];
    }
    rows.push({univ:g.university_name||'(unresolved)', prog:g.program||g.title, year:g.catalog_year,
      t1rows:g.stats.rows, t1unparsed:g.stats.unparsed_rows, t2rows, t2unparsed,
      stated, sum, sumHi,
      ok: stated!=null && (Math.abs(sum-stated)<=2 || Math.abs(sumHi-stated)<=2
        || (stated>=sum && stated<=sumHi)),
      slug:g.slug});
  }
  // one per university: prefer the guide with the cleanest reconciliation
  const best=new Map();
  for(const r of rows.sort((a,b)=>(b.ok-a.ok)||(a.t1unparsed+a.t2unparsed)-(b.t1unparsed+b.t2unparsed)))
    if(!best.has(r.univ)) best.set(r.univ, r);
  console.log('core-CS guides found:', rows.length, '| distinct universities:', best.size);
  console.log();
  console.log('univ'.padEnd(42),'T1 rows'.padStart(8),'T1 ?'.padStart(5),'T2 rows'.padStart(8),'T2 ?'.padStart(5),'stated'.padStart(7),'row sum'.padStart(7),'  recon');
  let pass=0;
  for(const r of [...best.values()].sort((a,b)=>a.univ.localeCompare(b.univ))){
    if(r.ok) pass++;
    console.log(r.univ.slice(0,41).padEnd(42), String(r.t1rows).padStart(8), String(r.t1unparsed).padStart(5),
      String(r.t2rows).padStart(8), String(r.t2unparsed).padStart(5),
      String(r.stated??'—').padStart(7), (r.sum===r.sumHi?String(r.sum):`${r.sum}-${r.sumHi}`).padStart(7),
      '  ', r.ok?'PASS':'differs');
  }
  console.log();
  console.log('reconciles within ±2 credits:', pass, 'of', best.size);
})().catch(e=>{console.error(e.stack);process.exit(1)});
