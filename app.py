from flask import Flask, render_template, request, jsonify, send_from_directory
import yt_dlp
import os
import threading
import time
from werkzeug.utils import secure_filename
import sys
import subprocess
from tkinter import Tk, filedialog

app = Flask(__name__)

# --- Configuration ---
app.config['DOWNLOAD_FOLDER'] = 'D:/Universal Video Downloader Downloads'
app.config['ALLOWED_EXTENSIONS'] = {'mp4', 'mp3', 'webm'}
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB

# --- Global Variables ---
download_status = {
    'is_paused': False,
    'is_downloading': False,
    'progress': 0,
    'current_file': None,
    'message': 'Ready to download',
    'title': '',
    'download_thread': None
}

# --- Helper Functions ---
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']

def create_download_folder():
    if not os.path.exists(app.config['DOWNLOAD_FOLDER']):
        os.makedirs(app.config['DOWNLOAD_FOLDER'])
        # Create first run file
        with open(os.path.join(app.config['DOWNLOAD_FOLDER'], 'first_run.txt'), 'w') as f:
            f.write("This file indicates the program was run for the first time.\n")

def get_available_formats():
    return ['Video', 'Audio']

def get_available_qualities():
    return ['144p', '240p', '360p', '480p', '720p', '1080p', '1440p', '2160p']

@app.route('/browse_folder', methods=['GET'])
def browse_folder():
    root = Tk()
    root.withdraw()  # hide the root window
    root.attributes('-topmost', True)  # Make the dialog always on top
    folder_path = filedialog.askdirectory(master=root)
    root.destroy()
    if folder_path:
        return jsonify(success=True, folder=folder_path)
    else:
        return jsonify(success=False)

# --- Download Functions ---
def progress_hook(d):
    if download_status['is_paused']:
        raise Exception("Download paused")
    
    if d['status'] == 'downloading':
        total_bytes = d.get('total_bytes') or d.get('total_bytes_estimate')
        downloaded_bytes = d.get('downloaded_bytes')
        if total_bytes and downloaded_bytes:
            percentage = (downloaded_bytes / total_bytes) * 100
            download_status['progress'] = percentage
            download_status['message'] = f"Downloading... {percentage:.1f}%"
    
    elif d['status'] == 'finished':
        download_status['progress'] = 100
        download_status['message'] = "Finalizing..."
    
    elif d['status'] == 'error':
        download_status['message'] = "Error occurred during download"

def download_video(url, quality, mode, download_folder, platform=None):
    global download_status
    
    try:
        download_status.update({
            'is_downloading': True,
            'is_paused': False,
            'progress': 0,
            'message': 'Starting download...',
            'current_file': None
        })
        
        processed_quality = quality[:-1] if quality.endswith('p') else quality
        
        ydl_opts_base = {
            # 'format_sort': ['res:'+processed_quality, 'ext:mp4:m4a'],  # Not a valid yt-dlp option
            'outtmpl': os.path.join(download_folder, '%(title)s.%(ext)s'),
            'noplaylist': True,
            'progress_hooks': [progress_hook],
            'postprocessors': [],
            'quiet': True,
            'merge_output_format': 'mp4',
            'compat_options': ['no-sabr'],
            'restrictfilenames': True,
        }

        if mode == "Audio":
            ydl_opts = ydl_opts_base.copy()
            ydl_opts['format'] = 'bestaudio/best'
            ydl_opts['postprocessors'].append({
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            })
            ydl_opts['outtmpl'] = os.path.join(download_folder, '%(title)s.mp3')
        else:  # Video
            ydl_opts = ydl_opts_base.copy()

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            filename = ydl.prepare_filename(info)
            if mode == "Audio":
                filename = os.path.splitext(filename)[0] + '.mp3'
            
            download_status['current_file'] = os.path.basename(filename)
            download_status['message'] = "Download complete!"
            download_status['progress'] = 100

    except Exception as e:
        error_message = str(e).splitlines()[0]
        if "Download paused" in error_message:
            download_status['message'] = "Download paused"
        else:
            download_status['message'] = f"Error: {error_message}"
    finally:
        download_status['is_downloading'] = False

# --- Routes ---
@app.route('/')
def index():
    create_download_folder()
    return render_template('index.html', 
                         formats=get_available_formats(),
                         qualities=get_available_qualities(),
                         default_folder=app.config['DOWNLOAD_FOLDER'])

@app.route('/fetch_title', methods=['POST'])
def fetch_title():
    url = request.form.get('url')
    if not url:
        return jsonify({'success': False, 'title': 'Please enter a video URL'})
    
    try:
        with yt_dlp.YoutubeDL({'quiet': True, 'extract_flat': 'in_playlist', 'force_generic_extractor': True}) as ydl:
            info = ydl.extract_info(url, download=False)
            title = info.get('title', 'No title found')
            download_status['title'] = title
            return jsonify({'success': True, 'title': title})
    except Exception as e:
        return jsonify({'success': False, 'title': f'Error fetching title: {str(e)}'})

@app.route('/start_download', methods=['POST'])
def start_download():
    global download_status
    
    url = request.form.get('url')
    quality = request.form.get('quality')
    mode = request.form.get('mode')
    download_folder = request.form.get('download_folder')
    platform = request.form.get('platform')
    
    if not url:
        return jsonify(success=False, message='URL is required')

    if platform != 'other' and platform.lower() not in url.lower():
        return jsonify(success=False, message=f"The URL must be from {platform}.")
    
    if download_status['is_downloading']:
        return jsonify(success=False, message='Another download is already in progress')
    
    download_status['download_thread'] = threading.Thread(
        target=download_video, 
        args=(url, quality, mode, download_folder, platform)
    )
    download_status['download_thread'].start()
    
    return jsonify(success=True)


@app.route('/toggle_pause', methods=['POST'])
def toggle_pause():
    download_status['is_paused'] = not download_status['is_paused']
    if download_status['is_paused']:
        return jsonify({'success': True, 'is_paused': True, 'message': 'Download paused'})
    else:
        return jsonify({'success': True, 'is_paused': False, 'message': 'Download resumed'})

@app.route('/get_status', methods=['GET'])
def get_status():
    return jsonify({
        'is_downloading': download_status['is_downloading'],
        'is_paused': download_status['is_paused'],
        'progress': download_status['progress'],
        'message': download_status['message'],
        'current_file': download_status['current_file'],
        'title': download_status['title']
    })

@app.route('/open_folder', methods=['POST'])
def open_folder():
    folder_path = request.form.get('folder_path', app.config['DOWNLOAD_FOLDER'])
    if not os.path.isdir(folder_path):
        return jsonify({'success': False, 'message': 'Folder not found'})
    
    try:
        if os.name == 'nt':  # Windows
            os.startfile(folder_path)
        elif os.name == 'posix':  # macOS and Linux
            if sys.platform == 'darwin':
                subprocess.run(['open', folder_path])
            else:
                subprocess.run(['xdg-open', folder_path])
        return jsonify({'success': True, 'message': 'Folder opened'})
    except Exception as e:
        return jsonify({'success': False, 'message': f'Could not open folder: {str(e)}'})

@app.route('/downloads/<filename>')
def download_file(filename):
    return send_from_directory(app.config['DOWNLOAD_FOLDER'], filename, as_attachment=True)

# --- Main ---
if __name__ == '__main__':
    create_download_folder()
    app.run(debug=True)