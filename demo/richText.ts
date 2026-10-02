export type Run = {
  readonly text: string;
  readonly bold: boolean;
  readonly italic: boolean;
};

export type Paragraph = readonly Run[];

const MARKUP = /\*\*([^*]+)\*\*|\*([^*]+)\*/g;

// Minimal markup: **bold** and *italic*. Each line is a paragraph.
export function parseRichText(source: string): Paragraph[] {
  return source.split("\n").map(parseParagraph);
}

function parseParagraph(line: string): Paragraph {
  const runs: Run[] = [];
  let plainFrom = 0;
  for (const match of line.matchAll(MARKUP)) {
    if (match.index > plainFrom) runs.push({ text: line.slice(plainFrom, match.index), bold: false, italic: false });
    if (match[1] !== undefined) runs.push({ text: match[1], bold: true, italic: false });
    else runs.push({ text: match[2], bold: false, italic: true });
    plainFrom = match.index + match[0].length;
  }
  if (plainFrom < line.length) runs.push({ text: line.slice(plainFrom), bold: false, italic: false });
  return runs;
}
