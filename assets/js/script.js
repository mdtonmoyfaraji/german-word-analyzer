window.detectGender = function () {
    const textarea = document.getElementById("inputText");
    const outputDiv = document.getElementById("output");

    const text = textarea.value;

    if (!text.trim()) {
        return;
    }
    const words = text.split(/(\s+|[.,\/#!$%\^&\*;:{}=\-_`~()])/g);

    let result = "";

    words.forEach(word => {
        let gender = getGender(word);

        if (gender) {
            let cls = mapGender(gender);
            result += `<span class="${cls}">${word}</span>`;
        } else if (/[A-Za-zÄÖÜäöüß]/.test(word)) {
            result += `<span class="word-token">${word}</span>`;
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
