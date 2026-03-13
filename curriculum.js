(function () {
  function gcd(a, b) {
    let x = Math.abs(a);
    let y = Math.abs(b);
    while (y) {
      const temp = y;
      y = x % y;
      x = temp;
    }
    return x || 1;
  }

  function createRational(num, den) {
    if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) {
      return null;
    }

    let numerator = num;
    let denominator = den;
    if (denominator < 0) {
      numerator *= -1;
      denominator *= -1;
    }

    const divisor = gcd(numerator, denominator);
    return {
      num: numerator / divisor,
      den: denominator / divisor
    };
  }

  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function formatInt(value) {
    return value < 0 ? `(${value})` : String(value);
  }

  function formatLinearTerm(coefficient) {
    if (coefficient === 1) {
      return "x";
    }
    if (coefficient === -1) {
      return "-x";
    }
    return `${coefficient}x`;
  }

  function formatSignedNumber(value) {
    return value < 0 ? `- ${Math.abs(value)}` : `+ ${value}`;
  }

  function buildFractionQuestion() {
    const denominators = [2, 3, 4, 5, 6, 8, 10, 12];

    while (true) {
      const d1 = pick(denominators);
      const d2 = pick(denominators);
      const n1 = randInt(1, d1 - 1);
      const n2 = randInt(1, d2 - 1);
      const operation = Math.random() < 0.5 ? "+" : "-";
      const denominator = d1 * d2;
      let numerator;

      if (operation === "+") {
        numerator = (n1 * d2) + (n2 * d1);
      } else {
        numerator = (n1 * d2) - (n2 * d1);
        if (numerator <= 0) {
          continue;
        }
      }

      return {
        text: `${n1}/${d1} ${operation} ${n2}/${d2}`,
        answerType: "mixedFraction",
        solution: createRational(numerator, denominator)
      };
    }
  }

  function buildIntegerOperationsQuestion() {
    const operation = pick(["+", "-", "×", "÷"]);

    if (operation === "÷") {
      const divisor = pick([-12, -9, -8, -6, -4, -3, -2, 2, 3, 4, 6, 8, 9, 12]);
      const quotient = randInt(-12, 12);
      const dividend = divisor * quotient;
      return {
        text: `${formatInt(dividend)} ${operation} ${formatInt(divisor)}`,
        answerType: "text",
        solution: createRational(quotient, 1)
      };
    }

    const left = randInt(-20, 20);
    const right = randInt(-20, 20);
    const value = operation === "+"
      ? left + right
      : operation === "-"
        ? left - right
        : left * right;

    return {
      text: `${formatInt(left)} ${operation} ${formatInt(right)}`,
      answerType: "text",
      solution: createRational(value, 1)
    };
  }

  function buildPercentQuestion() {
    const templates = [
      { percent: 5, step: 20 },
      { percent: 10, step: 10 },
      { percent: 20, step: 5 },
      { percent: 25, step: 4 },
      { percent: 40, step: 5 },
      { percent: 50, step: 2 },
      { percent: 60, step: 5 },
      { percent: 75, step: 4 }
    ];
    const template = pick(templates);
    const base = template.step * randInt(4, 24);
    const value = (template.percent * base) / 100;

    return {
      text: `Find ${template.percent}% of ${base}.`,
      answerType: "text",
      solution: createRational(value, 1)
    };
  }

  function buildEquivalentRatioQuestion() {
    const leftA = randInt(1, 12);
    const leftB = randInt(2, 12);
    const factor = randInt(2, 9);

    if (Math.random() < 0.5) {
      return {
        text: `${leftA} : ${leftB} = ? : ${leftB * factor}`,
        answerType: "text",
        solution: createRational(leftA * factor, 1)
      };
    }

    return {
      text: `? : ${leftB} = ${leftA * factor} : ${leftB * factor}`,
      answerType: "text",
      solution: createRational(leftA, 1)
    };
  }

  function buildOneStepEquationQuestion() {
    const solution = randInt(-12, 12);
    const mode = pick(["add", "subtract", "multiply", "divide"]);

    if (mode === "add") {
      const offset = randInt(-12, 12);
      return {
        text: `Solve: x ${formatSignedNumber(offset)} = ${solution + offset}`,
        answerType: "text",
        solution: createRational(solution, 1)
      };
    }

    if (mode === "subtract") {
      const offset = randInt(-12, 12);
      return {
        text: `Solve: x - ${formatInt(offset)} = ${solution - offset}`,
        answerType: "text",
        solution: createRational(solution, 1)
      };
    }

    if (mode === "multiply") {
      const coefficient = pick([-9, -8, -6, -4, -3, -2, 2, 3, 4, 5, 6, 8, 9]);
      return {
        text: `Solve: ${formatLinearTerm(coefficient)} = ${coefficient * solution}`,
        answerType: "text",
        solution: createRational(solution, 1)
      };
    }

    const divisor = pick([2, 3, 4, 5, 6, 8, 10]);
    return {
      text: `Solve: x / ${divisor} = ${solution}`,
      answerType: "text",
      solution: createRational(solution * divisor, 1)
    };
  }

  function buildExponentQuestion() {
    const base = pick([-5, -4, -3, -2, 2, 3, 4, 5, 6]);
    const exponent = pick([2, 2, 3, 3, 4]);
    const value = Math.pow(base, exponent);
    const baseText = base < 0 ? `(${base})` : String(base);

    return {
      text: `Evaluate: ${baseText}^${exponent}`,
      answerType: "text",
      solution: createRational(value, 1)
    };
  }

  function buildPythagoreanQuestion() {
    const triples = [
      [3, 4, 5],
      [5, 12, 13],
      [6, 8, 10],
      [7, 24, 25],
      [8, 15, 17],
      [9, 12, 15]
    ];
    const [a, b, c] = pick(triples);

    if (Math.random() < 0.5) {
      return {
        text: `A right triangle has legs ${a} and ${b}. Find the hypotenuse.`,
        answerType: "text",
        solution: createRational(c, 1)
      };
    }

    if (Math.random() < 0.5) {
      return {
        text: `A right triangle has hypotenuse ${c} and one leg ${a}. Find the missing leg.`,
        answerType: "text",
        solution: createRational(b, 1)
      };
    }

    return {
      text: `A right triangle has hypotenuse ${c} and one leg ${b}. Find the missing leg.`,
      answerType: "text",
      solution: createRational(a, 1)
    };
  }

  function buildTwoStepEquationQuestion() {
    const solution = randInt(-12, 12);
    const mode = pick(["add", "subtract", "divide"]);

    if (mode === "add") {
      const coefficient = pick([-8, -6, -4, -3, -2, 2, 3, 4, 5, 6, 8]);
      const offset = randInt(-12, 12);
      return {
        text: `Solve: ${formatLinearTerm(coefficient)} ${formatSignedNumber(offset)} = ${(coefficient * solution) + offset}`,
        answerType: "text",
        solution: createRational(solution, 1)
      };
    }

    if (mode === "subtract") {
      const coefficient = pick([-8, -6, -4, -3, -2, 2, 3, 4, 5, 6, 8]);
      const offset = randInt(1, 12);
      return {
        text: `Solve: ${formatLinearTerm(coefficient)} - ${offset} = ${(coefficient * solution) - offset}`,
        answerType: "text",
        solution: createRational(solution, 1)
      };
    }

    const divisor = pick([2, 3, 4, 5, 6, 8]);
    const offset = randInt(-10, 10);
    const rightSide = solution + offset;
    return {
      text: `Solve: x / ${divisor} ${formatSignedNumber(offset)} = ${rightSide}`,
      answerType: "text",
      solution: createRational((rightSide - offset) * divisor, 1)
    };
  }

  function buildSlopeQuestion() {
    while (true) {
      const x1 = randInt(-6, 6);
      const y1 = randInt(-8, 8);
      const run = pick([-5, -4, -3, -2, -1, 1, 2, 3, 4, 5]);
      const rise = pick([-8, -6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6, 8]);
      const x2 = x1 + run;
      const y2 = y1 + rise;

      if (x1 === x2) {
        continue;
      }

      return {
        text: `Find the slope of the line through (${x1}, ${y1}) and (${x2}, ${y2}).`,
        answerType: "text",
        solution: createRational(rise, run)
      };
    }
  }

  function buildLinearEvaluationQuestion() {
    const slope = pick([-6, -5, -4, -3, -2, 2, 3, 4, 5, 6]);
    const intercept = randInt(-12, 12);
    const xValue = randInt(-8, 8);
    const yValue = (slope * xValue) + intercept;
    const interceptText = intercept === 0
      ? ""
      : intercept < 0
        ? ` - ${Math.abs(intercept)}`
        : ` + ${intercept}`;

    return {
      text: `For y = ${slope}x${interceptText}, find y when x = ${xValue}.`,
      answerType: "text",
      solution: createRational(yValue, 1)
    };
  }

  const grades = [
    { id: "grade7", label: "Grade 7" },
    { id: "grade8", label: "Grade 8" },
    { id: "grade9", label: "Grade 9" }
  ];

  const skills = [
    {
      id: "grade7-fractions",
      grade: "grade7",
      label: "Fractions: Add & Subtract",
      description: "Practice adding and subtracting unlike fractions and simplify answers as mixed numbers when needed.",
      answerType: "mixedFraction",
      answerHelp: "Enter answers as a mixed number in simplest form. For a whole number, use 0 over 1 for the fraction part.",
      generateQuestion: buildFractionQuestion
    },
    {
      id: "grade7-integers",
      grade: "grade7",
      label: "Integers: Four Operations",
      description: "Work with positive and negative integers using addition, subtraction, multiplication, and division.",
      answerType: "text",
      answerHelp: "Type a whole number, decimal, or fraction. Negative answers are allowed.",
      generateQuestion: buildIntegerOperationsQuestion
    },
    {
      id: "grade7-percents",
      grade: "grade7",
      label: "Percents of a Number",
      description: "Find benchmark percents of whole numbers, including common classroom percents like 25%, 50%, and 75%.",
      answerType: "text",
      answerHelp: "Type a whole number, decimal, or fraction. Equivalent forms are accepted.",
      generateQuestion: buildPercentQuestion
    },
    {
      id: "grade7-ratios",
      grade: "grade7",
      label: "Equivalent Ratios",
      description: "Fill in the missing value in proportion and ratio equations.",
      answerType: "text",
      answerHelp: "Type the missing number for the equivalent ratio.",
      generateQuestion: buildEquivalentRatioQuestion
    },
    {
      id: "grade8-equations",
      grade: "grade8",
      label: "One-Step Equations",
      description: "Solve one-step equations with addition, subtraction, multiplication, and division.",
      answerType: "text",
      answerHelp: "Type the value of x. Whole numbers, decimals, and fractions are all accepted.",
      generateQuestion: buildOneStepEquationQuestion
    },
    {
      id: "grade8-exponents",
      grade: "grade8",
      label: "Exponents",
      description: "Evaluate integer powers, including problems with negative bases written in parentheses.",
      answerType: "text",
      answerHelp: "Type the final value after evaluating the exponent.",
      generateQuestion: buildExponentQuestion
    },
    {
      id: "grade8-pythagorean",
      grade: "grade8",
      label: "Pythagorean Theorem",
      description: "Use common right-triangle triples to find a missing side quickly and accurately.",
      answerType: "text",
      answerHelp: "Type the missing side length as a number.",
      generateQuestion: buildPythagoreanQuestion
    },
    {
      id: "grade9-two-step",
      grade: "grade9",
      label: "Two-Step Equations",
      description: "Solve multi-step linear equations involving coefficients, division, and signed constants.",
      answerType: "text",
      answerHelp: "Type the value of x. Fractions are okay if the answer is not a whole number.",
      generateQuestion: buildTwoStepEquationQuestion
    },
    {
      id: "grade9-slope",
      grade: "grade9",
      label: "Slope from Two Points",
      description: "Find rise over run from coordinate pairs and simplify the slope when needed.",
      answerType: "text",
      answerHelp: "Type the slope as an integer, decimal, or fraction such as -3/2.",
      generateQuestion: buildSlopeQuestion
    },
    {
      id: "grade9-linear-values",
      grade: "grade9",
      label: "Linear Functions",
      description: "Evaluate linear equations by substituting an x-value and solving for y.",
      answerType: "text",
      answerHelp: "Type the value of y after substituting the given x-value.",
      generateQuestion: buildLinearEvaluationQuestion
    }
  ];

  window.PixelMathCurriculum = { grades, skills };
}());
