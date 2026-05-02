window.detectGender = function () {
    const textarea = document.getElementById("inputText");
    const outputDiv = document.getElementById("output");

    const text = textarea.value;
    const words = text.split(/(\s+|[.,\/#!$%\^&\*;:{}=\-_`~()])/g);

    let result = "";

    words.forEach(word => {
        let gender = getGender(word);

        if (gender) {
            let cls = mapGender(gender);
            result += `<span class="${cls} word-hover" data-word="${word}">${word}</span>`;
        } else {
            result += word;
        }
    });

    outputDiv.innerHTML = result;

    textarea.style.display = "none";
    outputDiv.style.display = "block";

    localStorage.setItem("savedInput", text);
    localStorage.setItem("savedOutput", result);
};

function editText() {
    document.getElementById("inputText").style.display = "block";
    document.getElementById("output").style.display = "none";
}

function clearText() {
    const textarea = document.getElementById("inputText");
    const outputDiv = document.getElementById("output");

    textarea.value = "";
    outputDiv.innerHTML = "";

    textarea.style.display = "block";
    outputDiv.style.display = "none";

    localStorage.clear();
}

/* =========================
   LOAD SAVED DATA
========================= */
window.addEventListener("load", () => {
    const textarea = document.getElementById("inputText");
    const outputDiv = document.getElementById("output");

    const savedInput = localStorage.getItem("savedInput");
    const savedOutput = localStorage.getItem("savedOutput");

    if (savedInput && savedOutput) {
        textarea.value = savedInput;
        outputDiv.innerHTML = savedOutput;

        textarea.style.display = "none";
        outputDiv.style.display = "block";
    }
});

/* =========================
   GENDER FUNCTIONS
========================= */
function getGender(word) {
    if (nounGenderDictionary[word]) return nounGenderDictionary[word];

    if (word && word[0] === word[0].toUpperCase()) {
        for (let i = 1; i < word.length; i++) {
            let variant = word[i - 1].toUpperCase() + word.slice(i);
            if (nounGenderDictionary[variant]) return nounGenderDictionary[variant];
        }
    }

    return null;
}

function mapGender(g) {
    return {
        M: "masculine",
        F: "feminine",
        N: "neuter",
        NG: "only-plural"
    }[g] || "";
}

/* =========================
   HOVER BOX (FIXED)
========================= */
const hoverBox = document.createElement("div");
hoverBox.id = "hoverBox";
document.body.appendChild(hoverBox);

hoverBox.style.position = "fixed";
hoverBox.style.display = "none";
hoverBox.style.zIndex = "99999";
hoverBox.style.background = "rgba(0,0,0,0.85)";
hoverBox.style.color = "#fff";
hoverBox.style.padding = "10px";
hoverBox.style.borderRadius = "8px";
hoverBox.style.maxWidth = "300px";
hoverBox.style.fontSize = "13px";
hoverBox.style.pointerEvents = "auto";

/* =========================
   HOVER LOGIC (STABLE VERSION)
========================= */

let hoverTimeout = null;
let lastWord = null;

document.addEventListener("mouseover", function (e) {
    const target = e.target;

    if (!target.classList.contains("word-hover")) return;

    const word = target.dataset.word;
    lastWord = word;

    clearTimeout(hoverTimeout);

    hoverTimeout = setTimeout(() => {
        fetchData(word, (html) => {
            if (!html) return;

            // ignore outdated async response
            if (word !== lastWord) return;

            hoverBox.innerHTML = html;
            hoverBox.style.display = "block";

            const rect = target.getBoundingClientRect();

            let left = rect.left;
            let top = rect.bottom + 8;

            // screen boundary protection
            if (left + 320 > window.innerWidth) {
                left = window.innerWidth - 330;
            }

            if (top + 200 > window.innerHeight) {
                top = rect.top - 210;
            }

            hoverBox.style.left = left + "px";
            hoverBox.style.top = top + "px";
        });
    }, 150); // small delay prevents flicker
});

document.addEventListener("mouseout", function (e) {
    const related = e.relatedTarget;

    // keep box open if moving inside it
    if (hoverBox.contains(related)) return;

    hoverTimeout = setTimeout(() => {
        hoverBox.style.display = "none";
    }, 200);
});

/* =========================
   API FETCH (FIXED FOR WEB)
========================= */
function fetchData(word, callback) {
    fetch(`https://freedictionaryapi.com/api/v1/entries/de/${encodeURIComponent(word)}?translations=true`)
        .then(res => res.json())
        .then(data => {
            let entry = data?.entries?.[0];
            if (!entry) return callback("");

            let meaning = entry.senses?.[0]?.definition || "";

            let syn = (entry.synonyms || []).join(", ");
            let ant = (entry.antonyms || []).join(", ");

            let html = `
                <b>${word}</b><br>
                ${meaning}<br><hr>
                ${syn ? `<b>Syn:</b> ${syn}<br>` : ""}
                ${ant ? `<b>Ant:</b> ${ant}` : ""}
            `;

            callback(html);
        })
        .catch(() => callback(""));
}
