from flask import Flask, render_template, request, jsonify, send_from_directory, Response
import yt_dlp
import os
import threading
import time
from werkzeug.utils import secure_filename
import sys
import subprocess
import requests
import uuid
import shutil
from mutagen.mp3 import MP3
from mutagen.id3 import ID3, APIC, TIT2, TPE1, TALB, TDRC, TCON, TRCK, TPE2, TPE3
from mutagen.id3._util import ID3NoHeaderError
from mutagen import File
import io
import instaloader
import re

app = Flask(__name__, 
            template_folder='../templates',
            static_folder='../static')

# --- Configuration for Vercel ---
# Use /tmp for Vercel serverless environment
TEMP_FOLDER = os.environ.get('VERCEL_TMP', '/tmp') if os.environ.get('VERCEL') else os.path.join(os.getcwd(), 'downloads')
app.config['DOWNLOAD_FOLDER'] = TEMP_FOLDER
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

# Generate a unique ID for the device
def get_device_id():
    try:
        device_id_file = os.path.join(app.config['DOWNLOAD_FOLDER'], 'device_id.txt')
        if not os.path.exists(device_id_file):
            device_id = str(uuid.uuid4())
            try:
                os.makedirs(os.path.dirname(device_id_file), exist_ok=True)
                with open(device_id_file, 'w') as f:
                    f.write(device_id)
            except:
                pass  # If we can't write, just use the generated ID
        else:
            with open(device_id_file, 'r') as f:
                device_id = f.read().strip()
        return device_id
    except:
        return str(uuid.uuid4())

DEVICE_ID = get_device_id()

# --- Helper Functions ---
def get_ffmpeg_location():
    """
    Find ffmpeg location - on Vercel it should be in PATH
    """
    ffmpeg_path = shutil.which('ffmpeg')
    if ffmpeg_path:
        return os.path.dirname(ffmpeg_path)
    return None

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']

def secure_path(path):
    # Normalize the path to resolve any ".." components
    normalized_path = os.path.normpath(path)
    # Check if the path is within the intended download directory
    if os.path.commonprefix((normalized_path, os.path.abspath(app.config['DOWNLOAD_FOLDER']))) != os.path.abspath(app.config['DOWNLOAD_FOLDER']):
        raise ValueError("Invalid download path specified.")
    return normalized_path

def create_download_folder():
    try:
        if not os.path.exists(app.config['DOWNLOAD_FOLDER']):
            os.makedirs(app.config['DOWNLOAD_FOLDER'], exist_ok=True)
    except Exception as e:
        print(f"Could not create download folder: {e}")

def get_available_formats():
    return ['Video', 'Audio']

def get_available_qualities():
    return ['144p', '240p', '360p', '480p', '720p', '1080p', '1440p', '2160p']

def add_metadata_to_audio(file_path, video_info, thumbnail_data=None):
    """
    Add metadata to audio file using information from video_info
    """
    try:
        # Load the audio file
        audio_file = MP3(file_path, ID3=ID3)
        
        # Try to load existing tags, if not create new ones
        try:
            audio_file.add_tags()
        except ID3NoHeaderError:
            pass
        
        # Extract information from video_info
        title = video_info.get('title', '')
        uploader = video_info.get('uploader', '') or video_info.get('artist', '') or video_info.get('creator', '')
        album = video_info.get('album', '') or video_info.get('playlist_title', '') or uploader
        upload_date = video_info.get('upload_date', '')
        description = video_info.get('description', '')
        
        # Format upload date
        if upload_date and len(upload_date) >= 4:
            year = upload_date[:4]
        else:
            year = ''
        
        # Set basic metadata
        if title:
            audio_file.tags.add(TIT2(encoding=3, text=title))
        
        if uploader:
            audio_file.tags.add(TPE1(encoding=3, text=uploader))
            audio_file.tags.add(TPE2(encoding=3, text=uploader))
        
        if album:
            audio_file.tags.add(TALB(encoding=3, text=album))
        
        if year:
            audio_file.tags.add(TDRC(encoding=3, text=year))
        
        genre = determine_genre(title, description)
        if genre:
            audio_file.tags.add(TCON(encoding=3, text=genre))
        
        audio_file.tags.add(TRCK(encoding=3, text="1"))
        
        if thumbnail_data:
            audio_file.tags.add(APIC(
                encoding=3,
                mime='image/jpeg',
                type=3,
                desc='Cover',
                data=thumbnail_data
            ))
        
        audio_file.save()
        print(f"✅ Metadata added to: {file_path}")
        
    except Exception as e:
        print(f"❌ Error adding metadata to {file_path}: {str(e)}")

def determine_genre(title, description):
    """
    Try to determine genre based on title and description
    """
    title_lower = title.lower() if title else ''
    desc_lower = description.lower() if description else ''
    
    if any(word in title_lower or word in desc_lower for word in ['أغنية', 'أغاني', 'موسيقى', 'مهرجان', 'شعبي']):
        return 'Arabic Pop'
    elif any(word in title_lower or word in desc_lower for word in ['راب', 'rap', 'hip hop']):
        return 'Arabic Rap'
    elif any(word in title_lower or word in desc_lower for word in ['كلاسيكي', 'طرب', 'أم كلثوم', 'فيروز']):
        return 'Arabic Classical'
    elif any(word in title_lower or word in desc_lower for word in ['مهرجان', 'شعبي']):
        return 'Mahraganat'
    elif any(word in title_lower or word in desc_lower for word in ['pop', 'بوب']):
        return 'Pop'
    elif any(word in title_lower or word in desc_lower for word in ['rock', 'روك']):
        return 'Rock'
    elif any(word in title_lower or word in desc_lower for word in ['jazz', 'جاز']):
        return 'Jazz'
    elif any(word in title_lower or word in desc_lower for word in ['classical', 'كلاسيكي']):
        return 'Classical'
    else:
        return 'Music'

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
        
        if download_status.get('title'):
            sanitized_title = secure_filename(download_status['title'])
            outtmpl_path = os.path.join(download_folder, f'{sanitized_title}.%(ext)s')
        else:
            outtmpl_path = os.path.join(download_folder, '%(title)s.%(ext)s')

        ydl_opts_base = {
            'outtmpl': outtmpl_path,
            'noplaylist': True,
            'progress_hooks': [progress_hook],
            'postprocessors': [],
            'quiet': True,
            'merge_output_format': 'mp4',
            'compat_options': ['no-sabr'],
            'restrictfilenames': True,
            'writeinfojson': True,
        }
        
        ffmpeg_location = get_ffmpeg_location()
        if ffmpeg_location:
            ydl_opts_base['ffmpeg_location'] = ffmpeg_location
            print(f"🎯 Using ffmpeg from: {ffmpeg_location}")

        if mode == "Audio":
            ydl_opts = ydl_opts_base.copy()
            ydl_opts['format'] = 'bestaudio/best'
            ydl_opts['writethumbnail'] = True
            ydl_opts['postprocessors'].append({
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            })
            ydl_opts['postprocessors'].append({
                'key': 'EmbedThumbnail',
            })
            if download_status.get('title'):
                sanitized_title = secure_filename(download_status['title'])
                ydl_opts['outtmpl'] = os.path.join(download_folder, f'{sanitized_title}.mp3')
            else:
                ydl_opts['outtmpl'] = os.path.join(download_folder, '%(title)s.mp3')
        else:
            ydl_opts = ydl_opts_base.copy()

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            download_status['message'] = 'Extracting video information...'
            info = ydl.extract_info(url, download=True)
            filename = ydl.prepare_filename(info)
            
            if mode == "Audio":
                base_filename = os.path.splitext(filename)[0]
                mp3_filename = base_filename + '.mp3'
                
                possible_files = [
                    mp3_filename,
                    filename.replace('.webm', '.mp3').replace('.m4a', '.mp3'),
                    os.path.join(download_folder, os.path.basename(base_filename) + '.mp3')
                ]
                
                actual_file = None
                for possible_file in possible_files:
                    if os.path.exists(possible_file):
                        actual_file = possible_file
                        break
                
                if actual_file:
                    filename = actual_file
                    download_status['message'] = 'Adding metadata...'
                    
                    thumbnail_data = None
                    if info.get('thumbnail'):
                        try:
                            thumbnail_response = requests.get(info['thumbnail'], timeout=10)
                            if thumbnail_response.status_code == 200:
                                thumbnail_data = thumbnail_response.content
                        except Exception as e:
                            print(f"⚠️ Could not download thumbnail: {e}")
                    
                    add_metadata_to_audio(filename, info, thumbnail_data)
                    
                    info_json_path = os.path.splitext(filename)[0] + '.info.json'
                    if os.path.exists(info_json_path):
                        os.remove(info_json_path)
            
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

@app.route('/download_thumbnail_proxy')
def download_thumbnail_proxy():
    thumbnail_url = request.args.get('url')
    if not thumbnail_url:
        return "Missing URL parameter", 400

    try:
        response = requests.get(thumbnail_url, stream=True)
        response.raise_for_status()

        content_type = response.headers.get('content-type', 'image/jpeg')

        return Response(response.iter_content(chunk_size=8192),
                        content_type=content_type,
                        headers={"Content-Disposition": "attachment; filename=thumbnail.jpg"})

    except requests.exceptions.RequestException as e:
        return str(e), 500

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
        return jsonify({'success': False, 'title': 'Please enter a video URL', 'thumbnail': None})
    
    try:
        with yt_dlp.YoutubeDL({'quiet': True, 'extract_flat': 'in_playlist', 'force_generic_extractor': True}) as ydl:
            info = ydl.extract_info(url, download=False)
            title = info.get('title', 'No title found')
            thumbnail = info.get('thumbnail', None)
            download_status['title'] = title
            return jsonify({'success': True, 'title': title, 'thumbnail': thumbnail})
    except Exception as e:
        return jsonify({'success': False, 'title': f'Error fetching title: {str(e)}', 'thumbnail': None})

@app.route('/start_download', methods=['POST'])
def start_download():
    global download_status
    
    url = request.form.get('url')
    quality = request.form.get('quality')
    mode = request.form.get('mode')
    download_folder = request.form.get('download_folder', app.config['DOWNLOAD_FOLDER'])
    platform = request.form.get('platform')
    
    if not url:
        return jsonify(success=False, message='URL is required')

    try:
        download_folder = secure_path(download_folder)
    except ValueError as e:
        return jsonify(success=False, message=str(e))

    if platform != 'other':
        try:
            with yt_dlp.YoutubeDL({'quiet': True, 'extract_flat': 'in_playlist', 'force_generic_extractor': True}) as ydl:
                info = ydl.extract_info(url, download=False)
                extractor = info.get('extractor_key', '').lower()
                if platform.lower() not in extractor:
                    return jsonify(success=False, message=f"The URL is not a valid {platform} link.")
        except Exception as e:
            return jsonify(success=False, message=f"Error verifying URL: {str(e)}")

    if download_status['is_downloading']:
        return jsonify(success=False, message='Another download is already in progress')
    
    download_status['download_thread'] = threading.Thread(
        target=download_video, 
        args=(url, quality, mode, download_folder, platform)
    )
    download_status['download_thread'].start()
    
    return jsonify(success=True)


@app.route('/download_thumbnail', methods=['POST'])
def download_thumbnail():
    url = request.form.get('url')
    download_folder = request.form.get('download_folder', app.config['DOWNLOAD_FOLDER'])

    if not url:
        return jsonify(success=False, message='URL is required')

    try:
        ydl_opts = {
            'writethumbnail': True,
            'skip_download': True,
            'outtmpl': os.path.join(download_folder, '%(title)s.%(ext)s'),
            'quiet': True,
            'postprocessors': [{
                'key': 'FFmpegThumbnailsConvertor',
                'format': 'jpg',
            }],
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.extract_info(url, download=True)
        
        return jsonify(success=True, message='Thumbnail downloaded successfully!')
    except Exception as e:
        return jsonify(success=False, message=f'Error downloading thumbnail: {str(e)}')


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
    # This won't work on Vercel, but keep for local development
    folder_path = request.form.get('folder_path', app.config['DOWNLOAD_FOLDER'])
    return jsonify({'success': False, 'message': 'Opening folders is not supported in serverless environment'})

@app.route('/downloads/<filename>')
def download_file(filename):
    return send_from_directory(app.config['DOWNLOAD_FOLDER'], filename, as_attachment=True)

@app.route('/get_device_id', methods=['GET'])
def get_device_id_route():
    return jsonify({'device_id': DEVICE_ID})

# --- Instagram Download Functions ---
def download_instagram_media(url, download_folder):
    """
    Download photos/videos from Instagram posts, reels, or stories
    """
    try:
        L = instaloader.Instaloader(
            download_pictures=True,
            download_videos=True,
            download_video_thumbnails=False,
            download_geotags=False,
            download_comments=False,
            save_metadata=False,
            compress_json=False,
            dirname_pattern=download_folder,
            filename_pattern='{date_utc}_UTC_{typename}',
        )
        
        shortcode = extract_instagram_shortcode(url)
        if not shortcode:
            return {'success': False, 'message': 'Invalid Instagram URL'}
        
        post = instaloader.Post.from_shortcode(L.context, shortcode)
        
        L.download_post(post, target=download_folder)
        
        downloaded_files = []
        for file in os.listdir(download_folder):
            if file.startswith(post.date_utc.strftime('%Y-%m-%d_%H-%M-%S')):
                downloaded_files.append(file)
        
        return {
            'success': True, 
            'message': f'Downloaded {len(downloaded_files)} file(s) successfully!',
            'files': downloaded_files,
            'caption': post.caption if post.caption else 'No caption'
        }
        
    except Exception as e:
        return {'success': False, 'message': f'Error: {str(e)}'}

def extract_instagram_shortcode(url):
    """
    Extract shortcode from various Instagram URL formats
    """
    patterns = [
        r'instagram\.com/p/([^/?]+)',
        r'instagram\.com/reel/([^/?]+)',
        r'instagram\.com/tv/([^/?]+)',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    
    return None

@app.route('/download_instagram', methods=['POST'])
def download_instagram():
    url = request.form.get('url')
    download_folder = request.form.get('download_folder', app.config['DOWNLOAD_FOLDER'])
    
    if not url:
        return jsonify({'success': False, 'message': 'URL is required'})
    
    if 'instagram.com' not in url:
        return jsonify({'success': False, 'message': 'Please provide a valid Instagram URL'})
    
    try:
        download_folder = secure_path(download_folder)
    except ValueError as e:
        return jsonify({'success': False, 'message': str(e)})
    
    def download_thread():
        result = download_instagram_media(url, download_folder)
        download_status['instagram_result'] = result
    
    thread = threading.Thread(target=download_thread)
    thread.start()
    thread.join()
    
    result = download_status.get('instagram_result', {'success': False, 'message': 'Unknown error'})
    return jsonify(result)

@app.route('/download_instagram_single', methods=['POST'])
def download_instagram_single():
    """Download a single media item from Instagram"""
    media_url = request.form.get('media_url')
    media_type = request.form.get('media_type', 'image')
    download_folder = request.form.get('download_folder', app.config['DOWNLOAD_FOLDER'])
    
    if not media_url:
        return jsonify({'success': False, 'message': 'Media URL is required'})
    
    try:
        download_folder = secure_path(download_folder)
        
        timestamp = time.strftime('%Y%m%d_%H%M%S')
        ext = 'mp4' if media_type == 'video' else 'jpg'
        filename = f'instagram_{timestamp}.{ext}'
        filepath = os.path.join(download_folder, filename)
        
        response = requests.get(media_url, stream=True)
        response.raise_for_status()
        
        with open(filepath, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        
        return jsonify({
            'success': True,
            'message': 'Media downloaded successfully!',
            'filename': filename
        })
        
    except Exception as e:
        return jsonify({'success': False, 'message': f'Error downloading media: {str(e)}'})

@app.route('/fetch_instagram_info', methods=['POST'])
def fetch_instagram_info():
    url = request.form.get('url')
    
    if not url:
        return jsonify({'success': False, 'message': 'URL is required'})
    
    if 'instagram.com' not in url:
        return jsonify({'success': False, 'message': 'Please provide a valid Instagram URL'})
    
    try:
        shortcode = extract_instagram_shortcode(url)
        if not shortcode:
            return jsonify({'success': False, 'message': 'Invalid Instagram URL'})
        
        L = instaloader.Instaloader()
        
        post = instaloader.Post.from_shortcode(L.context, shortcode)
        
        media_items = []
        if post.typename == 'GraphSidecar':
            for node in post.get_sidecar_nodes():
                media_items.append({
                    'url': node.video_url if node.is_video else node.display_url,
                    'is_video': node.is_video,
                    'type': 'video' if node.is_video else 'image'
                })
        else:
            media_items.append({
                'url': post.video_url if post.is_video else post.url,
                'is_video': post.is_video,
                'type': 'video' if post.is_video else 'image'
            })
        
        return jsonify({
            'success': True,
            'title': post.caption[:100] + '...' if post.caption and len(post.caption) > 100 else (post.caption or 'Instagram Post'),
            'thumbnail': post.url,
            'owner': post.owner_username,
            'likes': post.likes,
            'is_video': post.is_video,
            'media_count': len(media_items),
            'media_items': media_items,
            'typename': post.typename
        })
        
    except Exception as e:
        return jsonify({'success': False, 'message': f'Error fetching Instagram info: {str(e)}'})

# For Vercel serverless
def handler(environ, start_response):
    return app(environ, start_response)

# --- Main ---
if __name__ == '__main__':
    create_download_folder()
    app.run(debug=True, host='0.0.0.0', port=5000)
