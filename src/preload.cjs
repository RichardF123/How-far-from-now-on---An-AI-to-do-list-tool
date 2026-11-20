const { contextBridge, ipcRenderer } = require('electron');
const invoke = async (channel, ...args) => { const r = await ipcRenderer.invoke(channel, ...args); if(!r.ok) throw new Error(r.message); return r.value; };
contextBridge.exposeInMainWorld('mentor', {
 snapshot: () => invoke('snapshot'), createGoal: a => invoke('create-goal', a), chooseFiles: () => invoke('choose-files'), saveRecord: a => invoke('save-record', a), requestReview: a => invoke('request-review', a), cancelReview: a => invoke('cancel-review', a), connection: a => invoke('connection', a), setup: () => invoke('setup'), copy: a => invoke('copy', a), windowAction: a => invoke('window-action', a),
 onChange: fn => { const handler = () => fn(); ipcRenderer.on('state-changed', handler); return () => ipcRenderer.removeListener('state-changed', handler); }
});
