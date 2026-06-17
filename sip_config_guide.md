# راهنمای تنظیمات SIP Database

این فایل راهنمای استفاده از فایل `sip.json` برای تنظیمات SIP در سیستم است.

## ساختار کلی

### 1. تنظیمات اصلی (`enabled`)
- `enabled`: فعال/غیرفعال کردن سرویس SIP (true/false)

### 2. تنظیمات حساب کاربری (`account`)
- `username`: نام کاربری SIP
- `password`: رمز عبور
- `domain`: دامنه سرور SIP
- `server`: آدرس سرور SIP
- `port`: پورت اتصال (پیش‌فرض: 5060)
- `transport`: نوع انتقال (UDP/TCP/TLS)
- `register_expires`: مدت زمان انقضای ثبت‌نام (ثانیه)
- `auto_register`: ثبت‌نام خودکار (true/false)

### 3. تنظیمات صوتی (`audio`)
#### دستگاه‌های صوتی:
- `capture_device`: دستگاه ضبط صدا
- `playback_device`: دستگاه پخش صدا

#### کدک‌های صوتی (`codecs`):
**OPUS (توصیه شده برای کیفیت بالا):**
- `enabled`: فعال/غیرفعال
- `priority`: اولویت (1 = بالاترین)
- `bitrate`: نرخ بیت (64000 توصیه می‌شود)
- `sample_rate`: نرخ نمونه‌برداری (48000 Hz)
- `channels`: تعداد کانال (1 = مونو)
- `complexity`: پیچیدگی کدک (1-10)
- `use_vbr`: استفاده از نرخ بیت متغیر
- `use_dtx`: فعال‌سازی DTX (قطع انتقال در سکوت)

**سایر کدک‌ها:**
- PCMU (G.711 μ-law)
- PCMA (G.711 A-law)
- G.722 (HD Voice)
- G.729
- Speex

#### تنظیمات پردازش صوت:
- `echo_cancellation`: حذف اکو
- `noise_suppression`: حذف نویز
- `adaptive_gain_control`: کنترل خودکار بهره
- `volume`: تنظیمات صدا (میکروفون و بلندگو)

### 4. تنظیمات تماس (`call_settings`)
- `auto_answer`: پاسخ خودکار
- `auto_answer_delay`: تاخیر پاسخ خودکار (ثانیه)
- `call_timeout`: مهلت زمانی تماس (ثانیه)
- `ring_timeout`: مهلت زمانی زنگ (ثانیه)
- `dtmf_mode`: حالت DTMF

### 5. تنظیمات امنیتی (`security`)
#### مدیریت Whitelist:
- `whitelist_enabled`: فعال‌سازی لیست سفید
- `allow_all_numbers`: اجازه تماس از همه شماره‌ها
- `allowed_numbers`: آرایه شماره‌های مجاز
- `blocked_numbers`: آرایه شماره‌های مسدود
- `require_authentication`: نیاز به احراز هویت

**نحوه استفاده از Whitelist:**
```json
"security": {
  "whitelist_enabled": true,
  "allow_all_numbers": false,
  "allowed_numbers": ["+989123456789", "02112345678"],
  "blocked_numbers": ["+989987654321"]
}
```

### 6. تنظیمات شبکه (`network`)
- `stun_server`: سرور STUN برای NAT traversal
- `ice_enabled`: فعال‌سازی ICE
- `upnp_enabled`: فعال‌سازی UPnP
- `nat_policy`: سیاست NAT
- `firewall_policy`: سیاست فایروال
- `media_encryption`: رمزگذاری رسانه
- `sip_encryption`: رمزگذاری SIP

### 7. تنظیمات پیشرفته (`advanced`)
- `log_level`: سطح لاگ (debug/message/warning/error)
- `keep_alive_interval`: فاصله keep-alive (ثانیه)
- `session_expires`: انقضای جلسه
- `use_rfc2833_for_dtmf`: استفاده از RFC2833 برای DTMF
- `adaptive_rate_control`: کنترل نرخ تطبیقی
- `bandwidth_limit`: محدودیت پهنای باند

## مثال تنظیمات کامل:

```json
{
  "sip": {
    "enabled": true,
    "account": {
      "username": "1001",
      "password": "mypassword",
      "domain": "sip.example.com",
      "server": "sip.example.com",
      "port": 5060
    },
    "audio": {
      "codecs": {
        "opus": {
          "enabled": true,
          "priority": 1
        }
      }
    },
    "security": {
      "whitelist_enabled": true,
      "allow_all_numbers": false,
      "allowed_numbers": ["+989123456789"]
    }
  }
}
```

## نکات مهم:

1. **کدک OPUS**: برای بهترین کیفیت صوتی، کدک OPUS را با اولویت 1 فعال کنید.
2. **Whitelist**: برای امنیت بیشتر، whitelist را فعال کرده و شماره‌های مجاز را تعریف کنید.
3. **تنظیمات صوتی**: echo_cancellation و noise_suppression را برای کیفیت بهتر فعال نگه دارید.
4. **پورت**: پورت پیش‌فرض SIP برابر 5060 است.
5. **Transport**: UDP معمولاً سریع‌تر است، TCP برای شبکه‌های ناپایدار مناسب‌تر است.