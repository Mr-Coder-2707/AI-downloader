"""
اختبار بسيط لوظائف Instagram في التطبيق
"""

def test_extract_shortcode():
    """اختبار استخراج shortcode من روابط Instagram"""
    import re
    
    def extract_instagram_shortcode(url):
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
    
    # اختبار روابط مختلفة
    test_urls = [
        ("https://www.instagram.com/p/ABC123xyz/", "ABC123xyz"),
        ("https://www.instagram.com/reel/XYZ789abc/", "XYZ789abc"),
        ("https://instagram.com/p/TEST12345/?utm_source=ig_web", "TEST12345"),
        ("https://www.instagram.com/tv/IGTV12345/", "IGTV12345"),
        ("https://www.instagram.com/user/profile/", None),
    ]
    
    print("🧪 اختبار استخراج shortcode من روابط Instagram:\n")
    
    all_passed = True
    for url, expected in test_urls:
        result = extract_instagram_shortcode(url)
        status = "✅" if result == expected else "❌"
        print(f"{status} URL: {url}")
        print(f"   المتوقع: {expected} | النتيجة: {result}\n")
        
        if result != expected:
            all_passed = False
    
    if all_passed:
        print("✨ جميع الاختبارات نجحت!")
    else:
        print("⚠️ بعض الاختبارات فشلت!")
    
    return all_passed

if __name__ == "__main__":
    test_extract_shortcode()
