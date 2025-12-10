# إصلاح مشكلة Vercel Deployment

## التغييرات التي تم إجراؤها:

### 1. إنشاء ملف `vercel.json`
تم إنشاء ملف التكوين الخاص بـ Vercel لتشغيل Flask كـ Serverless Function.

### 2. إنشاء مجلد `api/`
- تم نقل التطبيق إلى `api/index.py` حسب متطلبات Vercel
- تم تعديل المسارات لاستخدام `/tmp` في بيئة Vercel

### 3. التعديلات الرئيسية:

#### في `api/index.py`:
```python
# استخدام /tmp لبيئة Vercel
TEMP_FOLDER = os.environ.get('VERCEL_TMP', '/tmp') if os.environ.get('VERCEL') else os.path.join(os.getcwd(), 'downloads')
app.config['DOWNLOAD_FOLDER'] = TEMP_FOLDER

# تحديد مسارات templates و static
app = Flask(__name__, 
            template_folder='../templates',
            static_folder='../static')

# إضافة handler للـ serverless
def handler(environ, start_response):
    return app(environ, start_response)
```

### 4. تحديث `requirements.txt`
تم إضافة `werkzeug` للتأكد من توفر جميع المكتبات المطلوبة.

## خطوات النشر:

### 1. رفع التعديلات إلى GitHub:
```bash
git add .
git commit -m "Fix Vercel deployment configuration"
git push origin main
```

### 2. إعادة النشر على Vercel:
- انتقل إلى لوحة تحكم Vercel
- اختر المشروع الخاص بك
- اضغط على "Redeploy" أو سيتم النشر تلقائياً بعد الـ push

## ملاحظات مهمة:

⚠️ **تنبيهات:**

1. **التخزين المؤقت**: الملفات المحملة على `/tmp` في Vercel مؤقتة وقد تُحذف بعد انتهاء الطلب

2. **الحدود الزمنية**: Vercel لديه حد زمني 10 ثوانٍ للـ Hobby plan و 60 ثانية للـ Pro plan
   - قد لا تعمل التحميلات الكبيرة بشكل صحيح

3. **ffmpeg**: قد لا يكون متوفراً على Vercel
   - بعض عمليات تحويل الصوت قد لا تعمل

## الحلول البديلة:

### إذا استمرت المشكلة:

#### الخيار 1: استخدام Vercel مع قيود
- استخدم التطبيق فقط لمعاينة معلومات الفيديو
- قم بالتحميل من جهازك المحلي

#### الخيار 2: النشر على منصة أخرى
منصات أفضل لهذا النوع من التطبيقات:

1. **Railway.app** (موصى به)
   ```bash
   # إضافة Procfile
   echo "web: gunicorn app:app" > Procfile
   ```

2. **Render.com**
   - يدعم التطبيقات طويلة المدة
   - يوفر storage دائم

3. **PythonAnywhere**
   - مثالي لتطبيقات Flask
   - يوفر تخزين دائم

## اختبار محلي:

للتأكد من أن كل شيء يعمل محلياً:

```bash
# تشغيل من المجلد الرئيسي
python app.py

# أو تشغيل من api/
python api/index.py
```

## التحقق من الأخطاء:

إذا استمرت الأخطاء، تحقق من:

1. **Vercel Logs**:
   - انتقل إلى Deployments
   - اختر آخر deployment
   - اضغط على "View Function Logs"

2. **Build Logs**:
   - تحقق من أن جميع المكتبات تم تثبيتها بنجاح

## الدعم:

إذا كنت بحاجة إلى مساعدة إضافية:
- تحقق من logs في Vercel
- شارك رسالة الخطأ الكاملة
