window.detectGender = function () {
    const text = document.getElementById("inputText").value;
    const outputDiv = document.getElementById("output");

    const words = text.split(/(\s+|[.,\/#!$%\^&\*;:{}=\-_`~()])/g);

    let result = "";

    words.forEach(word => {
        let gender = getGender(word);

        if (gender) {
            let cls = mapGender(gender);
            result += `<span class="${cls}">${word}</span>`;
        } else {
            result += word;
        }
    });

    outputDiv.innerHTML = result;

    // 🔥 SAVE DATA
    localStorage.setItem("savedInput", text);
    localStorage.setItem("savedOutput", result);
};

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

window.addEventListener("load", () => {
    const savedInput = localStorage.getItem("savedInput");
    const savedOutput = localStorage.getItem("savedOutput");

    if (savedInput) {
        document.getElementById("inputText").value = savedInput;
    }

    if (savedOutput) {
        document.getElementById("output").innerHTML = savedOutput;
    }
});


function clearText() {
    document.getElementById("inputText").value = "";
    document.getElementById("output").innerHTML = "";

    // 🔥 REMOVE SAVED DATA
    localStorage.removeItem("savedInput");
    localStorage.removeItem("savedOutput");
}
