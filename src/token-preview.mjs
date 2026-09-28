
const _previewTokenIds = new Set();
let _raisedDeadVisible = false;

export const addPreviewToken = (id) => { _previewTokenIds.add(id); };
export const removePreviewToken = (id) => { _previewTokenIds.delete(id); };
export const clearPreviewTokens = () => { _previewTokenIds.clear(); };
export const isPreviewToken = (id) => _previewTokenIds.has(id);

export const setRaisedDeadVisible = (v) => { _raisedDeadVisible = v; };
export const isRaisedDeadVisible = () => _raisedDeadVisible;

export const activateTokenLayer = () => {
  if (canvas.tokens._activate) canvas.tokens._activate();
  else canvas.tokens.activate();
};
