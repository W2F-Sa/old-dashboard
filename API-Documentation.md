# API Documentation - getSensorDataInTime

## نمای کلی
تابع `getSensorDataInTime` برای دریافت داده‌های سنسور در بازه‌های زمانی مشخص طراحی شده است.

## آدرس API
```
POST https://api.giot.ir/getsensordataintime
```

## ورودی (Request)

### Headers
```json
{
  "Content-Type": "application/json"
}
```

### Body
```json
{
  "userid": "1234567890",
  "session": "jwt_token_here",
  "macaddress": "AA:BB:CC:DD:EE:FF",
  "starttime": "2024-01-01 00:00:00",
  "endtime": "2024-01-31 23:59:59"
}
```

### پارامترها
- **userid**: شناسه کاربر (الزامی)
- **session**: توکن جلسه JWT (الزامی)
- **macaddress**: آدرس MAC دستگاه (الزامی)
- **starttime**: زمان شروع به فرمت `YYYY-MM-DD HH:MM:SS` (الزامی)
- **endtime**: زمان پایان به فرمت `YYYY-MM-DD HH:MM:SS` (الزامی)

## خروجی (Response)

### پاسخ موفق
```json
{
  "status": "success",
  "data": [
    {
      "time": "2024-01-15 10:30:25",
      "data": "{\"lat\":35.6892,\"lng\":51.3890,\"speed\":45}",
      "datadirection": "R"
    },
    {
      "time": "2024-01-15 10:35:30",
      "data": "{\"lat\":35.6895,\"lng\":51.3895,\"speed\":50}",
      "datadirection": "R"
    }
  ],
  "count": 2,
  "start_time": "2024-01-01 00:00:00",
  "end_time": "2024-01-31 23:59:59",
  "device_mac": "AA:BB:CC:DD:EE:FF"
}
```

### پاسخ خطا
```json
{
  "status": "error",
  "message": "Invalid session or unauthorized access"
}
```

### فیلدهای پاسخ
- **status**: وضعیت درخواست (`success` یا `error`)
- **data**: آرایه‌ای از داده‌های سنسور
  - **time**: زمان دریافت داده
  - **data**: داده‌های JSON سنسور (به صورت رشته)
  - **datadirection**: جهت داده (`R` برای دریافت، `S` برای ارسال)
- **count**: تعداد کل رکوردها
- **start_time**: زمان شروع درخواست شده
- **end_time**: زمان پایان درخواست شده
- **device_mac**: آدرس MAC دستگاه

## نحوه استفاده در JavaScript

### تابع اصلی
```javascript
async function getSensorDataInTime(startTime, endTime) {
    const userid = sessionStorage.getItem('userid');
    const session = sessionStorage.getItem('session');
    const macaddress = sessionStorage.getItem('macaddress');
    
    const postData = {
        userid: userid,
        session: session,
        macaddress: macaddress,
        starttime: startTime,
        endtime: endTime
    };
    
    const response = await fetch('https://api.giot.ir/getsensordataintime', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(postData)
    });
    
    const result = await response.json();
    return result;
}
```

### توابع کمکی
```javascript
// دریافت داده‌های امروز
async function getDataForToday() {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
    
    return await getDataForDateRange(startOfDay, endOfDay);
}

// دریافت داده‌های N روز گذشته
async function getDataForLastDays(days) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    return await getDataForDateRange(startDate, endDate);
}

// فرمت کردن تاریخ برای API
function formatDateForAPI(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}
```

## مثال‌های استفاده

### دریافت داده‌های بازه زمانی مشخص
```javascript
const result = await getSensorDataInTime(
    '2024-01-01 00:00:00',
    '2024-01-31 23:59:59'
);

if (result.status === 'success') {
    console.log(`تعداد داده‌ها: ${result.count}`);
    result.data.forEach(item => {
        console.log(`زمان: ${item.time}, داده: ${item.data}`);
    });
}
```

### دریافت داده‌های امروز
```javascript
const todayData = await getDataForToday();
if (todayData) {
    console.log('داده‌های امروز:', todayData);
}
```

### دریافت داده‌های 7 روز گذشته
```javascript
const weekData = await getDataForLastDays(7);
if (weekData) {
    console.log('داده‌های هفته گذشته:', weekData);
}
```

## کدهای خطا

- **400**: درخواست نامعتبر (پارامترهای ناقص یا نامعتبر)
- **401**: عدم احراز هویت (session نامعتبر)
- **403**: عدم دسترسی (کاربر مجاز نیست)
- **404**: دستگاه یافت نشد
- **500**: خطای سرور

## نکات مهم

1. **احراز هویت**: حتماً قبل از فراخوانی API، اطلاعات `userid`، `session` و `macaddress` را در sessionStorage تنظیم کنید.

2. **فرمت زمان**: زمان باید دقیقاً به فرمت `YYYY-MM-DD HH:MM:SS` باشد.

3. **محدودیت زمانی**: توصیه می‌شود بازه زمانی درخواستی بیش از 30 روز نباشد.

4. **مدیریت خطا**: همیشه پاسخ API را بررسی کنید و خطاها را مدیریت کنید.

5. **کارایی**: برای داده‌های زیاد، از صفحه‌بندی استفاده کنید.

## فایل‌های مرتبط

- `script.js`: پیاده‌سازی اصلی توابع API
- `index.html`: رابط کاربری اصلی با پنل داده‌های تاریخی
- `test-api.html`: صفحه تست API
- `styles.css`: استایل‌های مربوط به UI

## تست API

برای تست API، از فایل `test-api.html` استفاده کنید:

1. فایل `test-api.html` را در مرورگر باز کنید
2. اطلاعات جلسه را وارد کنید
3. بازه زمانی مورد نظر را انتخاب کنید
4. دکمه "تست API" را کلیک کنید
5. نتیجه در قسمت "نتیجه" نمایش داده می‌شود