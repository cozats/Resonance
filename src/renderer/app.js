/**
 * Whisper Pro - Renderer Application Logic
 */

// State
const state = {
    jobs: [],
    selectedModel: 'base',
    selectedLanguage: '',
    outputDir: null,
    formats: ['srt', 'txt', 'md']
};

// Get selected formats from checkboxes
function getSelectedFormats() {
    const formats = [];
    if (document.getElementById('format-srt')?.checked) formats.push('srt');
    if (document.getElementById('format-txt')?.checked) formats.push('txt');
    if (document.getElementById('format-md')?.checked) formats.push('md');
    return formats.length > 0 ? formats : ['srt']; // Default to srt if none selected
}

// DOM Elements
const uploadZone = document.getElementById('upload-zone');
const browseBtn = document.getElementById('browse-btn');
const modelSelect = document.getElementById('model-select');
const languageSelect = document.getElementById('language-select');
const outputDirInput = document.getElementById('output-dir');
const selectFolderBtn = document.getElementById('select-folder-btn');
const jobsTable = document.getElementById('jobs-table');
const noJobsRow = document.getElementById('no-jobs-row');
const clearBtn = document.getElementById('clear-btn');
const statusMessage = document.getElementById('status-message');

// Initialize
function init() {
    setupEventListeners();
    setupProgressListener();
}

function setupEventListeners() {
    // Browse button
    browseBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const files = await window.whisperAPI.selectFiles();
        if (files && files.length > 0) {
            handleFiles(files);
        }
    });

    // Drag and drop
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        uploadZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
        });
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        uploadZone.addEventListener(eventName, () => uploadZone.classList.add('dragover'));
    });

    ['dragleave', 'drop'].forEach(eventName => {
        uploadZone.addEventListener(eventName, () => uploadZone.classList.remove('dragover'));
    });

    uploadZone.addEventListener('drop', (e) => {
        const files = Array.from(e.dataTransfer.files).map(f => f.path);
        handleFiles(files);
    });

    // Select output folder
    selectFolderBtn.addEventListener('click', async () => {
        const folder = await window.whisperAPI.selectOutputFolder();
        if (folder) {
            state.outputDir = folder;
            outputDirInput.value = folder;
        }
    });

    // Model and language selects
    modelSelect.addEventListener('change', (e) => {
        state.selectedModel = e.target.value;
    });

    languageSelect.addEventListener('change', (e) => {
        state.selectedLanguage = e.target.value;
    });

    // Clear all
    clearBtn.addEventListener('click', () => {
        state.jobs = [];
        renderJobs();
    });
}

function setupProgressListener() {
    window.whisperAPI.onProgress((data) => {
        const job = state.jobs.find(j => j.filePath === data.filePath);
        if (job) {
            job.progress = data.progress;
            job.status = data.status;
            if (data.error) job.error = data.error;
            if (data.progress === 100) job.status = 'completed';
            if (data.error) job.status = 'failed';
            renderJobs();
        }
    });
}

async function handleFiles(filePaths) {
    for (const filePath of filePaths) {
        const fileName = filePath.split('/').pop();
        
        // Add to jobs list
        const job = {
            id: Date.now() + Math.random(),
            filePath,
            fileName,
            model: state.selectedModel,
            progress: 0,
            status: 'queued'
        };
        state.jobs.unshift(job);
        renderJobs();

        // Start transcription
        statusMessage.textContent = `Processing: ${fileName}`;
        
        try {
            const formats = getSelectedFormats();
            const result = await window.whisperAPI.transcribe({
                filePath,
                modelId: state.selectedModel,
                language: state.selectedLanguage,
                outputDir: state.outputDir,
                formats: formats
            });

            if (result.success) {
                job.srtPath = result.srtPath;
                job.txtPath = result.txtPath;
                job.mdPath = result.mdPath;
                statusMessage.textContent = `Completed: ${fileName}`;
            } else {
                job.status = 'failed';
                job.error = result.error;
                statusMessage.textContent = `Failed: ${fileName}`;
            }
        } catch (error) {
            job.status = 'failed';
            job.error = error.message;
            statusMessage.textContent = `Error: ${error.message}`;
        }
        
        renderJobs();
    }
}

function renderJobs() {
    if (state.jobs.length === 0) {
        noJobsRow.style.display = '';
        // Clear other rows
        jobsTable.querySelectorAll('tr:not(#no-jobs-row)').forEach(row => row.remove());
        return;
    }

    noJobsRow.style.display = 'none';
    jobsTable.querySelectorAll('tr:not(#no-jobs-row)').forEach(row => row.remove());

    state.jobs.forEach(job => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <div class="file-info">
                    <div class="file-icon">
                        <span class="material-symbols-outlined">${getFileIcon(job.fileName)}</span>
                    </div>
                    <span class="file-name" title="${job.fileName}">${job.fileName}</span>
                </div>
            </td>
            <td style="text-transform: uppercase;">${job.model}</td>
            <td class="progress-cell">
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${job.progress}%"></div>
                </div>
                <div class="progress-text">${job.progress}%</div>
            </td>
            <td>
                <span class="status-badge ${getStatusClass(job.status)}">${job.status}</span>
            </td>
            <td class="actions-cell">
                ${job.status === 'completed' ? `
                    ${job.srtPath ? `<button class="action-btn" onclick="openFile('${job.srtPath}')">.SRT</button>` : ''}
                    ${job.txtPath ? `<button class="action-btn" onclick="openFile('${job.txtPath}')">.TXT</button>` : ''}
                    ${job.mdPath ? `<button class="action-btn" onclick="openFile('${job.mdPath}')">.MD</button>` : ''}
                ` : ''}
                <button class="action-btn delete" onclick="deleteJob(${job.id})">
                    <span class="material-symbols-outlined">delete</span>
                </button>
            </td>
        `;
        jobsTable.insertBefore(row, noJobsRow);
    });
}

function getFileIcon(fileName) {
    const ext = fileName.split('.').pop().toLowerCase();
    if (['mp4', 'mkv', 'webm'].includes(ext)) return 'movie';
    if (['wav', 'flac'].includes(ext)) return 'mic';
    return 'audiotrack';
}

function getStatusClass(status) {
    if (status === 'completed' || status === 'Completed') return 'completed';
    if (status === 'processing' || status.includes('...')) return 'processing';
    if (status === 'failed' || status === 'Failed') return 'failed';
    return 'queued';
}

function deleteJob(id) {
    state.jobs = state.jobs.filter(j => j.id !== id);
    renderJobs();
}

function openFile(filePath) {
    window.whisperAPI.openFile(filePath);
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
