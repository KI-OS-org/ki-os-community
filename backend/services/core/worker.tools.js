/**
 * (c) 2026 KI-OS.org (v6.0) by Ingo Schaffer und Kimba
 * Datei: worker.tools.js
 * Diese Datei enthält JavaScript-Logik für Runtime, Services, Tools oder Tests innerhalb des KI-OS AgentMesh.
 */

'use strict';
// xlsx removed — replaced with exceljs (no Prototype Pollution / ReDoS CVEs)
const ExcelJS = require('exceljs');
const AdmZip = require('adm-zip');
const pdfParse = require('pdf-parse');
const PDFDocument = require('pdfkit');
const PptxGenJS = require('pptxgenjs');
const fs = require('fs');

// --- EXCEL ---
async function generateExcel(data) {
  try {
    const wb = new ExcelJS.Workbook();
    const sheets = (data.sheets && Array.isArray(data.sheets))
      ? data.sheets
      : [{ name: 'Data', data: [['No Data']] }];
    sheets.forEach(s => {
      const ws = wb.addWorksheet(s.name || 'Sheet1');
      (s.data || []).forEach(row => ws.addRow(row));
    });
    const buffer = await wb.xlsx.writeBuffer();
    return {
      success: true,
      base64: Buffer.from(buffer).toString('base64'),
      mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename: data.filename || 'export.xlsx'
    };
  } catch (e) { return { success: false, error: e.message }; }
}

async function parseExcel(base64) {
  try {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(base64, 'base64'));
    const sheets = [];
    wb.eachSheet(ws => {
      const rows = [];
      ws.eachRow(row => rows.push(row.values.slice(1)));  // slice(1): exceljs is 1-indexed
      sheets.push({ name: ws.name, data: rows });
    });
    return { success: true, sheets };
  } catch (e) { return { success: false, error: e.message }; }
}

// --- PDF ---
async function extractPdfText(base64OrPath) {
  try {
    let buffer;
    if (base64OrPath.includes('/') || base64OrPath.includes('\\')) {
        if(fs.existsSync(base64OrPath)) buffer = fs.readFileSync(base64OrPath);
        else return { success: false, error: 'File not found' };
    } else {
        buffer = Buffer.from(base64OrPath, 'base64');
    }
    const data = await pdfParse(buffer);
    return { success: true, text: data.text, pages: data.numpages };
  } catch (e) { return { success: false, error: e.message }; }
}

async function generatePdf(data) {
    return new Promise((resolve) => {
        try {
            const doc = new PDFDocument();
            let buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => {
                const pdfData = Buffer.concat(buffers);
                resolve({
                    success: true,
                    base64: pdfData.toString('base64'),
                    mime: 'application/pdf',
                    filename: data.filename || 'document.pdf'
                });
            });

            if(data.title) doc.fontSize(20).text(data.title, { align: 'center' }).moveDown();
            if(data.content) doc.fontSize(12).text(data.content, { align: 'left' });
            
            doc.end();
        } catch(e) {
            resolve({ success: false, error: e.message });
        }
    });
}

// --- PPT ---
async function generatePpt(data) {
    try {
        const pptx = new PptxGenJS();
        if(data.slides && Array.isArray(data.slides)) {
            data.slides.forEach(s => {
                const slide = pptx.addSlide();
                if(s.title) slide.addText(s.title, { x:1, y:0.5, fontSize:18, color:'363636' });
                if(s.text) slide.addText(s.text, { x:1, y:1.5, fontSize:14, color:'666666' });
            });
        } else {
            const slide = pptx.addSlide();
            slide.addText("Kimba Presentation", { x:1, y:1, fontSize:24 });
        }
        const buffer = await pptx.write("nodebuffer");
        return {
            success: true,
            base64: buffer.toString('base64'),
            mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            filename: data.filename || 'presentation.pptx'
        };
    } catch(e) { return { success: false, error: e.message }; }
}

// --- ZIP / CODE ---
function generateCodeZip(data) {
  try {
    const zip = new AdmZip();
    if (!data.files || !Array.isArray(data.files)) throw new Error('No files');
    
    data.files.forEach(f => {
        const content = typeof f.content === 'string' ? Buffer.from(f.content, 'utf8') : f.content;
        zip.addFile(f.path, content);
    });
    
    const buffer = zip.toBuffer();
    return {
      success: true,
      base64: buffer.toString('base64'),
      mime: 'application/zip',
      filename: data.filename || 'code.zip'
    };
  } catch (e) { return { success: false, error: e.message }; }
}

function csvToJson(csv) {
    const lines = csv.split('\n').filter(x=>x.trim());
    if(!lines.length) return { success:true, data:[] };
    const headers = lines[0].split(',').map(x=>x.trim());
    const data = lines.slice(1).map(line => {
        const vals = line.split(',');
        let obj = {};
        headers.forEach((h,i) => obj[h] = vals[i]?.trim());
        return obj;
    });
    return { success: true, data };
}

module.exports = {
  generateExcel, parseExcel,  // async
  extractPdfText, generatePdf,
  generatePpt,
  generateCodeZip,
  csvToJson
};