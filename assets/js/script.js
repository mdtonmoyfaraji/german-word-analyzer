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

    // 🔥 SWITCH VIEW
    textarea.style.display = "none";
    outputDiv.style.display = "block";

    // SAVE
    localStorage.setItem("savedInput", text);
    localStorage.setItem("savedOutput", result);
};

function editText() {
    const textarea = document.getElementById("inputText");
    const outputDiv = document.getElementById("output");

    textarea.style.display = "block";
    outputDiv.style.display = "none";
}

function clearText() {
    const textarea = document.getElementById("inputText");
    const outputDiv = document.getElementById("output");

    textarea.value = "";
    outputDiv.innerHTML = "";

    textarea.style.display = "block";
    outputDiv.style.display = "none";

    localStorage.removeItem("savedInput");
    localStorage.removeItem("savedOutput");
}

// LOAD SAVED STATE
window.addEventListener("load", () => {
    const savedInput = localStorage.getItem("savedInput");
    const savedOutput = localStorage.getItem("savedOutput");

    const textarea = document.getElementById("inputText");
    const outputDiv = document.getElementById("output");

    if (savedInput && savedOutput) {
        textarea.value = savedInput;
        outputDiv.innerHTML = savedOutput;

        textarea.style.display = "none";
        outputDiv.style.display = "block";
    }
});

// EXISTING FUNCTIONS
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

const hoverBox = document.createElement("div");
hoverBox.id = "hoverBox";
document.body.appendChild(hoverBox);

// 🔥 HOVER EVENT
document.addEventListener("mouseover", function(e) {
    if (!e.target.classList.contains("word-hover")) return;

    let word = e.target.dataset.word;

    fetchData(word, (html) => {
        if (!html) return;

        hoverBox.innerHTML = html;
        hoverBox.style.display = "block";

        let rect = e.target.getBoundingClientRect();
        hoverBox.style.left = rect.left + "px";
        hoverBox.style.top = (rect.bottom + 5) + "px";
    });
});

document.addEventListener("mouseout", function(e) {
    if (e.target.classList.contains("word-hover")) {
        hoverBox.style.display = "none";
    }
});

function fetchData(word, callback) {
    fetch(`https://freedictionaryapi.com/api/v1/entries/de/${encodeURIComponent(word)}?translations=true`)
        .then(res => res.json())
        .then(data => {

            let entry = data.entries?.[0];
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
