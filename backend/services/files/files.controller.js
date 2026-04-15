/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */

'use strict';

const { assertRole } = require('../ui/ui.auth');
const { saveFile, listFiles, getFile, getFileContent, deleteFile, getFabricPayload } = require('./file.fabric.service');

async function handleFileRequest(pathname, method, body = {}, ctx = {}) {
  assertRole(ctx, ['admin', 'operator', 'viewer', 'auditor', 'user']);

  if (pathname === '/files' && method === 'GET') {
    return { statusCode: 200, body: listFiles(body) };
  }
  if (pathname === '/files/fabric' && method === 'GET') {
    return { statusCode: 200, body: getFabricPayload() };
  }
  if ((pathname === '/files' || pathname === '/files/upload') && method === 'POST') {
    return { statusCode: 200, body: saveFile({ ...body, userId: body.userId || ctx?.pki?.userId || 'system' }) };
  }
  if (pathname.startsWith('/files/') && pathname.endsWith('/content') && method === 'GET') {
    const fileId = decodeURIComponent(pathname.split('/')[2] || '');
    return { statusCode: 200, body: getFileContent(fileId) };
  }
  if (pathname.startsWith('/files/') && method === 'GET') {
    const fileId = decodeURIComponent(pathname.split('/').pop());
    const item = getFile(fileId);
    return item ? { statusCode: 200, body: { success: true, item } } : { statusCode: 404, body: { success: false, error: 'file_not_found', fileId } };
  }
  if (pathname.startsWith('/files/') && method === 'DELETE') {
    const fileId = decodeURIComponent(pathname.split('/').pop());
    const out = deleteFile(fileId);
    return out.success ? { statusCode: 200, body: out } : { statusCode: 404, body: out };
  }
  return { statusCode: 404, body: { success: false, error: 'unknown_file_route', path: pathname, method } };
}

module.exports = { handleFileRequest };
