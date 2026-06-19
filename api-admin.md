# راهنمای API های مدیریت (Admin APIs)

این راهنما شامل اطلاعات کامل برای استفاده از API های مدیریت سیستم IoT است.

## فهرست مطالب
- [API ورود مدیر (Admin Login)](#api-ورود-مدیر-admin-login)
- [API خروج مدیر (Admin Logout)](#api-خروج-مدیر-admin-logout)
- [نکات امنیتی](#نکات-امنیتی)
- [کدهای خطا](#کدهای-خطا)

---

## API ورود مدیر (Admin Login)

### اطلاعات کلی
- **Endpoint**: `/adminlogin`
- **Method**: `POST`
- **Content-Type**: `application/json`
- **Authentication**: ندارد (API ورود)

### درخواست (Request)

```json
{
  "username": "admin_username",
  "password": "hashed_password_sha256"
}
```

#### پارامترهای ورودی:
- `username` (string, required): نام کاربری مدیر - می‌تواند شامل:
  - ایمیل (حاوی @ و .)
  - شماره تلفن (11 رقم)
  - کد ملی (10 رقم)
- `password` (string, required): رمز عبور هش شده با SHA256 (64 کاراکتر)

### پاسخ موفق (Success Response)

```json
{
  "status": "success",
  "reason": "Login successful",
  "userid": "1234567890",
  "session": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "mqtttopic": "user/1234567890/data",
  "mqttuser": "mqtt_username",
  "mqttpass": "mqtt_password",
  "mqttenable": true
}
```

#### فیلدهای پاسخ:
- `status`: وضعیت درخواست ("success" یا "error")
- `reason`: توضیح نتیجه
- `userid`: کد ملی کاربر
- `session`: JWT token برای احراز هویت
- `mqtttopic`: موضوع MQTT اختصاصی کاربر
- `mqttuser`: نام کاربری MQTT
- `mqttpass`: رمز عبور MQTT
- `mqttenable`: وضعیت فعال بودن MQTT

### پاسخ خطا (Error Response)

```json
{
  "status": "error",
  "reason": "Access denied"
}
```

### ویژگی‌های امنیتی
1. **بررسی admin_level**: فقط کاربران با `admin_level > 0` می‌توانند وارد شوند
2. **Fail2Ban**: IP های مشکوک مسدود می‌شوند
3. **JWT Token**: نشست امن با JWT
4. **بررسی وضعیت مسدودی**: کاربران مسدود شده نمی‌توانند وارد شوند
5. **مدیریت نشست**: بررسی و به‌روزرسانی نشست‌های موجود

---

## API خروج مدیر (Admin Logout)

### اطلاعات کلی
- **Endpoint**: `/adminlogout`
- **Method**: `POST`
- **Content-Type**: `application/json`
- **Authentication**: JWT Token مورد نیاز

### درخواست (Request)

```json
{
  "userid": "1234567890",
  "session": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### پارامترهای ورودی:
- `userid` (string, required): کد ملی مدیر (10 رقم)
- `session` (string, required): JWT token دریافتی از API ورود

### پاسخ موفق (Success Response)

```json
{
  "status": "success",
  "reason": "Admin successfully logged out!"
}
```

### پاسخ خطا (Error Response)

```json
{
  "status": "error",
  "reason": "Access denied"
}
```

### ویژگی‌های امنیتی
1. **بررسی admin_level**: فقط مدیران می‌توانند از این API استفاده کنند
2. **اعتبارسنجی JWT**: بررسی صحت و اعتبار token
3. **بررسی IP**: تطبیق IP درخواست با IP ثبت شده در نشست
4. **به‌روزرسانی نشست**: تغییر وضعیت JWT به 'LOGGEDOUT'
5. **Fail2Ban**: محافظت در برابر حملات

---

## API تعریف مدیر جدید (Define New Admin)

### اطلاعات کلی
- **Endpoint**: `/admindefinenewadmin`
- **Method**: `POST`
- **Content-Type**: `application/json`
- **Authentication**: JWT Token مورد نیاز (فقط مدیران سطح 255)

### درخواست با کد ملی (Request by National ID)

```json
{
  "userid": "1234567890",
  "session": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "targetuser": "0987654321",
  "admin_level": 100
}
```

### درخواست با شماره تلفن (Request by Phone Number)

```json
{
  "userid": "1234567890",
  "session": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "targetphonenumber": "09123456789",
  "admin_level": 50
}
```

#### پارامترهای ورودی:
- `userid` (string, required): کد ملی مدیر فعلی (10 رقم)
- `session` (string, required): JWT token دریافتی از API ورود
- `targetuser` (string, optional): کد ملی کاربر هدف (10 رقم)
- `targetphonenumber` (string, optional): شماره تلفن کاربر هدف (11 رقم)
- `admin_level` (integer, required): سطح مدیریت جدید (0-255)

### پاسخ موفق (Success Response)

```json
{
  "status": "success",
  "reason": "Admin level successfully updated",
  "targetuser": "0987654321",
  "admin_level": 100
}
```

#### فیلدهای پاسخ:
- `status`: وضعیت درخواست ("success")
- `reason`: توضیح نتیجه
- `targetuser`: کد ملی کاربر هدف
- `admin_level`: سطح مدیریت تنظیم شده

### پاسخ خطا (Error Response)

```json
{
  "status": "error",
  "reason": "Access denied. Only full admins (level 255) can define new admins"
}
```

### ویژگی‌های امنیتی
1. **بررسی admin_level**: فقط مدیران سطح 255 می‌توانند از این API استفاده کنند
2. **اعتبارسنجی JWT**: بررسی صحت و اعتبار token
3. **بررسی IP**: تطبیق IP درخواست با IP ثبت شده در نشست
4. **بررسی وجود کاربر**: تأیید وجود کاربر هدف در سیستم
5. **محدودیت سطح دسترسی**: امکان تنظیم سطح مدیریت از 0 تا 255
6. **Fail2Ban**: محافظت در برابر حملات

### سطوح مدیریت
- **0**: کاربر عادی (بدون دسترسی مدیریت)
- **1-99**: مدیر محدود (دسترسی‌های خاص)
- **100-254**: مدیر پیشرفته (دسترسی‌های گسترده)
- **255**: مدیر کامل (تمام دسترسی‌ها)

---

## API حذف مدیر (Remove Admin)

### اطلاعات کلی
- **Endpoint**: `/adminremoveadmin`
- **Method**: `POST`
- **Content-Type**: `application/json`
- **Authentication**: JWT Token مورد نیاز (فقط مدیران سطح 255)

### درخواست با کد ملی (Request by National ID)

```json
{
  "userid": "1234567890",
  "session": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "targetuser": "0987654321"
}
```

### درخواست با شماره تلفن (Request by Phone Number)

```json
{
  "userid": "1234567890",
  "session": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "targetphonenumber": "09123456789"
}
```

#### پارامترهای ورودی:
- `userid` (string, required): کد ملی مدیر فعلی (10 رقم)
- `session` (string, required): JWT token دریافتی از API ورود
- `targetuser` (string, optional): کد ملی کاربر هدف (10 رقم)
- `targetphonenumber` (string, optional): شماره تلفن کاربر هدف (11 رقم)

### پاسخ موفق (Success Response)

```json
{
  "status": "success",
  "reason": "Admin privileges successfully removed",
  "targetuser": "0987654321",
  "previous_admin_level": 100,
  "new_admin_level": 0
}
```

#### فیلدهای پاسخ:
- `status`: وضعیت درخواست ("success")
- `reason`: توضیح نتیجه
- `targetuser`: کد ملی کاربر هدف
- `previous_admin_level`: سطح مدیریت قبلی
- `new_admin_level`: سطح مدیریت جدید (0)

### پاسخ خطا (Error Response)

```json
{
  "status": "error",
  "reason": "Cannot remove another full admin (level 255)"
}
```

### ویژگی‌های امنیتی
1. **بررسی admin_level**: فقط مدیران سطح 255 می‌توانند از این API استفاده کنند
2. **اعتبارسنجی JWT**: بررسی صحت و اعتبار token
3. **بررسی IP**: تطبیق IP درخواست با IP ثبت شده در نشست
4. **بررسی وجود کاربر**: تأیید وجود کاربر هدف در سیستم
5. **محدودیت حذف**: امکان حذف مدیران سطح 255 وجود ندارد
6. **Fail2Ban**: محافظت در برابر حملات

### محدودیت‌ها
- مدیران سطح 255 نمی‌توانند یکدیگر را حذف کنند
- فقط مدیران سطح 255 می‌توانند از این API استفاده کنند
- کاربر هدف باید در سیستم موجود باشد

---

## API دریافت لیست کاربران (Get User List)

### اطلاعات کلی
- **Endpoint**: `/admingetuserlist`
- **Method**: `POST`
- **Content-Type**: `application/json`
- **Authentication**: JWT Token مورد نیاز (مدیران با سطح دسترسی > 0)

### درخواست (Request)

```json
{
  "userid": "1234567890",
  "session": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### پارامترهای درخواست
- `userid`: کد ملی مدیر (10 رقم)
- `session`: JWT Token معتبر

### پاسخ موفق (Success Response)

```json
{
  "status": "success",
  "user_count": 150,
  "users": [
    {
      "codemelli": "1234567890",
      "number": "09123456789",
      "emailaddr": "user@example.com",
      "firstname": "احمد",
      "lastname": "محمدی",
      "admin_level": 0,
      "banstatus": true,
      "bandcount": 0,
      "bandatetime": 0,
      "billcharge": 50000.0,
      "mqttvaliduntil": 1735689600
    }
  ]
}
```

### پاسخ خطا (Error Response)

```json
{
  "status": "error",
  "reason": "Access denied. Admin privileges required"
}
```

### ویژگی‌های امنیتی
1. **بررسی admin_level**: فقط مدیران با سطح > 0 می‌توانند از این API استفاده کنند
2. **اعتبارسنجی JWT**: بررسی صحت و اعتبار token
3. **بررسی IP**: تطبیق IP درخواست با IP ثبت شده در نشست
4. **بررسی انقضای نشست**: تأیید اعتبار زمانی نشست
5. **Fail2Ban**: محافظت در برابر حملات

### کاربردها
- مدیریت کاربران سیستم
- نظارت بر وضعیت حساب‌های کاربری
- بررسی اطلاعات مالی کاربران
- مدیریت دسترسی‌ها

---

## API ارسال پیامک به کاربر (Send SMS to User)

### اطلاعات کلی
- **Endpoint**: `/adminsendsmstouser`
- **Method**: `POST`
- **Content-Type**: `application/json`
- **Authentication**: JWT Token مورد نیاز (مدیران با سطح دسترسی > 0)

### درخواست (Request)

#### ارسال با کد ملی:
```json
{
  "userid": "1234567890",
  "session": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "targetuser": "0987654321",
  "message": "پیام شما با موفقیت ارسال شد."
}
```

#### ارسال با شماره تلفن:
```json
{
  "userid": "1234567890",
  "session": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "targetphonenumber": "09123456789",
  "message": "پیام شما با موفقیت ارسال شد."
}
```

### پارامترهای درخواست
- `userid`: کد ملی مدیر (10 رقم)
- `session`: JWT Token معتبر
- `targetuser`: کد ملی کاربر هدف (اختیاری)
- `targetphonenumber`: شماره تلفن کاربر هدف (اختیاری، اولویت دارد)
- `message`: متن پیامک (حداکثر 500 کاراکتر)

### پاسخ موفق (Success Response)

```json
{
  "status": "success",
  "message": "SMS sent successfully",
  "target_phone": "09123456789",
  "sent_message": "پیام شما با موفقیت ارسال شد."
}
```

### پاسخ خطا (Error Response)

```json
{
  "status": "error",
  "reason": "Target user not found"
}
```

### ویژگی‌های امنیتی
1. **بررسی admin_level**: فقط مدیران با سطح > 0 می‌توانند از این API استفاده کنند
2. **اعتبارسنجی JWT**: بررسی صحت و اعتبار token
3. **بررسی IP**: تطبیق IP درخواست با IP ثبت شده در نشست
4. **اعتبارسنجی پیام**: بررسی طول و محتوای پیام
5. **اعتبارسنجی شماره تلفن**: بررسی فرمت شماره تلفن ایرانی
6. **Fail2Ban**: محافظت در برابر حملات

### کاربردها
- ارسال اطلاعیه‌های مهم به کاربران
- تأیید تراکنش‌ها
- هشدارهای امنیتی
- پیام‌های تبلیغاتی

---

## API ارسال پیامک گروهی (Send SMS to All Users)

### اطلاعات کلی
- **Endpoint**: `/adminsendsmstoallusers`
- **Method**: `POST`
- **Content-Type**: `application/json`
- **Authentication**: JWT Token مورد نیاز (مدیران با سطح دسترسی > 128)

### درخواست (Request)

```json
{
  "userid": "1234567890",
  "session": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "message": "اطلاعیه مهم: سیستم فردا از ساعت 2 تا 4 صبح در دسترس نخواهد بود."
}
```

### پارامترهای درخواست
- `userid`: کد ملی مدیر (10 رقم)
- `session`: JWT Token معتبر
- `message`: متن پیامک (حداکثر 500 کاراکتر)

### پاسخ موفق (Success Response)

```json
{
  "status": "success",
  "message": "Bulk SMS sent to all users",
  "total_recipients": 1250,
  "successful_sends": 1248,
  "failed_sends": 2,
  "sent_message": "اطلاعیه مهم: سیستم فردا از ساعت 2 تا 4 صبح در دسترس نخواهد بود."
}
```

### پاسخ خطا (Error Response)

```json
{
  "status": "error",
  "reason": "Access denied. High-level admin privileges required (level > 128)"
}
```

### ویژگی‌های امنیتی
1. **بررسی admin_level**: فقط مدیران با سطح > 128 می‌توانند از این API استفاده کنند
2. **اعتبارسنجی JWT**: بررسی صحت و اعتبار token
3. **بررسی IP**: تطبیق IP درخواست با IP ثبت شده در نشست
4. **اعتبارسنجی پیام**: بررسی طول و محتوای پیام
5. **فیلتر شماره تلفن**: فقط شماره‌های معتبر ایرانی
6. **Fail2Ban**: محافظت در برابر حملات

### محدودیت‌ها
- فقط مدیران سطح بالا (> 128) می‌توانند استفاده کنند
- حداکثر طول پیام 500 کاراکتر
- فقط شماره‌های تلفن معتبر و ثبت شده

### کاربردها
- اطلاعیه‌های عمومی سیستم
- هشدارهای امنیتی گسترده
- اعلان تعمیرات و نگهداری
- پیام‌های تبلیغاتی گروهی

---

## API دریافت لیست مدیران (Get Admin List)

### اطلاعات کلی
- **Endpoint**: `/admingetadminlist`
- **Method**: `POST`
- **Content-Type**: `application/json`
- **Authentication**: JWT Token مورد نیاز (فقط مدیران سطح 255)

### درخواست (Request)

```json
{
  "userid": "1234567890",
  "session": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### پارامترهای ورودی:
- `userid` (string, required): کد ملی مدیر فعلی (10 رقم)
- `session` (string, required): JWT token دریافتی از API ورود

### پاسخ موفق (Success Response)

```json
{
  "status": "success",
  "reason": "Admin list retrieved successfully",
  "admin_count": 3,
  "admin_list": [
    {
      "codemelli": "1234567890",
      "number": "09123456789",
      "emailaddr": "admin1@example.com",
      "admin_level": 255,
      "firstname": "John",
      "lastname": "Doe"
    },
    {
      "codemelli": "0987654321",
      "number": "09198765432",
      "emailaddr": "admin2@example.com",
      "admin_level": 100,
      "firstname": "Jane",
      "lastname": "Smith"
    }
  ]
}
```

#### فیلدهای پاسخ:
- `status`: وضعیت درخواست ("success")
- `reason`: توضیح نتیجه
- `admin_count`: تعداد کل مدیران
- `admin_list`: آرایه‌ای از اطلاعات مدیران شامل:
  - `codemelli`: کد ملی مدیر
  - `number`: شماره تلفن مدیر
  - `emailaddr`: آدرس ایمیل مدیر
  - `admin_level`: سطح مدیریت
  - `firstname`: نام مدیر
  - `lastname`: نام خانوادگی مدیر

### پاسخ خطا (Error Response)

```json
{
  "status": "error",
  "reason": "Access denied. Only full admins (level 255) can view admin list"
}
```

### ویژگی‌های امنیتی
1. **بررسی admin_level**: فقط مدیران سطح 255 می‌توانند از این API استفاده کنند
2. **اعتبارسنجی JWT**: بررسی صحت و اعتبار token
3. **بررسی IP**: تطبیق IP درخواست با IP ثبت شده در نشست
4. **فیلتر اطلاعات**: فقط اطلاعات ضروری مدیران نمایش داده می‌شود
5. **Fail2Ban**: محافظت در برابر حملات

### کاربردها
- مدیریت و نظارت بر مدیران سیستم
- بررسی سطوح دسترسی مدیران
- شناسایی مدیران غیرفعال یا مشکوک
- گزارش‌گیری از وضعیت مدیریت سیستم

---

## نکات امنیتی

### 1. هش کردن رمز عبور
```javascript
// نمونه هش کردن رمز عبور در JavaScript
const crypto = require('crypto');
const password = 'mypassword';
const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
```

### 2. مدیریت JWT Token
- Token را در مکان امن ذخیره کنید
- Token را در هر درخواست ارسال کنید
- پس از خروج، Token را حذف کنید

### 3. مدیریت خطاها
- همیشه وضعیت پاسخ را بررسی کنید
- خطاهای امنیتی را لاگ کنید
- از retry logic استفاده کنید

---

## کدهای خطا

| کد خطا | توضیح | راه حل |
|---------|-------|--------|
| "error parsing json" | فرمت JSON نامعتبر | بررسی فرمت JSON |
| "Access denied" | عدم دسترسی مدیریت | بررسی admin_level کاربر |
| "Invalid user id" | کد ملی نامعتبر | بررسی فرمت کد ملی (10 رقم) |
| "User not found" | کاربر یافت نشد | بررسی اطلاعات کاربر |
| "Wrong password" | رمز عبور اشتباه | بررسی رمز عبور |
| "User is banned" | کاربر مسدود شده | تماس با مدیر سیستم |
| "JWT Session decode failed" | Token نامعتبر | دریافت token جدید |
| "No session found" | نشست یافت نشد | ورود مجدد |
| "Database error" | خطای پایگاه داده | تماس با پشتیبانی |

---

## نمونه کد استفاده

### JavaScript (Node.js)
```javascript
const axios = require('axios');
const crypto = require('crypto');

// ورود مدیر
async function adminLogin(username, password) {
  const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
  
  try {
    const response = await axios.post('https://your-api.com/adminlogin', {
      username: username,
      password: hashedPassword
    });
    
    if (response.data.status === 'success') {
      // ذخیره token برای استفاده بعدی
      localStorage.setItem('adminToken', response.data.session);
      localStorage.setItem('adminUserId', response.data.userid);
      return response.data;
    } else {
      throw new Error(response.data.reason);
    }
  } catch (error) {
    console.error('Login failed:', error.message);
    throw error;
  }
}

// خروج مدیر
async function adminLogout() {
  const token = localStorage.getItem('adminToken');
  const userId = localStorage.getItem('adminUserId');
  
  if (!token || !userId) {
    throw new Error('No active session found');
  }
  
  try {
    const response = await axios.post('https://your-api.com/adminlogout', {
      userid: userId,
      session: token
    });
    
    if (response.data.status === 'success') {
      // حذف token از storage
      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminUserId');
      return response.data;
    } else {
      throw new Error(response.data.reason);
    }
  } catch (error) {
    console.error('Logout failed:', error.message);
    throw error;
  }
}

// تعریف مدیر جدید با کد ملی
async function defineNewAdminByNationalId(targetUserId, adminLevel) {
  const token = localStorage.getItem('adminToken');
  const userId = localStorage.getItem('adminUserId');
  
  if (!token || !userId) {
    throw new Error('No active session found');
  }
  
  try {
    const response = await axios.post('https://your-api.com/admindefinenewadmin', {
      userid: userId,
      session: token,
      targetuser: targetUserId,
      admin_level: adminLevel
    });
    
    if (response.data.status === 'success') {
      return response.data;
    } else {
      throw new Error(response.data.reason);
    }
  } catch (error) {
    console.error('Define new admin failed:', error.message);
    throw error;
  }
}

// تعریف مدیر جدید با شماره تلفن
async function defineNewAdminByPhone(targetPhoneNumber, adminLevel) {
  const token = localStorage.getItem('adminToken');
  const userId = localStorage.getItem('adminUserId');
  
  if (!token || !userId) {
    throw new Error('No active session found');
  }
  
  try {
    const response = await axios.post('https://your-api.com/admindefinenewadmin', {
      userid: userId,
      session: token,
      targetphonenumber: targetPhoneNumber,
      admin_level: adminLevel
    });
    
    if (response.data.status === 'success') {
      return response.data;
    } else {
      throw new Error(response.data.reason);
    }
  } catch (error) {
    console.error('Define new admin by phone failed:', error.message);
    throw error;
  }
}
```

### Python
```python
import requests
import hashlib
import json

class AdminAPI:
    def __init__(self, base_url):
        self.base_url = base_url
        self.session_token = None
        self.user_id = None
    
    def login(self, username, password):
        # هش کردن رمز عبور
        hashed_password = hashlib.sha256(password.encode()).hexdigest()
        
        payload = {
            'username': username,
            'password': hashed_password
        }
        
        try:
            response = requests.post(f'{self.base_url}/adminlogin', json=payload)
            data = response.json()
            
            if data['status'] == 'success':
                self.session_token = data['session']
                self.user_id = data['userid']
                return data
            else:
                raise Exception(data['reason'])
                
        except Exception as e:
            print(f'Login failed: {e}')
            raise
    
    def logout(self):
        if not self.session_token or not self.user_id:
            raise Exception('No active session found')
        
        payload = {
            'userid': self.user_id,
            'session': self.session_token
        }
        
        try:
            response = requests.post(f'{self.base_url}/adminlogout', json=payload)
            data = response.json()
            
            if data['status'] == 'success':
                self.session_token = None
                self.user_id = None
                return data
            else:
                raise Exception(data['reason'])
                
        except Exception as e:
            print(f'Logout failed: {e}')
            raise
    
    def define_new_admin_by_national_id(self, target_user_id, admin_level):
        if not self.session_token or not self.user_id:
            raise Exception('No active session found')
        
        payload = {
            'userid': self.user_id,
            'session': self.session_token,
            'targetuser': target_user_id,
            'admin_level': admin_level
        }
        
        try:
            response = requests.post(f'{self.base_url}/admindefinenewadmin', json=payload)
            data = response.json()
            
            if data['status'] == 'success':
                return data
            else:
                raise Exception(data['reason'])
                
        except Exception as e:
            print(f'Define new admin failed: {e}')
            raise
    
    def define_new_admin_by_phone(self, target_phone_number, admin_level):
        if not self.session_token or not self.user_id:
            raise Exception('No active session found')
        
        payload = {
            'userid': self.user_id,
            'session': self.session_token,
            'targetphonenumber': target_phone_number,
            'admin_level': admin_level
        }
        
        try:
            response = requests.post(f'{self.base_url}/admindefinenewadmin', json=payload)
            data = response.json()
            
            if data['status'] == 'success':
                return data
            else:
                raise Exception(data['reason'])
                
        except Exception as e:
            print(f'Define new admin by phone failed: {e}')
            raise

# نمونه استفاده
api = AdminAPI('https://your-api.com')

# ورود
try:
    result = api.login('admin@example.com', 'mypassword')
    print('Login successful:', result)
except Exception as e:
    print('Login error:', e)

# تعریف مدیر جدید با کد ملی
try:
    result = api.define_new_admin_by_national_id('0987654321', 100)
    print('Define admin by national ID successful:', result)
except Exception as e:
    print('Define admin error:', e)

# تعریف مدیر جدید با شماره تلفن
try:
    result = api.define_new_admin_by_phone('09123456789', 50)
    print('Define admin by phone successful:', result)
except Exception as e:
    print('Define admin by phone error:', e)

# خروج
try:
    result = api.logout()
    print('Logout successful:', result)
except Exception as e:
    print('Logout error:', e)
```

### Java
```java
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HashMap;
import java.util.Map;

public class AdminAPIClient {
    private static final String BASE_URL = "https://your-api.com";
    private static final HttpClient client = HttpClient.newHttpClient();
    private static final ObjectMapper mapper = new ObjectMapper();
    private String sessionToken;
    private String userId;
    
    // هش کردن رمز عبور با SHA256
    private String hashPassword(String password) throws NoSuchAlgorithmException {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        byte[] hash = digest.digest(password.getBytes());
        StringBuilder hexString = new StringBuilder();
        
        for (byte b : hash) {
            String hex = Integer.toHexString(0xff & b);
            if (hex.length() == 1) {
                hexString.append('0');
            }
            hexString.append(hex);
        }
        
        return hexString.toString();
    }
    
    // ورود مدیر
    public JsonNode adminLogin(String username, String password) 
            throws IOException, InterruptedException, NoSuchAlgorithmException {
        
        String hashedPassword = hashPassword(password);
        
        Map<String, Object> loginData = new HashMap<>();
        loginData.put("username", username);
        loginData.put("password", hashedPassword);
        
        String loginJson = mapper.writeValueAsString(loginData);
        
        HttpRequest loginRequest = HttpRequest.newBuilder()
                .uri(URI.create(BASE_URL + "/adminlogin"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(loginJson))
                .build();
        
        HttpResponse<String> loginResponse = client.send(loginRequest, 
                HttpResponse.BodyHandlers.ofString());
        
        JsonNode loginResult = mapper.readTree(loginResponse.body());
        
        if ("success".equals(loginResult.get("status").asText())) {
            this.sessionToken = loginResult.get("session").asText();
            this.userId = loginResult.get("userid").asText();
        }
        
        return loginResult;
    }
    
    // خروج مدیر
    public JsonNode adminLogout() throws IOException, InterruptedException {
        if (sessionToken == null || userId == null) {
            throw new IllegalStateException("No active session found");
        }
        
        Map<String, Object> logoutData = new HashMap<>();
        logoutData.put("userid", userId);
        logoutData.put("session", sessionToken);
        
        String logoutJson = mapper.writeValueAsString(logoutData);
        
        HttpRequest logoutRequest = HttpRequest.newBuilder()
                .uri(URI.create(BASE_URL + "/adminlogout"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(logoutJson))
                .build();
        
        HttpResponse<String> logoutResponse = client.send(logoutRequest, 
                HttpResponse.BodyHandlers.ofString());
        
        JsonNode logoutResult = mapper.readTree(logoutResponse.body());
        
        if ("success".equals(logoutResult.get("status").asText())) {
            this.sessionToken = null;
            this.userId = null;
        }
        
        return logoutResult;
    }
    
    // تعریف مدیر جدید با کد ملی
    public JsonNode defineNewAdminByNationalId(String targetUserId, int adminLevel) 
            throws IOException, InterruptedException {
        
        if (sessionToken == null || userId == null) {
            throw new IllegalStateException("No active session found");
        }
        
        Map<String, Object> defineAdminData = new HashMap<>();
        defineAdminData.put("userid", userId);
        defineAdminData.put("session", sessionToken);
        defineAdminData.put("targetuser", targetUserId);
        defineAdminData.put("admin_level", adminLevel);
        
        String defineAdminJson = mapper.writeValueAsString(defineAdminData);
        
        HttpRequest defineAdminRequest = HttpRequest.newBuilder()
                .uri(URI.create(BASE_URL + "/admindefinenewadmin"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(defineAdminJson))
                .build();
        
        HttpResponse<String> defineAdminResponse = client.send(defineAdminRequest, 
                HttpResponse.BodyHandlers.ofString());
        
        return mapper.readTree(defineAdminResponse.body());
    }
    
    // تعریف مدیر جدید با شماره تلفن
    public JsonNode defineNewAdminByPhone(String targetPhoneNumber, int adminLevel) 
            throws IOException, InterruptedException {
        
        if (sessionToken == null || userId == null) {
            throw new IllegalStateException("No active session found");
        }
        
        Map<String, Object> defineAdminData = new HashMap<>();
        defineAdminData.put("userid", userId);
        defineAdminData.put("session", sessionToken);
        defineAdminData.put("targetphonenumber", targetPhoneNumber);
        defineAdminData.put("admin_level", adminLevel);
        
        String defineAdminJson = mapper.writeValueAsString(defineAdminData);
        
        HttpRequest defineAdminRequest = HttpRequest.newBuilder()
                .uri(URI.create(BASE_URL + "/admindefinenewadmin"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(defineAdminJson))
                .build();
        
        HttpResponse<String> defineAdminResponse = client.send(defineAdminRequest, 
                HttpResponse.BodyHandlers.ofString());
        
        return mapper.readTree(defineAdminResponse.body());
    }
    
    // حذف مدیر با کد ملی
    public JsonNode removeAdminByNationalId(String targetUserId) 
            throws IOException, InterruptedException {
        
        if (sessionToken == null || userId == null) {
            throw new IllegalStateException("No active session found");
        }
        
        Map<String, Object> removeAdminData = new HashMap<>();
        removeAdminData.put("userid", userId);
        removeAdminData.put("session", sessionToken);
        removeAdminData.put("targetuser", targetUserId);
        
        String removeAdminJson = mapper.writeValueAsString(removeAdminData);
        
        HttpRequest removeAdminRequest = HttpRequest.newBuilder()
                .uri(URI.create(BASE_URL + "/adminremoveadmin"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(removeAdminJson))
                .build();
        
        HttpResponse<String> removeAdminResponse = client.send(removeAdminRequest, 
                HttpResponse.BodyHandlers.ofString());
        
        return mapper.readTree(removeAdminResponse.body());
    }
    
    // حذف مدیر با شماره تلفن
    public JsonNode removeAdminByPhone(String targetPhoneNumber) 
            throws IOException, InterruptedException {
        
        if (sessionToken == null || userId == null) {
            throw new IllegalStateException("No active session found");
        }
        
        Map<String, Object> removeAdminData = new HashMap<>();
        removeAdminData.put("userid", userId);
        removeAdminData.put("session", sessionToken);
        removeAdminData.put("targetphonenumber", targetPhoneNumber);
        
        String removeAdminJson = mapper.writeValueAsString(removeAdminData);
        
        HttpRequest removeAdminRequest = HttpRequest.newBuilder()
                .uri(URI.create(BASE_URL + "/adminremoveadmin"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(removeAdminJson))
                .build();
        
        HttpResponse<String> removeAdminResponse = client.send(removeAdminRequest, 
                HttpResponse.BodyHandlers.ofString());
        
        return mapper.readTree(removeAdminResponse.body());
    }
    
    // دریافت لیست مدیران
    public JsonNode getAdminList() throws IOException, InterruptedException {
        if (sessionToken == null || userId == null) {
            throw new IllegalStateException("No active session found");
        }
        
        Map<String, Object> getAdminListData = new HashMap<>();
        getAdminListData.put("userid", userId);
        getAdminListData.put("session", sessionToken);
        
        String getAdminListJson = mapper.writeValueAsString(getAdminListData);
        
        HttpRequest getAdminListRequest = HttpRequest.newBuilder()
                .uri(URI.create(BASE_URL + "/admingetadminlist"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(getAdminListJson))
                .build();
        
        HttpResponse<String> getAdminListResponse = client.send(getAdminListRequest, 
                HttpResponse.BodyHandlers.ofString());
        
        return mapper.readTree(getAdminListResponse.body());
    }
    
    // دریافت لیست کاربران
    public JsonNode getUserList() throws IOException, InterruptedException {
        if (sessionToken == null || userId == null) {
            throw new IllegalStateException("No active session found");
        }
        
        Map<String, Object> getUserListData = new HashMap<>();
        getUserListData.put("userid", userId);
        getUserListData.put("session", sessionToken);
        
        String getUserListJson = mapper.writeValueAsString(getUserListData);
        
        HttpRequest getUserListRequest = HttpRequest.newBuilder()
                .uri(URI.create(BASE_URL + "/admingetuserlist"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(getUserListJson))
                .build();
        
        HttpResponse<String> getUserListResponse = client.send(getUserListRequest, 
                HttpResponse.BodyHandlers.ofString());
        
        return mapper.readTree(getUserListResponse.body());
    }
    
    // دریافت اطلاعات کاربر با کد ملی
    public JsonNode getUserInfoByNationalId(String targetUserId) 
            throws IOException, InterruptedException {
        
        if (sessionToken == null || userId == null) {
            throw new IllegalStateException("No active session found");
        }
        
        Map<String, Object> getUserInfoData = new HashMap<>();
        getUserInfoData.put("userid", userId);
        getUserInfoData.put("session", sessionToken);
        getUserInfoData.put("targetuser", targetUserId);
        
        String getUserInfoJson = mapper.writeValueAsString(getUserInfoData);
        
        HttpRequest getUserInfoRequest = HttpRequest.newBuilder()
                .uri(URI.create(BASE_URL + "/adminuserinfo"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(getUserInfoJson))
                .build();
        
        HttpResponse<String> getUserInfoResponse = client.send(getUserInfoRequest, 
                HttpResponse.BodyHandlers.ofString());
        
        return mapper.readTree(getUserInfoResponse.body());
    }
    
    // دریافت اطلاعات کاربر با شماره تلفن
    public JsonNode getUserInfoByPhone(String targetPhoneNumber) 
            throws IOException, InterruptedException {
        
        if (sessionToken == null || userId == null) {
            throw new IllegalStateException("No active session found");
        }
        
        Map<String, Object> getUserInfoData = new HashMap<>();
        getUserInfoData.put("userid", userId);
        getUserInfoData.put("session", sessionToken);
        getUserInfoData.put("targetphonenumber", targetPhoneNumber);
        
        String getUserInfoJson = mapper.writeValueAsString(getUserInfoData);
        
        HttpRequest getUserInfoRequest = HttpRequest.newBuilder()
                .uri(URI.create(BASE_URL + "/adminuserinfo"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(getUserInfoJson))
                .build();
        
        HttpResponse<String> getUserInfoResponse = client.send(getUserInfoRequest, 
                HttpResponse.BodyHandlers.ofString());
        
        return mapper.readTree(getUserInfoResponse.body());
    }
    
    // دریافت دستگاه‌های کاربر با کد ملی
    public JsonNode getUserDevicesByNationalId(String targetUserId) 
            throws IOException, InterruptedException {
        
        if (sessionToken == null || userId == null) {
            throw new IllegalStateException("No active session found");
        }
        
        Map<String, Object> getUserDevicesData = new HashMap<>();
        getUserDevicesData.put("userid", userId);
        getUserDevicesData.put("session", sessionToken);
        getUserDevicesData.put("targetuser", targetUserId);
        
        String getUserDevicesJson = mapper.writeValueAsString(getUserDevicesData);
        
        HttpRequest getUserDevicesRequest = HttpRequest.newBuilder()
                .uri(URI.create(BASE_URL + "/adminuserdevices"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(getUserDevicesJson))
                .build();
        
        HttpResponse<String> getUserDevicesResponse = client.send(getUserDevicesRequest, 
                HttpResponse.BodyHandlers.ofString());
        
        return mapper.readTree(getUserDevicesResponse.body());
    }
    
    // دریافت دستگاه‌های کاربر با شماره تلفن
    public JsonNode getUserDevicesByPhone(String targetPhoneNumber) 
            throws IOException, InterruptedException {
        
        if (sessionToken == null || userId == null) {
            throw new IllegalStateException("No active session found");
        }
        
        Map<String, Object> getUserDevicesData = new HashMap<>();
        getUserDevicesData.put("userid", userId);
        getUserDevicesData.put("session", sessionToken);
        getUserDevicesData.put("targetphonenumber", targetPhoneNumber);
        
        String getUserDevicesJson = mapper.writeValueAsString(getUserDevicesData);
        
        HttpRequest getUserDevicesRequest = HttpRequest.newBuilder()
                .uri(URI.create(BASE_URL + "/adminuserdevices"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(getUserDevicesJson))
                .build();
        
        HttpResponse<String> getUserDevicesResponse = client.send(getUserDevicesRequest, 
                HttpResponse.BodyHandlers.ofString());
        
        return mapper.readTree(getUserDevicesResponse.body());
    }
    
    // دریافت روابط کاربر با کد ملی
    public JsonNode getUserRelationshipsByNationalId(String targetUserId) 
            throws IOException, InterruptedException {
        
        if (sessionToken == null || userId == null) {
            throw new IllegalStateException("No active session found");
        }
        
        Map<String, Object> getUserRelationshipsData = new HashMap<>();
        getUserRelationshipsData.put("userid", userId);
        getUserRelationshipsData.put("session", sessionToken);
        getUserRelationshipsData.put("targetuser", targetUserId);
        
        String getUserRelationshipsJson = mapper.writeValueAsString(getUserRelationshipsData);
        
        HttpRequest getUserRelationshipsRequest = HttpRequest.newBuilder()
                .uri(URI.create(BASE_URL + "/adminuserrelationship"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(getUserRelationshipsJson))
                .build();
        
        HttpResponse<String> getUserRelationshipsResponse = client.send(getUserRelationshipsRequest, 
                HttpResponse.BodyHandlers.ofString());
        
        return mapper.readTree(getUserRelationshipsResponse.body());
    }
    
    // دریافت روابط کاربر با شماره تلفن
    public JsonNode getUserRelationshipsByPhone(String targetPhoneNumber) 
            throws IOException, InterruptedException {
        
        if (sessionToken == null || userId == null) {
            throw new IllegalStateException("No active session found");
        }
        
        Map<String, Object> getUserRelationshipsData = new HashMap<>();
        getUserRelationshipsData.put("userid", userId);
        getUserRelationshipsData.put("session", sessionToken);
        getUserRelationshipsData.put("targetphonenumber", targetPhoneNumber);
        
        String getUserRelationshipsJson = mapper.writeValueAsString(getUserRelationshipsData);
        
        HttpRequest getUserRelationshipsRequest = HttpRequest.newBuilder()
                .uri(URI.create(BASE_URL + "/adminuserrelationship"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(getUserRelationshipsJson))
                .build();
        
        HttpResponse<String> getUserRelationshipsResponse = client.send(getUserRelationshipsRequest, 
                HttpResponse.BodyHandlers.ofString());
        
        return mapper.readTree(getUserRelationshipsResponse.body());
    }
    
    // ارسال پیامک به کاربر خاص با کد ملی
    public JsonNode sendSMSToUserByNationalId(String targetUserId, String message) 
            throws IOException, InterruptedException {
        
        if (sessionToken == null || userId == null) {
            throw new IllegalStateException("No active session found");
        }
        
        Map<String, Object> sendSMSData = new HashMap<>();
        sendSMSData.put("userid", userId);
        sendSMSData.put("session", sessionToken);
        sendSMSData.put("targetuser", targetUserId);
        sendSMSData.put("message", message);
        
        String sendSMSJson = mapper.writeValueAsString(sendSMSData);
        
        HttpRequest sendSMSRequest = HttpRequest.newBuilder()
                .uri(URI.create(BASE_URL + "/adminsendsmstouser"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(sendSMSJson))
                .build();
        
        HttpResponse<String> sendSMSResponse = client.send(sendSMSRequest, 
                HttpResponse.BodyHandlers.ofString());
        
        return mapper.readTree(sendSMSResponse.body());
    }
    
    // ارسال پیامک به کاربر خاص با شماره تلفن
    public JsonNode sendSMSToUserByPhone(String targetPhoneNumber, String message) 
            throws IOException, InterruptedException {
        
        if (sessionToken == null || userId == null) {
            throw new IllegalStateException("No active session found");
        }
        
        Map<String, Object> sendSMSData = new HashMap<>();
        sendSMSData.put("userid", userId);
        sendSMSData.put("session", sessionToken);
        sendSMSData.put("targetphonenumber", targetPhoneNumber);
        sendSMSData.put("message", message);
        
        String sendSMSJson = mapper.writeValueAsString(sendSMSData);
        
        HttpRequest sendSMSRequest = HttpRequest.newBuilder()
                .uri(URI.create(BASE_URL + "/adminsendsmstouser"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(sendSMSJson))
                .build();
        
        HttpResponse<String> sendSMSResponse = client.send(sendSMSRequest, 
                HttpResponse.BodyHandlers.ofString());
        
        return mapper.readTree(sendSMSResponse.body());
    }
    
    // ارسال پیامک گروهی به همه کاربران
    public JsonNode sendSMSToAllUsers(String message) 
            throws IOException, InterruptedException {
        
        if (sessionToken == null || userId == null) {
            throw new IllegalStateException("No active session found");
        }
        
        Map<String, Object> sendSMSData = new HashMap<>();
        sendSMSData.put("userid", userId);
        sendSMSData.put("session", sessionToken);
        sendSMSData.put("message", message);
        
        String sendSMSJson = mapper.writeValueAsString(sendSMSData);
        
        HttpRequest sendSMSRequest = HttpRequest.newBuilder()
                .uri(URI.create(BASE_URL + "/adminsendsmstoallusers"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(sendSMSJson))
                .build();
        
        HttpResponse<String> sendSMSResponse = client.send(sendSMSRequest, 
                HttpResponse.BodyHandlers.ofString());
        
        return mapper.readTree(sendSMSResponse.body());
    }
    
    // نمونه استفاده
    public static void main(String[] args) {
        AdminAPIClient apiClient = new AdminAPIClient();
        
        try {
            // ورود
            JsonNode loginResult = apiClient.adminLogin("admin@example.com", "mypassword");
            System.out.println("Login: " + loginResult);
            
            if ("success".equals(loginResult.get("status").asText())) {
                // تعریف مدیر جدید با کد ملی
            JsonNode defineAdminResult = apiClient.defineNewAdminByNationalId("0987654321", 100);
            System.out.println("Define Admin by National ID: " + defineAdminResult);
            
            // تعریف مدیر جدید با شماره تلفن
            JsonNode defineAdminByPhoneResult = apiClient.defineNewAdminByPhone("09123456789", 50);
            System.out.println("Define Admin by Phone: " + defineAdminByPhoneResult);
            
            // حذف مدیر با کد ملی
            JsonNode removeAdminResult = apiClient.removeAdminByNationalId("0987654321");
            System.out.println("Remove Admin by National ID: " + removeAdminResult);
            
            // حذف مدیر با شماره تلفن
            JsonNode removeAdminByPhoneResult = apiClient.removeAdminByPhone("09123456789");
            System.out.println("Remove Admin by Phone: " + removeAdminByPhoneResult);
            
            // دریافت لیست مدیران
            JsonNode getAdminListResult = apiClient.getAdminList();
            System.out.println("Get Admin List: " + getAdminListResult);
            
            // دریافت لیست کاربران
            JsonNode getUserListResult = apiClient.getUserList();
            System.out.println("Get User List: " + getUserListResult);
            
            // دریافت اطلاعات کاربر با کد ملی
            JsonNode getUserInfoResult = apiClient.getUserInfoByNationalId("0987654321");
            System.out.println("Get User Info by National ID: " + getUserInfoResult);
            
            // دریافت اطلاعات کاربر با شماره تلفن
            JsonNode getUserInfoByPhoneResult = apiClient.getUserInfoByPhone("09123456789");
            System.out.println("Get User Info by Phone: " + getUserInfoByPhoneResult);
            
            // دریافت دستگاه‌های کاربر با کد ملی
            JsonNode getUserDevicesResult = apiClient.getUserDevicesByNationalId("0987654321");
            System.out.println("Get User Devices by National ID: " + getUserDevicesResult);
            
            // دریافت دستگاه‌های کاربر با شماره تلفن
            JsonNode getUserDevicesByPhoneResult = apiClient.getUserDevicesByPhone("09123456789");
            System.out.println("Get User Devices by Phone: " + getUserDevicesByPhoneResult);
            
            // دریافت روابط کاربر با کد ملی
            JsonNode getUserRelationshipsResult = apiClient.getUserRelationshipsByNationalId("0987654321");
            System.out.println("Get User Relationships by National ID: " + getUserRelationshipsResult);
            
            // دریافت روابط کاربر با شماره تلفن
            JsonNode getUserRelationshipsByPhoneResult = apiClient.getUserRelationshipsByPhone("09123456789");
            System.out.println("Get User Relationships by Phone: " + getUserRelationshipsByPhoneResult);
            
            // ارسال پیامک به کاربر خاص با کد ملی
            JsonNode sendSMSResult = apiClient.sendSMSToUserByNationalId("0987654321", "پیام تست");
            System.out.println("Send SMS by National ID: " + sendSMSResult);
            
            // ارسال پیامک به کاربر خاص با شماره تلفن
            JsonNode sendSMSByPhoneResult = apiClient.sendSMSToUserByPhone("09123456789", "پیام تست");
            System.out.println("Send SMS by Phone: " + sendSMSByPhoneResult);
            
            // ارسال پیامک گروهی
            JsonNode sendSMSToAllResult = apiClient.sendSMSToAllUsers("اطلاعیه عمومی");
            System.out.println("Send SMS to All Users: " + sendSMSToAllResult);
            
            // خروج
            JsonNode logoutResult = apiClient.adminLogout();
            System.out.println("Logout: " + logoutResult);
            }
            
        } catch (Exception e) {
            System.err.println("Error: " + e.getMessage());
        }
    }
    
    // Charge user bill (Admin Level > 0)
    public String chargeUserBill(String targetUser, String targetPhoneNumber, double amount) {
        if (!isSessionActive()) {
            return "Session not active";
        }
        
        try {
            JSONObject request = new JSONObject();
            request.put("userid", this.userid);
            request.put("session", this.session);
            if (targetUser != null && !targetUser.isEmpty()) {
                request.put("targetuser", targetUser);
            }
            if (targetPhoneNumber != null && !targetPhoneNumber.isEmpty()) {
                request.put("targetphonenumber", targetPhoneNumber);
            }
            request.put("amount", amount);
            
            return sendPostRequest("/adminchargeuserbill", request.toString());
        } catch (Exception e) {
            return "Error: " + e.getMessage();
        }
    }
    
    // Get user bill charge (Admin Level > 0)
    public String getUserBill(String targetUser, String targetPhoneNumber) {
        if (!isSessionActive()) {
            return "Session not active";
        }
        
        try {
            JSONObject request = new JSONObject();
            request.put("userid", this.userid);
            request.put("session", this.session);
            if (targetUser != null && !targetUser.isEmpty()) {
                request.put("targetuser", targetUser);
            }
            if (targetPhoneNumber != null && !targetPhoneNumber.isEmpty()) {
                request.put("targetphonenumber", targetPhoneNumber);
            }
            
            return sendGetRequest("/admingetuserbill", request.toString());
        } catch (Exception e) {
            return "Error: " + e.getMessage();
        }
    }
    
    // Renew MQTT expiration (Admin Level > 0)
    public String renewMqttExpiration(String targetUser, String targetPhoneNumber, int months) {
        if (!isSessionActive()) {
            return "Session not active";
        }
        
        try {
            JSONObject request = new JSONObject();
            request.put("userid", this.userid);
            request.put("session", this.session);
            if (targetUser != null && !targetUser.isEmpty()) {
                request.put("targetuser", targetUser);
            }
            if (targetPhoneNumber != null && !targetPhoneNumber.isEmpty()) {
                request.put("targetphonenumber", targetPhoneNumber);
            }
            request.put("months", months);
            
            return sendPostRequest("/adminrenewmqttexpiration", request.toString());
        } catch (Exception e) {
            return "Error: " + e.getMessage();
        }
    }
    
    // Disable user account (Admin Level > 0)
    public String disableUserAccount(String targetUser, String targetPhoneNumber) {
        if (!isSessionActive()) {
            return "Session not active";
        }
        
        try {
            JSONObject request = new JSONObject();
            request.put("userid", this.userid);
            request.put("session", this.session);
            if (targetUser != null && !targetUser.isEmpty()) {
                request.put("targetuser", targetUser);
            }
            if (targetPhoneNumber != null && !targetPhoneNumber.isEmpty()) {
                request.put("targetphonenumber", targetPhoneNumber);
            }
            
            return sendPostRequest("/admindisableuseraccount", request.toString());
        } catch (Exception e) {
            return "Error: " + e.getMessage();
        }
    }
    
    // Enable user account (Admin Level > 0)
    public String enableUserAccount(String targetUser, String targetPhoneNumber) {
        if (!isSessionActive()) {
            return "Session not active";
        }
        
        try {
            JSONObject request = new JSONObject();
            request.put("userid", this.userid);
            request.put("session", this.session);
            if (targetUser != null && !targetUser.isEmpty()) {
                request.put("targetuser", targetUser);
            }
            if (targetPhoneNumber != null && !targetPhoneNumber.isEmpty()) {
                request.put("targetphonenumber", targetPhoneNumber);
            }
            
            return sendPostRequest("/adminenableuseraccount", request.toString());
        } catch (Exception e) {
            return "Error: " + e.getMessage();
        }
    }
    
    public static void main(String[] args) {
        AdminAPIClient client = new AdminAPIClient("https://api.example.com");
        
        try {
            // Login as admin
            String loginResult = client.login("1234567890", "admin_password");
            System.out.println("Login result: " + loginResult);
            
            // Get user info by national ID
            String userInfo = client.getUserInfoByNationalId("0987654321");
            System.out.println("User info: " + userInfo);
            
            // Get user info by phone number
            String userInfoByPhone = client.getUserInfoByPhone("09123456789");
            System.out.println("User info by phone: " + userInfoByPhone);
            
            // Get user devices by national ID
            String userDevices = client.getUserDevicesByNationalId("0987654321");
            System.out.println("User devices: " + userDevices);
            
            // Get user devices by phone number
            String userDevicesByPhone = client.getUserDevicesByPhone("09123456789");
            System.out.println("User devices by phone: " + userDevicesByPhone);
            
            // Get user relationships by national ID
            String userRelationships = client.getUserRelationshipsByNationalId("0987654321");
            System.out.println("User relationships: " + userRelationships);
            
            // Get user relationships by phone number
            String userRelationshipsByPhone = client.getUserRelationshipsByPhone("09123456789");
            System.out.println("User relationships by phone: " + userRelationshipsByPhone);
            
            // Charge user bill by national ID
            String chargeResult = client.chargeUserBill("0987654321", null, 50000.0);
            System.out.println("Charge result: " + chargeResult);
            
            // Get user bill by phone number
            String billInfo = client.getUserBill(null, "09123456789");
            System.out.println("Bill info: " + billInfo);
            
            // Renew MQTT expiration for 6 months
            String renewResult = client.renewMqttExpiration("0987654321", null, 6);
            System.out.println("MQTT renewal result: " + renewResult);
            
            // Disable user account
            String disableResult = client.disableUserAccount(null, "09123456789");
            System.out.println("Disable account result: " + disableResult);
            
            // Enable user account
            String enableResult = client.enableUserAccount(null, "09123456789");
            System.out.println("Enable account result: " + enableResult);
            
            // Get detailed user information by national ID
            String detailedUserInfo = client.getDetailedUserInfo("0987654321", null);
            System.out.println("Detailed user info: " + detailedUserInfo);
            
            // Get detailed user information by phone number
            String detailedUserInfoByPhone = client.getDetailedUserInfo(null, "09123456789");
            System.out.println("Detailed user info by phone: " + detailedUserInfoByPhone);
            
            // Logout
            String logoutResult = client.logout();
            System.out.println("Logout result: " + logoutResult);
            
        } catch (Exception e) {
            System.err.println("Error: " + e.getMessage());
        }
    }
    
    // Get detailed user information (Admin Level > 0)
    public String getDetailedUserInfo(String targetUser, String targetPhoneNumber) {
        if (!isSessionActive()) {
            return "Session not active";
        }
        
        try {
            JSONObject request = new JSONObject();
            request.put("userid", this.userid);
            request.put("session", this.session);
            if (targetUser != null && !targetUser.isEmpty()) {
                request.put("targetuser", targetUser);
            }
            if (targetPhoneNumber != null && !targetPhoneNumber.isEmpty()) {
                request.put("targetphonenumber", targetPhoneNumber);
            }
            
            return sendPostRequest("/admingetuserinfo", request.toString());
        } catch (Exception e) {
            return "Error: " + e.getMessage();
        }
    }
}
```

---

## نتیجه‌گیری

API های مدیریت با رعایت اصول امنیتی طراحی شده‌اند و شامل لایه‌های مختلف محافظت هستند. برای استفاده بهینه:

1. همیشه رمز عبور را هش کنید
2. Token ها را امن نگهداری کنید
3. خطاها را مدیریت کنید
4. از HTTPS استفاده کنید
5. لاگ‌های امنیتی را بررسی کنید

این راهنما برای توسعه سایر API های مدیریت نیز قابل استفاده است.