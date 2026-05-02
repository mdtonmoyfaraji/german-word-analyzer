(function () {
'use strict';

/* =========================
   🎨 STYLE FOR POPUP BOX
   ========================= */
function addStyle(cssText) {
  const el = document.createElement('style');
  el.textContent = cssText;
  document.head.appendChild(el);
}

addStyle(`
#dictBox {
    position: fixed;
    width: 300px;
    height: 300px;
    overflow-y: auto;
    overflow-x: hidden;
    word-wrap: break-word;
    backdrop-filter: blur(10px);
    background: rgba(0,0,0,0.8);
    color: #fff;
    padding: 12px;
    border-radius: 10px;
    z-index: 999999;
    font-size: 13px;
    font-family: Arial;
}
hr { opacity: 0.1; }
`);

/* =========================
   🧹 CLEAN SELECTED WORD
   ========================= */
function clean(word){
    return (word || "")
        .replace(/[.,!?()\"]/g,'')
        .trim()
        .split(/[\/\s\n]+/)[0];
}

/* =========================
   🔤 CASE HELPERS
   ========================= */
const capitalize = w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
const lowercase = w => w.toLowerCase();

/* =========================
   🌐 CALL DICTIONARY API
   ========================= */
async function api(word, callback){
  try {
    const url = `https://freedictionaryapi.com/api/v1/entries/de/${encodeURIComponent(word)}?translations=true`;
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) return callback(null);
    const json = await res.json();
    callback(json);
  } catch {
    callback(null);
  }
}

/* =========================
   🔍 FIND BASE WORD (e.g. past → infinitive)
   ========================= */
function findBase(data){
    for (let e of (data?.entries || [])){
        for (let s of (e.senses || [])){
            let match = s.definition?.match(/(?:of|past of|participle of) ([A-Za-zÄÖÜäöüß]+)/i);
            if(match) return match[1];
        }
    }
    return null;
}

/* =========================
   🔗 COLLECT SYNONYMS & ANTONYMS
   ========================= */
function collectSynAnt(entries){
    let syn = new Set();
    let ant = new Set();

    for(let e of entries){
        (e.synonyms || []).forEach(x => x && syn.add(x));
        (e.antonyms || []).forEach(x => x && ant.add(x));

        for(let s of (e.senses || [])){
            (s.synonyms || []).forEach(x => x && syn.add(x));
            (s.antonyms || []).forEach(x => x && ant.add(x));
        }
    }

    return {
        syn: [...syn],
        ant: [...ant]
    };
}

/* =========================
   📘 RENDER NOUN DATA
   ========================= */
function renderNoun(entries){

    let base="", plural="", genitive="", meaning="", article="";
    let isNoun=false;

    for(let e of entries){

        if(e.partOfSpeech === "noun"){
            isNoun = true;
            meaning = e.senses?.[0]?.definition || meaning;

            let tags = e.senses?.[0]?.tags || [];
            if(tags.includes("masculine")) article="der";
            else if(tags.includes("feminine")) article="die";
            else if(tags.includes("neuter")) article="das";
        }

        for(let f of (e.forms || [])){
            let t = f.tags || [];

            if(t.includes("nominative") && t.includes("singular")){
                base = f.word;
            }

            if(isNoun && t.includes("genitive") && !genitive){
                genitive = f.word;
            }

            if(isNoun && t.includes("plural") && !plural){
                if(!f.word.includes("gegangen") && !f.word.includes("werden")){
                    plural = f.word;
                }
            }
        }
    }

    let baseWithArticle = article ? article + " " + base : base;

    if(!base && !genitive && !plural && !meaning) return "";

    return `
<div class="noun">
<b>NOUN</b><br>
${baseWithArticle ? `<span>${baseWithArticle}</span><br>` : ""}
${(genitive||plural)? `<span>${genitive||""}${genitive&&plural?", ":""}${plural||""}</span><br>`:""}
${meaning ? `<span>${meaning}</span>` : ""}
</div>`;
}

/* =========================
   📗 RENDER VERB DATA
   ========================= */
function renderVerb(entries){

    let inf="", pres="", past="", part="", meaning="";

    for(let e of entries){

        meaning = e.senses?.[0]?.definition || meaning;
        if(!inf) inf = e.word;

        for(let f of (e.forms || [])){
            let t = f.tags || [];
            let w = f.word;

            if(t.includes("future") || t.includes("subjunctive")) continue;
            if(t.includes("multiword-construction") && !t.includes("perfect")) continue;

            if(t.includes("infinitive") && !t.includes("infinitive-zu")) inf = w;

            if(t.includes("present") && t.includes("third-person") && t.includes("singular")) pres = w;

            if((t.includes("preterite")||t.includes("past")) && t.includes("singular") && t.includes("third-person")) past = w;

            if(t.includes("participle") && t.includes("past")) part = w;

            if(t.includes("perfect") && t.includes("multiword-construction")) part = w;
        }
    }

    function normalizeAux(str){
        if(!str) return str;
        return str
            .replace(/\bsein\b|\bsind\b|\bbin\b|\bbist\b|\bseid\b|\bwar\b|\bwaren\b/g,"ist")
            .replace(/\bhabe\b|\bhast\b|\bhaben\b|\bhabt\b/g,"hat");
    }

    part = normalizeAux(part);

    if(part && !part.includes(" ")){
        let aux = ["machen","haben","sehen","lernen","spielen"].some(v=>inf.includes(v)) ? "hat":"ist";
        part = aux + " " + part;
    }

    if(!inf && !pres && !past && !part) return "";

    return `
<div class="verb">
<b>VERB</b><br>
${inf ? `<span>${inf}</span><br>` : ""}
${(pres||past||part)? `<span>${pres||""}${pres&&past?", ":""}${past||""}${(pres||past)&&part?", ":""}${part||""}</span><br>`:""}
${meaning ? `<span>${meaning}</span>` : ""}
</div>`;
}

/* =========================
   🖥️ SHOW POPUP BOX
   ========================= */
let lastMouse = { x: 20, y: 20 };

function show(html){

    let box = document.getElementById("dictBox");

    if(!box){
        box = document.createElement("div");
        box.id="dictBox";
        document.body.appendChild(box);

        ["mousedown","click","contextmenu"].forEach(evt =>
            box.addEventListener(evt, e => e.stopPropagation())
        );
    }

    box.innerHTML = html;

    // If there is a selection range, use it; else position by mouse (for hover mode)
    let sel = window.getSelection();
    let range = sel && sel.rangeCount ? sel.getRangeAt(0).getBoundingClientRect() : null;

    let left, top;

    if(range && (range.width || range.height)){
        left = range.x;
        top = range.y + 20;
    } else {
        left = lastMouse.x + 12;
        top = lastMouse.y + 12;
    }

    if(left+340 > window.innerWidth) left = window.innerWidth - 350;
    if(top+300 > window.innerHeight) top = top - 320;
    if(top < 10) top = 10;

    box.style.left = left+"px";
    box.style.top = top+"px";
}

/* =========================
   🔄 RESOLVE WORD DATA
   ========================= */
function resolve(word, cb){
    api(word,(data)=>{
        if(!data) return cb([]);

        let entries = data.entries || [];
        let base = findBase(data);

        let isInf = entries.some(e =>
            e.forms?.some(f => f.tags?.includes("infinitive"))
        );

        if(base && !isInf){
            api(base, data2 => cb(data2?.entries || entries));
        } else {
            cb(entries);
        }
    });
}

/* =========================
   🎯 MAIN LOGIC
   ========================= */
function resolveDual(word){

    word = clean(word);

    let nounHTML="", verbHTML="", fallbackMeaning="";
    let synSet=new Set(), antSet=new Set();

    let nounDone = false;
    let verbDone = false;

    show("Loading...");

    function tryRender(){
        if(!nounDone || !verbDone) return;

        let synStr=[...synSet].join(", ");
        let antStr=[...antSet].join(", ");

        let finalHTML="";

        if(!nounHTML && !verbHTML && fallbackMeaning){
            finalHTML += `<div><b>MEANING</b><br>${fallbackMeaning}</div>`;
        }

        if(nounHTML) finalHTML+=nounHTML;
        if(verbHTML) finalHTML+=verbHTML;

        if(synStr || antStr){
            finalHTML += `
<div class="synant">
<b>SYN / ANT</b><br>
${synStr ? `<span><b>Syn:</b> ${synStr}</span>` : ""}
${antStr ? `<span><b>Ant:</b> ${antStr}</span>` : ""}
</div>`;
        }

        if(!finalHTML.trim()){
            let box = document.getElementById("dictBox");
            if(box) box.remove();
            return;
        }

        show(finalHTML);
    }

    resolve(capitalize(word), entries=>{
        nounHTML = renderNoun(entries);
        fallbackMeaning ||= entries?.[0]?.senses?.[0]?.definition;

        let {syn,ant} = collectSynAnt(entries);
        syn.forEach(x=>synSet.add(x));
        ant.forEach(x=>antSet.add(x));

        nounDone = true;
        tryRender();
    });

    resolve(lowercase(word), entries=>{
        verbHTML = renderVerb(entries);
        fallbackMeaning ||= entries?.[0]?.senses?.[0]?.definition;

        let {syn,ant} = collectSynAnt(entries);
        syn.forEach(x=>synSet.add(x));
        ant.forEach(x=>antSet.add(x));

        verbDone = true;
        tryRender();
    });
}

/* =========================
   🪄 HOVER TRIGGER (OUTPUT ONLY)
   ========================= */

const HOVER_DELAY_MS = 350;
let hoverTimer = null;
let lastWord = "";

function getWordFromPoint(x, y) {
  let range = null;

  if (document.caretPositionFromPoint) {
    const pos = document.caretPositionFromPoint(x, y);
    if (!pos || !pos.offsetNode) return "";
    range = document.createRange();
    range.setStart(pos.offsetNode, pos.offset);
    range.setEnd(pos.offsetNode, pos.offset);
  } else if (document.caretRangeFromPoint) {
    range = document.caretRangeFromPoint(x, y);
    if (!range) return "";
  } else {
    return "";
  }

  const node = range.startContainer;
  if (!node || node.nodeType !== Node.TEXT_NODE) return "";

  const text = node.textContent || "";
  let i = range.startOffset;
  if (i > 0 && i === text.length) i--;

  const isWordChar = ch => /[A-Za-zÄÖÜäöüß-]/.test(ch);

  let start = i;
  while (start > 0 && isWordChar(text[start - 1])) start--;

  let end = i;
  while (end < text.length && isWordChar(text[end])) end++;

  return clean(text.slice(start, end));
}

function isValidWord(w) {
  if (!w) return false;
  if (w.length < 2) return false;
  if (/\s/.test(w)) return false;
  return /^[A-Za-zÄÖÜäöüß]+(-[A-Za-zÄÖÜäöüß]+)*$/.test(w);
}

function isInsideOutput(target) {
  const output = document.getElementById("output");
  return !!(output && output.style.display !== "none" && output.contains(target));
}

document.addEventListener("mousemove", (e) => {
  // Only trigger when hovering text inside #output (the highlighted view)
  if (!isInsideOutput(e.target)) {
    if (hoverTimer) clearTimeout(hoverTimer);
    hoverTimer = null;
    return;
  }

  lastMouse.x = e.clientX;
  lastMouse.y = e.clientY;

  const box = document.getElementById("dictBox");
  if (box && box.contains(e.target)) return;

  const w = getWordFromPoint(e.clientX, e.clientY);
  if (!isValidWord(w)) {
    if (hoverTimer) clearTimeout(hoverTimer);
    hoverTimer = null;
    return;
  }

  if (w === lastWord) return;

  if (hoverTimer) clearTimeout(hoverTimer);
  hoverTimer = setTimeout(() => {
    lastWord = w;
    resolveDual(w);
  }, HOVER_DELAY_MS);
});

/* =========================
   ❌ CLOSE ON OUTSIDE CLICK
   ========================= */
document.addEventListener("mousedown", e=>{
    let box=document.getElementById("dictBox");
    if(box && !box.contains(e.target)) box.remove();
});

})();
