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
    const clipboardBtn = document.getElementById('clipboardBtn');
    const instagramGallery = document.getElementById('instagram-gallery');
    const mediaGrid = document.getElementById('mediaGrid');
    const downloadAllMedia = document.getElementById('downloadAllMedia');
    const downloadSelectedMedia = document.getElementById('downloadSelectedMedia');
    const selectedCountSpan = document.getElementById('selectedCount');
    const mediaCountBadge = document.getElementById('mediaCount');

    let currentFile = null;
    let currentThumbnailUrl = null;
    let instagramMediaItems = [];
    let selectedMediaIndices = new Set();

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
        hideInstagramGallery();
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

    function hideInstagramGallery() {
        if (instagramGallery) {
            instagramGallery.style.display = 'none';
            mediaGrid.innerHTML = '';
            instagramMediaItems = [];
            selectedMediaIndices.clear();
        }
    }

    function showInstagramGallery(mediaItems) {
        if (!instagramGallery) return;
        
        instagramMediaItems = mediaItems;
        mediaGrid.innerHTML = '';
        selectedMediaIndices.clear();
        
        mediaCountBadge.textContent = `${mediaItems.length} item${mediaItems.length > 1 ? 's' : ''}`;
        
        mediaItems.forEach((media, index) => {
            const mediaItem = document.createElement('div');
            mediaItem.className = 'media-item';
            mediaItem.dataset.index = index;
            
            const mediaElement = media.is_video ? 
                `<video src="${media.url}" muted></video>` :
                `<img src="${media.url}" alt="Instagram Media ${index + 1}">`;
            
            mediaItem.innerHTML = `
                ${mediaElement}
                <div class="media-overlay"></div>
                <span class="media-type-badge ${media.type}">${media.type.toUpperCase()}</span>
                <input type="checkbox" class="select-checkbox" data-index="${index}">
                <button class="download-single-btn" data-index="${index}">
                    <i class="fas fa-download"></i>
                </button>
            `;
            
            // Toggle selection on click
            mediaItem.addEventListener('click', (e) => {
                if (!e.target.classList.contains('download-single-btn') && 
                    !e.target.classList.contains('select-checkbox') &&
                    !e.target.closest('.download-single-btn')) {
                    toggleMediaSelection(index);
                }
            });
            
            // Checkbox change
            const checkbox = mediaItem.querySelector('.select-checkbox');
            checkbox.addEventListener('change', (e) => {
                e.stopPropagation();
                toggleMediaSelection(index);
            });
            
            // Single download button
            const downloadBtn = mediaItem.querySelector('.download-single-btn');
            downloadBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                downloadSingleMedia(index);
            });
            
            mediaGrid.appendChild(mediaItem);
        });
        
        instagramGallery.style.display = 'block';
        updateSelectedCount();
    }

    function toggleMediaSelection(index) {
        if (selectedMediaIndices.has(index)) {
            selectedMediaIndices.delete(index);
        } else {
            selectedMediaIndices.add(index);
        }
        
        const mediaItem = mediaGrid.querySelector(`[data-index="${index}"]`);
        const checkbox = mediaItem.querySelector('.select-checkbox');
        
        if (selectedMediaIndices.has(index)) {
            mediaItem.classList.add('selected');
            checkbox.checked = true;
        } else {
            mediaItem.classList.remove('selected');
            checkbox.checked = false;
        }
        
        updateSelectedCount();
    }

    function updateSelectedCount() {
        const count = selectedMediaIndices.size;
        selectedCountSpan.textContent = count;
        downloadSelectedMedia.style.display = count > 0 ? 'inline-block' : 'none';
    }

    function downloadSingleMedia(index) {
        const media = instagramMediaItems[index];
        updateStatus(`Downloading ${media.type}...`, 'info');
        
        fetch('/download_instagram_single', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `media_url=${encodeURIComponent(media.url)}&media_type=${media.type}&download_folder=${encodeURIComponent(downloadFolder.value)}`
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                updateStatus(data.message, 'success');
                addDownloadToHistory(`Instagram ${media.type}`, data.filename);
            } else {
                updateStatus(data.message, 'error');
            }
        })
        .catch(error => {
            updateStatus('Error downloading media', 'error');
            console.error('Error:', error);
        });
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
        
        // Check if it's an Instagram URL
        const isInstagram = videoUrl.value.includes('instagram.com');
        const endpoint = isInstagram ? '/fetch_instagram_info' : '/fetch_title';
        
        fetch(endpoint, {
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
                
                // Show Instagram gallery if it's a carousel or has multiple media
                if (isInstagram && data.media_items && data.media_items.length > 0) {
                    showInstagramGallery(data.media_items);
                } else {
                    hideInstagramGallery();
                }
            } else {
                updateStatus(data.title || data.message || 'Error fetching title', 'error');
                hideInstagramGallery();
            }
        })
        .catch(error => {
            updateStatus('Error fetching title', 'error');
            console.error('Error:', error);
            hideInstagramGallery();
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
        
        // Check if it's an Instagram URL
        const isInstagram = videoUrl.value.includes('instagram.com');
        
        if (isInstagram) {
            // Handle Instagram download separately
            downloadBtn.disabled = true;
            showFolderBtn.disabled = true;
            updateStatus('Downloading from Instagram...', 'info');
            
            fetch('/download_instagram', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: `url=${encodeURIComponent(videoUrl.value)}&download_folder=${encodeURIComponent(downloadFolder.value)}`
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    updateStatus(data.message, 'success');
                    showFolderBtn.disabled = false;
                    if (data.files && data.files.length > 0) {
                        addDownloadToHistory(data.caption || 'Instagram Post', data.files[0]);
                    }
                } else {
                    updateStatus(data.message, 'error');
                }
                downloadBtn.disabled = false;
            })
            .catch(error => {
                updateStatus('Error downloading from Instagram', 'error');
                console.error('Error:', error);
                downloadBtn.disabled = false;
            });
        } else {
            // Handle regular download (YouTube, etc.)
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
        }
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

    clipboardBtn.addEventListener('click', async () => {
        try {
            const text = await navigator.clipboard.readText();
            videoUrl.value = text;
            clearUrlBtn.style.display = 'block';
        } catch (err) {
            console.error('Failed to read clipboard contents: ', err);
            alert('Unable to access clipboard. Please check your browser permissions.');
        }
    });

    // Instagram Gallery - Download All
    if (downloadAllMedia) {
        downloadAllMedia.addEventListener('click', function() {
            if (instagramMediaItems.length === 0) return;
            
            downloadBtn.disabled = true;
            showFolderBtn.disabled = true;
            updateStatus('Downloading all media from Instagram...', 'info');
            
            fetch('/download_instagram', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: `url=${encodeURIComponent(videoUrl.value)}&download_folder=${encodeURIComponent(downloadFolder.value)}`
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    updateStatus(data.message, 'success');
                    showFolderBtn.disabled = false;
                    if (data.files && data.files.length > 0) {
                        addDownloadToHistory(data.caption || 'Instagram Post', data.files[0]);
                    }
                } else {
                    updateStatus(data.message, 'error');
                }
                downloadBtn.disabled = false;
            })
            .catch(error => {
                updateStatus('Error downloading from Instagram', 'error');
                console.error('Error:', error);
                downloadBtn.disabled = false;
            });
        });
    }

    // Instagram Gallery - Download Selected
    if (downloadSelectedMedia) {
        downloadSelectedMedia.addEventListener('click', function() {
            if (selectedMediaIndices.size === 0) return;
            
            updateStatus(`Downloading ${selectedMediaIndices.size} selected media...`, 'info');
            
            let completed = 0;
            let failed = 0;
            
            selectedMediaIndices.forEach(index => {
                const media = instagramMediaItems[index];
                
                fetch('/download_instagram_single', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: `media_url=${encodeURIComponent(media.url)}&media_type=${media.type}&download_folder=${encodeURIComponent(downloadFolder.value)}`
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        completed++;
                        addDownloadToHistory(`Instagram ${media.type}`, data.filename);
                    } else {
                        failed++;
                    }
                    
                    // Update status after all downloads complete
                    if (completed + failed === selectedMediaIndices.size) {
                        if (failed === 0) {
                            updateStatus(`Successfully downloaded ${completed} media files!`, 'success');
                            showFolderBtn.disabled = false;
                        } else {
                            updateStatus(`Downloaded ${completed} files, ${failed} failed`, 'warning');
                        }
                        
                        // Clear selection
                        selectedMediaIndices.clear();
                        document.querySelectorAll('.media-item').forEach(item => {
                            item.classList.remove('selected');
                            item.querySelector('.select-checkbox').checked = false;
                        });
                        updateSelectedCount();
                    }
                })
                .catch(error => {
                    failed++;
                    console.error('Error:', error);
                });
            });
        });
    }

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
        
        // Show/hide metadata info for Audio downloads
        const metadataInfo = document.getElementById('metadata-info');
        if (metadataInfo) {
            if (formatSelect.value === 'Audio') {
                metadataInfo.style.display = 'block';
            } else {
                metadataInfo.style.display = 'none';
            }
        }
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