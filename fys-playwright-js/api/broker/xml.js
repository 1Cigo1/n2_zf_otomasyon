import assert from 'node:assert/strict';
import { mkdir, writeFile, chmod } from 'node:fs/promises';
import path from 'node:path';
import { XMLBuilder, XMLParser, XMLValidator } from 'fast-xml-parser';

const parser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true,
  parseTagValue: false, // Rez_ID ve benzeri değerler metin olarak kalsın.
});
const builder = new XMLBuilder({ ignoreAttributes: false, format: true });
const xmlDirectory = path.resolve('reports/api_xml');

export function parseXml(xml) {
  const valid = XMLValidator.validate(xml);
  assert.equal(valid, true, 'API geçerli XML döndürmedi.');
  const document = parser.parse(xml);
  const rootName = Object.keys(document).find((name) => !name.startsWith('?'));
  assert.ok(rootName, 'XML içinde kök öğe bulunamadı.');
  return { rootName, root: document[rootName] };
}

export function fieldText(record, name) {
  const value = record?.[name];
  return value === undefined || value === null ? '' : String(value).trim();
}

export function recordsOf(document, tagName) {
  const value = document.root?.[tagName];
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

export function xmlHasError(value) {
  if (!value || typeof value !== 'object') return false;
  for (const [name, child] of Object.entries(value)) {
    if (['error', 'fault', 'hata'].includes(name.toLowerCase())) return true;
    if (xmlHasError(child)) return true;
  }
  return false;
}

export async function saveXml(fileName, document) {
  assert.match(fileName, /^[a-z0-9_-]+\.xml$/i);
  await mkdir(xmlDirectory, { recursive: true });
  const filePath = path.join(xmlDirectory, fileName);
  await writeFile(filePath, builder.build({ [document.rootName]: document.root }), {
    encoding: 'utf8',
    mode: 0o600,
  });
  await chmod(filePath, 0o600);
  return filePath;
}

export async function saveErrorResponse(stem, body) {
  try {
    return await saveXml(`${stem}.xml`, parseXml(body));
  } catch {
    const filePath = path.join(xmlDirectory, `${stem}.txt`);
    await mkdir(xmlDirectory, { recursive: true });
    await writeFile(filePath, body, { encoding: 'utf8', mode: 0o600 });
    await chmod(filePath, 0o600);
    return filePath;
  }
}

export async function inspectXmlResponse(response, { title, fileName, recordTag, fields }) {
  assert.equal(response.status(), 200, `${title}: HTTP ${response.status()}`);
  const document = parseXml(await response.text());
  const records = recordsOf(document, recordTag);
  assert.ok(records.length > 0, `${title}: ${recordTag} kaydı dönmedi.`);
  const filePath = await saveXml(fileName, document);

  // Terminal kısa bir örnek gösterir; tam XML dosyada kalır.
  const sample = records.slice(0, 3).map((record) => {
    const selectedFields = {};
    for (const field of fields) {
      selectedFields[field] = fieldText(record, field);
    }
    return selectedFields;
  });
  console.log(`\n${title}: ${records.length} kayıt`);
  console.log(builder.build({ [document.rootName]: { [recordTag]: sample } }));
  console.log(`Tam XML: ${filePath}`);
  return records;
}
