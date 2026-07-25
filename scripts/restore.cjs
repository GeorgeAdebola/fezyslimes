const fs = require('fs');

const transcriptPath = 'C:\\Users\\Olamiposi Badiya\\.gemini\\antigravity-ide\\brain\\77c052d8-f229-4b4c-83bf-9db295ede69d\\.system_generated\\logs\\transcript_full.jsonl';
const lines = fs.readFileSync(transcriptPath, 'utf-8').split('\n');

let part1 = '';
let part2 = '';

for (const line of lines) {
  if (!line) continue;
  try {
    const data = JSON.parse(line);
    if (data.type === 'VIEW_FILE' && data.content && data.content.includes('Showing lines 1 to 800')) {
      part1 = data.content;
    }
    if (data.type === 'VIEW_FILE' && data.content && data.content.includes('Showing lines 800 to 1159')) {
      part2 = data.content;
    }
  } catch(e) {}
}

function extractCode(viewFileText) {
  const lines = viewFileText.split('\n');
  let inCode = false;
  let code = [];
  for (const line of lines) {
    if (line.match(/^1: /) || line.match(/^800: /)) inCode = true;
    if (line.startsWith('The above content does NOT show')) inCode = false;
    if (line.startsWith('The above content shows the entire')) inCode = false;
    
    if (inCode) {
      // remove the line number prefix e.g. "1: "
      code.push(line.replace(/^\d+: /, ''));
    }
  }
  return code.join('\n');
}

let fullCode = extractCode(part1) + '\n' + extractCode(part2).split('\n').slice(1).join('\n');

// Apply the 3 bug fixes
fullCode = fullCode.replace(/db\.collection\('products'\.delete\(\)\.doc\(id\)\)/g, "db.collection('products').doc(id).delete()");
fullCode = fullCode.replace(/db\.collection\('orders'\.get\(\)\)/g, "db.collection('orders').get()");
fullCode = fullCode.replace(/await doc\(productsRef\.set\(prod\.id\), prod\)/g, "await productsRef.doc(prod.id).set(prod)");
fullCode = fullCode.replace(/if \(\!snapshot\.exists\(\)\) \{/g, "if (!snapshot.exists) {"); // fix shipping rates seed bug
fullCode = fullCode.replace(/await ratesDocRef\.set\(defaultShippingRates\);/g, "await ratesDocRef.set(defaultShippingRates);"); // this was already correct in the original

fs.writeFileSync('c:\\Users\\Olamiposi Badiya\\Desktop\\fezyslimes\\server\\index.cjs', fullCode);
console.log('Restored server/index.cjs');
