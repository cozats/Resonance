/**
 * Preload script - Exposes secure APIs to the renderer
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('whisperAPI', {
  // File selection
  selectFiles: () => ipcRenderer.invoke('select-files'),
  selectOutputFolder: () => ipcRenderer.invoke('select-output-folder'),
  
  // Models
  getModels: () => ipcRenderer.invoke('get-models'),
  
  // Transcription
  transcribe: (options) => ipcRenderer.invoke('transcribe', options),
  
  // File operations
  openFile: (filePath) => ipcRenderer.invoke('open-file', filePath),
  showInFinder: (filePath) => ipcRenderer.invoke('show-in-finder', filePath),
  
  // Event listeners for progress updates
  onProgress: (callback) => {
    ipcRenderer.on('transcription-progress', (event, data) => callback(data));
  },
  
  // Remove listener
  removeProgressListener: () => {
    ipcRenderer.removeAllListeners('transcription-progress');
  }
});
