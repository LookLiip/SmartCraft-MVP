// Test cleanup function matching Edge Function behavior
function cleanTranscription(text) {
  let cleaned = text;
  const fillerPatterns = [
    /\b(?:äh|öhm|uhm|hm{1,3}|mm{1,3}|em|eh|ach|so{1,2}|ja{1,2}|okay|ok)\b/gi,
    /\s+/g,
  ];
  for (const pattern of fillerPatterns) {
    cleaned = cleaned.replace(pattern, ' ');
  }
  cleaned = cleaned.replace(/\b(\w+)(\s+\1\b)+/gi, '$1');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  if (cleaned.length > 0 && cleaned[0] === cleaned[0].toLowerCase()) {
    cleaned = cleaned[0].toUpperCase() + cleaned.slice(1);
  }
  if (cleaned.length > 0 && !/[.!?]$/.test(cleaned)) {
    cleaned = cleaned + '.';
  }
  return cleaned;
}

const tests = [
  ['äh ich habe die kabel verlegt öhm', 'Ich habe die kabel verlegt.'],
  ['ich ich ich habe das gemacht das das gemacht', 'Ich habe das gemacht.'],
  ['so die arbeiten sind fertig', 'So die arbeiten sind fertig.']
];

console.log('Testing cleanTranscription:');
let passed = 0;
tests.forEach((t, i) => {
  const result = cleanTranscription(t[0]);
  const clean = result.replace(/\.$/, '');
  const exp = t[1].replace(/\.$/, '');
  if (clean === exp) {
    console.log(`✓ Test ${i+1}: "${t[0]}" -> "${result}"`);
    passed++;
  } else {
    console.log(`✗ Test ${i+1}: Expected "${t[1]}" but got "${result}"`);
  }
});
console.log(`\n${passed}/${tests.length} tests passed`);

// Also test the language detection
function detectLanguage(text) {
  const lowerText = text.toLowerCase();
  const deWords = ["der", "die", "das", "und", "ist", "von", "mit", "für", "auf", "nicht", "ich", "wir", "sie", "ein", "eine", "zu", "den", "dem", "einen", "von", "bei", "mit"];
  const trWords = ["bir", "ve", "için", "bu", "da", "de", "ne", "var", "yok", "ben", "sen", "biz", "onlar", "daha", "çok", "kadar", "gibi"];
  const plWords = ["i", "w", "z", "na", "do", "nie", "się", "to", "jest", "być", "byłem", "my", "ty", "się", "tak", "nie", "ale"];
  const roWords = ["și", "de", "a", "în", "pe", "la", "un", "o", "nu", "eu", "tu", "noi", "voi", "ei", "ca", "cu", "sau"];
  const arWords = ["في", "من", "إلى", "على", "هذا", "ال", "أن", "كان", "ليس", "مع", "ما", "هل", "لا", "عن", "بعد"];

  const scores = { de: 0, tr: 0, pl: 0, ro: 0, ar: 0 };
  for (const word of deWords) { if (lowerText.includes(word)) scores.de += 2; }
  for (const word of trWords) { if (lowerText.includes(word)) scores.tr += 2; }
  for (const word of plWords) { if (lowerText.includes(word)) scores.pl += 2; }
  for (const word of roWords) { if (lowerText.includes(word)) scores.ro += 2; }
  for (const word of arWords) { if (lowerText.includes(word)) scores.ar += 2; }

  const maxLang = Object.entries(scores).reduce((a, b) => a[1] > b[1] ? a : b);
  if (maxLang[1] === 0) return "unknown";
  return maxLang[0];
}

console.log('\nTesting detectLanguage:');
const langTests = [
  { text: "der die das und ist von mit für auf nicht", lang: "de" },
  { text: "bir ve için bu da de ne var yok", lang: "tr" },
  { text: "i w z na do nie się to jest", lang: "pl" },
  { text: "și de a în pe la un o nu eu", lang: "ro" },
  { text: "في من إلى على هذا ال أن كان", lang: "ar" }
];
let langPassed = 0;
langTests.forEach((t, i) => {
  const result = detectLanguage(t.text);
  if (result === t.lang) {
    console.log(`✓ Test ${i+1}: "${t.lang}" detected correctly`);
    langPassed++;
  } else {
    console.log(`✗ Test ${i+1}: Expected "${t.lang}" but got "${result}"`);
  }
});
console.log(`\n${langPassed}/${langTests.length} language tests passed`);