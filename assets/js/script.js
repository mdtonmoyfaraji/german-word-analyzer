function detectGender() {
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
}

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
