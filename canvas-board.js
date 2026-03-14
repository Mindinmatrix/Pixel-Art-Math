(function () {
  const BOARD_SURFACE = "#d7e3ef";
  const BOARD_SURFACE_EDGE = "#b7c7d7";
  const BLANK_TILE = "#f7fbff";
  const BLANK_TILE_EDGE = "#d4dfeb";
  const BLANK_TILE_STROKE = "rgba(116, 142, 171, 0.18)";
  const BOARD_STROKE = "rgba(116, 142, 171, 0.22)";

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function getNow() {
    return typeof performance !== "undefined" && typeof performance.now === "function"
      ? performance.now()
      : Date.now();
  }

  function roundedRect(context, x, y, width, height, radius) {
    const safeRadius = Math.max(0, Math.min(radius, width / 2, height / 2));
    context.beginPath();
    context.moveTo(x + safeRadius, y);
    context.lineTo(x + width - safeRadius, y);
    context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
    context.lineTo(x + width, y + height - safeRadius);
    context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
    context.lineTo(x + safeRadius, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
    context.lineTo(x, y + safeRadius);
    context.quadraticCurveTo(x, y, x + safeRadius, y);
    context.closePath();
  }

  function parseHexColor(value, fallback) {
    const candidate = typeof value === "string" ? value.trim() : "";
    const normalized = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(candidate) ? candidate : fallback;
    const hex = normalized.slice(1);

    if (hex.length === 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16)
      };
    }

    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16)
    };
  }

  function mixColors(left, right, amount) {
    const from = parseHexColor(left, "#000000");
    const to = parseHexColor(right, "#ffffff");
    const mix = clamp(amount, 0, 1);
    const red = Math.round(from.r + ((to.r - from.r) * mix));
    const green = Math.round(from.g + ((to.g - from.g) * mix));
    const blue = Math.round(from.b + ((to.b - from.b) * mix));
    return `rgb(${red}, ${green}, ${blue})`;
  }

  function alphaColor(value, alpha) {
    const { r, g, b } = parseHexColor(value, "#000000");
    return `rgba(${r}, ${g}, ${b}, ${clamp(alpha, 0, 1)})`;
  }

  function easeOutBack(value) {
    const t = clamp(value, 0, 1) - 1;
    const s = 1.70158;
    return 1 + ((s + 1) * (t ** 3)) + (s * (t ** 2));
  }

  class PixelBoardCanvas {
    constructor(container, options = {}) {
      this.container = container;
      this.gridSize = options.gridSize || 16;
      this.blankCount = this.gridSize * this.gridSize;
      this.canvas = document.createElement("canvas");
      this.canvas.className = "board-canvas";
      this.context = this.canvas.getContext("2d");
      this.pattern = Array.from({ length: this.gridSize }, () => ".".repeat(this.gridSize));
      this.entryMap = new Map();
      this.revealedIndexes = new Set();
      this.revealAnimations = new Map();
      this.frameHandle = 0;
      this.resizeObserver = null;
      this.width = 320;
      this.height = 320;
      this.colors = {
        pixel: "#ef4444",
        outline: "#111111",
        highlight: "#ffffff",
        shadow: "#b91c1c"
      };

      this.container.innerHTML = "";
      this.container.appendChild(this.canvas);
      this.attachEvents();
      this.resize();
    }

    attachEvents() {
      if (typeof ResizeObserver === "function") {
        this.resizeObserver = new ResizeObserver(() => this.resize());
        this.resizeObserver.observe(this.container);
      } else {
        window.addEventListener("resize", this.handleResize);
      }
    }

    handleResize = () => {
      this.resize();
    };

    resize() {
      if (!this.context) {
        return;
      }

      this.width = Math.max(1, Math.floor(this.canvas.clientWidth || this.container.clientWidth || 0));
      this.height = Math.max(1, Math.floor(this.canvas.clientHeight || this.container.clientHeight || this.width));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.canvas.width = Math.round(this.width * dpr);
      this.canvas.height = Math.round(this.height * dpr);
      this.context.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.requestRender(true);
    }

    requestRender(immediate = false) {
      if (immediate) {
        if (this.frameHandle) {
          window.cancelAnimationFrame(this.frameHandle);
          this.frameHandle = 0;
        }
        this.render(getNow());
        return;
      }

      if (this.frameHandle) {
        return;
      }

      this.frameHandle = window.requestAnimationFrame((timestamp) => {
        this.frameHandle = 0;
        this.render(timestamp);
      });
    }

    setSprite(renderedShape, colors) {
      const pattern = renderedShape?.pattern || [];
      const toneMap = renderedShape?.toneMap || {};

      this.pattern = pattern;
      this.colors = {
        pixel: colors?.pixel || "#ef4444",
        outline: colors?.outline || "#111111",
        highlight: colors?.highlight || "#ffffff",
        shadow: colors?.shadow || colors?.pixel || "#b91c1c"
      };
      this.entryMap.clear();
      this.revealedIndexes = new Set();
      this.revealAnimations.clear();

      for (let row = 0; row < this.gridSize; row += 1) {
        const rowText = pattern[row] || ".".repeat(this.gridSize);
        for (let col = 0; col < this.gridSize; col += 1) {
          const symbol = rowText[col];
          if (!symbol || symbol === ".") {
            continue;
          }

          const tone = toneMap[symbol] || "fill";
          const cellIndex = (row * this.gridSize) + col;
          this.entryMap.set(cellIndex, {
            row,
            col,
            tone,
            color: this.getToneColor(tone)
          });
        }
      }

      this.requestRender(true);
    }

    setRevealedCellIndexes(revealedIndexes) {
      const nextIndexes = revealedIndexes instanceof Set ? new Set(revealedIndexes) : new Set(revealedIndexes || []);
      const startedAt = getNow();

      nextIndexes.forEach((cellIndex) => {
        if (!this.revealedIndexes.has(cellIndex)) {
          this.revealAnimations.set(cellIndex, startedAt);
        }
      });

      [...this.revealAnimations.keys()].forEach((cellIndex) => {
        if (!nextIndexes.has(cellIndex)) {
          this.revealAnimations.delete(cellIndex);
        }
      });

      this.revealedIndexes = nextIndexes;
      this.requestRender();
    }

    resetView() {
      this.requestRender(true);
    }

    getToneColor(tone) {
      if (tone === "outline") {
        return this.colors.outline;
      }
      if (tone === "highlight") {
        return this.colors.highlight;
      }
      if (tone === "shadow") {
        return this.colors.shadow;
      }
      return this.colors.pixel;
    }

    getMetrics() {
      const shortestSide = Math.max(1, Math.min(this.width, this.height));
      const inset = Math.max(14, Math.round(shortestSide * 0.065));
      const boardSize = Math.max(40, shortestSide - (inset * 2));
      const boardX = (this.width - boardSize) / 2;
      const boardY = (this.height - boardSize) / 2;
      const gap = Math.max(2, Math.round(boardSize * 0.006));
      const cellSize = (boardSize - (gap * (this.gridSize - 1))) / this.gridSize;
      return {
        boardX,
        boardY,
        boardSize,
        gap,
        cellSize,
        radius: Math.max(4, cellSize * 0.24)
      };
    }

    drawBoardSurface(metrics) {
      const context = this.context;
      const surfaceX = metrics.boardX - 8;
      const surfaceY = metrics.boardY - 8;
      const surfaceSize = metrics.boardSize + 16;

      context.save();
      context.shadowColor = "rgba(15, 23, 42, 0.14)";
      context.shadowBlur = 20;
      context.shadowOffsetY = 10;
      roundedRect(context, surfaceX, surfaceY, surfaceSize, surfaceSize, 26);
      context.fillStyle = "rgba(71, 85, 105, 0.12)";
      context.fill();
      context.restore();

      const gradient = context.createLinearGradient(surfaceX, surfaceY, surfaceX, surfaceY + surfaceSize);
      gradient.addColorStop(0, BOARD_SURFACE);
      gradient.addColorStop(1, BOARD_SURFACE_EDGE);

      context.save();
      roundedRect(context, surfaceX, surfaceY, surfaceSize, surfaceSize, 26);
      context.fillStyle = gradient;
      context.fill();
      context.strokeStyle = BOARD_STROKE;
      context.lineWidth = 1;
      context.stroke();
      context.restore();
    }

    drawBlankCell(x, y, size, radius) {
      const context = this.context;

      context.save();
      roundedRect(context, x, y + (size * 0.08), size, size, radius);
      context.fillStyle = BLANK_TILE_EDGE;
      context.fill();
      context.restore();

      const gradient = context.createLinearGradient(x, y, x, y + size);
      gradient.addColorStop(0, "#ffffff");
      gradient.addColorStop(1, BLANK_TILE);

      context.save();
      roundedRect(context, x, y, size, size, radius);
      context.fillStyle = gradient;
      context.fill();
      context.strokeStyle = BLANK_TILE_STROKE;
      context.lineWidth = 1;
      context.stroke();
      context.restore();

      context.save();
      context.globalAlpha = 0.8;
      roundedRect(context, x + 2, y + 2, Math.max(0, size - 4), Math.max(0, size * 0.38), Math.max(3, radius * 0.72));
      context.fillStyle = "rgba(255, 255, 255, 0.9)";
      context.fill();
      context.restore();
    }

    drawGhostCell(x, y, size, radius, entry) {
      const context = this.context;
      const ghostInset = size * 0.12;
      const alpha = entry.tone === "outline"
        ? 0.12
        : entry.tone === "highlight"
          ? 0.18
          : 0.1;

      context.save();
      context.globalAlpha = alpha;
      roundedRect(context, x + ghostInset, y + ghostInset, size - (ghostInset * 2), size - (ghostInset * 2), Math.max(3, radius * 0.72));
      context.fillStyle = entry.color;
      context.fill();
      context.restore();
    }

    drawFilledCell(x, y, size, radius, entry, progress) {
      const context = this.context;
      const eased = easeOutBack(progress);
      const scale = 0.84 + (0.16 * eased);
      const scaledSize = size * scale;
      const inset = (size - scaledSize) / 2;
      const fillX = x + inset;
      const fillY = y + inset;
      const fillRadius = Math.max(3, radius * scale);
      const shadowColor = mixColors(entry.color, "#000000", 0.32);
      const topColor = mixColors(entry.color, "#ffffff", entry.tone === "highlight" ? 0.1 : 0.22);
      const faceGradient = context.createLinearGradient(fillX, fillY, fillX, fillY + scaledSize);
      faceGradient.addColorStop(0, topColor);
      faceGradient.addColorStop(0.56, entry.color);
      faceGradient.addColorStop(1, shadowColor);

      context.save();
      context.shadowColor = alphaColor(entry.color, 0.28);
      context.shadowBlur = Math.max(10, size * 0.55);
      context.shadowOffsetY = Math.max(3, size * 0.14);
      roundedRect(context, fillX, fillY + (size * 0.08), scaledSize, scaledSize, fillRadius);
      context.fillStyle = alphaColor(shadowColor, 0.95);
      context.fill();
      context.restore();

      context.save();
      roundedRect(context, fillX, fillY, scaledSize, scaledSize, fillRadius);
      context.fillStyle = faceGradient;
      context.fill();
      context.strokeStyle = shadowColor;
      context.lineWidth = 1;
      context.stroke();
      context.restore();

      context.save();
      context.globalAlpha = 0.42;
      roundedRect(
        context,
        fillX + (scaledSize * 0.1),
        fillY + (scaledSize * 0.1),
        scaledSize * 0.48,
        scaledSize * 0.18,
        Math.max(2, fillRadius * 0.4)
      );
      context.fillStyle = "rgba(255, 255, 255, 0.92)";
      context.fill();
      context.restore();
    }

    render(timestamp = getNow()) {
      if (!this.context) {
        return;
      }

      const context = this.context;
      const metrics = this.getMetrics();
      let hasActiveAnimations = false;

      context.clearRect(0, 0, this.width, this.height);
      this.drawBoardSurface(metrics);

      for (let row = 0; row < this.gridSize; row += 1) {
        for (let col = 0; col < this.gridSize; col += 1) {
          const x = metrics.boardX + (col * (metrics.cellSize + metrics.gap));
          const y = metrics.boardY + (row * (metrics.cellSize + metrics.gap));
          const cellIndex = (row * this.gridSize) + col;
          const entry = this.entryMap.get(cellIndex);

          this.drawBlankCell(x, y, metrics.cellSize, metrics.radius);

          if (!entry) {
            continue;
          }

          if (!this.revealedIndexes.has(cellIndex)) {
            this.drawGhostCell(x, y, metrics.cellSize, metrics.radius, entry);
            continue;
          }

          let progress = 1;
          if (this.revealAnimations.has(cellIndex)) {
            const elapsed = timestamp - this.revealAnimations.get(cellIndex);
            progress = clamp(elapsed / 260, 0, 1);
            if (progress >= 1) {
              this.revealAnimations.delete(cellIndex);
            } else {
              hasActiveAnimations = true;
            }
          }

          this.drawFilledCell(x, y, metrics.cellSize, metrics.radius, entry, progress);
        }
      }

      if (hasActiveAnimations) {
        this.requestRender();
      }
    }

    dispose() {
      if (this.frameHandle) {
        window.cancelAnimationFrame(this.frameHandle);
        this.frameHandle = 0;
      }
      this.resizeObserver?.disconnect();
      window.removeEventListener("resize", this.handleResize);
      this.container.innerHTML = "";
    }
  }

  window.PixelBoardCanvas = PixelBoardCanvas;
}());
