// Checks every answer the way a player types it, on every difficulty:
//   node tools/check_answers.js            (all difficulties)
//   node tools/check_answers.js easy       (one)
// Mirrors the data + prompt setup in js/app.js. For every playable prompt it types each right answer's
// full name and every alias, and reports anything rejected, matched to the wrong thing, missing from a
// "Which one?" list, crashing, or breaking the tier rules. Run it after changing data, prompts or the engine.
const vm=require("vm"),fs=require("fs");const R=process.env.REPO||require("path").join(__dirname,"..")+"/";
const ctx={window:{}};ctx.globalThis=ctx;vm.createContext(ctx);
for (const f of ["js/config.js","js/questions.js","js/questions_things.js","data/characters.js","data/things.js"]) vm.runInContext(fs.readFileSync(R+f,"utf8"),ctx);
try{vm.runInContext(fs.readFileSync(R+"data/tags.js","utf8"),ctx)}catch(e){}
for (const k of Object.keys(ctx.window)) globalThis[k]=ctx.window[k];
const W=ctx.window;const E=require(R+"js/engine.js");
const MODES={supereasy:["easy"],easy:["easy"],medium:["easy","medium"],hard:["easy","medium","hard"]};
const only=process.argv[2];
let totalProblems=0;
for (const [modeId,levels] of Object.entries(MODES)) {
  if (only && only!==modeId) continue;
  const C={...W.GAME_CONFIG}; C.poolLevels=levels; C.mode=modeId==="supereasy"?"easy":modeId;
  const allRows=W.CHARACTER_DATA; const LK=(W.THING_LINKS||{}).character||{};
  for (const c of allRows) for (const [k,v] of Object.entries(LK[c.id]||{})) if (c[k]==null||c[k]==="") c[k]=v;
  const rows=allRows.filter(c=>levels.includes(c.difficulty||"hard"));
  const linkLists=new Set(C.listFields); for (const v of Object.values(LK)) for (const [k,x] of Object.entries(v)) if (Array.isArray(x)) linkLists.add(k);
  const charCfg={...C,listFields:[...linkLists]};
  const data=E.prepare(rows,charCfg), allData=E.prepare(allRows,charCfg);
  const {playable}=E.buildQuestions(data,W.QUESTION_TEMPLATES||[],W.QUESTIONS||[],C);
  const KIND={character:data}, ANS={character:allData};
  const kindCfg=list=>{const l=new Set(C.listFields),n=new Set(C.numberFields);for(const t of list)for(const[k,v]of Object.entries(t)){if(Array.isArray(v))l.add(k);else if(typeof v==="number")n.add(k)}return{...C,listFields:[...l],numberFields:[...n],noCombos:true}};
  for (const [kind,list] of Object.entries(W.THING_DATA||{})) {
    const keep=list.filter(t=>levels.includes(t.difficulty||"hard"));
    if (keep.length) KIND[kind]=E.prepare(keep,kindCfg(keep));
    ANS[kind]=keep.length===list.length?KIND[kind]:E.prepare(list,kindCfg(list));
  }
  const dataFor=q=>ANS[(q&&q.kind)||"character"]||allData;
  const templates=[],manual=[...(W.THING_QUESTIONS||[])];
  for (const t of W.THING_TEMPLATES||[]) { if(!t.labels){templates.push(t);continue} for(const[v,l]of Object.entries(t.labels)) manual.push({kind:t.kind,id:`${t.group}:${v}`,group:t.group,text:t.text.replace("{label}",l),where:[[t.field,"is",v]]}); }
  for (const [kind,kd] of Object.entries(KIND)) { const mine=x=>(x.kind||"character")===kind;
    const r=E.buildQuestions(kd,templates.filter(mine),manual.filter(mine),kind==="character"?{...charCfg,noCombos:true}:kindCfg(kd.chars));
    for (const q of r.playable){q.kind=kind;q.id=`${kind}:${q.id}`;if(!playable.some(p=>p.text===q.text))playable.push(q);} }
  for (const q of playable) { const kind=q.kind||"character",ad=dataFor(q),pool=KIND[kind]||data;
    if (ad===pool||(!q.where&&!q.anyOf)) continue;
    const extra=ad.chars.filter(c=>!pool.byId.has(c.id)&&E.fits(c,q)).map(c=>c.id); if(!extra.length) continue;
    q.answers=[...q.answers,...extra]; let cache=null;
    Object.defineProperty(q,"tierById",{get(){return cache||(cache=E.tierAnswers(q.answers,ad,kind==="character"?charCfg:C,q))},configurable:true}); }
  // ---- checks ----
  const prob={rejected:[],wrongMatch:[],buried:[],noTier:[],crash:[],cap:[],rookie:[],aliasWrong:[]};
  let typed=0,aliasTyped=0,deep=0;
  const caps=(C.modeTiers[C.mode]||{}).caps||{}; const tierIdx=id=>C.tiers.findIndex(t=>t.id===id);
  for (const q of playable) {
    const d=dataFor(q); const ans=new Set(q.answers); let tb;
    try{tb=q.tierById}catch(e){prob.crash.push(q.text+": "+e.message);continue}
    const order=[...q.answers].sort((a,b)=>tb[b].share-tb[a].share);
    if (order.length && tb[order[0]].tier.id!=="rookie") prob.rookie.push(q.text);
    const pool=KIND[q.kind||"character"]||data;
    for (const id of q.answers) {
      const c=d.byId.get(id); if(!tb[id]){prob.noTier.push(q.text+" -> "+id);continue}
      if(!pool.byId.has(id)) deep++;
      const lv=c.difficulty||"medium"; if(caps[lv]&&tierIdx(tb[id].tier.id)>tierIdx(caps[lv])) prob.cap.push(`${q.text} -> ${c.name} ${tb[id].tier.name}`);
      // the full name
      typed++; const r=E.resolveFor(c.name,d,q);
      if (r.status==="unknown") prob.rejected.push(`${q.text} | "${c.name}"`);
      else if (r.status==="match"&&r.id!==id) prob.wrongMatch.push(`${q.text} | "${c.name}" -> ${d.byId.get(r.id).name}`);
      else if (r.status==="ambiguous"&&!r.ids.slice(0,8).includes(id)) prob.buried.push(`${q.text} | "${c.name}"`);
      const s=E.scoreGuess(q,id,d,C); if(!s.ok) prob.rejected.push(`${q.text} | ${c.name} scored wrong`);
      // every alias: must not pick a DIFFERENT item outright when this item is also a right answer
      for (const a of E.asList(c.aliases)) { aliasTyped++; const ra=E.resolveFor(a,d,q);
        if (ra.status==="unknown") prob.aliasWrong.push(`${q.text} | alias "${a}" of ${c.name} -> not found`);
        else if (ra.status==="match"&&ra.id!==id&&!ans.has(ra.id)) prob.aliasWrong.push(`${q.text} | alias "${a}" of ${c.name} -> ${d.byId.get(ra.id).name} (wrong)`);
        else if (ra.status==="ambiguous"&&!ra.ids.slice(0,8).includes(id)) prob.buried.push(`${q.text} | alias "${a}" of ${c.name}`);
      }
    }
    // a wrong item must be turned away without crashing
    const wrong=d.chars.find(c=>!ans.has(c.id));
    if (wrong) { try{const s=E.scoreGuess(q,wrong.id,d,C); if(s.ok) prob.crash.push(q.text+": wrong item accepted "+wrong.name)}catch(e){prob.crash.push(q.text+": "+e.message)} }
  }
  // de-dupe alias problems by alias text
  const uniq=a=>[...new Set(a)];
  const aliasKeys=uniq(prob.aliasWrong.map(x=>x.split(" | ")[1]));
  const n=Object.entries(prob).reduce((s,[k,v])=>s+(k==="aliasWrong"?aliasKeys.length:v.length),0); totalProblems+=n;
  console.log(`== ${modeId}: ${playable.length} prompts, ${typed} answers typed, ${aliasTyped} aliases typed, ${deep} answers from outside the ${modeId} pool now accepted | problems: ${n}`);
  for (const [k,v] of Object.entries(prob)) { const list=k==="aliasWrong"?aliasKeys:uniq(v); if(list.length){console.log(`   ${k}: ${list.length}`); list.slice(0,8).forEach(x=>console.log("     "+x));} }
  if (modeId==="easy") { const q=playable.find(x=>/crew whose captain is one of the Worst Generation/.test(x.text)); const d=dataFor(q);
    for (const g of ["drake","Drake Pirates","drakes"]) { const r=E.resolveFor(g,d,q); const s=r.status==="match"?E.scoreGuess(q,r.id,d,C):null; console.log(`   check (Easy) "${g}" -> ${r.status} ${r.id||""} ${s?(s.ok?"RIGHT "+s.tier.name:"wrong"):""}`); } }
}
console.log("TOTAL PROBLEMS", totalProblems);
process.exitCode = totalProblems ? 1 : 0;
