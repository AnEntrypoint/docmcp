export function parseColor(colorStr) {
  if (!colorStr) return null;
  const hex = colorStr.replace('#', '');
  if (hex.length !== 6) return null;
  return { red: parseInt(hex.substring(0, 2), 16) / 255, green: parseInt(hex.substring(2, 4), 16) / 255, blue: parseInt(hex.substring(4, 6), 16) / 255 };
}

function colToNum(col) {
  if (typeof col === 'number') return col;
  let num = 0;
  for (const char of col.toUpperCase()) num = num * 26 + (char.charCodeAt(0) - 64);
  return num - 1;
}

export function parseA1Range(range) {
  const match = range.match(/^(?:([^!]+)!)?([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/i);
  if (!match) return null;
  return {
    sheetName: match[1] || null,
    startCol: colToNum(match[2]),
    startRow: parseInt(match[3]) - 1,
    endCol: match[4] ? colToNum(match[4]) : colToNum(match[2]),
    endRow: match[5] ? parseInt(match[5]) - 1 : parseInt(match[3]) - 1
  };
}

export { colToNum };
