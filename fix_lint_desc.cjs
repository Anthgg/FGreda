const fs = require('fs');
let l = fs.readFileSync('src/features/cotizadorV2/V2LaborLines.test.tsx', 'utf8');
l = l.replace(/@ts-expect-error/g, '@ts-expect-error Mock type incomplete');
fs.writeFileSync('src/features/cotizadorV2/V2LaborLines.test.tsx', l);

let w = fs.readFileSync('src/features/cotizadorV2/V2Wizard.test.tsx', 'utf8');
w = w.replace(/@ts-expect-error/g, '@ts-expect-error Mock type incomplete');
fs.writeFileSync('src/features/cotizadorV2/V2Wizard.test.tsx', w);
