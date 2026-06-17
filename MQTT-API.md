# راهنمای MQTT API

این راهنما برای توسعه‌دهندگان فرانت‌اند جهت استفاده از API های MQTT دستگاه تهیه شده است.

## مقدمه

API های MQTT دستگاه مشابه API های وب عمل می‌کنند اما از طریق پروتکل MQTT ارتباط برقرار می‌کنند. 

**مهم**: این API ها هیچ‌گونه احراز هویت session یا token نیاز ندارند. امنیت کامل از طریق اتصال MQTT با username و password فراهم می‌شود. بر خلاف API های HTTP که نیاز به session_token دارند، API های MQTT بدون هیچ محدودیت احراز هویت کاربر قابل استفاده هستند.

**Device ID**: همه درخواست‌ها باید شامل فیلد "deviceid" باشند که حاوی CPU Serial ID دستگاه است. دستگاه تنها به پیام‌هایی پاسخ می‌دهد که deviceid آن‌ها با CPU Serial ID خودش مطابقت داشته باشد. این مکانیزم تضمین می‌کند که پیام‌ها تنها توسط دستگاه مقصد پردازش شوند.


## دریافت CPU Serial ID

برای دریافت CPU Serial ID دستگاه، می‌توانید از API "دریافت اطلاعات سیستم" (msg_id: 10) استفاده کنید. این API اطلاعات کاملی از سیستم شامل CPU Serial ID ارائه می‌دهد. CPU Serial ID در فیلد `data.cpu_serial` پاسخ موجود است.

**نکته**: برای اولین بار که می‌خواهید CPU Serial ID را دریافت کنید، می‌توانید از هر مقدار دلخواه برای deviceid استفاده کنید، اما پس از دریافت CPU Serial ID واقعی، باید از همان مقدار در تمام درخواست‌های بعدی استفاده کنید.

## ساختار پیام‌ها

### درخواست (Request)
```json
{
  "msg_id": <شماره پیام>,
  "deviceid": "<CPU Serial ID دستگاه>",
  "data": {
    // داده‌های مربوط به درخواست
  }
}
```

### پاسخ (Response)
```json
{
  "deviceid": "<CPU Serial ID دستگاه>",
  "timestamp": <Unix Timestamp>,
  "msg_id": <شماره پیام>,
  "status": "success|error",
  "message": "<پیام توضیحی>",
  "data": {
    // داده‌های پاسخ
  }
}
```

## فهرست API ها

### 1. ذخیره تنظیمات MQTT خصوصی (msg_id: 1)

**توضیح**: ذخیره اطلاعات MQTT جدید و اتصال مجدد با تنظیمات جدید

**درخواست**:
```json
{
  "msg_id": 1,
  "deviceid": "1000000012345678",
  "deviceconfig": {
    "server": "mqtt.example.com",
    "port": 1883,
    "username": "device_user",
    "password": "device_pass",
    "client_id": "device_001",
    "topic": "devices/001",
    "ssl_enabled": false
  }
}
```

**پاسخ موفق**:
```json
{
  "deviceid": "1000000012345678",
  "timestamp": 1640995200,
  "msg_id": 1,
  "status": "success",
  "message": "تنظیمات MQTT ذخیره شد و اتصال مجدد انجام شد"
}
```

### 2. دریافت تنظیمات اذان (msg_id: 2)

**درخواست**:
```json
{
  "msg_id": 2,
  "deviceid": "1000000012345678"
}
```

**پاسخ موفق**:
```json
{
  "deviceid": "1000000012345678",
  "timestamp": 1640995200,
  "msg_id": 2,
  "status": "success",
  "data": {
    "enabled": true,
    "volume": 75,
    "fajr_enabled": true,
    "dhuhr_enabled": true,
    "asr_enabled": true,
    "maghrib_enabled": true,
    "isha_enabled": true,
    "location": {
      "latitude": 35.6892,
      "longitude": 51.3890,
      "city": "Tehran"
    }
  }
}
```

### 3. ذخیره تنظیمات اذان (msg_id: 3)

**درخواست**:
```json
{
  "msg_id": 3,
  "deviceid": "1000000012345678",
  "data": {
    "enabled": true,
    "volume": 80,
    "fajr_enabled": true,
    "dhuhr_enabled": true,
    "asr_enabled": false,
    "maghrib_enabled": true,
    "isha_enabled": true,
    "location": {
      "latitude": 35.6892,
      "longitude": 51.3890,
      "city": "Tehran"
    }
  }
}
```

### 4. دریافت تنظیمات PIMS (msg_id: 4)

**درخواست**:
```json
{
  "msg_id": 4,
  "deviceid": "1000000012345678"
}
```

### 5. ذخیره تنظیمات PIMS (msg_id: 5)

**درخواست**:
```json
{
  "msg_id": 5,
  "deviceid": "1000000012345678",
  "data": {
    "server_url": "https://pims.example.com",
    "api_key": "your_api_key",
    "sync_interval": 300,
    "enabled": true
  }
}
```

### 6. دریافت تنظیمات SIP (msg_id: 6)

**درخواست**:
```json
{
  "msg_id": 6,
  "deviceid": "1000000012345678"
}
```

### 7. ذخیره تنظیمات SIP (msg_id: 7)

**درخواست**:
```json
{
  "msg_id": 7,
  "deviceid": "1000000012345678",
  "data": {
    "server": "sip.example.com",
    "port": 5060,
    "username": "sip_user",
    "password": "sip_pass",
    "enabled": true
  }
}
```

### 8. دریافت تنظیمات Digital IO (msg_id: 8)

**درخواست**:
```json
{
  "msg_id": 8,
  "deviceid": "1000000012345678"
}
```

### 9. ذخیره تنظیمات Digital IO (msg_id: 9)

**درخواست**:
```json
{
  "msg_id": 9,
  "deviceid": "1000000012345678",
  "data": {
    "input_pins": [2, 3, 4],
    "output_pins": [5, 6, 7],
    "pull_up_enabled": true,
    "debounce_time": 50
  }
}
```

### 10. دریافت اطلاعات سیستم (msg_id: 10)

**درخواست**:
```json
{
  "msg_id": 10,
  "deviceid": "1000000012345678"
}
```

**پاسخ موفق**:
```json
{
  "deviceid": "1000000012345678",
  "timestamp": 1640995200,
  "msg_id": 10,
  "status": "success",
  "data": {
    "device_name": "IoT Device 001",
    "firmware_version": "1.2.3",
    "hardware_version": "2.1",
    "cpu_usage": 25.5,
    "memory_usage": 45.2,
    "storage_usage": 60.1,
    "uptime": 86400,
    "ip_address": "192.168.1.100"
  }
}
```

### 11. ذخیره اطلاعات سیستم (msg_id: 11)

**درخواست**:
```json
{
  "msg_id": 11,
  "deviceid": "1000000012345678",
  "data": {
    "device_name": "New Device Name",
    "location": "Office Room 1",
    "description": "Temperature and humidity sensor"
  }
}
```

### 12. دریافت وضعیت GPIO (msg_id: 12)

**درخواست**:
```json
{
  "msg_id": 12,
  "deviceid": "1000000012345678",
  "data": {
    "pin": 5
  }
}
```

**پاسخ موفق**:
```json
{
  "deviceid": "1000000012345678",
  "timestamp": 1640995200,
  "msg_id": 12,
  "status": "success",
  "data": {
    "pin": 5,
    "value": 1,
    "state": "HIGH"
  }
}
```

### 13. تنظیم وضعیت GPIO (msg_id: 13)

**درخواست**:
```json
{
  "msg_id": 13,
  "deviceid": "1000000012345678",
  "data": {
    "pin": 5,
    "value": 1
  }
}
```

**پاسخ موفق**:
```json
{
  "deviceid": "1000000012345678",
  "timestamp": 1640995200,
  "msg_id": 13,
  "status": "success",
  "message": "وضعیت GPIO با موفقیت تنظیم شد",
  "pin": 5,
  "value": 1
}
```

### 14. تغییر وضعیت GPIO (Toggle) (msg_id: 14)

**درخواست**:
```json
{
  "msg_id": 14,
  "deviceid": "1000000012345678",
  "data": {
    "pin": 5
  }
}
```

**پاسخ موفق**:
```json
{
  "deviceid": "1000000012345678",
  "timestamp": 1640995200,
  "msg_id": 14,
  "status": "success",
  "message": "وضعیت GPIO با موفقیت تغییر کرد",
  "pin": 5,
  "previous_value": 0,
  "new_value": 1
}
```

### 20. دریافت زمان سیستم (msg_id: 20)

**درخواست**:
```json
{
  "msg_id": 20,
  "deviceid": "1000000012345678"
}
```

**پاسخ موفق**:
```json
{
  "deviceid": "1000000012345678",
  "timestamp": 1640995200,
  "msg_id": 20,
  "status": "success",
  "data": {
    "unix_timestamp": 1640995200,
    "year": 2022,
    "month": 1,
    "day": 1,
    "hour": 12,
    "minute": 0,
    "second": 0,
    "weekday": 6,
    "uptime_seconds": 86400
  }
}
```

### 21. تنظیم زمان سیستم (msg_id: 21)

**درخواست**:
```json
{
  "msg_id": 21,
  "deviceid": "1000000012345678",
  "data": {
    "datetime": {
      "year": 2022,
      "month": 12,
      "day": 25,
      "hour": 14,
      "minute": 30,
      "second": 0
    }
  }
}
```

**پاسخ موفق**:
```json
{
  "deviceid": "1000000012345678",
  "timestamp": 1671975000,
  "msg_id": 21,
  "status": "success",
  "message": "تاریخ و زمان سیستم با موفقیت تنظیم شد",
  "new_timestamp": 1671975000
}
```

## مدیریت خطاها

در صورت بروز خطا، پاسخ به شکل زیر خواهد بود:

```json
{
  "deviceid": "1000000012345678",
  "timestamp": 1640995200,
  "msg_id": <شماره پیام>,
  "status": "error",
  "message": "توضیح خطا",
  "error_details": "جزئیات تکنیکی خطا (اختیاری)"
}
```

## نکات مهم برای توسعه‌دهندگان

1. **بدون احراز هویت**: هیچ session_token یا authentication header نیاز نیست
2. **امنیت MQTT**: تنها امنیت از طریق username/password اتصال MQTT فراهم می‌شود
3. **Device ID بررسی**: همه درخواست‌ها باید شامل فیلد "deviceid" باشند که با CPU Serial ID دستگاه مطابقت داشته باشد
4. **CPU Serial ID**: دستگاه تنها به پیام‌هایی پاسخ می‌دهد که deviceid آن‌ها با CPU Serial ID دستگاه برابر باشد
5. **Timeout**: برای هر درخواست timeout مناسب (5-10 ثانیه) در نظر بگیرید
6. **Retry Logic**: در صورت عدم دریافت پاسخ، حداکثر 3 بار تلاش مجدد کنید
7. **Connection Status**: قبل از ارسال درخواست، وضعیت اتصال MQTT را بررسی کنید
8. **Message ID**: هر پیام باید msg_id منحصر به فرد داشته باشد
9. **Device ID در پاسخ**: همیشه CPU Serial ID دستگاه در پاسخ موجود است
10. **Timestamp**: همه پاسخ‌ها شامل Unix timestamp هستند

## مثال کد JavaScript

```javascript
const mqtt = require('mqtt');

class DeviceMQTTAPI {
  constructor(brokerUrl, username, password, deviceId) {
    this.deviceId = deviceId; // CPU Serial ID دستگاه
    this.client = mqtt.connect(brokerUrl, {
      username: username,
      password: password
    });
    
    this.client.on('connect', () => {
      console.log('Connected to MQTT broker');
      this.client.subscribe('device/response');
    });
    
    this.client.on('message', (topic, message) => {
      const response = JSON.parse(message.toString());
      this.handleResponse(response);
    });
  }
  
  sendRequest(msgId, data = {}) {
    const request = {
      msg_id: msgId,
      deviceid: this.deviceId, // اضافه کردن Device ID
      data: data
    };
    
    this.client.publish('device/request', JSON.stringify(request));
  }
  
  // دریافت اطلاعات سیستم
  getSystemInfo() {
    this.sendRequest(10);
  }
  
  // تنظیم GPIO
  setGPIO(pin, value) {
    this.sendRequest(13, { pin: pin, value: value });
  }
  
  // دریافت زمان سیستم
  getSystemTime() {
    this.sendRequest(20);
  }
  
  handleResponse(response) {
    console.log(`Response for msg_id ${response.msg_id}:`, response);
    
    // بررسی Device ID در پاسخ
    if (response.deviceid !== this.deviceId) {
      console.warn('Device ID mismatch in response');
      return;
    }
    
    if (response.status === 'error') {
      console.error('Error:', response.message);
    }
  }
}

// استفاده
const deviceAPI = new DeviceMQTTAPI('mqtt://localhost:1883', 'username', 'password', '1000000012345678');
deviceAPI.getSystemInfo();
```

## پشتیبانی

برای سوالات فنی یا گزارش مشکلات، با تیم توسعه تماس بگیرید.