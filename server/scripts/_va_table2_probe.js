const path=require('path'), cheerio=require('cheerio');
const {VirginiaClient, discoverGuideSlugs}=require('../services/virginia/fetch');
const {parseGuide}=require('../services/virginia/parseGuide');
const {parseRequirementCell}=require('../services/virginia/rowGrammar');
const clean=(s)=>String(s??'').replace(/ /g,' ').replace(/\s+/g,' ').trim();
(async()=>{
  const c=new VirginiaClient({cacheDir:path.resolve(__dirname,'../.virginia-cache')});
  const slugs=(await discoverGuideSlugs(c)).filter(s=>/guide/i.test(s));
  const agg={guides:0,cs:0,noT2:0,rows:0,course:0,category:0,unparsed:0,summary:0,withCredits:0,
             hasTotal:0,totalMatches:0};
  const headers={}, unparsed={};
  for(const s of slugs){
    const h=c.readCache('https://www.transfervirginia.org'+s); if(!h) continue;
    const g=parseGuide(h,{slug:s}); if(!g.has_cc_table) continue;
    agg.guides++;
    const isCS=/computer science|computer engineering|information/i.test(g.vccs_curriculum||g.program||'');
    if(isCS) agg.cs++;
    const $=cheerio.load(h);
    const tabs=$('table').toArray();
    // table 2 = the one whose header says "Complete at <University>"
    const t2=tabs.find(t=>{
      const head=$(t).find('tr').first().find('td,th').map((_,x)=>clean($(x).text())).get().join(' | ');
      return /complete at\s+(?!a virginia community college)/i.test(head);
    });
    if(!t2){ agg.noT2++; continue; }
    const trs=$(t2).find('tr').toArray();
    const head=trs[0]? $(trs[0]).find('td,th').map((_,x)=>clean($(x).text())).get():[];
    headers[head.map(x=>x.replace(/Complete at .*/i,'Complete at <UNIV>')).join(' | ').slice(0,70)]=
      (headers[head.map(x=>x.replace(/Complete at .*/i,'Complete at <UNIV>')).join(' | ').slice(0,70)]||0)+1;
    let total=null, sum=0;
    for(const tr of trs.slice(1)){
      const cells=$(tr).find('td,th').map((_,x)=>clean($(x).text())).get();
      const req=cells[0]; if(!req) continue;
      const p=parseRequirementCell(req);
      if(p.kind==='summary'){ agg.summary++; const m=/(\d+)/.exec(cells[1]||''); if(m) total=+m[1]; continue; }
      agg.rows++;
      if(p.kind==='course') agg.course++; else if(p.kind==='category') agg.category++;
      else { agg.unparsed++; const k=req.slice(0,58); unparsed[k]=(unparsed[k]||0)+1; }
      const m=/^(\d+)/.exec(cells[1]||''); if(m){ agg.withCredits++; sum+=+m[1]; }
    }
    if(total!=null){ agg.hasTotal++; if(Math.abs(sum-total)<=2) agg.totalMatches++; }
  }
  const pct=(n,d)=>d?(100*n/d).toFixed(1)+'%':'—';
  console.log(JSON.stringify({
    guides:agg.guides, cs_related:agg.cs, guides_without_table2:agg.noT2,
    t2_rows:agg.rows, course:agg.course, category:agg.category, unparsed:agg.unparsed,
    rates:{course:pct(agg.course,agg.rows),category:pct(agg.category,agg.rows),unparsed:pct(agg.unparsed,agg.rows)},
    credits_present:pct(agg.withCredits,agg.rows),
    // the strongest fidelity check available: does the row credit sum reproduce
    // the table's own stated post-transfer total?
    total_stated:agg.hasTotal, total_reproduced:agg.totalMatches,
    total_check:pct(agg.totalMatches,agg.hasTotal),
    headers, top_unparsed:Object.entries(unparsed).sort((a,b)=>b[1]-a[1]).slice(0,12),
  },null,1));
})().catch(e=>{console.error(e.stack);process.exit(1)});
