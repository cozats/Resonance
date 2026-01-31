/**
 * Whisper Service - Uses Python openai-whisper via subprocess
 * Simpler approach that leverages existing Python installation
 */

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

// Helper to find executables in common macOS locations
function findExecutable(name) {
  const commonPaths = ['/usr/local/bin', '/opt/homebrew/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin'];
  for (const dir of commonPaths) {
    const fullPath = path.join(dir, name);
    if (fs.existsSync(fullPath)) return fullPath;
  }
  return name; // Fallback to raw name if not found in common paths
}

// Get the writable directory for the whisper environment
const getWhisperDir = () => path.join(app.getPath('userData'), 'whisper-env');
const getVenvDir = () => path.join(getWhisperDir(), 'venv');
const getPythonBin = () => {
  const venvDir = getVenvDir();
  return process.platform === 'win32' 
    ? path.join(venvDir, 'Scripts', 'python.exe')
    : path.join(venvDir, 'bin', 'python');
};

// Helper for shell environment with common paths added
const getShellEnv = () => {
    const commonPaths = ['/usr/local/bin', '/opt/homebrew/bin', '/usr/bin', '/bin'];
    const pathValue = [...commonPaths, process.env.PATH].join(process.platform === 'win32' ? ';' : ':');
    return { ...process.env, PATH: pathValue };
};

// Model sizes
const MODELS = {
  tiny: { size: '~75MB' },
  base: { size: '~150MB' },
  small: { size: '~500MB' },
  medium: { size: '~1.5GB' },
  large: { size: '~3GB' },
};

/**
 * Ensure Python environment with whisper is set up
 */
async function ensureEnvironment(onStatus) {
  const pythonBin = getPythonBin();
  const whisperDir = getWhisperDir();
  const venvDir = getVenvDir();

  if (fs.existsSync(pythonBin)) {
    return true;
  }

  await fs.promises.mkdir(whisperDir, { recursive: true });

  const shellEnv = getShellEnv();

  // Check for python3
  const python3Path = findExecutable('python3');
  try {
    execSync(`"${python3Path}" --version`, { env: shellEnv, stdio: 'pipe' });
  } catch (e) {
    throw new Error('Python 3 not found. Please install Python 3.9+ from python.org or via Homebrew.');
  }

  // Check for ffmpeg
  const ffmpegPath = findExecutable('ffmpeg');
  try {
    execSync(`"${ffmpegPath}" -version`, { env: shellEnv, stdio: 'pipe' });
  } catch (e) {
    throw new Error('FFmpeg not found. Residency requires FFmpeg for media processing. Please install it (e.g., brew install ffmpeg).');
  }

  if (onStatus) onStatus('Setting up Python environment (first run)...');
  
  try {
    // Create virtual environment using the detected python3
    execSync(`"${python3Path}" -m venv "${venvDir}"`, { env: shellEnv, stdio: 'pipe' });
    
    if (onStatus) onStatus('Installing whisper (this may take a few minutes)...');
    
    // Install openai-whisper
    execSync(`"${pythonBin}" -m pip install --upgrade pip`, { env: shellEnv, stdio: 'pipe' });
    execSync(`"${pythonBin}" -m pip install openai-whisper`, { 
      env: shellEnv,
      stdio: 'pipe',
      timeout: 600000 // 10 minute timeout
    });
    
    console.log('Whisper environment set up successfully at:', venvDir);
    return true;
  } catch (e) {
    // Clean up on failure
    try { if(fs.existsSync(venvDir)) fs.rmSync(venvDir, { recursive: true, force: true }); } catch (err) {}
    throw new Error(`Failed to set up whisper: ${e.message}`);
  }
}

/**
 * Transcribe audio file using whisper
 */
async function transcribe(filePath, options = {}) {
  const { modelId = 'base', language = null, formats = ['srt', 'txt', 'md'], onProgress, onStatus } = options;

  try {
    // Ensure environment
    await ensureEnvironment(onStatus);

    if (onProgress) onProgress({ status: 'Starting transcription...', progress: 10 });

    // Output paths
    const outputDir = path.dirname(filePath);
    const baseName = path.basename(filePath, path.extname(filePath));
    
    // Determine output format for whisper
    // Whisper supports: txt, vtt, srt, tsv, json, all
    // We need srt and/or txt, then generate md from txt
    const needsTxt = formats.includes('txt') || formats.includes('md');
    const needsSrt = formats.includes('srt');
    
    let outputFormat;
    if (needsTxt && needsSrt) {
      outputFormat = 'all'; // Get all formats, we'll clean up later
    } else if (needsSrt) {
      outputFormat = 'srt';
    } else if (needsTxt) {
      outputFormat = 'txt';
    } else {
      outputFormat = 'srt'; // Default
    }
    
    // Build whisper command
    const args = [
      '-m', 'whisper',
      filePath,
      '--model', modelId,
      '--output_dir', outputDir,
      '--output_format', outputFormat,
    ];

    if (language) {
      args.push('--language', language);
    }

    return new Promise((resolve, reject) => {
      if (onProgress) onProgress({ status: 'Transcribing...', progress: 30 });
      
      const pythonBin = getPythonBin();
      const shellEnv = getShellEnv();
      
      console.log('Running whisper:', pythonBin, args.join(' '));
      const whisper = spawn(pythonBin, args, {
        env: shellEnv
      });
      
      let stderr = '';
      let lastProgress = 30;
      
      whisper.stdout.on('data', (data) => {
        console.log('stdout:', data.toString());
      });

      whisper.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        console.log('stderr:', output);
        
        // Parse progress from whisper output
        const match = output.match(/(\d+)%\|/);
        if (match && onProgress) {
          const pct = parseInt(match[1], 10);
          lastProgress = 30 + (pct * 0.65);
          onProgress({ status: `Transcribing... ${pct}%`, progress: lastProgress });
        }
      });

      whisper.on('close', (code) => {
        console.log('Whisper exit code:', code);
        
        // File paths
        const srtPath = path.join(outputDir, baseName + '.srt');
        const txtPath = path.join(outputDir, baseName + '.txt');
        const mdPath = path.join(outputDir, baseName + '.md');
        const vttPath = path.join(outputDir, baseName + '.vtt');
        const tsvPath = path.join(outputDir, baseName + '.tsv');
        const jsonPath = path.join(outputDir, baseName + '.json');

        // Create MD from TXT if needed
        if (formats.includes('md') && fs.existsSync(txtPath)) {
          const text = fs.readFileSync(txtPath, 'utf-8');
          const md = `# Transcription\n\n**File:** ${path.basename(filePath)}\n\n---\n\n${text}`;
          fs.writeFileSync(mdPath, md);
        }

        // Clean up unwanted files
        if (!formats.includes('srt') && fs.existsSync(srtPath)) fs.unlinkSync(srtPath);
        if (!formats.includes('txt') && fs.existsSync(txtPath)) fs.unlinkSync(txtPath);
        // Always clean up extra formats we don't support in UI
        if (fs.existsSync(vttPath)) fs.unlinkSync(vttPath);
        if (fs.existsSync(tsvPath)) fs.unlinkSync(tsvPath);
        if (fs.existsSync(jsonPath)) fs.unlinkSync(jsonPath);

        if (code === 0 || fs.existsSync(srtPath) || fs.existsSync(txtPath)) {
          if (onProgress) onProgress({ status: 'Completed', progress: 100 });
          
          resolve({
            success: true,
            srtPath: formats.includes('srt') && fs.existsSync(srtPath) ? srtPath : null,
            txtPath: formats.includes('txt') && fs.existsSync(txtPath) ? txtPath : null,
            mdPath: formats.includes('md') && fs.existsSync(mdPath) ? mdPath : null,
          });
        } else {
          reject(new Error(`Transcription failed: ${stderr || 'Unknown error'}`));
        }
      });

      whisper.on('error', (err) => {
        reject(err);
      });
    });
  } catch (error) {
    if (onProgress) onProgress({ status: 'Failed', progress: 0, error: error.message });
    throw error;
  }
}

/**
 * Get available models
 */
function getModels() {
  return [
    { id: 'tiny', name: 'Tiny', description: 'Fastest, lowest accuracy', size: '~75MB' },
    { id: 'base', name: 'Base', description: 'Fast, good for drafts', size: '~150MB' },
    { id: 'small', name: 'Small', description: 'Balanced speed/accuracy', size: '~500MB' },
    { id: 'medium', name: 'Medium', description: 'High accuracy', size: '~1.5GB' },
    { id: 'large', name: 'Large', description: 'Best accuracy', size: '~3GB' },
  ];
}

module.exports = {
  transcribe,
  getModels,
  ensureEnvironment,
};
