// API Configuration - Load from config.js (generated from .env)
let API_BASE_URL = window.APP_CONFIG?.API_BASE_URL || 'http://localhost:8000';

// DOM Elements - with null checks
const companyIdInput = document.getElementById('companyId');
const fileInput = document.getElementById('fileInput');
const uploadArea = document.getElementById('uploadArea');
const uploadBtn = document.getElementById('uploadBtn');
const fileInfo = document.getElementById('fileInfo');
const uploadStatus = document.getElementById('uploadStatus');
const queryInput = document.getElementById('queryInput');
const queryBtn = document.getElementById('queryBtn');
const queryStatus = document.getElementById('queryStatus');
const queryResult = document.getElementById('queryResult');
const streamCheck = document.getElementById('streamCheck');
const collectionInfoBtn = document.getElementById('collectionInfoBtn');
const collectionInfo = document.getElementById('collectionInfo');

// File Upload Handlers
if (uploadArea && fileInput) {
    uploadArea.addEventListener('click', () => fileInput.click());

    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            fileInput.files = files;
            handleFileSelect();
        }
    });
}

if (fileInput) {
    fileInput.addEventListener('change', handleFileSelect);
}

function handleFileSelect() {
    if (!fileInput || !fileInfo || !uploadBtn) return;

    const file = fileInput.files[0];
    if (file) {
        fileInfo.textContent = `Selected: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`;
        uploadBtn.disabled = false;
    } else {
        fileInfo.textContent = '';
        uploadBtn.disabled = true;
    }
}

if (uploadBtn) {
    uploadBtn.addEventListener('click', async () => {
        if (!fileInput || !companyIdInput || !uploadStatus) return;

        const file = fileInput.files[0];
        const companyId = companyIdInput.value.trim();

        if (!file) {
            showStatus(uploadStatus, 'Please select a file', 'error');
            return;
        }

        if (!companyId) {
            showStatus(uploadStatus, 'Please enter a company ID', 'error');
            return;
        }

        uploadBtn.disabled = true;
        uploadBtn.innerHTML = 'Uploading... <span class="loading"></span>';
        showStatus(uploadStatus, 'Uploading document...', 'info');

        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch(
                `${API_BASE_URL}/api/v1/process-document?company_id=${encodeURIComponent(companyId)}`,
                {
                    method: 'POST',
                    body: formData
                }
            );

            const data = await response.json();

            if (response.ok) {
                showStatus(uploadStatus, `Success! ${data.chunks_count} chunks created.`, 'success');
                fileInput.value = '';
                if (fileInfo) fileInfo.textContent = '';
                uploadBtn.disabled = true;
            } else {
                showStatus(uploadStatus, `Error: ${data.detail || 'Upload failed'}`, 'error');
            }
        } catch (error) {
            showStatus(uploadStatus, `Error: ${error.message}`, 'error');
        } finally {
            uploadBtn.disabled = false;
            uploadBtn.textContent = 'Upload Document';
        }
    });
}

// Query Handlers
if (queryBtn) {
    queryBtn.addEventListener('click', async () => {
        if (!queryInput || !companyIdInput || !queryStatus || !queryResult) return;

        const query = queryInput.value.trim();
        const companyId = companyIdInput.value.trim();
        const stream = streamCheck ? streamCheck.checked : false;

        if (!query) {
            showStatus(queryStatus, 'Please enter a query', 'error');
            return;
        }

        if (!companyId) {
            showStatus(queryStatus, 'Please enter a company ID', 'error');
            return;
        }

        queryBtn.disabled = true;
        queryBtn.innerHTML = 'Querying... <span class="loading"></span>';
        showStatus(queryStatus, 'Querying documents...', 'info');
        queryResult.classList.remove('show');

        try {
            if (stream) {
                await handleStreamingQuery(companyId, query);
            } else {
                await handleRegularQuery(companyId, query);
            }
        } catch (error) {
            showStatus(queryStatus, `Error: ${error.message}`, 'error');
            queryResult.classList.add('show');
            queryResult.innerHTML = `<pre>Error: ${error.message}</pre>`;
        } finally {
            queryBtn.disabled = false;
            queryBtn.textContent = 'Query';
        }
    });
}

async function handleRegularQuery(companyId, query) {
    if (!queryStatus || !queryResult) return;

    const response = await fetch(`${API_BASE_URL}/api/v1/query`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            company_id: companyId,
            query: query
        })
    });

    const data = await response.json();

    if (response.ok) {
        showStatus(queryStatus, 'Query successful!', 'success');
        displayQueryResult(data);
    } else {
        showStatus(queryStatus, `Error: ${data.detail || 'Query failed'}`, 'error');
        queryResult.classList.add('show');
        queryResult.innerHTML = `<pre>${JSON.stringify(data, null, 2)}</pre>`;
    }
}

async function handleStreamingQuery(companyId, query) {
    if (!queryStatus || !queryResult) return;

    const response = await fetch(`${API_BASE_URL}/api/v1/query/stream`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            company_id: companyId,
            query: query
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Streaming query failed');
    }

    showStatus(queryStatus, 'Streaming response...', 'info');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';

    queryResult.classList.add('show');
    queryResult.innerHTML = '<h3>Response (Streaming):</h3><div class="response-text formatted-response" id="streamingResponse"></div>';
    const streamingDiv = document.getElementById('streamingResponse');

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        fullResponse += chunk;
        if (streamingDiv) {
            streamingDiv.innerHTML = formatResponse(fullResponse);
        }
    }

    showStatus(queryStatus, 'Streaming complete!', 'success');
}

function formatResponse(text) {
    if (!text) return '';

    let lines = text.split('\n');
    let html = '';
    let inList = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const nextLine = i < lines.length - 1 ? lines[i + 1].trim() : '';

        if (line.startsWith('#')) {
            if (inList) {
                html += '</ul>';
                inList = false;
            }
            const level = line.match(/^#+/)[0].length;
            const headerText = line.replace(/^#+\s*/, '');
            html += `<h${Math.min(level, 4)} style="margin-top: 20px; margin-bottom: 10px; color: #667eea; font-weight: 600;">${escapeHtml(headerText)}</h${Math.min(level, 4)}>`;
        }
        else if (line.match(/^\*\*.*\*\*$/) || line.match(/^__.*__$/)) {
            if (inList) {
                html += '</ul>';
                inList = false;
            }
            const boldText = line.replace(/\*\*/g, '').replace(/__/g, '');
            html += `<p style="font-weight: 600; margin: 10px 0; color: #555;"><strong>${escapeHtml(boldText)}</strong></p>`;
        }
        else if (line.match(/^[\*\-\•]\s+/) || line.match(/^\d+\.\s+/)) {
            if (!inList) {
                html += '<ul style="margin: 10px 0; padding-left: 25px; line-height: 1.8;">';
                inList = true;
            }
            const listText = line.replace(/^[\*\-\•]\s+/, '').replace(/^\d+\.\s+/, '');
            const indent = lines[i].match(/^\s*/)[0].length;
            if (indent > 0) {
                html += `<li style="margin-left: ${indent * 20}px; margin-bottom: 8px;">${formatInlineMarkdown(listText)}</li>`;
            } else {
                html += `<li style="margin-bottom: 8px;">${formatInlineMarkdown(listText)}</li>`;
            }
        }
        else if (line === '') {
            if (inList && (nextLine === '' || !nextLine.match(/^[\*\-\•\d]/))) {
                html += '</ul>';
                inList = false;
            }
            html += '<br>';
        }
        else {
            if (inList) {
                html += '</ul>';
                inList = false;
            }
            html += `<p style="margin: 10px 0; line-height: 1.8;">${formatInlineMarkdown(line)}</p>`;
        }
    }

    if (inList) {
        html += '</ul>';
    }

    return html;
}

function formatInlineMarkdown(text) {
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
    text = text.replace(/_(.*?)_/g, '<em>$1</em>');
    text = text.replace(/`(.*?)`/g, '<code style="background: #f4f4f4; padding: 2px 6px; border-radius: 3px; font-family: monospace;">$1</code>');

    return escapeHtml(text);
}

function displayQueryResult(data) {
    if (!queryResult) return;

    queryResult.classList.add('show');
    let html = '<h3>Response:</h3>';
    html += `<div class="response-text formatted-response">${formatResponse(data.response)}</div>`;

    if (data.context_used) {
        html += '<h3 style="margin-top: 25px;">Context Used:</h3>';
        html += `<div class="context-text">${formatResponse(data.context_used)}</div>`;
    }

    queryResult.innerHTML = html;
}

// Collection Info Handler
if (collectionInfoBtn) {
    collectionInfoBtn.addEventListener('click', async () => {
        if (!companyIdInput || !collectionInfo) return;

        const companyId = companyIdInput.value.trim();

        if (!companyId) {
            collectionInfo.classList.add('show');
            collectionInfo.innerHTML = '<pre>Please enter a company ID</pre>';
            return;
        }

        collectionInfoBtn.disabled = true;
        collectionInfoBtn.textContent = 'Loading...';

        try {
            const response = await fetch(`${API_BASE_URL}/api/v1/collections/${encodeURIComponent(companyId)}`);
            const data = await response.json();

            collectionInfo.classList.add('show');
            collectionInfo.innerHTML = `<pre>${JSON.stringify(data, null, 2)}</pre>`;
        } catch (error) {
            collectionInfo.classList.add('show');
            collectionInfo.innerHTML = `<pre>Error: ${error.message}</pre>`;
        } finally {
            collectionInfoBtn.disabled = false;
            collectionInfoBtn.textContent = 'Get Collection Info';
        }
    });
}

// Utility Functions
function showStatus(element, message, type) {
    if (!element) return;

    element.textContent = message;
    element.className = `status-message ${type}`;
    element.style.display = 'block';

    if (type === 'success' || type === 'error') {
        setTimeout(() => {
            element.style.display = 'none';
        }, 5000);
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Enter key for query
if (queryInput && queryBtn) {
    queryInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.ctrlKey) {
            queryBtn.click();
        }
    });
}
