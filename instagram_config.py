# إعدادات Instagram - ملف تكوين اختياري

"""
ملف تكوين اختياري لإعدادات Instagram
يمكن تعديل هذه الإعدادات حسب الحاجة
"""

# إعدادات Instaloader
INSTAGRAM_CONFIG = {
    # إعدادات التحميل
    'download_pictures': True,          # تحميل الصور
    'download_videos': True,            # تحميل الفيديوهات
    'download_video_thumbnails': False, # تحميل صور مصغرة للفيديوهات
    'download_geotags': False,          # تحميل معلومات الموقع
    'download_comments': False,         # تحميل التعليقات
    'save_metadata': False,             # حفظ metadata في ملفات JSON
    'compress_json': False,             # ضغط ملفات JSON
    
    # تنسيق أسماء الملفات
    'filename_pattern': '{date_utc}_UTC_{typename}',
    
    # جودة التحميل
    'video_quality': 'best',            # best, 720p, 480p, 360p
    'image_quality': 'best',            # best, medium, low
    
    # إعدادات إعادة المحاولة
    'max_connection_attempts': 3,       # عدد محاولات الاتصال
    'sleep_time': 5,                    # وقت الانتظار بين المحاولات (ثواني)
    
    # إعدادات الأمان
    'user_agent': None,                 # اترك None لاستخدام الافتراضي
    'request_timeout': 300,             # مهلة الطلب (ثواني)
}

# إعدادات مسار التحميل
DOWNLOAD_SETTINGS = {
    'base_folder': 'D:/Universal Video Downloader Downloads',
    'create_subfolders': False,         # إنشاء مجلدات فرعية حسب المنصة
    'subfolder_format': '{platform}',   # {platform}, {date}, {username}
}

# إعدادات الواجهة
UI_SETTINGS = {
    'show_instagram_username': True,    # عرض اسم المستخدم
    'show_likes_count': True,           # عرض عدد الإعجابات
    'show_post_date': True,             # عرض تاريخ النشر
    'show_caption': True,               # عرض نص المنشور
    'max_caption_length': 100,          # الحد الأقصى لطول النص المعروض
}

# إعدادات الأخطاء
ERROR_MESSAGES = {
    'ar': {
        'invalid_url': 'رابط Instagram غير صحيح',
        'private_account': 'هذا الحساب خاص ولا يمكن الوصول إليه',
        'post_not_found': 'المنشور غير موجود أو تم حذفه',
        'rate_limit': 'تم تجاوز الحد المسموح من الطلبات، يرجى المحاولة لاحقاً',
        'network_error': 'خطأ في الاتصال بالإنترنت',
        'download_failed': 'فشل التحميل، يرجى المحاولة مرة أخرى',
    },
    'en': {
        'invalid_url': 'Invalid Instagram URL',
        'private_account': 'This account is private',
        'post_not_found': 'Post not found or has been deleted',
        'rate_limit': 'Rate limit exceeded, please try again later',
        'network_error': 'Network connection error',
        'download_failed': 'Download failed, please try again',
    }
}

# إعدادات السجلات
LOGGING_CONFIG = {
    'enabled': True,                    # تفعيل السجلات
    'level': 'INFO',                    # DEBUG, INFO, WARNING, ERROR
    'log_file': 'instagram_downloads.log',
    'max_log_size': 10 * 1024 * 1024,  # 10 MB
}

# إعدادات التخزين المؤقت
CACHE_SETTINGS = {
    'enabled': False,                   # تفعيل التخزين المؤقت
    'cache_duration': 3600,             # مدة التخزين المؤقت (ثواني)
    'cache_folder': '.cache',
}

# ملاحظات:
# - هذا الملف اختياري ويمكن حذفه
# - الإعدادات الافتراضية في app.py كافية للاستخدام العادي
# - لاستخدام هذه الإعدادات، قم باستيرادها في app.py

"""
مثال على الاستخدام في app.py:

from instagram_config import INSTAGRAM_CONFIG

L = instaloader.Instaloader(
    download_pictures=INSTAGRAM_CONFIG['download_pictures'],
    download_videos=INSTAGRAM_CONFIG['download_videos'],
    # ... الخ
)
"""
