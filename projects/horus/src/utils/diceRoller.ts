export type DiceRollTerm =
  | {
      kind: "dice";
      sign: 1 | -1;
      count: number;
      faces: number;
      rolls: number[];
      total: number;
    }
  | {
      kind: "modifier";
      sign: 1 | -1;
      value: number;
      total: number;
    };

export type DiceRollResult = {
  formula: string;
  total: number;
  terms: DiceRollTerm[];
};

export function isDiceThrowInteger(type: string) {
  return /^d[1-9]\d*_throw_int$/.test(type);
}

export function getDiceFaces(type: string) {
  const match = type.match(/^d([1-9]\d*)_throw_int$/);
  return match ? parseInt(match[1], 10) : 20;
}

export function rollFormula(rawFormula: string): DiceRollResult {
  const formula = rawFormula.replace(/\s+/g, "").toLowerCase();

  if (!formula) {
    throw new Error("Escribe una fórmula.");
  }

  const tokenPattern = /([+-]?)(?:(\d*)d([1-9]\d*)|(\d+))/g;
  const terms: DiceRollTerm[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(formula)) !== null) {
    if (match.index !== cursor) {
      throw new Error("Fórmula inválida.");
    }

    const sign: 1 | -1 = match[1] === "-" ? -1 : 1;

    if (match[3]) {
      const count = match[2] ? parseInt(match[2], 10) : 1;
      const faces = parseInt(match[3], 10);

      if (count <= 0 || count > 100 || faces <= 0 || faces > 10000) {
        throw new Error("Demasiados dados.");
      }

      const rolls = Array.from({ length: count }, () => Math.floor(Math.random() * faces) + 1);
      const total = sign * rolls.reduce((sum, roll) => sum + roll, 0);
      terms.push({ kind: "dice", sign, count, faces, rolls, total });
    } else {
      const value = parseInt(match[4], 10);
      terms.push({ kind: "modifier", sign, value, total: sign * value });
    }

    cursor = tokenPattern.lastIndex;
  }

  if (cursor !== formula.length || terms.length === 0) {
    throw new Error("Fórmula inválida.");
  }

  return {
    formula,
    terms,
    total: terms.reduce((sum, term) => sum + term.total, 0),
  };
}

export function formatRollBreakdown(result: DiceRollResult) {
  return result.terms
    .map((term, index) => {
      const prefix = term.sign < 0 ? "-" : index === 0 ? "" : "+";

      if (term.kind === "dice") {
        return `${prefix}${term.count}d${term.faces}[${term.rolls.join(",")}]`;
      }

      return `${prefix}${term.value}`;
    })
    .join(" ");
}
