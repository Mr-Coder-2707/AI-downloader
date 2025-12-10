document.addEventListener('DOMContentLoaded', function() {
    const videoUrl = document.getElementById('videoUrl');
    const clearUrlBtn = document.getElementById('clearUrlBtn');
    const urlInputContainer = document.getElementById('url-input-container');
    const fetchTitleBtn = document.getElementById('fetchTitleBtn');
    const titleDisplay = document.getElementById('titleDisplay');
    const platformSelect = document.getElementById('platformSelect');
    const formatSelect = document.getElementById('formatSelect');
    const qualitySelect = document.getElementById('qualitySelect');
    const downloadFolder = document.getElementById('downloadFolder');
    const browseFolderBtn = document.getElementById('browseFolderBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const pauseBtn = document.getElementById('pauseBtn');
    const showFolderBtn = document.getElementById('showFolderBtn');
    const progressBar = document.getElementById('progressBar');
    const statusMessage = document.getElementById('statusMessage');
    const themeToggle = document.getElementById('themeToggle');
    const body = document.body;
    const thumbnailPreview = document.getElementById('thumbnailPreview');
    const downloadThumbnailBtn = document.getElementById('downloadThumbnailBtn');
    const videoInfo = document.getElementById('video-info');
    const progressContainer = document.querySelector('.progress');
    const downloadHistory = document.getElementById('downloadHistory');

    let currentFile = null;
    let currentThumbnailUrl = null;

    // --- Theme Management ---
    function setTheme(theme) {
        if (theme === 'dark') {
            body.classList.add('dark-mode');
            themeToggle.innerHTML = `<i class="bi bi-sun-fill"></i>`;
        } else {
            body.classList.remove('dark-mode');
            themeToggle.innerHTML = `<i class="bi bi-moon-fill"></i>`;
        }
    }

    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        setTheme(savedTheme);
    }

    themeToggle.addEventListener('click', () => {
        const newTheme = body.classList.contains('dark-mode') ? 'light' : 'dark';
        localStorage.setItem('theme', newTheme);
        setTheme(newTheme);
    });

    // --- URL Input Management ---
    videoUrl.addEventListener('input', function() {
        clearUrlBtn.style.display = videoUrl.value ? 'block' : 'none';
    });

    clearUrlBtn.addEventListener('click', function() {
        videoUrl.value = '';
        clearUrlBtn.style.display = 'none';
        hideVideoInfo();
    });

    // --- Drag and Drop ---
    urlInputContainer.addEventListener('dragover', (e) => {
        e.preventDefault();
        urlInputContainer.classList.add('drag-over');
    });

    urlInputContainer.addEventListener('dragleave', () => {
        urlInputContainer.classList.remove('drag-over');
    });

    urlInputContainer.addEventListener('drop', (e) => {
        e.preventDefault();
        urlInputContainer.classList.remove('drag-over');
        const text = e.dataTransfer.getData('text/plain');
        videoUrl.value = text;
        clearUrlBtn.style.display = 'block';
        fetchTitleBtn.click(); // Automatically fetch title on drop
    });

    // --- UI Updates ---
    function updateStatus(message, type = 'info') {
        statusMessage.textContent = message;
        // You can add classes for different message types (e.g., text-danger for errors)
    }

    function showVideoInfo(title, thumbnailUrl) {
        titleDisplay.textContent = title;
        thumbnailPreview.src = thumbnailUrl;
        videoInfo.style.display = 'block';
        currentThumbnailUrl = thumbnailUrl;
    }

    function hideVideoInfo() {
        videoInfo.style.display = 'none';
    }

    function setProgress(percentage) {
        progressContainer.style.display = 'block';
        progressBar.style.width = `${percentage}%`;
        progressBar.textContent = `${Math.round(percentage)}%`;
    }

    function hideProgress() {
        progressContainer.style.display = 'none';
        setProgress(0);
    }

    // --- API Calls ---
    fetchTitleBtn.addEventListener('click', function() {
        if (!videoUrl.value.trim()) {
            updateStatus('Please enter a video URL', 'error');
            return;
        }
        
        fetchTitleBtn.disabled = true;
        fetchTitleBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Fetching...';
        hideVideoInfo();
        
        fetch('/fetch_title', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `url=${encodeURIComponent(videoUrl.value)}`
        })
        .then(response => response.json())
        .then(data => {
            if (data.success && data.thumbnail) {
                showVideoInfo(data.title, data.thumbnail);
                updateStatus('Title fetched successfully', 'success');
            } else {
                updateStatus(data.title || 'Error fetching title', 'error');
            }
        })
        .catch(error => {
            updateStatus('Error fetching title', 'error');
            console.error('Error:', error);
        })
        .finally(() => {
            fetchTitleBtn.disabled = false;
            fetchTitleBtn.innerHTML = '<i class="fas fa-search me-1"></i> Fetch';
        });
    });

    downloadThumbnailBtn.addEventListener('click', function() {
        if (!currentThumbnailUrl) {
            updateStatus('No thumbnail to download', 'error');
            return;
        }

        // Use the server-side proxy to download the thumbnail
        const downloadUrl = `/download_thumbnail_proxy?url=${encodeURIComponent(currentThumbnailUrl)}`;
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = 'thumbnail.jpg'; // The filename for the user
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        updateStatus('Thumbnail download started', 'success');
    });

    browseFolderBtn.addEventListener('click', function() {
        fetch('/browse_folder')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                downloadFolder.value = data.folder;
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Could not open folder browser.');
        });
    });

    downloadBtn.addEventListener('click', function() {
        if (!videoUrl.value.trim()) {
            updateStatus('Please enter a video URL', 'error');
            return;
        }
        
        downloadBtn.disabled = true;
        pauseBtn.disabled = false;
        showFolderBtn.disabled = true;
        hideProgress();
        
        fetch('/start_download', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `url=${encodeURIComponent(videoUrl.value)}&quality=${qualitySelect.value}&mode=${formatSelect.value}&download_folder=${encodeURIComponent(downloadFolder.value)}&platform=${platformSelect.value}`
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                updateStatus('Download started', 'info');
                checkDownloadStatus();
            } else {
                updateStatus(data.message, 'error');
                downloadBtn.disabled = false;
                pauseBtn.disabled = true;
            }
        })
        .catch(error => {
            updateStatus('Error starting download', 'error');
            console.error('Error:', error);
            downloadBtn.disabled = false;
            pauseBtn.disabled = true;
        });
    });

    pauseBtn.addEventListener('click', function() {
        fetch('/toggle_pause', { method: 'POST' })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                if (data.is_paused) {
                    pauseBtn.innerHTML = '<i class="bi bi-play-fill"></i> Resume';
                    updateStatus('Download paused', 'warning');
                } else {
                    pauseBtn.innerHTML = '<i class="bi bi-pause-fill"></i> Pause';
                    updateStatus('Download resumed', 'info');
                }
            }
        });
    });

    showFolderBtn.addEventListener('click', function() {
        fetch('/open_folder', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `folder_path=${encodeURIComponent(downloadFolder.value)}`
        })
        .then(response => response.json())
        .then(data => {
            if (!data.success) {
                alert(data.message);
            }
        });
    });

    function checkDownloadStatus() {
        fetch('/get_status')
        .then(response => response.json())
        .then(data => {
            setProgress(data.progress);
            updateStatus(data.message, 'info');

            if (data.is_paused) {
                pauseBtn.innerHTML = '<i class="bi bi-play-fill"></i> Resume';
            } else {
                pauseBtn.innerHTML = '<i class="bi bi-pause-fill"></i> Pause';
            }

            if (data.current_file) {
                currentFile = data.current_file;
                showFolderBtn.disabled = false;
            }

            if (data.is_downloading) {
                setTimeout(checkDownloadStatus, 1000);
            } else {
                downloadBtn.disabled = false;
                pauseBtn.disabled = true;
                if (data.progress === 100) {
                    showFolderBtn.disabled = false;
                    updateStatus('Download complete!', 'success');
                    addDownloadToHistory(data.title, data.current_file);
                    setTimeout(hideProgress, 3000);
                }
            }
        })
        .catch(error => {
            console.error('Error:', error);
            downloadBtn.disabled = false;
            pauseBtn.disabled = true;
            setTimeout(checkDownloadStatus, 2000);
        });
    }

    // --- Download History ---
    function renderDownloadHistory() {
        const history = JSON.parse(localStorage.getItem('downloadHistory')) || [];
        downloadHistory.innerHTML = '';
        if (history.length === 0) {
            downloadHistory.innerHTML = '<li class="list-group-item">No downloads yet.</li>';
            return;
        }
        history.forEach(item => {
            const li = document.createElement('li');
            li.className = 'list-group-item d-flex justify-content-between align-items-center';
            li.innerHTML = `
                <span>${item.title}</span>
                <small class="text-muted">${new Date(item.date).toLocaleString()}</small>
            `;
            downloadHistory.appendChild(li);
        });
    }

    function addDownloadToHistory(title, filename) {
        const history = JSON.parse(localStorage.getItem('downloadHistory')) || [];
        const newEntry = {
            title: title || 'Untitled',
            filename: filename,
            date: new Date().toISOString()
        };
        history.unshift(newEntry); // Add to the beginning
        if (history.length > 10) { // Keep history to a reasonable size
            history.pop();
        }
        localStorage.setItem('downloadHistory', JSON.stringify(history));
        renderDownloadHistory();
    }

    formatSelect.addEventListener('change', function() {
        qualitySelect.disabled = formatSelect.value === 'Audio';
    });

    // Hide folder selection on mobile devices
    if (/Mobi|Android/i.test(navigator.userAgent)) {
        const downloadFolderContainer = document.getElementById('downloadFolderContainer');
        if (downloadFolderContainer) {
            downloadFolderContainer.style.display = 'none';
        }
    }

    // Initial render
    renderDownloadHistory();
});

// Loader logic
window.addEventListener('load', function() {
    const loaderOverlay = document.getElementById('loader-overlay');
    if (loaderOverlay) {
        // Add a short delay before hiding to ensure animations are smooth
        setTimeout(() => {
            loaderOverlay.classList.add('hidden');
        }, 200); // 200ms delay
    }
});