const GRID_SIZE = 16;
const QUESTION_COUNT = 20;
const DEFAULT_BOARD_TILT_X = 24;
const DEFAULT_BOARD_TILT_Y = -10;
const MIN_BOARD_TILT_X = 4;
const MAX_BOARD_TILT_X = 42;
const MIN_BOARD_TILT_Y = -34;
const MAX_BOARD_TILT_Y = 34;
const BOARD_DRAG_SENSITIVITY = 0.18;

const themes = window.PixelArtShapes || {};
const themeColors = window.PixelArtColors || {};
const curriculum = window.PixelMathCurriculum || { areas: [], grades: [], subjects: [], skills: [] };
const themeNames = Object.keys(themes);
const areaCatalog = curriculum.areas || [];
const gradeCatalog = curriculum.grades || [];
const subjectCatalog = curriculum.subjects || [];
const allSkills = curriculum.skills || [];

const defaultArea = curriculum.defaultArea || areaCatalog[0]?.id || "math";
const defaultGrade = gradeCatalog[0]?.id || "grade7";
const defaultSubject = subjectCatalog.find((subject) => subject.area === defaultArea && subject.grade === defaultGrade)?.id || "";
const defaultSkill = allSkills.find((skill) => (
  skill.area === defaultArea && skill.grade === defaultGrade && skill.subject === defaultSubject
))?.id || allSkills[0]?.id || "";

const state = {
  area: defaultArea,
  theme: themeNames[0] || "Cute",
  shape: "Heart",
  grade: defaultGrade,
  subjectId: defaultSubject,
  skillId: defaultSkill,
  boardTiltX: DEFAULT_BOARD_TILT_X,
  boardTiltY: DEFAULT_BOARD_TILT_Y,
  questions: [],
  answers: []
};

const els = {};
let boardRenderer = null;
let boardRendererUnavailable = false;
const boardDrag = {
  active: false,
  pointerId: null,
  startX: 0,
  startY: 0,
  startTiltX: DEFAULT_BOARD_TILT_X,
  startTiltY: DEFAULT_BOARD_TILT_Y
};

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

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function isFilledCell(cell) {
  return cell !== "." && cell !== "" && cell != null;
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

function makeBlankPattern(size = GRID_SIZE) {
  return Array.from({ length: size }, () => ".".repeat(size));
}

function sanitizePatternRows(pattern) {
  if (!Array.isArray(pattern) || pattern.length === 0) {
    return makeBlankPattern(1);
  }

  const width = pattern.reduce((max, row) => Math.max(max, String(row).length), 0) || 1;
  return pattern.map((row) => (
    [...String(row).padEnd(width, ".")].map((cell) => (cell === "." || cell === " " ? "." : cell)).join("")
  ));
}

function getShapeEntry(theme, shape) {
  return themes[theme]?.[shape] ?? themes.Cute?.Heart ?? [];
}

function getShapeDefinition(theme, shape) {
  const entry = getShapeEntry(theme, shape);
  if (Array.isArray(entry)) {
    return {
      pattern: entry,
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      lift: null,
      toneMap: {}
    };
  }

  return {
    pattern: Array.isArray(entry?.pattern) ? entry.pattern : themes.Cute?.Heart ?? [],
    scale: Number.isFinite(entry?.scale) ? entry.scale : 1,
    offsetX: Number.isFinite(entry?.offsetX) ? entry.offsetX : 0,
    offsetY: Number.isFinite(entry?.offsetY) ? entry.offsetY : 0,
    lift: Number.isFinite(entry?.lift) ? entry.lift : null,
    toneMap: typeof entry?.toneMap === "object" && entry.toneMap ? entry.toneMap : {}
  };
}

function trimPattern(pattern) {
  const rows = sanitizePatternRows(pattern);
  let minRow = rows.length;
  let maxRow = -1;
  let minCol = rows[0]?.length ?? 0;
  let maxCol = -1;

  rows.forEach((row, rowIndex) => {
    [...row].forEach((cell, colIndex) => {
      if (!isFilledCell(cell)) {
        return;
      }

      minRow = Math.min(minRow, rowIndex);
      maxRow = Math.max(maxRow, rowIndex);
      minCol = Math.min(minCol, colIndex);
      maxCol = Math.max(maxCol, colIndex);
    });
  });

  if (maxRow === -1 || maxCol === -1) {
    return { rows: ["."] };
  }

  return {
    rows: rows.slice(minRow, maxRow + 1).map((row) => row.slice(minCol, maxCol + 1))
  };
}

function scalePattern(pattern, targetWidth, targetHeight) {
  const rows = sanitizePatternRows(pattern);
  const sourceHeight = rows.length;
  const sourceWidth = rows[0]?.length ?? 1;

  if (sourceWidth === targetWidth && sourceHeight === targetHeight) {
    return rows;
  }

  return Array.from({ length: targetHeight }, (_, targetRow) => {
    const sourceRow = Math.min(sourceHeight - 1, Math.floor((targetRow / targetHeight) * sourceHeight));
    let nextRow = "";

    for (let targetCol = 0; targetCol < targetWidth; targetCol += 1) {
      const sourceCol = Math.min(sourceWidth - 1, Math.floor((targetCol / targetWidth) * sourceWidth));
      nextRow += isFilledCell(rows[sourceRow][sourceCol]) ? rows[sourceRow][sourceCol] : ".";
    }

    return nextRow;
  });
}

function normalizePattern(pattern, options = {}) {
  const gridSize = options.gridSize ?? GRID_SIZE;
  const definitionScale = Number.isFinite(options.scale) ? options.scale : 1;
  const offsetX = Math.round(options.offsetX || 0);
  const offsetY = Math.round(options.offsetY || 0);
  const trimmed = trimPattern(pattern).rows;
  const sourceHeight = trimmed.length;
  const sourceWidth = trimmed[0]?.length ?? 1;
  const maxFitScale = Math.min(gridSize / sourceWidth, gridSize / sourceHeight);
  const baselineScale = Math.max(1, gridSize / 12);
  const defaultScale = Math.min(maxFitScale, baselineScale);
  const finalScale = Math.max(0.1, Math.min(maxFitScale, defaultScale * definitionScale));
  const targetWidth = Math.max(1, Math.min(gridSize, Math.round(sourceWidth * finalScale)));
  const targetHeight = Math.max(1, Math.min(gridSize, Math.round(sourceHeight * finalScale)));
  const scaled = scalePattern(trimmed, targetWidth, targetHeight);
  const startCol = Math.max(0, Math.min(gridSize - targetWidth, Math.round(((gridSize - targetWidth) / 2) + offsetX)));
  const startRow = Math.max(0, Math.min(gridSize - targetHeight, Math.round(((gridSize - targetHeight) / 2) + offsetY)));
  const grid = Array.from({ length: gridSize }, () => Array(gridSize).fill("."));

  scaled.forEach((row, rowIndex) => {
    [...row].forEach((cell, colIndex) => {
      if (isFilledCell(cell)) {
        grid[startRow + rowIndex][startCol + colIndex] = cell;
      }
    });
  });

  return grid.map((row) => row.join(""));
}

function getRenderedShape(theme, shape) {
  const definition = getShapeDefinition(theme, shape);
  return {
    ...definition,
    pattern: normalizePattern(definition.pattern, {
      gridSize: GRID_SIZE,
      scale: definition.scale,
      offsetX: definition.offsetX,
      offsetY: definition.offsetY
    })
  };
}

function getPattern(theme, shape) {
  return getRenderedShape(theme, shape).pattern;
}

function getShapeColors(theme, shape) {
  return {
    pixel: "#111827",
    glow: "rgba(17, 24, 39, 0.18)",
    outline: "#0b1120",
    outlineGlow: "rgba(15, 23, 42, 0.18)",
    highlight: "#f8fafc",
    highlightGlow: "rgba(248, 250, 252, 0.14)",
    shadow: "color-mix(in srgb, var(--pixel) 72%, black)",
    shadowGlow: "rgba(15, 23, 42, 0.22)",
    ...(themeColors[theme]?.[shape] ?? {})
  };
}

function getToneForCell(symbol, toneMap) {
  if (!isFilledCell(symbol)) {
    return "";
  }

  return toneMap?.[symbol] ?? "fill";
}

function applyCellTone(cell, tone) {
  const colorValue = tone === "outline"
    ? "var(--pixel-outline)"
    : tone === "highlight"
      ? "var(--pixel-highlight)"
      : tone === "shadow"
        ? "var(--pixel-shadow)"
        : "var(--pixel)";
  const glowValue = tone === "outline"
    ? "var(--pixel-outline-glow)"
    : tone === "highlight"
      ? "var(--pixel-highlight-glow)"
      : tone === "shadow"
        ? "var(--pixel-shadow-glow)"
        : "var(--pixel-glow)";
  cell.style.setProperty("--tone-color", colorValue);
  cell.style.setProperty("--tone-glow", glowValue);
}

function getGradeLabel(grade) {
  return gradeCatalog.find((entry) => entry.id === grade)?.label ?? grade;
}

function getSubjectsForGrade(grade) {
  return subjectCatalog.filter((subject) => subject.area === state.area && subject.grade === grade);
}

function getSubjectById(subjectId) {
  return subjectCatalog.find((subject) => subject.id === subjectId)
    ?? getSubjectsForGrade(state.grade)[0]
    ?? null;
}

function getCurrentSubject() {
  return getSubjectById(state.subjectId);
}

function getSkillsForSelection(grade, subjectId) {
  return allSkills.filter((skill) => (
    skill.area === state.area
    && skill.grade === grade
    && skill.subject === subjectId
  ));
}

function getSkillById(skillId) {
  return allSkills.find((skill) => skill.id === skillId)
    ?? getSkillsForSelection(state.grade, state.subjectId)[0]
    ?? allSkills[0]
    ?? null;
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
  els.pixelWrap = document.querySelector(".pixel-wrap");
  els.themeSelect = document.getElementById("themeSelect");
  els.shapeSelect = document.getElementById("shapeSelect");
  els.gradeSelect = document.getElementById("gradeSelect");
  els.subjectSelect = document.getElementById("subjectSelect");
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
    "pixelWrap",
    "themeSelect",
    "shapeSelect",
    "gradeSelect",
    "subjectSelect",
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

function populateSubjectSelect() {
  const subjects = getSubjectsForGrade(state.grade);
  els.subjectSelect.innerHTML = "";

  subjects.forEach((subject) => {
    const option = document.createElement("option");
    option.value = subject.id;
    option.textContent = subject.label;
    els.subjectSelect.appendChild(option);
  });

  if (!subjects.some((subject) => subject.id === state.subjectId)) {
    state.subjectId = subjects[0]?.id || "";
  }

  els.subjectSelect.value = state.subjectId;
}

function populateSkillSelect() {
  const skills = getSkillsForSelection(state.grade, state.subjectId);
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

function initializeBoardRenderer() {
  if (boardRenderer || boardRendererUnavailable || !els.pixelGrid || typeof window.PixelBoardCanvas !== "function") {
    return;
  }

  try {
    boardRenderer = new window.PixelBoardCanvas(els.pixelGrid, { gridSize: GRID_SIZE });
    els.pixelGrid.classList.add("grid-canvas");
    els.pixelGrid.classList.remove("grid-dom");
  } catch (error) {
    boardRendererUnavailable = true;
    boardRenderer = null;
    els.pixelGrid.innerHTML = "";
    els.pixelGrid.classList.remove("grid-canvas");
    console.warn("Canvas board renderer could not start. Falling back to the DOM grid.", error);
  }
}

function resetBoardView() {
  if (boardRenderer) {
    boardRenderer.resetView();
    return;
  }

  resetBoardTilt();
}

function buildPixelGrid() {
  const renderedShape = getRenderedShape(state.theme, state.shape);
  const colors = getShapeColors(state.theme, state.shape);
  initializeBoardRenderer();

  if (boardRenderer) {
    els.pixelGrid.classList.add("grid-canvas");
    els.pixelGrid.classList.remove("grid-dom");
    boardRenderer.setSprite(renderedShape, colors);
    return;
  }

  els.pixelGrid.classList.remove("grid-canvas");
  els.pixelGrid.classList.add("grid-dom");
  els.pixelGrid.innerHTML = "";
  const pattern = renderedShape.pattern;
  els.pixelGrid.style.setProperty("--pixel", colors.pixel);
  els.pixelGrid.style.setProperty("--pixel-glow", colors.glow);
  els.pixelGrid.style.setProperty("--pixel-outline", colors.outline);
  els.pixelGrid.style.setProperty("--pixel-outline-glow", colors.outlineGlow);
  els.pixelGrid.style.setProperty("--pixel-highlight", colors.highlight);
  els.pixelGrid.style.setProperty("--pixel-highlight-glow", colors.highlightGlow);
  els.pixelGrid.style.setProperty("--pixel-shadow", colors.shadow);
  els.pixelGrid.style.setProperty("--pixel-shadow-glow", colors.shadowGlow);
  els.pixelGrid.style.setProperty("--grid-size", String(GRID_SIZE));
  els.pixelGrid.style.setProperty("--pixel-lift", `${renderedShape.lift ?? 12}px`);
  els.pixelGrid.style.setProperty("--pixel-side-depth", `${Math.max(6, Math.round((renderedShape.lift ?? 12) * 0.55))}px`);
  applyBoardTilt();

  for (let rowIndex = 0; rowIndex < GRID_SIZE; rowIndex += 1) {
    const row = pattern[rowIndex] || ".".repeat(GRID_SIZE);
    for (let colIndex = 0; colIndex < GRID_SIZE; colIndex += 1) {
      const cell = document.createElement("div");
      cell.className = "cell";
      if (isFilledCell(row[colIndex])) {
        cell.dataset.active = "true";
        cell.dataset.tone = getToneForCell(row[colIndex], renderedShape.toneMap);
        applyCellTone(cell, cell.dataset.tone);
      }
      els.pixelGrid.appendChild(cell);
    }
  }
}

function applyBoardTilt() {
  if (!els.pixelGrid) {
    return;
  }

  els.pixelGrid.style.setProperty("--board-tilt-x", `${state.boardTiltX}deg`);
  els.pixelGrid.style.setProperty("--board-tilt-y", `${state.boardTiltY}deg`);
}

function resetBoardTilt() {
  state.boardTiltX = DEFAULT_BOARD_TILT_X;
  state.boardTiltY = DEFAULT_BOARD_TILT_Y;
  applyBoardTilt();
}

function stopBoardDrag(event) {
  if (!boardDrag.active) {
    return;
  }

  if (event?.pointerId != null && event.pointerId !== boardDrag.pointerId) {
    return;
  }

  if (typeof els.pixelGrid?.releasePointerCapture === "function" && boardDrag.pointerId != null) {
    try {
      els.pixelGrid.releasePointerCapture(boardDrag.pointerId);
    } catch (error) {
      // Ignore release errors when capture has already ended.
    }
  }

  boardDrag.active = false;
  boardDrag.pointerId = null;
  els.pixelGrid?.classList.remove("dragging");
}

function handleBoardPointerDown(event) {
  if (event.button != null && event.button !== 0) {
    return;
  }

  boardDrag.active = true;
  boardDrag.pointerId = event.pointerId ?? null;
  boardDrag.startX = event.clientX;
  boardDrag.startY = event.clientY;
  boardDrag.startTiltX = state.boardTiltX;
  boardDrag.startTiltY = state.boardTiltY;
  els.pixelGrid.classList.add("dragging");

  if (typeof els.pixelGrid.setPointerCapture === "function" && event.pointerId != null) {
    els.pixelGrid.setPointerCapture(event.pointerId);
  }

  event.preventDefault();
}

function handleBoardPointerMove(event) {
  if (!boardDrag.active) {
    return;
  }

  if (event.pointerId != null && boardDrag.pointerId != null && event.pointerId !== boardDrag.pointerId) {
    return;
  }

  const deltaX = event.clientX - boardDrag.startX;
  const deltaY = event.clientY - boardDrag.startY;
  state.boardTiltY = clamp(
    boardDrag.startTiltY + (deltaX * BOARD_DRAG_SENSITIVITY),
    MIN_BOARD_TILT_Y,
    MAX_BOARD_TILT_Y
  );
  state.boardTiltX = clamp(
    boardDrag.startTiltX - (deltaY * BOARD_DRAG_SENSITIVITY),
    MIN_BOARD_TILT_X,
    MAX_BOARD_TILT_X
  );
  applyBoardTilt();
}

function attachFallbackBoardControls() {
  if (boardRenderer || !els.pixelGrid) {
    return;
  }

  els.pixelGrid.addEventListener("pointerdown", handleBoardPointerDown);
  els.pixelGrid.addEventListener("lostpointercapture", stopBoardDrag);
  window.addEventListener("pointermove", handleBoardPointerMove);
  window.addEventListener("pointerup", stopBoardDrag);
  window.addEventListener("pointercancel", stopBoardDrag);
}

function updateSkillCard() {
  const subject = getCurrentSubject();
  const skill = getCurrentSkill();

  if (!subject || !skill) {
    els.skillGradeLabel.textContent = "Math";
    els.skillTitle.textContent = "Choose a skill";
    els.skillDescription.textContent = "This project is ready for grade, subject, and skill-based practice.";
    els.tipBox.textContent = "";
    els.answerGuide.innerHTML = "";
    return;
  }

  els.skillGradeLabel.textContent = `${getGradeLabel(skill.grade)} • ${subject.label}`;
  els.skillTitle.textContent = skill.label;
  els.skillDescription.textContent = `${subject.description} ${skill.description}`;
  els.appSubtitle.textContent = "Choose a grade, subject, and skill, then reveal a hidden pixel picture as correct answers are entered.";
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
  const activeIndexes = [];
  for (let index = 0; index < GRID_SIZE * GRID_SIZE; index += 1) {
    const row = Math.floor(index / GRID_SIZE);
    const col = index % GRID_SIZE;
    if (isFilledCell((pattern[row] || "")[col])) {
      activeIndexes.push(index);
    }
  }

  const revealGroups = getRevealGroups(activeIndexes);
  const correct = state.questions.map((_, index) => isAnswerCorrect(index));

  if (boardRenderer) {
    const revealedIndexes = new Set();
    revealGroups.forEach((group, index) => {
      if (correct[index]) {
        group.forEach((cellIndex) => {
          revealedIndexes.add(cellIndex);
        });
      }
    });
    boardRenderer.setRevealedCellIndexes(revealedIndexes);
  } else {
    const cells = [...els.pixelGrid.children];
    cells.forEach((cell) => {
      cell.classList.remove("filled");
    });
    revealGroups.forEach((group, index) => {
      if (correct[index]) {
        group.forEach((cellIndex) => {
          cells[cellIndex]?.classList.add("filled");
        });
      }
    });
  }

  const correctCount = correct.filter(Boolean).length;
  const shown = revealGroups.reduce((total, group, index) => total + (correct[index] ? group.length : 0), 0);
  const pct = activeIndexes.length ? Math.round((shown / activeIndexes.length) * 100) : 0;
  els.correctCount.textContent = String(correctCount);
  els.progressCount.textContent = `${pct}%`;
  els.shapeName.textContent = state.shape;
  els.pixelProgressText.textContent = `${correctCount} of ${QUESTION_COUNT} answers correct • each answer reveals part of the picture`;
  els.celebrateBox.classList.toggle("show", correctCount === QUESTION_COUNT);
}

function restoreStartupSelections(snapshot) {
  state.area = snapshot.area;
  state.theme = snapshot.theme;
  state.shape = snapshot.shape;
  state.grade = snapshot.grade;
  state.subjectId = snapshot.subjectId;
  state.skillId = snapshot.skillId;
  state.boardTiltX = snapshot.boardTiltX;
  state.boardTiltY = snapshot.boardTiltY;
  populateThemeSelect();
  populateGradeSelect();
  populateSubjectSelect();
  populateSkillSelect();
  populateShapeSelect();
  updateSkillCard();
  if (!boardRenderer) {
    applyBoardTilt();
  }
}

function syncSelections() {
  state.theme = els.themeSelect.value;
  state.grade = els.gradeSelect.value;
  state.subjectId = els.subjectSelect.value;
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
  const snapshot = {
    area: state.area,
    theme: state.theme,
    shape: state.shape,
    grade: state.grade,
    subjectId: state.subjectId,
    skillId: state.skillId,
    boardTiltX: state.boardTiltX,
    boardTiltY: state.boardTiltY
  };
  const tests = [];
  const assert = (name, condition) => tests.push({ name, pass: Boolean(condition) });

  assert("required elements are present", requiredElementsExist());
  assert("curriculum exposes math as a learning area", areaCatalog.some((area) => area.id === "math"));
  assert("curriculum includes grades 7, 8, and 9", ["grade7", "grade8", "grade9"].every((grade) => gradeCatalog.some((entry) => entry.id === grade)));
  assert("each grade exposes at least one subject", gradeCatalog.every((grade) => getSubjectsForGrade(grade.id).length > 0));

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

  const allShapesNormalizeToGrid = Object.entries(themes).every(([theme, shapeSet]) => (
    Object.keys(shapeSet).every((shapeName) => {
      const rows = getPattern(theme, shapeName);
      return rows.length === GRID_SIZE && rows.every((row) => row.length === GRID_SIZE);
    })
  ));
  assert("all sprites normalize to the render grid size", allShapesNormalizeToGrid);

  const centeredSample = normalizePattern(["##", "##"], { gridSize: 6 });
  assert("normalization centers smaller sprites", centeredSample[2].slice(2, 4) === "##" && centeredSample[3].slice(2, 4) === "##");

  const scaledSample = normalizePattern(["####", "####", "####", "####"], { gridSize: 16 });
  assert("larger boards scale sprites up from the original 12-cell baseline", scaledSample.some((row) => row.includes("#####")));
  resetBoardView();
  assert("board view reset works when the board renderer is available", !boardRenderer || typeof boardRenderer.resetView === "function");
  assert("custom tone symbols are supported", getToneForCell("B", { B: "outline", R: "fill" }) === "outline" && getToneForCell("R", { B: "outline", R: "fill" }) === "fill");

  const heartColors = getShapeColors("Cute", "Heart");
  assert("Heart shape exposes tuned heart colors", heartColors.pixel === "#ff1f1f" && heartColors.outline === "#111111");

  const moonColors = getShapeColors("Space", "Moon");
  assert("Moon shape has a space color mapping", moonColors.pixel === "#94a3b8");

  populateThemeSelect();
  state.theme = "Space";
  populateShapeSelect();
  assert("Space theme populates Rocket option", els.shapeSelect.textContent.includes("Rocket"));

  populateGradeSelect();
  state.grade = "grade9";
  populateSubjectSelect();
  assert("Grade 9 exposes functions and graphing subject", els.subjectSelect.textContent.includes("Functions & Graphing"));

  state.subjectId = "grade9-functions-graphing";
  populateSkillSelect();
  assert("functions subject exposes slope skill", els.skillSelect.textContent.includes("Slope from Two Points"));
  assert("functions subject filters out two-step equations", !els.skillSelect.textContent.includes("Two-Step Equations"));

  const fractionSkill = getSkillById("grade7-fractions");
  const slopeSkill = getSkillById("grade9-slope");
  assert("fraction skill exists", Boolean(fractionSkill));
  assert("slope skill exists", Boolean(slopeSkill));
  assert("fraction skill maps to a subject", fractionSkill?.subject === "grade7-number-sense");
  assert("slope skill generates text questions", slopeSkill?.generateQuestion().answerType === "text");
  assert("object-based shape metadata is supported", getShapeDefinition("Game", "Sword").scale > 1 && getShapeDefinition("Space", "UFO").lift > 12);
  assert("heart sprite supports tone metadata", getShapeDefinition("Cute", "Heart").toneMap?.B === "outline");

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
  assert("pixel board renderer initializes", Boolean(boardRenderer) || els.pixelGrid.children.length === GRID_SIZE * GRID_SIZE);
  assert("pixel board tracks the full board size", !boardRenderer || boardRenderer.blankCount === GRID_SIZE * GRID_SIZE);

  state.grade = "grade7";
  state.subjectId = "grade7-number-sense";
  state.skillId = "grade7-fractions";
  updateSkillCard();
  state.questions = [{ text: "1/4 + 1/4", answerType: "mixedFraction", solution: createRational(1, 2) }];
  state.answers = [{ whole: "", num: "1", den: "2" }];
  renderQuestions();
  assert("fraction rows render three inputs", els.questionBody.querySelectorAll("input").length === 3);
  assert("skill kicker includes subject label", els.skillGradeLabel.textContent.includes("Number Sense"));
  assert("fraction guide shows whole numerator denominator labels", ["Whole", "Numerator", "Denominator"].every((label) => els.answerGuide.textContent.includes(label)));

  updateQuestionStatuses();
  assert("simplified mixed answers count as correct", isAnswerCorrect(0));
  assert("status cell updates to Correct", els.questionBody.querySelector(".status-cell")?.textContent.includes("Correct"));

  state.answers = [{ whole: "", num: "2", den: "4" }];
  renderQuestions();
  updateQuestionStatuses();
  assert("unsimplified equivalent answers prompt simplify", els.questionBody.querySelector(".status-cell")?.textContent.includes("Simplify"));

  state.grade = "grade8";
  state.subjectId = "grade8-algebra-foundations";
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

  restoreStartupSelections(snapshot);
}

function init() {
  cacheElements();
  if (!requiredElementsExist()) {
    console.error("Required DOM elements are missing.");
    return;
  }

  populateThemeSelect();
  populateGradeSelect();
  populateSubjectSelect();
  populateSkillSelect();
  populateShapeSelect();
  initializeBoardRenderer();
  if (!boardRenderer) {
    applyBoardTilt();
    attachFallbackBoardControls();
  }
  updateSkillCard();

  els.appTitle.addEventListener("dblclick", toggleSolveButton);
  els.pixelGrid.addEventListener("dblclick", resetBoardView);
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
    state.subjectId = getSubjectsForGrade(state.grade)[0]?.id || "";
    populateSubjectSelect();
    state.skillId = getSkillsForSelection(state.grade, state.subjectId)[0]?.id || "";
    populateSkillSelect();
    newPuzzle();
  });
  els.subjectSelect.addEventListener("change", () => {
    state.subjectId = els.subjectSelect.value;
    state.skillId = getSkillsForSelection(state.grade, state.subjectId)[0]?.id || "";
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
