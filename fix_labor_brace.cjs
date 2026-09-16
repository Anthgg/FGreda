const fs = require('fs');
let l = fs.readFileSync('src/features/cotizadorV2/V2LaborLines.tsx', 'utf8');
let lines = l.split('\n');
lines.splice(144, 1); // delete line 145 (0-indexed)
fs.writeFileSync('src/features/cotizadorV2/V2LaborLines.tsx', lines.join('\n'));
