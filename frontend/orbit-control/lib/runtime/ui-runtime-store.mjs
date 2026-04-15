import fs from 'node:fs';
import path from 'node:path';
import { createUiRuntimeSeed } from './ui-runtime-seed.mjs';
const STORE_FILENAME = '.ki-os-ui-runtime.json';
const getStorePath = () => path.join(process.cwd(), STORE_FILENAME);
const cloneValue = (value) => JSON.parse(JSON.stringify(value));
export function loadUiRuntimeState() {
  const storePath = getStorePath();
  if (!fs.existsSync(storePath)) {
    const seeded = createUiRuntimeSeed();
    saveUiRuntimeState(seeded);
    return cloneValue(seeded);
  }
  return JSON.parse(fs.readFileSync(storePath, 'utf8'));
}
export function saveUiRuntimeState(state) {
  const nextState = { ...cloneValue(state), meta: { ...state.meta, updatedAt: new Date().toISOString() } };
  fs.writeFileSync(getStorePath(), JSON.stringify(nextState, null, 2) + '\n', 'utf8');
  return nextState;
}
export function resetUiRuntimeState() { return saveUiRuntimeState(createUiRuntimeSeed()); }
export function updateUiRuntimeState(updater) { return saveUiRuntimeState(updater(cloneValue(loadUiRuntimeState()))); }
export function appendUiRuntimeEvent(section, collection, item) {
  return updateUiRuntimeState((state) => {
    const target = state?.[section]?.[collection];
    if (!Array.isArray(target)) throw new Error(`runtime_collection_not_array:${String(section)}.${String(collection)}`);
    target.push(item);
    return state;
  });
}
export function findUiRuntimeEntityById(section, collection, idField, idValue) {
  const state = loadUiRuntimeState();
  const target = state?.[section]?.[collection];
  if (!Array.isArray(target)) return undefined;
  return target.find((entry) => entry && typeof entry === 'object' && entry[idField] === idValue);
}
