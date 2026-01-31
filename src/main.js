/**
 * Resonance - Main Electron Process
 * Handles window management, native dialogs, and transcription logic
 */

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const whisper = require('./whisper');

// Keep a global reference of the window object
let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#121a20',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Load the app
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // DevTools - uncomment for debugging:
  // mainWindow.webContents.openDevTools();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App lifecycle
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// ============ IPC Handlers ============

// Select files via native dialog
ipcMain.handle('select-files', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Media Files', extensions: ['mp3', 'wav', 'mp4', 'mkv', 'm4a', 'ogg', 'webm', 'flac'] }
    ]
  });
  return result.filePaths;
});

// Select output folder via native dialog
ipcMain.handle('select-output-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory']
  });
  return result.filePaths[0] || null;
});

// Get available models
ipcMain.handle('get-models', async () => {
  return whisper.getModels();
});

// Start transcription with whisper.cpp
ipcMain.handle('transcribe', async (event, options) => {
  const { filePath, modelId, language, outputDir, formats = ['srt', 'txt', 'md'] } = options;
  
  try {
    // Determine output path
    const fileName = path.basename(filePath, path.extname(filePath));
    
    // Progress callback
    const onProgress = (data) => {
      mainWindow.webContents.send('transcription-progress', {
        filePath,
        progress: data.progress,
        status: data.status
      });
    };

    // Status callback for setup messages
    const onStatus = (status) => {
      mainWindow.webContents.send('transcription-progress', {
        filePath,
        progress: 0,
        status: status
      });
    };

    // Run transcription
    const result = await whisper.transcribe(filePath, {
      modelId,
      language: language || null,
      formats,
      onProgress,
      onStatus
    });

    // If custom output dir, copy the files there
    if (outputDir && result.success) {
      const targetBasePath = path.join(outputDir, fileName);
      
      if (result.srtPath) {
        const finalSrtPath = targetBasePath + '.srt';
        fs.copyFileSync(result.srtPath, finalSrtPath);
        fs.unlinkSync(result.srtPath);
        result.srtPath = finalSrtPath;
      }
      if (result.txtPath) {
        const finalTxtPath = targetBasePath + '.txt';
        fs.copyFileSync(result.txtPath, finalTxtPath);
        fs.unlinkSync(result.txtPath);
        result.txtPath = finalTxtPath;
      }
      if (result.mdPath) {
        const finalMdPath = targetBasePath + '.md';
        fs.copyFileSync(result.mdPath, finalMdPath);
        fs.unlinkSync(result.mdPath);
        result.mdPath = finalMdPath;
      }
    }

    return result;
  } catch (error) {
    console.error('Transcription error:', error);
    mainWindow.webContents.send('transcription-progress', {
      filePath,
      progress: 0,
      status: 'Failed',
      error: error.message
    });
    return { success: false, error: error.message };
  }
});

// Open file in Finder/default app
ipcMain.handle('open-file', async (event, filePath) => {
  if (fs.existsSync(filePath)) {
    shell.openPath(filePath);
    return true;
  }
  return false;
});

// Show file in Finder
ipcMain.handle('show-in-finder', async (event, filePath) => {
  if (fs.existsSync(filePath)) {
    shell.showItemInFolder(filePath);
    return true;
  }
  return false;
});
