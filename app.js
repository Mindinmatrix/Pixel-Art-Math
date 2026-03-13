const GRID_SIZE = 12;
const QUESTION_COUNT = 20;

const themes = window.PixelArtShapes || {};
const themeColors = window.PixelArtColors || {};
const curriculum = window.PixelMathCurriculum || { grades: [], skills: [] };
const themeNames = Object.keys(themes);
const gradeCatalog = curriculum.grades || [];
const allSkills = curriculum.skills || [];

const state = {
  theme: themeNames[0] || "Cute",
  shape: "Heart",
  grade: gradeCatalog[0]?.id || "grade7",
  skillId: allSkills[0]?.id || "",
  questions: [],
  answers: []
};

const els = {};

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

function rationalEquals(left, right) {
  return Boolean(left) && Boolean(right) && left.num === right.num && left.den === right.den;
}

function getShapesForTheme(theme) {
  return Object.keys(themes[theme] || {});
}

function getPattern(theme, shape) {
  return themes[theme]?.[shape] ?? themes.Cute?.Heart ?? [];
}

function getShapeColors(theme, shape) {
  return themeColors[theme]?.[shape] ?? { pixel: "#111827", glow: "rgba(17, 24, 39, 0.18)" };
}

function getSkillsForGrade(grade) {
  return allSkills.filter((skill) => skill.grade === grade);
}

function getGradeLabel(grade) {
  return gradeCatalog.find((entry) => entry.id === grade)?.label ?? grade;
}

function getSkillById(skillId) {
  return allSkills.find((skill) => skill.id === skillId) ?? getSkillsForGrade(state.grade)[0] ?? allSkills[0] ?? null;
}

function getCurrentSkill() {
  return getSkillById(state.skillId);
}

function makeEmptyAnswer(answerType) {
  return answerType === "mixedFraction"
    ? { whole: "", num: "", den: "" }
    : { value: "" };
}

function cacheElements() {
  els.appTitle = document.getElementById("appTitle");
  els.appSubtitle = document.getElementById("appSubtitle");
  els.themeSelect = document.getElementById("themeSelect");
  els.shapeSelect = document.getElementById("shapeSelect");
  els.gradeSelect = document.getElementById("gradeSelect");
  els.skillSelect = document.getElementById("skillSelect");
  els.skillGradeLabel = document.getElementById("skillGradeLabel");
  els.skillTitle = document.getElementById("skillTitle");
  els.skillDescription = document.getElementById("skillDescription");
  els.tipBox = document.getElementById("tipBox");
  els.answerGuide = document.getElementById("answerGuide");
  els.newPuzzleBtn = document.getElementById("newPuzzleBtn");
  els.resetBtn = document.getElementById("resetBtn");
  els.solveAllBtn = document.getElementById("solveAllBtn");
  els.pixelGrid = document.getElementById("pixelGrid");
  els.questionBody = document.getElementById("questionBody");
  els.correctCount = document.getElementById("correctCount");
  els.progressCount = document.getElementById("progressCount");
  els.shapeName = document.getElementById("shapeName");
  els.pixelProgressText = document.getElementById("pixelProgressText");
  els.celebrateBox = document.getElementById("celebrateBox");
  els.testPanel = document.getElementById("testPanel");
}

function requiredElementsExist() {
  return [
    "appTitle",
    "appSubtitle",
    "themeSelect",
    "shapeSelect",
    "gradeSelect",
    "skillSelect",
    "skillGradeLabel",
    "skillTitle",
    "skillDescription",
    "tipBox",
    "answerGuide",
    "newPuzzleBtn",
    "resetBtn",
    "solveAllBtn",
    "pixelGrid",
    "questionBody",
    "correctCount",
    "progressCount",
    "shapeName",
    "pixelProgressText",
    "celebrateBox",
    "testPanel"
  ].every((key) => Boolean(els[key]));
}

function populateThemeSelect() {
  els.themeSelect.innerHTML = "";
  themeNames.forEach((theme) => {
    const option = document.createElement("option");
    option.value = theme;
    option.textContent = theme;
    els.themeSelect.appendChild(option);
  });
  els.themeSelect.value = state.theme;
}

function populateShapeSelect() {
  els.shapeSelect.innerHTML = '<option value="random">Random</option>';
  getShapesForTheme(state.theme).forEach((shape) => {
    const option = document.createElement("option");
    option.value = shape;
    option.textContent = shape;
    els.shapeSelect.appendChild(option);
  });
  els.shapeSelect.value = "random";
}

function populateGradeSelect() {
  els.gradeSelect.innerHTML = "";
  gradeCatalog.forEach((grade) => {
    const option = document.createElement("option");
    option.value = grade.id;
    option.textContent = grade.label;
    els.gradeSelect.appendChild(option);
  });
  els.gradeSelect.value = state.grade;
}

function populateSkillSelect() {
  const skills = getSkillsForGrade(state.grade);
  els.skillSelect.innerHTML = "";

  skills.forEach((skill) => {
    const option = document.createElement("option");
    option.value = skill.id;
    option.textContent = skill.label;
    els.skillSelect.appendChild(option);
  });

  if (!skills.some((skill) => skill.id === state.skillId)) {
    state.skillId = skills[0]?.id || "";
  }

  els.skillSelect.value = state.skillId;
}

function chooseShape() {
  const value = els.shapeSelect.value;
  if (value === "random") {
    const shapes = getShapesForTheme(state.theme);
    state.shape = shapes[Math.floor(Math.random() * shapes.length)] || "Heart";
  } else {
    state.shape = value;
  }
}

function getCurrentPattern() {
  return getPattern(state.theme, state.shape);
}

function buildPixelGrid() {
  els.pixelGrid.innerHTML = "";
  const pattern = getCurrentPattern();
  const colors = getShapeColors(state.theme, state.shape);
  els.pixelGrid.style.setProperty("--pixel", colors.pixel);
  els.pixelGrid.style.setProperty("--pixel-glow", colors.glow);

  for (let rowIndex = 0; rowIndex < GRID_SIZE; rowIndex += 1) {
    const row = pattern[rowIndex] || ".".repeat(GRID_SIZE);
    for (let colIndex = 0; colIndex < GRID_SIZE; colIndex += 1) {
      const cell = document.createElement("div");
      cell.className = "cell";
      if (row[colIndex] === "#") {
        cell.dataset.active = "true";
      }
      els.pixelGrid.appendChild(cell);
    }
  }
}

function updateSkillCard() {
  const skill = getCurrentSkill();
  if (!skill) {
    els.skillGradeLabel.textContent = "Math";
    els.skillTitle.textContent = "Choose a skill";
    els.skillDescription.textContent = "This project is ready for multi-grade math practice once a skill is selected.";
    els.tipBox.textContent = "";
    els.answerGuide.innerHTML = "";
    return;
  }

  els.skillGradeLabel.textContent = getGradeLabel(skill.grade);
  els.skillTitle.textContent = skill.label;
  els.skillDescription.textContent = skill.description;
  els.appSubtitle.textContent = `Choose a ${getGradeLabel(skill.grade).toLowerCase()} skill and reveal a hidden pixel picture one answer at a time.`;
  els.tipBox.innerHTML = skill.answerType === "mixedFraction"
    ? `Use <strong>Tab</strong> or click to move between boxes.<br>${skill.answerHelp}<br>Example: <strong>1 1/5</strong> is entered as <strong>1</strong>, <strong>1</strong>, and <strong>5</strong>.`
    : `${skill.answerHelp}<br>Examples: <strong>-3</strong>, <strong>0.5</strong>, <strong>3/4</strong>, or <strong>1 1/2</strong>.`;

  els.answerGuide.className = skill.answerType === "mixedFraction" ? "answer-guide" : "answer-guide text-guide";
  els.answerGuide.innerHTML = skill.answerType === "mixedFraction"
    ? `
      <span class="guide-pill">Whole</span>
      <div class="fraction-guide">
        <span class="guide-pill">Numerator</span>
        <span class="guide-slash" aria-hidden="true">/</span>
        <span class="guide-pill">Denominator</span>
      </div>
    `
    : '<span class="guide-pill wide">Number, decimal, or fraction</span>';
}

function normalizeMixedAnswer(answer) {
  const whole = Number(answer.whole || 0);
  const num = Number(answer.num || 0);
  const den = Number(answer.den || 1);

  if (!Number.isFinite(whole) || !Number.isFinite(num) || !Number.isFinite(den) || den <= 0 || whole < 0 || num < 0) {
    return null;
  }

  return createRational((whole * den) + num, den);
}

function isMixedAnswerInSimplestForm(answer) {
  const normalized = normalizeMixedAnswer(answer);
  if (!normalized) {
    return false;
  }

  const numText = String(answer.num ?? "").trim();
  const denText = String(answer.den ?? "").trim();
  const numerator = Number(numText || 0);
  const denominator = Number(denText || 1);

  if (numerator === 0) {
    return normalized.den === 1 && (denText === "" || denominator === 1);
  }

  return denominator > 0 && gcd(numerator, denominator) === 1 && numerator < denominator;
}

function parseDecimalToRational(text) {
  const negative = text.startsWith("-");
  const unsigned = negative ? text.slice(1) : text;
  const [wholePart, fractionalPart = ""] = unsigned.split(".");
  const scale = 10 ** fractionalPart.length;
  const numerator = (Number(wholePart) * scale) + Number(fractionalPart || 0);
  return createRational(negative ? -numerator : numerator, scale || 1);
}

function parseTextAnswer(text) {
  const value = String(text ?? "").trim();
  if (!value) {
    return null;
  }

  const mixedMatch = value.match(/^(-?\d+)\s+(\d+)\/(\d+)$/);
  if (mixedMatch) {
    const whole = Number(mixedMatch[1]);
    const numerator = Number(mixedMatch[2]);
    const denominator = Number(mixedMatch[3]);

    if (denominator <= 0 || numerator < 0) {
      return null;
    }

    const sign = whole < 0 ? -1 : 1;
    return createRational((Math.abs(whole) * denominator * sign) + (numerator * sign), denominator);
  }

  const fractionMatch = value.match(/^(-?\d+)\/(\d+)$/);
  if (fractionMatch) {
    const numerator = Number(fractionMatch[1]);
    const denominator = Number(fractionMatch[2]);
    return denominator > 0 ? createRational(numerator, denominator) : null;
  }

  if (/^-?\d+(?:\.\d+)?$/.test(value)) {
    return value.includes(".")
      ? parseDecimalToRational(value)
      : createRational(Number(value), 1);
  }

  return null;
}

function getAnswerState(index) {
  const question = state.questions[index];
  if (!question) {
    return { attempted: false, equivalent: false, correct: false, needsSimplifying: false };
  }

  const answer = state.answers[index] || makeEmptyAnswer(question.answerType);
  if (question.answerType === "mixedFraction") {
    const attempted = answer.whole !== "" || answer.num !== "" || answer.den !== "";
    const normalized = normalizeMixedAnswer(answer);
    const equivalent = rationalEquals(normalized, question.solution);
    const correct = equivalent && isMixedAnswerInSimplestForm(answer);
    return {
      attempted,
      equivalent,
      correct,
      needsSimplifying: equivalent && !correct
    };
  }

  const attempted = String(answer.value ?? "").trim() !== "";
  const normalized = parseTextAnswer(answer.value);
  const equivalent = rationalEquals(normalized, question.solution);
  return {
    attempted,
    equivalent,
    correct: equivalent,
    needsSimplifying: false
  };
}

function isAnswerCorrect(index) {
  return getAnswerState(index).correct;
}

function generateQuestions() {
  const skill = getCurrentSkill();
  state.questions = [];
  state.answers = [];

  if (!skill) {
    return;
  }

  for (let index = 0; index < QUESTION_COUNT; index += 1) {
    const question = skill.generateQuestion();
    state.questions.push(question);
    state.answers.push(makeEmptyAnswer(question.answerType));
  }
}

function formatRationalForText(rational) {
  if (!rational) {
    return "";
  }

  return rational.den === 1
    ? String(rational.num)
    : `${rational.num}/${rational.den}`;
}

function formatSolvedAnswer(question) {
  if (question.answerType !== "mixedFraction") {
    return { value: formatRationalForText(question.solution) };
  }

  const whole = Math.floor(question.solution.num / question.solution.den);
  const remainder = question.solution.num % question.solution.den;

  if (remainder === 0) {
    return { whole: String(whole), num: "0", den: "1" };
  }

  return {
    whole: whole > 0 ? String(whole) : "",
    num: String(remainder),
    den: String(question.solution.den)
  };
}

function updateQuestionStatuses() {
  const rows = els.questionBody.querySelectorAll("tr");
  rows.forEach((row, index) => {
    const statusCell = row.querySelector(".status-cell");
    const answerState = getAnswerState(index);
    row.classList.remove("correct-row", "incorrect-row", "simplify-row");

    if (answerState.attempted) {
      if (answerState.correct) {
        row.classList.add("correct-row");
      } else if (answerState.needsSimplifying) {
        row.classList.add("simplify-row");
      } else {
        row.classList.add("incorrect-row");
      }
    }

    if (statusCell) {
      statusCell.innerHTML = !answerState.attempted
        ? '<span class="status muted">-</span>'
        : answerState.correct
          ? '<span class="status good">Correct</span>'
          : answerState.needsSimplifying
            ? '<span class="status warn">Simplify</span>'
            : '<span class="status bad">Try again</span>';
    }
  });
}

function handleInput(event) {
  const index = Number(event.target.dataset.index);
  const part = event.target.dataset.part;

  if (!Number.isInteger(index) || !state.answers[index] || !part) {
    return;
  }

  state.answers[index][part] = event.target.value;
  updateQuestionStatuses();
  updatePixelArt();
}

function buildMixedAnswerInputs(index, answer) {
  const wrapper = document.createElement("div");
  wrapper.className = "answer-inputs";

  const wholeInput = document.createElement("input");
  wholeInput.className = "whole-input";
  wholeInput.type = "number";
  wholeInput.dataset.index = String(index);
  wholeInput.dataset.part = "whole";
  wholeInput.setAttribute("aria-label", `Question ${index + 1} whole number`);
  wholeInput.value = answer.whole;

  const fractionWrap = document.createElement("div");
  fractionWrap.className = "frac-stack";

  const numeratorInput = document.createElement("input");
  numeratorInput.className = "mini-input";
  numeratorInput.type = "number";
  numeratorInput.dataset.index = String(index);
  numeratorInput.dataset.part = "num";
  numeratorInput.setAttribute("aria-label", `Question ${index + 1} numerator`);
  numeratorInput.value = answer.num;

  const slash = document.createElement("div");
  slash.className = "slash";
  slash.textContent = "/";

  const denominatorInput = document.createElement("input");
  denominatorInput.className = "mini-input";
  denominatorInput.type = "number";
  denominatorInput.dataset.index = String(index);
  denominatorInput.dataset.part = "den";
  denominatorInput.setAttribute("aria-label", `Question ${index + 1} denominator`);
  denominatorInput.value = answer.den;

  fractionWrap.appendChild(numeratorInput);
  fractionWrap.appendChild(slash);
  fractionWrap.appendChild(denominatorInput);
  wrapper.appendChild(wholeInput);
  wrapper.appendChild(fractionWrap);

  return wrapper;
}

function buildTextAnswerInput(index, answer) {
  const wrapper = document.createElement("div");
  wrapper.className = "text-answer";

  const input = document.createElement("input");
  input.className = "text-input";
  input.type = "text";
  input.dataset.index = String(index);
  input.dataset.part = "value";
  input.setAttribute("aria-label", `Question ${index + 1} answer`);
  input.value = answer.value;

  wrapper.appendChild(input);
  return wrapper;
}

function renderQuestions() {
  els.questionBody.innerHTML = "";

  state.questions.forEach((question, index) => {
    const answer = state.answers[index] || makeEmptyAnswer(question.answerType);
    const row = document.createElement("tr");

    const numberCell = document.createElement("td");
    const numberStrong = document.createElement("strong");
    numberStrong.textContent = String(index + 1);
    numberCell.appendChild(numberStrong);

    const problemCell = document.createElement("td");
    problemCell.className = "problem";
    problemCell.textContent = question.text;

    const answerCell = document.createElement("td");
    answerCell.appendChild(
      question.answerType === "mixedFraction"
        ? buildMixedAnswerInputs(index, answer)
        : buildTextAnswerInput(index, answer)
    );

    const statusCell = document.createElement("td");
    statusCell.className = "status-cell";

    row.appendChild(numberCell);
    row.appendChild(problemCell);
    row.appendChild(answerCell);
    row.appendChild(statusCell);
    els.questionBody.appendChild(row);
  });

  els.questionBody.querySelectorAll("input").forEach((input) => {
    input.addEventListener("input", handleInput);
  });

  updateQuestionStatuses();
}

function getRevealGroups(activeCells) {
  const groups = Array.from({ length: QUESTION_COUNT }, () => []);

  if (activeCells.length <= QUESTION_COUNT) {
    activeCells.forEach((cell, index) => {
      groups[index].push(cell);
    });
    return groups;
  }

  const baseSize = Math.floor(activeCells.length / QUESTION_COUNT);
  const extras = activeCells.length % QUESTION_COUNT;
  let cursor = 0;

  for (let index = 0; index < QUESTION_COUNT; index += 1) {
    const size = baseSize + (index < extras ? 1 : 0);
    groups[index] = activeCells.slice(cursor, cursor + size);
    cursor += size;
  }

  return groups;
}

function updatePixelArt() {
  const pattern = getCurrentPattern();
  const cells = [...els.pixelGrid.children];
  const active = [];

  cells.forEach((cell, index) => {
    const row = Math.floor(index / GRID_SIZE);
    const col = index % GRID_SIZE;
    if ((pattern[row] || "")[col] === "#") {
      active.push(cell);
    }
    cell.classList.remove("filled");
  });

  const revealGroups = getRevealGroups(active);
  const correct = state.questions.map((_, index) => isAnswerCorrect(index));

  revealGroups.forEach((group, index) => {
    if (correct[index]) {
      group.forEach((cell) => {
        cell.classList.add("filled");
      });
    }
  });

  const correctCount = correct.filter(Boolean).length;
  const shown = revealGroups.reduce((total, group, index) => total + (correct[index] ? group.length : 0), 0);
  const pct = active.length ? Math.round((shown / active.length) * 100) : 0;
  els.correctCount.textContent = String(correctCount);
  els.progressCount.textContent = `${pct}%`;
  els.shapeName.textContent = state.shape;
  els.pixelProgressText.textContent = `${correctCount} of ${QUESTION_COUNT} answers correct • each answer reveals part of the picture`;
  els.celebrateBox.classList.toggle("show", correctCount === QUESTION_COUNT);
}

function syncSelections() {
  state.theme = els.themeSelect.value;
  state.grade = els.gradeSelect.value;
  state.skillId = els.skillSelect.value;
}

function newPuzzle() {
  syncSelections();
  updateSkillCard();
  chooseShape();
  generateQuestions();
  buildPixelGrid();
  renderQuestions();
  updatePixelArt();
}

function resetAnswers() {
  state.answers = state.questions.map((question) => makeEmptyAnswer(question.answerType));
  renderQuestions();
  updatePixelArt();
}

function solveAllAnswers() {
  state.answers = state.questions.map((question) => formatSolvedAnswer(question));
  renderQuestions();
  updatePixelArt();
}

function toggleSolveButton() {
  els.solveAllBtn.hidden = !els.solveAllBtn.hidden;
}

function runSelfTests() {
  const tests = [];
  const assert = (name, condition) => tests.push({ name, pass: Boolean(condition) });

  assert("required elements are present", requiredElementsExist());
  assert("curriculum includes grades 7, 8, and 9", ["grade7", "grade8", "grade9"].every((grade) => gradeCatalog.some((entry) => entry.id === grade)));
  assert("each grade exposes at least one skill", gradeCatalog.every((grade) => getSkillsForGrade(grade.id).length > 0));

  const reduced = createRational(8, 12);
  assert("rational helper reduces 8/12 to 2/3", reduced && reduced.num === 2 && reduced.den === 3);

  const parsedMixed = parseTextAnswer("-1 1/2");
  assert("text parser handles negative mixed numbers", parsedMixed && parsedMixed.num === -3 && parsedMixed.den === 2);

  const parsedDecimal = parseTextAnswer("0.25");
  assert("text parser handles decimals", parsedDecimal && parsedDecimal.num === 1 && parsedDecimal.den === 4);

  const normalized = normalizeMixedAnswer({ whole: "1", num: "2", den: "4" });
  assert("mixed number 1 2/4 normalizes to 3/2", normalized && normalized.num === 3 && normalized.den === 2);
  assert("1 2/4 is not in simplest form", !isMixedAnswerInSimplestForm({ whole: "1", num: "2", den: "4" }));
  assert("1 1/2 is in simplest form", isMixedAnswerInSimplestForm({ whole: "1", num: "1", den: "2" }));

  const solvedImproper = formatSolvedAnswer({ answerType: "mixedFraction", solution: createRational(7, 3) });
  assert("solve helper formats 7/3 as 2 1/3", solvedImproper.whole === "2" && solvedImproper.num === "1" && solvedImproper.den === "3");

  const solvedSlope = formatSolvedAnswer({ answerType: "text", solution: createRational(-3, 2) });
  assert("solve helper formats text answers as fractions", solvedSlope.value === "-3/2");

  const themeShapes = getShapesForTheme("Cute");
  assert("Cute theme exposes shapes", Array.isArray(themeShapes) && themeShapes.includes("Heart") && themeShapes.includes("Flower"));

  const allShapesHaveValidRows = Object.values(themes).every((shapeSet) => (
    Object.values(shapeSet).every((rows) => rows.length === GRID_SIZE && rows.every((row) => row.length === GRID_SIZE))
  ));
  assert("all sprite patterns are 12 by 12", allShapesHaveValidRows);

  const heartColors = getShapeColors("Cute", "Heart");
  assert("Heart shape has a pink color mapping", heartColors.pixel === "#ec4899");

  const moonColors = getShapeColors("Space", "Moon");
  assert("Moon shape has a space color mapping", moonColors.pixel === "#94a3b8");

  populateThemeSelect();
  state.theme = "Space";
  populateShapeSelect();
  assert("Space theme populates Rocket option", els.shapeSelect.textContent.includes("Rocket"));

  populateGradeSelect();
  state.grade = "grade9";
  populateSkillSelect();
  assert("Grade 9 exposes slope skill", els.skillSelect.textContent.includes("Slope from Two Points"));

  const fractionSkill = getSkillById("grade7-fractions");
  const slopeSkill = getSkillById("grade9-slope");
  assert("fraction skill exists", Boolean(fractionSkill));
  assert("slope skill exists", Boolean(slopeSkill));
  assert("fraction skill generates mixed-fraction questions", fractionSkill?.generateQuestion().answerType === "mixedFraction");
  assert("slope skill generates text questions", slopeSkill?.generateQuestion().answerType === "text");

  const sampleCells = Array.from({ length: 43 }, (_, id) => ({ id }));
  const revealGroups = getRevealGroups(sampleCells);
  const flattened = revealGroups.flat();
  const groupSizes = revealGroups.map((group) => group.length);
  assert("getRevealGroups returns 20 groups", revealGroups.length === QUESTION_COUNT);
  assert("getRevealGroups assigns every cell exactly once", flattened.length === sampleCells.length && new Set(flattened.map((cell) => cell.id)).size === sampleCells.length);
  assert("getRevealGroups balances group sizes", Math.max(...groupSizes) - Math.min(...groupSizes) <= 1);

  state.theme = "Cute";
  state.shape = "Heart";
  buildPixelGrid();
  assert("pixel grid renders 144 cells", els.pixelGrid.children.length === GRID_SIZE * GRID_SIZE);

  state.grade = "grade7";
  state.skillId = "grade7-fractions";
  updateSkillCard();
  state.questions = [{ text: "1/4 + 1/4", answerType: "mixedFraction", solution: createRational(1, 2) }];
  state.answers = [{ whole: "", num: "1", den: "2" }];
  renderQuestions();
  assert("fraction rows render three inputs", els.questionBody.querySelectorAll("input").length === 3);
  assert("fraction guide shows whole numerator denominator labels", ["Whole", "Numerator", "Denominator"].every((label) => els.answerGuide.textContent.includes(label)));

  updateQuestionStatuses();
  assert("simplified mixed answers count as correct", isAnswerCorrect(0));
  assert("status cell updates to Correct", els.questionBody.querySelector(".status-cell")?.textContent.includes("Correct"));

  state.answers = [{ whole: "", num: "2", den: "4" }];
  renderQuestions();
  updateQuestionStatuses();
  assert("unsimplified equivalent answers prompt simplify", els.questionBody.querySelector(".status-cell")?.textContent.includes("Simplify"));

  state.grade = "grade8";
  state.skillId = "grade8-equations";
  updateSkillCard();
  state.questions = [{ text: "Solve: x + 2 = 5", answerType: "text", solution: createRational(3, 1) }];
  state.answers = [{ value: "3" }];
  renderQuestions();
  assert("text rows render one input", els.questionBody.querySelectorAll("input").length === 1);
  assert("text guide shows numeric input hint", els.answerGuide.textContent.includes("Number, decimal, or fraction"));
  assert("text answers count as correct", isAnswerCorrect(0));

  const pixelWrap = document.querySelector(".pixel-wrap");
  assert("pixel art panel exists", Boolean(pixelWrap));
  assert("pixel art panel uses sticky follow behavior on desktop", Boolean(pixelWrap) && window.getComputedStyle(pixelWrap).position === "sticky");

  const passed = tests.filter((test) => test.pass).length;
  const failed = tests.length - passed;
  els.testPanel.classList.add("show");
  els.testPanel.innerHTML = `<strong>Self-checks:</strong> ${passed}/${tests.length} passed${failed ? `, ${failed} failed` : ""}.`;

  if (failed) {
    console.error("Self-tests failed", tests.filter((test) => !test.pass));
  }
}

function init() {
  cacheElements();
  if (!requiredElementsExist()) {
    console.error("Required DOM elements are missing.");
    return;
  }

  populateThemeSelect();
  populateGradeSelect();
  populateSkillSelect();
  populateShapeSelect();
  updateSkillCard();

  els.appTitle.addEventListener("dblclick", toggleSolveButton);
  els.newPuzzleBtn.addEventListener("click", newPuzzle);
  els.resetBtn.addEventListener("click", resetAnswers);
  els.solveAllBtn.addEventListener("click", solveAllAnswers);
  els.themeSelect.addEventListener("change", () => {
    state.theme = els.themeSelect.value;
    populateShapeSelect();
    newPuzzle();
  });
  els.shapeSelect.addEventListener("change", newPuzzle);
  els.gradeSelect.addEventListener("change", () => {
    state.grade = els.gradeSelect.value;
    state.skillId = getSkillsForGrade(state.grade)[0]?.id || "";
    populateSkillSelect();
    newPuzzle();
  });
  els.skillSelect.addEventListener("change", () => {
    state.skillId = els.skillSelect.value;
    newPuzzle();
  });

  runSelfTests();
  newPuzzle();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
