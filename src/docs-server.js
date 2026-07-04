import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { google } from "googleapis";
import { getAuthClient } from "./auth.js";

const auth = await getAuthClient();
const docs = google.docs({ version: "v1", auth });
const drive = google.drive({ version: "v3", auth });

const server = new McpServer({ name: "mcp-maru-docs", version: "1.0.0" });

// ── Helpers ──

function hexToColor(hex) {
  const h = hex.replace("#", "");
  return {
    red: parseInt(h.slice(0, 2), 16) / 255,
    green: parseInt(h.slice(2, 4), 16) / 255,
    blue: parseInt(h.slice(4, 6), 16) / 255,
  };
}

async function getDocEndIndex(documentId) {
  const doc = await docs.documents.get({ documentId });
  const body = doc.data.body.content;
  const last = body[body.length - 1];
  return last.endIndex - 1;
}

// ── Tools ──

server.tool("read_document", "Đọc toàn bộ nội dung Google Doc — trả về text thuần + cấu trúc heading/bảng/ảnh", {
  documentId: z.string().describe("ID từ URL: docs.google.com/document/d/{documentId}/edit"),
}, async ({ documentId }) => {
  const doc = await docs.documents.get({ documentId });
  const title = doc.data.title;
  const lines = [];
  for (const el of doc.data.body.content) {
    if (el.paragraph) {
      const style = el.paragraph.paragraphStyle?.namedStyleType || "";
      let text = el.paragraph.elements.map((e) => {
        if (e.textRun) return e.textRun.content;
        if (e.inlineObjectElement) return "[ẢNH]";
        return "";
      }).join("");
      if (style.startsWith("HEADING")) lines.push(`[${style}] ${text}`);
      else lines.push(text);
    }
    if (el.table) {
      lines.push(`[BẢNG ${el.table.rows}×${el.table.columns}]`);
      for (const row of el.table.tableRows) {
        const cells = row.tableCells.map((cell) =>
          cell.content.map((c) =>
            c.paragraph?.elements.map((e) => e.textRun?.content || "").join("") || ""
          ).join("").trim()
        );
        lines.push("| " + cells.join(" | ") + " |");
      }
    }
  }
  return { content: [{ type: "text", text: `📄 ${title}\n\n${lines.join("")}` }] };
});

server.tool("create_document", "Tạo Google Doc mới (trả về documentId)", {
  title: z.string(),
  folderId: z.string().optional().describe("ID folder Drive để cất doc — nếu không truyền thì để My Drive"),
}, async ({ title, folderId }) => {
  const doc = await docs.documents.create({ requestBody: { title } });
  const docId = doc.data.documentId;
  if (folderId) {
    const file = await drive.files.get({ fileId: docId, fields: "parents", supportsAllDrives: true });
    await drive.files.update({
      fileId: docId,
      addParents: folderId,
      removeParents: (file.data.parents || []).join(","),
      supportsAllDrives: true,
    });
  }
  return { content: [{ type: "text", text: `✓ Tạo doc "${title}" — ID: ${docId}\nhttps://docs.google.com/document/d/${docId}/edit` }] };
});

server.tool("insert_text", "Chèn text vào vị trí index (1 = đầu doc). Dùng \\n cho xuống dòng.", {
  documentId: z.string(),
  text: z.string(),
  index: z.number().optional().describe("Vị trí chèn (1 = đầu doc). Bỏ trống = cuối doc."),
}, async ({ documentId, text, index }) => {
  const idx = index ?? await getDocEndIndex(documentId);
  await docs.documents.batchUpdate({
    documentId,
    requestBody: { requests: [{ insertText: { location: { index: idx }, text } }] },
  });
  return { content: [{ type: "text", text: `✓ Chèn ${text.length} ký tự tại index ${idx}` }] };
});

server.tool("replace_text", "Tìm & thay thế text trong toàn bộ doc", {
  documentId: z.string(),
  find: z.string(),
  replaceWith: z.string(),
  matchCase: z.boolean().optional(),
}, async ({ documentId, find, replaceWith, matchCase }) => {
  const res = await docs.documents.batchUpdate({
    documentId,
    requestBody: {
      requests: [{
        replaceAllText: {
          containsText: { text: find, matchCase: matchCase ?? true },
          replaceText: replaceWith,
        },
      }],
    },
  });
  const count = res.data.replies?.[0]?.replaceAllText?.occurrencesChanged || 0;
  return { content: [{ type: "text", text: `✓ Thay ${count} chỗ: "${find}" → "${replaceWith}"` }] };
});

server.tool("format_text", "Format text: bold, italic, font, size, màu cho 1 vùng (startIndex → endIndex)", {
  documentId: z.string(),
  startIndex: z.number(),
  endIndex: z.number(),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  underline: z.boolean().optional(),
  fontFamily: z.string().optional().describe("Vd: 'Times New Roman', 'Arial'"),
  fontSize: z.number().optional().describe("Đơn vị pt"),
  colorHex: z.string().optional().describe("Màu chữ, vd '#1B3A6B'"),
}, async ({ documentId, startIndex, endIndex, bold, italic, underline, fontFamily, fontSize, colorHex }) => {
  const textStyle = {};
  const fields = [];
  if (bold !== undefined) { textStyle.bold = bold; fields.push("bold"); }
  if (italic !== undefined) { textStyle.italic = italic; fields.push("italic"); }
  if (underline !== undefined) { textStyle.underline = underline; fields.push("underline"); }
  if (fontFamily) { textStyle.weightedFontFamily = { fontFamily }; fields.push("weightedFontFamily"); }
  if (fontSize) { textStyle.fontSize = { magnitude: fontSize, unit: "PT" }; fields.push("fontSize"); }
  if (colorHex) { textStyle.foregroundColor = { color: { rgbColor: hexToColor(colorHex) } }; fields.push("foregroundColor"); }

  await docs.documents.batchUpdate({
    documentId,
    requestBody: {
      requests: [{
        updateTextStyle: {
          range: { startIndex, endIndex },
          textStyle,
          fields: fields.join(","),
        },
      }],
    },
  });
  return { content: [{ type: "text", text: `✓ Format ${startIndex}→${endIndex}: ${fields.join(", ")}` }] };
});

server.tool("set_paragraph_style", "Đặt style paragraph: heading, alignment, spacing, indent", {
  documentId: z.string(),
  startIndex: z.number(),
  endIndex: z.number(),
  namedStyleType: z.enum(["NORMAL_TEXT", "HEADING_1", "HEADING_2", "HEADING_3", "HEADING_4", "HEADING_5", "HEADING_6", "TITLE", "SUBTITLE"]).optional(),
  alignment: z.enum(["START", "CENTER", "END", "JUSTIFIED"]).optional(),
  spaceAbovePt: z.number().optional(),
  spaceBelowPt: z.number().optional(),
  lineSpacing: z.number().optional().describe("100 = single, 150 = 1.5, 200 = double"),
  indentFirstLinePt: z.number().optional(),
}, async ({ documentId, startIndex, endIndex, namedStyleType, alignment, spaceAbovePt, spaceBelowPt, lineSpacing, indentFirstLinePt }) => {
  const paragraphStyle = {};
  const fields = [];
  if (namedStyleType) { paragraphStyle.namedStyleType = namedStyleType; fields.push("namedStyleType"); }
  if (alignment) { paragraphStyle.alignment = alignment; fields.push("alignment"); }
  if (spaceAbovePt !== undefined) { paragraphStyle.spaceAbove = { magnitude: spaceAbovePt, unit: "PT" }; fields.push("spaceAbove"); }
  if (spaceBelowPt !== undefined) { paragraphStyle.spaceBelow = { magnitude: spaceBelowPt, unit: "PT" }; fields.push("spaceBelow"); }
  if (lineSpacing !== undefined) { paragraphStyle.lineSpacing = lineSpacing; fields.push("lineSpacing"); }
  if (indentFirstLinePt !== undefined) { paragraphStyle.indentFirstLine = { magnitude: indentFirstLinePt, unit: "PT" }; fields.push("indentFirstLine"); }

  await docs.documents.batchUpdate({
    documentId,
    requestBody: {
      requests: [{
        updateParagraphStyle: {
          range: { startIndex, endIndex },
          paragraphStyle,
          fields: fields.join(","),
        },
      }],
    },
  });
  return { content: [{ type: "text", text: `✓ Paragraph style ${startIndex}→${endIndex}: ${fields.join(", ")}` }] };
});

server.tool("insert_table", "Chèn bảng vào doc", {
  documentId: z.string(),
  rows: z.number(),
  columns: z.number(),
  index: z.number().optional().describe("Vị trí chèn (bỏ trống = cuối doc)"),
}, async ({ documentId, rows, columns, index }) => {
  const idx = index ?? await getDocEndIndex(documentId);
  await docs.documents.batchUpdate({
    documentId,
    requestBody: {
      requests: [{ insertTable: { rows, columns, location: { index: idx } } }],
    },
  });
  return { content: [{ type: "text", text: `✓ Chèn bảng ${rows}×${columns} tại index ${idx}` }] };
});

server.tool("insert_image", "Chèn ảnh vào body doc từ URL (ảnh phải public hoặc có quyền)", {
  documentId: z.string(),
  imageUrl: z.string().describe("URL ảnh (https://...) — phải truy cập được công khai hoặc qua Drive"),
  index: z.number().optional().describe("Vị trí chèn (bỏ trống = cuối doc)"),
  widthPt: z.number().optional().describe("Chiều rộng ảnh (pt). Mặc định: giữ nguyên."),
  heightPt: z.number().optional().describe("Chiều cao ảnh (pt). Mặc định: giữ nguyên."),
}, async ({ documentId, imageUrl, index, widthPt, heightPt }) => {
  const idx = index ?? await getDocEndIndex(documentId);
  const req = {
    insertInlineImage: {
      uri: imageUrl,
      location: { index: idx },
    },
  };
  if (widthPt || heightPt) {
    req.insertInlineImage.objectSize = {};
    if (widthPt) req.insertInlineImage.objectSize.width = { magnitude: widthPt, unit: "PT" };
    if (heightPt) req.insertInlineImage.objectSize.height = { magnitude: heightPt, unit: "PT" };
  }
  await docs.documents.batchUpdate({ documentId, requestBody: { requests: [req] } });
  return { content: [{ type: "text", text: `✓ Chèn ảnh tại index ${idx}` }] };
});

server.tool("set_header", "Đặt header cho doc — text + tuỳ chọn ảnh thương hiệu", {
  documentId: z.string(),
  text: z.string().optional().describe("Nội dung header (vd: tên công ty). Bỏ trống nếu chỉ chèn ảnh."),
  imageUrl: z.string().optional().describe("URL ảnh logo cho header (phải public)"),
  imageWidthPt: z.number().optional().describe("Chiều rộng logo (pt). Mặc định 80."),
  imageHeightPt: z.number().optional().describe("Chiều cao logo (pt). Mặc định tỉ lệ theo width."),
}, async ({ documentId, text, imageUrl, imageWidthPt, imageHeightPt }) => {
  const doc = await docs.documents.get({ documentId });
  let headerId = doc.data.documentStyle?.defaultHeaderId;
  const requests = [];

  if (!headerId) {
    requests.push({ createHeader: { type: "DEFAULT", sectionBreakLocation: { index: 0 } } });
    const res = await docs.documents.batchUpdate({ documentId, requestBody: { requests } });
    headerId = res.data.replies[0].createHeader.headerId;
    requests.length = 0;
  }

  const headerDoc = await docs.documents.get({ documentId });
  const header = headerDoc.data.headers[headerId];
  const headerStartIndex = header.content[0]?.startIndex || 0;

  if (imageUrl) {
    const imgReq = {
      insertInlineImage: {
        uri: imageUrl,
        location: { segmentId: headerId, index: headerStartIndex },
        objectSize: {},
      },
    };
    if (imageWidthPt || 80) imgReq.insertInlineImage.objectSize.width = { magnitude: imageWidthPt || 80, unit: "PT" };
    if (imageHeightPt) imgReq.insertInlineImage.objectSize.height = { magnitude: imageHeightPt, unit: "PT" };
    requests.push(imgReq);
  }

  if (text) {
    requests.push({
      insertText: {
        location: { segmentId: headerId, index: headerStartIndex },
        text: text + (imageUrl ? "\n" : ""),
      },
    });
  }

  if (requests.length > 0) {
    await docs.documents.batchUpdate({ documentId, requestBody: { requests } });
  }
  return { content: [{ type: "text", text: `✓ Header đã cập nhật${imageUrl ? " (có logo)" : ""}${text ? `: "${text}"` : ""}` }] };
});

server.tool("set_footer", "Đặt footer cho doc", {
  documentId: z.string(),
  text: z.string().describe("Nội dung footer (vd: 'Trang {PAGE} / {PAGES}' hoặc địa chỉ công ty)"),
}, async ({ documentId, text }) => {
  const doc = await docs.documents.get({ documentId });
  let footerId = doc.data.documentStyle?.defaultFooterId;
  const requests = [];

  if (!footerId) {
    requests.push({ createFooter: { type: "DEFAULT", sectionBreakLocation: { index: 0 } } });
    const res = await docs.documents.batchUpdate({ documentId, requestBody: { requests } });
    footerId = res.data.replies[0].createFooter.footerId;
    requests.length = 0;
  }

  const footerDoc = await docs.documents.get({ documentId });
  const footer = footerDoc.data.footers[footerId];
  const footerStartIndex = footer.content[0]?.startIndex || 0;

  requests.push({
    insertText: {
      location: { segmentId: footerId, index: footerStartIndex },
      text,
    },
  });

  await docs.documents.batchUpdate({ documentId, requestBody: { requests } });
  return { content: [{ type: "text", text: `✓ Footer: "${text}"` }] };
});

server.tool("set_page_margins", "Đặt margin trang (mm)", {
  documentId: z.string(),
  topMm: z.number().optional(),
  bottomMm: z.number().optional(),
  leftMm: z.number().optional(),
  rightMm: z.number().optional(),
}, async ({ documentId, topMm, bottomMm, leftMm, rightMm }) => {
  const documentStyle = {};
  const fields = [];
  const mmToPt = (mm) => mm * 72 / 25.4;
  if (topMm !== undefined) { documentStyle.marginTop = { magnitude: mmToPt(topMm), unit: "PT" }; fields.push("marginTop"); }
  if (bottomMm !== undefined) { documentStyle.marginBottom = { magnitude: mmToPt(bottomMm), unit: "PT" }; fields.push("marginBottom"); }
  if (leftMm !== undefined) { documentStyle.marginLeft = { magnitude: mmToPt(leftMm), unit: "PT" }; fields.push("marginLeft"); }
  if (rightMm !== undefined) { documentStyle.marginRight = { magnitude: mmToPt(rightMm), unit: "PT" }; fields.push("marginRight"); }

  await docs.documents.batchUpdate({
    documentId,
    requestBody: {
      requests: [{ updateDocumentStyle: { documentStyle, fields: fields.join(",") } }],
    },
  });
  return { content: [{ type: "text", text: `✓ Margin: ${fields.map((f) => f.replace("margin", "")).join(", ")}` }] };
});

server.tool("delete_content", "Xoá nội dung trong 1 vùng (startIndex → endIndex)", {
  documentId: z.string(),
  startIndex: z.number(),
  endIndex: z.number(),
}, async ({ documentId, startIndex, endIndex }) => {
  await docs.documents.batchUpdate({
    documentId,
    requestBody: {
      requests: [{ deleteContentRange: { range: { startIndex, endIndex } } }],
    },
  });
  return { content: [{ type: "text", text: `✓ Xoá index ${startIndex}→${endIndex}` }] };
});

server.tool("batch_update", "Gửi nhiều request cùng lúc (nâng cao — dùng Docs API batchUpdate format)", {
  documentId: z.string(),
  requests: z.array(z.any()).describe("Mảng request theo format Google Docs API batchUpdate"),
}, async ({ documentId, requests }) => {
  const res = await docs.documents.batchUpdate({ documentId, requestBody: { requests } });
  return { content: [{ type: "text", text: `✓ Batch: ${res.data.replies?.length || 0} replies` }] };
});

// ── Start ──

const transport = new StdioServerTransport();
await server.connect(transport);
