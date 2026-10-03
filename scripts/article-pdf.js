(function () {
  const DEFAULT_TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || "local time";

  function formatDateTime(value) {
    if (!value) return "Not available";
    return new Intl.DateTimeFormat("en-CA", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short"
    }).format(new Date(value));
  }

  function renderMath(root) {
    if (!root || typeof window.renderMathInElement !== "function") return;

    window.renderMathInElement(root, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "\\[", right: "\\]", display: true },
        { left: "$", right: "$", display: false },
        { left: "\\(", right: "\\)", display: false }
      ],
      throwOnError: false
    });
  }

  function escapeFilename(value) {
    return String(value || "article")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "article";
  }

  function loadImageData(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth || image.width;
        canvas.height = image.naturalHeight || image.height;
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0);
        resolve({
          dataUrl: canvas.toDataURL("image/png"),
          width: canvas.width,
          height: canvas.height,
          image
        });
      };
      image.onerror = reject;
      image.src = src;
    });
  }

  function makeTransparentImageData(imageInfo, alpha) {
    const canvas = document.createElement("canvas");
    canvas.width = imageInfo.width;
    canvas.height = imageInfo.height;
    const context = canvas.getContext("2d");
    context.globalAlpha = alpha;
    context.drawImage(imageInfo.image, 0, 0);
    return canvas.toDataURL("image/png");
  }

  function htmlToBlocks(html) {
    const template = document.createElement("template");
    template.innerHTML = html || "";
    const blocks = [];

    function textOf(node) {
      return String(node.textContent || "").replace(/\s+/g, " ").trim();
    }

    function walk(node) {
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const tag = node.tagName.toLowerCase();

      if (["h1", "h2", "h3"].includes(tag)) {
        const text = textOf(node);
        if (text) blocks.push({ type: "heading", text });
        return;
      }

      if (tag === "img") {
        const src = node.getAttribute("src");
        const alt = node.getAttribute("alt") || "";
        if (src) blocks.push({ type: "image", src, alt });
        return;
      }

      if (tag === "figure") {
        const image = node.querySelector("img");
        const caption = node.querySelector("figcaption");
        if (image && image.getAttribute("src")) {
          blocks.push({
            type: "figure",
            src: image.getAttribute("src"),
            alt: image.getAttribute("alt") || "",
            caption: caption ? textOf(caption) : ""
          });
        }
        return;
      }

      if (tag === "p" || tag === "blockquote") {
        const text = textOf(node);
        if (text) blocks.push({ type: tag === "blockquote" ? "quote" : "paragraph", text });
        return;
      }

      if (tag === "li") {
        const text = textOf(node);
        if (text) blocks.push({ type: "list", text: `- ${text}` });
        return;
      }

      if (tag === "figcaption") {
        const text = textOf(node);
        if (text) blocks.push({ type: "caption", text });
        return;
      }

      Array.from(node.childNodes).forEach(walk);
    }

    Array.from(template.content.childNodes).forEach(walk);
    return blocks.length ? blocks : [{ type: "paragraph", text: textOf(template.content) }];
  }

  function addHeader(doc, logo, article, downloadDate) {
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, pageWidth, 43, "F");
    doc.setFillColor(248, 252, 247);
    doc.rect(0, 0, pageWidth, 9, "F");
    doc.addImage(logo.dataUrl, "PNG", 14, 12, 22, 22);
    doc.setTextColor(47, 20, 68);
    doc.setFont("times", "bold");
    doc.setFontSize(14);
    doc.text("RM Tutoring Services", 42, 17);
    doc.setFont("times", "normal");
    doc.setFontSize(9);
    doc.setTextColor(75, 75, 75);
    doc.text(`Downloaded: ${formatDateTime(downloadDate)} | ${DEFAULT_TIME_ZONE}`, 42, 24);
    doc.text(`Published: ${formatDateTime(article.createdAt || article.updatedAt)}`, 42, 30);
    doc.setFont("times", "italic");
    doc.text(article.title || "Article", pageWidth - 14, 17, { align: "right", maxWidth: 64 });
    doc.setDrawColor(127, 197, 113);
    doc.setLineWidth(0.6);
    doc.line(14, 39, pageWidth - 14, 39);
  }

  function addWatermark(doc, watermarkDataUrl) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.addImage(watermarkDataUrl, "PNG", (pageWidth - 118) / 2, (pageHeight - 118) / 2, 118, 118);
  }

  function addFooter(doc, pageNumber) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFont("times", "normal");
    doc.setFontSize(9);
    doc.setTextColor(110, 110, 110);
    doc.text("rmtutoringservices.com", 14, pageHeight - 10);
    doc.text(`Page ${pageNumber}`, pageWidth - 14, pageHeight - 10, { align: "right" });
  }

  function addPageShell(doc, logo, article, downloadedAt, watermark, pageNumber) {
    addWatermark(doc, watermark);
    addHeader(doc, logo, article, downloadedAt);
    addFooter(doc, pageNumber);
  }

  function reportProgress(options, percent) {
    if (typeof options.onProgress === "function") {
      options.onProgress(percent);
    }
  }

  function nextFrame() {
    return new Promise((resolve) => requestAnimationFrame(resolve));
  }

  async function readBlobWithProgress(blob, options) {
    const totalBytes = blob.size || 1;
    const chunkSize = Math.max(1024, Math.ceil(totalBytes / 80));
    let loadedBytes = 0;

    reportProgress(options, 0);

    for (let start = 0; start < totalBytes; start += chunkSize) {
      const chunk = blob.slice(start, Math.min(start + chunkSize, totalBytes));
      await chunk.arrayBuffer();
      loadedBytes += chunk.size;
      reportProgress(options, (loadedBytes / totalBytes) * 100);
      await nextFrame();
    }
  }

  function triggerBlobDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.hidden = true;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function downloadArticlePdf(article, options = {}) {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      throw new Error("PDF library is still loading. Try again in a moment.");
    }

    const doc = new window.jspdf.jsPDF({ unit: "mm", format: "letter" });
    const logo = await loadImageData(options.logoPath || "../assets/logo.png");
    const watermark = makeTransparentImageData(logo, 0.07);
    const downloadedAt = new Date();
    const pageHeight = doc.internal.pageSize.getHeight();
    const bottomLimit = pageHeight - 20;
    let page = 1;
    let y = 52;

    addPageShell(doc, logo, article, downloadedAt, watermark, page);

    doc.setTextColor(47, 20, 68);
    doc.setFont("times", "bold");
    doc.setFontSize(22);
    const titleLines = doc.splitTextToSize(article.title || "Article", 170);
    doc.text(titleLines, 14, y);
    y += titleLines.length * 9 + 3;

    doc.setFont("times", "bold");
    doc.setFontSize(10);
    doc.setTextColor(76, 127, 66);
    doc.text(article.category || "Article", 14, y);
    y += 8;

    if (article.excerpt) {
      doc.setFont("times", "italic");
      doc.setFontSize(11);
      doc.setTextColor(80, 80, 80);
      const excerptLines = doc.splitTextToSize(article.excerpt, 176);
      doc.text(excerptLines, 14, y);
      y += excerptLines.length * 5.2 + 6;
    }

    const blocks = htmlToBlocks(article.content);
    for (const block of blocks) {
      const isHeading = block.type === "heading";
      const isCaption = block.type === "caption";
      const isQuote = block.type === "quote";

      if (block.type === "image" || block.type === "figure") {
        try {
          const image = await loadImageData(block.src);
          const maxWidth = 150;
          const maxHeight = 84;
          const ratio = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
          const imageWidth = image.width * ratio;
          const imageHeight = image.height * ratio;
          const captionLines = block.caption ? doc.splitTextToSize(block.caption, 150) : [];
          const needed = imageHeight + (captionLines.length ? captionLines.length * 4.8 + 7 : 8);

          if (y + needed > bottomLimit) {
            doc.addPage();
            page += 1;
            y = 48;
            addPageShell(doc, logo, article, downloadedAt, watermark, page);
          }

          doc.addImage(image.dataUrl, "PNG", 14, y, imageWidth, imageHeight);
          y += imageHeight + 4;

          if (captionLines.length) {
            doc.setFont("times", "italic");
            doc.setFontSize(9);
            doc.setTextColor(90, 90, 90);
            doc.text(captionLines, 14, y);
            y += captionLines.length * 4.8 + 5;
          } else {
            y += 4;
          }
        } catch {
          const fallback = block.alt || block.caption || "Image unavailable in PDF export.";
          const lines = doc.splitTextToSize(`[Image: ${fallback}]`, 176);
          if (y + lines.length * 5.2 + 5 > bottomLimit) {
            doc.addPage();
            page += 1;
            y = 48;
            addPageShell(doc, logo, article, downloadedAt, watermark, page);
          }
          doc.setFont("times", "italic");
          doc.setFontSize(10);
          doc.setTextColor(90, 90, 90);
          doc.text(lines, 14, y);
          y += lines.length * 5.2 + 5;
        }
        continue;
      }

      const fontSize = isHeading ? 15 : isCaption ? 9 : 11;
      const lineHeight = isHeading ? 7 : 5.7;
      const lines = doc.splitTextToSize(block.text, isQuote ? 164 : 176);
      const needed = lines.length * lineHeight + 5;

      if (y + needed > bottomLimit) {
        doc.addPage();
        page += 1;
        y = 48;
        addPageShell(doc, logo, article, downloadedAt, watermark, page);
      }

      doc.setFont("times", isHeading ? "bold" : isCaption ? "italic" : "normal");
      doc.setFontSize(fontSize);
      doc.setTextColor(isHeading ? 47 : isCaption ? 90 : 45, isHeading ? 20 : isCaption ? 90 : 45, isHeading ? 68 : isCaption ? 90 : 45);
      doc.text(lines, isQuote ? 22 : 14, y);
      y += lines.length * lineHeight + (isHeading ? 5 : 4);
    }

    const filename = `${escapeFilename(article.title)}.pdf`;
    const blob = doc.output("blob");
    await readBlobWithProgress(blob, options);
    triggerBlobDownload(blob, filename);
  }

  window.RMArticleTools = {
    downloadArticlePdf,
    formatDateTime,
    renderMath
  };
})();
