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
   📌 INJECT WORD INTO ENTRIES
   The API returns the word at the root level ({word:"Frau", entries:[...]})
   but NOT inside each entry object. This helper stamps the word onto entries
   that lack it so downstream functions (renderNoun, detectArticle) can use e.word.
   ========================= */
function injectWord(rawEntries, word){
    return rawEntries.map(e =>
        e.word ? e : Object.assign({}, e, {word: word})
    );
}

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
   🔍 FIND BASE WORD (e.g. plural → singular)
   ========================= */
function findBase(data){
    // Support both array-at-root and {entries:[...]} response formats
    const entries = Array.isArray(data) ? data : (data?.entries || []);
    for (let e of entries){
        for (let s of (e.senses || [])){
            // Only match SPECIFIC patterns anchored at the start of the definition.
            // The bare "of" pattern was removed because it caused false positives:
            // e.g. "movement of a symphony" (Satz) → redirected to "a" → empty result.
            // Cases: "plural of Garten", "past of gehen", "participle of ..."
            let match = s.definition?.match(/^(?:plural of|past of|participle of|form of)\s+([A-Za-zÄÖÜäöüß-]+)/i);
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
   🧠 DETECT NOUN ARTICLE (der/die/das)
   ========================= */
function detectArticle(entries){
    if(!entries || !entries.length) return "";

    // Look for gender tags across common places
    for(const e of entries){
        const tagSets = [];

        // Some APIs put tags at entry level
        if(Array.isArray(e.tags)) tagSets.push(e.tags);

        // Sense tags
        if(Array.isArray(e.senses)){
            for(const s of e.senses){
                if(Array.isArray(s?.tags)) tagSets.push(s.tags);
            }
        }

        // Forms tags
        if(Array.isArray(e.forms)){
            for(const f of e.forms){
                if(Array.isArray(f?.tags)) tagSets.push(f.tags);
            }
        }

        for(const tags of tagSets){
            if(tags.includes("masculine")) return "der";
            if(tags.includes("feminine")) return "die";
            if(tags.includes("neuter")) return "das";
        }
    }

    // Fallback: look up the noun word in the local gender dictionary.
    // dictionary.js (loaded on the same page) defines nounGenderDictionary as a
    // plain global.  Using typeof + truthy check avoids a ReferenceError in
    // environments where that script is absent, and also handles cases where
    // the variable is explicitly set to null/undefined.
    // This covers common nouns like "Frau" (F→die), "Satz" (M→der), "Garten" (M→der).
    if(typeof nounGenderDictionary !== "undefined" && nounGenderDictionary){
        for(const e of entries){
            if(e.partOfSpeech !== "noun" || !e.word) continue;
            const g = nounGenderDictionary[e.word] ||
                      nounGenderDictionary[capitalize(e.word)];
            if(g === "M") return "der";
            if(g === "F") return "die";
            if(g === "N") return "das";
        }
    }

    return "";
}

/* =========================
   ✅ HELPERS FOR "HAS REAL NOUN DATA"
   ========================= */
function hasNoun(entries){
    return Array.isArray(entries) && entries.some(e => e && e.partOfSpeech === "noun");
}

/* =========================
   📘 RENDER NOUN DATA
   ========================= */
function renderNoun(entries){

    let base="", plural="", genitive="", meaning="";

    for(let e of entries){

        if(e.partOfSpeech === "noun"){
            meaning = e.senses?.[0]?.definition || meaning;

            // Base noun lemma as returned by API (important for cases where no nominative singular form is in e.forms)
            if(!base && e.word) base = e.word;

            for(let f of (e.forms || [])){
                let t = f.tags || [];

                if(t.includes("nominative") && t.includes("singular")){
                    base = f.word;
                }

                if(t.includes("genitive") && !genitive){
                    genitive = f.word;
                }

                if(t.includes("plural") && !plural){
                    // Old workaround kept (filters some verb participle noise if it ever appears in noun forms)
                    if(!f.word.includes("gegangen") && !f.word.includes("werden")){
                        plural = f.word;
                    }
                }
            }
        }
    }

    // Fallback for base word when API doesn't include nominative singular in forms
    if(!base){
        const nounEntry = entries?.find(e => e.partOfSpeech === "noun" && e.word);
        if(nounEntry?.word) base = nounEntry.word;
    }

    const article = detectArticle(entries);
    const baseWithArticle = article ? article + " " + base : base;

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

    // Only accept verb entries, otherwise noun-only pages like "Texte" can hide verbs.
    const verbEntries = (Array.isArray(entries) ? entries : []).filter(e => e && e.partOfSpeech === "verb");
    if(!verbEntries.length) return "";

    for(let e of verbEntries){

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

        // Handle both response formats:
        //   {word:"Frau", entries:[{partOfSpeech:"noun",...}]}  ← standard
        //   [{word:"Frau", partOfSpeech:"noun",...}]            ← array at root
        let rawEntries, topWord;
        if(Array.isArray(data)){
            rawEntries = data;
            topWord = data[0]?.word || word;
        } else {
            rawEntries = data.entries || [];
            topWord = data.word || word;
        }

        // Inject top-level word into entries that lack .word field.
        // See injectWord() helper above for details.
        let entries = injectWord(rawEntries, topWord);

        let base = findBase(data);

        let isInf = entries.some(e =>
            e.forms?.some(f => f.tags?.includes("infinitive"))
        );

        if(base && !isInf){
            api(base, data2 => {
                if(!data2) return cb(entries); // API error → keep original entries
                let raw2 = Array.isArray(data2) ? data2 : (data2.entries || []);
                // BUG FIX: an empty array [] is truthy, so `raw2 || entries` would
                // incorrectly return [].  Explicitly check length before using raw2.
                if(!raw2.length) return cb(entries);
                let topWord2 = Array.isArray(data2)
                    ? (data2[0]?.word || base)
                    : (data2.word || base);
                cb(injectWord(raw2, topWord2));
            });
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

    // Noun resolution must not "lock in" on non-noun results.
    // Example: searching "Garten" should not accept a verb/empty result and then stop.
    let nounResolved = false;
    const resolveNounMaybe = (entries) => {
        if(nounResolved) return;

        // Only accept responses that actually contain a noun entry.
        if(!hasNoun(entries)) return;

        nounResolved = true;
        nounHTML = renderNoun(entries);
        fallbackMeaning ||= entries?.[0]?.senses?.[0]?.definition;

        let {syn,ant} = collectSynAnt(entries);
        syn.forEach(x=>synSet.add(x));
        ant.forEach(x=>antSet.add(x));

        nounDone = true;
        tryRender();
    };

    // Finalize noun even if we didn't find a noun anywhere (prevents endless loading)
    const finalizeNoun = () => {
        if(nounDone) return;
        nounDone = true;
        tryRender();
    };

    // Try several casing variants for nouns. Some words can be stored differently.
    // We finalize after the last attempt.
    const nounVariants = Array.from(new Set([
        capitalize(word),
        word,
        lowercase(word)
    ]));

    let nounAttempt = 0;
    (function nextNoun(){
        if(nounResolved) return; // resolved via hasNoun
        if(nounAttempt >= nounVariants.length) return finalizeNoun();

        const w = nounVariants[nounAttempt++];
        resolve(w, (entries) => {
            resolveNounMaybe(entries);
            // continue until resolved or variants exhausted
            nextNoun();
        });
    })();

    // VERB: do not force lowercase here. "Ist" (capitalized) can have a verb entry
    // that the lowercase lookup misses depending on API/Wiktionary page structure.
    const verbVariants = Array.from(new Set([
        word,
        lowercase(word),
        capitalize(word)
    ]));

    let verbResolved = false;
    const resolveVerbMaybe = (entries) => {
        if(verbResolved) return;
        const html = renderVerb(entries);
        if(!html) return; // keep trying other variants

        verbResolved = true;
        verbHTML = html;
        fallbackMeaning ||= entries?.[0]?.senses?.[0]?.definition;

        let {syn,ant} = collectSynAnt(entries);
        syn.forEach(x=>synSet.add(x));
        ant.forEach(x=>antSet.add(x));

        verbDone = true;
        tryRender();
    };

    const finalizeVerb = () => {
        if(verbDone) return;
        verbDone = true;
        tryRender();
    };

    let verbAttempt = 0;
    (function nextVerb(){
        if(verbResolved) return;
        if(verbAttempt >= verbVariants.length) return finalizeVerb();

        const w = verbVariants[verbAttempt++];
        resolve(w, (entries) => {
            resolveVerbMaybe(entries);
            nextVerb();
        });
    })();
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

/* =========================
   🔎 SIDEBAR DICTIONARY SEARCH
   Exposed globally so sidebar UI can call it.
   Renders result into `targetEl` instead of the floating popup.
   ========================= */
window.dictSearch = function(word, targetEl){
    if(!word || !targetEl) return;
    word = clean(word);
    if(!word) return;

    targetEl.innerHTML = "Loading…";

    let nounHTML="", verbHTML="", fallbackMeaning="";
    let synSet=new Set(), antSet=new Set();
    let nounDone=false, verbDone=false;

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

        targetEl.innerHTML = finalHTML.trim() || "<em>No result found.</em>";
    }

    // Noun: same improved resolution as hover popup
    let nounResolved = false;
    const resolveNounMaybe = (entries) => {
        if(nounResolved) return;
        if(!hasNoun(entries)) return;

        nounResolved = true;
        nounHTML = renderNoun(entries);
        fallbackMeaning ||= entries?.[0]?.senses?.[0]?.definition;
        let {syn,ant} = collectSynAnt(entries);
        syn.forEach(x=>synSet.add(x));
        ant.forEach(x=>antSet.add(x));
        nounDone=true; tryRender();
    };

    const finalizeNoun = () => {
        if(nounDone) return;
        nounDone=true; tryRender();
    };

    const nounVariants = Array.from(new Set([
        capitalize(word),
        word,
        lowercase(word)
    ]));

    let nounAttempt = 0;
    (function nextNoun(){
        if(nounResolved) return;
        if(nounAttempt >= nounVariants.length) return finalizeNoun();

        const w = nounVariants[nounAttempt++];
        resolve(w, (entries) => {
            resolveNounMaybe(entries);
            nextNoun();
        });
    })();

    // Verb: try multiple casing variants
    const verbVariants = Array.from(new Set([
        word,
        lowercase(word),
        capitalize(word)
    ]));

    let verbResolved = false;
    const resolveVerbMaybe = (entries) => {
        if(verbResolved) return;
        const html = renderVerb(entries);
        if(!html) return;

        verbResolved = true;
        verbHTML = html;
        fallbackMeaning ||= entries?.[0]?.senses?.[0]?.definition;

        let {syn,ant} = collectSynAnt(entries);
        syn.forEach(x=>synSet.add(x));
        ant.forEach(x=>antSet.add(x));
        verbDone=true; tryRender();
    };

    const finalizeVerb = () => {
        if(verbDone) return;
        verbDone=true; tryRender();
    };

    let verbAttempt = 0;
    (function nextVerb(){
        if(verbResolved) return;
        if(verbAttempt >= verbVariants.length) return finalizeVerb();

        const w = verbVariants[verbAttempt++];
        resolve(w, (entries) => {
            resolveVerbMaybe(entries);
            nextVerb();
        });
    })();
};

})();
