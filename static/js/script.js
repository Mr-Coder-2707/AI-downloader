document.addEventListener('DOMContentLoaded', function() {
    const videoUrl = document.getElementById('videoUrl');
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
    
    let currentFile = null;
    let isDarkMode = false;

    // Function to check if the device is mobile
    function isMobileDevice() {
        const userAgent = navigator.userAgent || navigator.vendor || window.opera;
        // Checks for specific mobile user agents
        return /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
    }

    // Hide folder selection on mobile devices
    if (isMobileDevice()) {
        const downloadFolderContainer = document.getElementById('downloadFolderContainer');
        if (downloadFolderContainer) {
            downloadFolderContainer.style.display = 'none';
        }
    }
    
    // Theme toggle
    themeToggle.addEventListener('click', function() {
        isDarkMode = !isDarkMode;
        if (isDarkMode) {
            body.classList.add('dark-mode');
            themeToggle.innerHTML = '<i class="bi bi-sun-fill"></i>';
        } else {
            body.classList.remove('dark-mode');
            themeToggle.innerHTML = '<i class="bi bi-moon-fill"></i>';
        }
    });
    
    // Fetch title
    fetchTitleBtn.addEventListener('click', function() {
        if (!videoUrl.value.trim()) {
            updateStatus('Please enter a video URL', 'error');
            return;
        }
        
        fetchTitleBtn.disabled = true;
        fetchTitleBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Fetching...';
        
        fetch('/fetch_title', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `url=${encodeURIComponent(videoUrl.value)}`
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                titleDisplay.innerHTML = `<i class="bi bi-camera-reels"></i> ${data.title}`;
                updateStatus('Title fetched successfully', 'success');
            } else {
                titleDisplay.innerHTML = `<i class="bi bi-exclamation-triangle"></i> ${data.title}`;
                updateStatus('Error fetching title', 'error');
            }
        })
        .catch(error => {
            titleDisplay.innerHTML = '<i class="bi bi-exclamation-triangle"></i> Error fetching title';
            updateStatus('Error fetching title', 'error');
            console.error('Error:', error);
        })
        .finally(() => {
            fetchTitleBtn.disabled = false;
            fetchTitleBtn.innerHTML = '<i class="bi bi-search"></i> Fetch Title';
        });
    });
    
    // Browse folder
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
    
    // Start download
    downloadBtn.addEventListener('click', function() {
        if (!videoUrl.value.trim()) {
            updateStatus('Please enter a video URL', 'error');
            return;
        }
        
        downloadBtn.disabled = true;
        pauseBtn.disabled = false;
        showFolderBtn.disabled = true;
        
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
    
    // Pause/resume download
    pauseBtn.addEventListener('click', function() {
        fetch('/toggle_pause', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            }
        })
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
        })
        .catch(error => {
            console.error('Error:', error);
        });
    });
    
    // Show in folder
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
        })
        .catch(error => {
            console.error('Error:', error);
        });
    });
    
    // Check download status
    function checkDownloadStatus() {
        fetch('/get_status')
        .then(response => response.json())
        .then(data => {
            progressBar.style.width = `${data.progress}%`;
            progressBar.textContent = `${Math.round(data.progress)}%`;
            
            if (data.message) {
                updateStatus(data.message, 'info');
            }
            
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
    
    // Update status message
    function updateStatus(message, type = 'info') {
        let icon = '';
        switch(type) {
            case 'error':
                icon = '<i class="bi bi-exclamation-triangle"></i>';
                break;
            case 'success':
                icon = '<i class="bi bi-check-circle"></i>';
                break;
            case 'warning':
                icon = '<i class="bi bi-exclamation-circle"></i>';
                break;
            default:
                icon = '<i class="bi bi-info-circle"></i>';
        }
        
        statusMessage.innerHTML = `${icon} ${message}`;
    }
    
    // Disable quality select when audio is selected
    formatSelect.addEventListener('change', function() {
        qualitySelect.disabled = formatSelect.value === 'Audio';
    });
});

// Theme persistence and toggle
const themeToggle = document.getElementById('themeToggle');
const body = document.body;
const moonIcon = 'bi-moon-fill';
const sunIcon = 'bi-sun-fill';

// Function to set the theme
function setTheme(theme) {
    if (theme === 'dark') {
        body.classList.add('dark-mode');
        themeToggle.innerHTML = `<i class="bi ${sunIcon}"></i>`;
    } else {
        body.classList.remove('dark-mode');
        themeToggle.innerHTML = `<i class="bi ${moonIcon}"></i>`;
    }
}

// Check for saved theme in localStorage
const savedTheme = localStorage.getItem('theme');
if (savedTheme) {
    setTheme(savedTheme);
}

themeToggle.addEventListener('click', () => {
    if (body.classList.contains('dark-mode')) {
        localStorage.setItem('theme', 'light');
        setTheme('light');
    } else {
        localStorage.setItem('theme', 'dark');
        setTheme('dark');
    }
});

// Loader logic
const startTime = Date.now();
window.addEventListener('load', function() {
    const loader = document.querySelector('.hourglassBackground');
    const elapsedTime = Date.now() - startTime;
    const minDisplayTime = 2000; // Minimum display time in milliseconds

    const hideLoader = () => {
        loader.style.display = 'none';
    };

    if (elapsedTime < minDisplayTime) {
        setTimeout(hideLoader, minDisplayTime - elapsedTime);
    } else {
        hideLoader();
    }
});