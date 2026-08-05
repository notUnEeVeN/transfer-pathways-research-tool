const path=require('path'), fs=require('fs');
const {VirginiaClient, discoverGuideSlugs}=require('../services/virginia/fetch');
const {parseGuide}=require('../services/virginia/parseGuide');
(async()=>{
  const client=new VirginiaClient({cacheDir:path.resolve(__dirname,'../.virginia-cache'),delayMs:2500,concurrency:1});
  console.error('discovering…');
  const slugs=(await discoverGuideSlugs(client)).filter(s=>/guide/i.test(s));
  console.error(`  ${slugs.length} guide slugs`);
  const agg={guides:0,noTable:0,rows:0,course:0,category:0,unparsed:0,summary:0,inferred:0,codes:0,
             noProgram:0,noUniv:0,noYear:0};
  const unparsedSamples=[], inferredRules={}, byUniv={};
  await client.mapLimit(slugs, async (slug,i)=>{
    if(i&&i%50===0) console.error(`  …${i}/${slugs.length} (cache ${client.stats.hits}h/${client.stats.misses}m blocked:${client.stats.blocked})`);
    const html=await client.get(slug); if(!html){ agg.fetchFailed=(agg.fetchFailed||0)+1; return; }
    let g; try{ g=parseGuide(html,{slug}); }catch(e){ return; }
    agg.guides++;
    if(!g.has_cc_table){ agg.noTable++; return; }
    if(!g.program) agg.noProgram++;
    if(!g.university_name) agg.noUniv++;
    if(!g.catalog_year) agg.noYear++;
    agg.rows+=g.stats.rows; agg.course+=g.stats.course_rows;
    agg.category+=g.stats.category_rows; agg.unparsed+=g.stats.unparsed_rows; agg.summary+=g.stats.summary_rows;
    agg.inferred+=g.stats.inferred_rows; agg.codes+=g.stats.codes;
    const u=g.university_name||'(unknown)'; byUniv[u]=(byUniv[u]||0)+1;
    for(const r of g.rows){
      for(const rule of r.requirement.rules) inferredRules[rule]=(inferredRules[rule]||0)+1;
      if(r.requirement.kind==='unparsed'&&unparsedSamples.length<400) unparsedSamples.push(r.requirement.raw);
    }
  });
  const pct=(n,d)=>d?((100*n/d).toFixed(2)+'%'):'—';
  console.log(JSON.stringify({
    guides:agg.guides, guides_without_cc_table:agg.noTable, fetch_failed:agg.fetchFailed||0,
    universities:Object.keys(byUniv).length,
    rows:agg.rows, course_rows:agg.course, category_rows:agg.category, unparsed_rows:agg.unparsed, summary_rows_excluded:agg.summary,
    course_codes_extracted:agg.codes,
    rates:{ course:pct(agg.course,agg.rows), category:pct(agg.category,agg.rows),
            unparsed:pct(agg.unparsed,agg.rows), inferred:pct(agg.inferred,agg.rows) },
    header_misses:{ program:agg.noProgram, university:agg.noUniv, catalog_year:agg.noYear },
    rules_fired:inferredRules,
    http:client.stats,
  },null,2));
  fs.writeFileSync('/tmp/va-unparsed.json', JSON.stringify(unparsedSamples,null,1));
})().catch(e=>{console.error(e.stack);process.exit(1)});
