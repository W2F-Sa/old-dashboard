# MQTT GPIO Automation Control
# کنترل اتوماسیون GPIO با MQTT

This document explains how to control GPIO automation system via MQTT messages, similar to existing web APIs but without session validation.

این سند نحوه کنترل سیستم اتوماسیون GPIO از طریق پیام‌های MQTT را توضیح می‌دهد، مشابه API های وب موجود اما بدون اعتبارسنجی جلسه.

## MQTT Message IDs / شناسه‌های پیام MQTT

The following message IDs are used for GPIO automation control:
شناسه‌های پیام زیر برای کنترل اتوماسیون GPIO استفاده می‌شوند:

- **30**: Get Automation Rules / دریافت قوانین اتوماسیون
- **31**: Save Automation Rules / ذخیره قوانین اتوماسیون  
- **32**: Get Automation Status / دریافت وضعیت اتوماسیون

## Message Format / فرمت پیام

All MQTT messages should be sent as JSON with the following structure:
همه پیام‌های MQTT باید به صورت JSON با ساختار زیر ارسال شوند:

```json
{
    "msg_id": 30,
    "request_id": "unique-request-id",
    "data": {
        // Optional data for specific operations
        // داده‌های اختیاری برای عملیات خاص
    }
}
```

## API Functions / توابع API

### 1. Get Automation Rules (msg_id: 30)
### 1. دریافت قوانین اتوماسیون (msg_id: 30)

Retrieves all automation rules from the system.
تمام قوانین اتوماسیون را از سیستم دریافت می‌کند.

**Request / درخواست:**
```json
{
    "msg_id": 30,
    "request_id": "get-rules-001"
}
```

**Response / پاسخ:**
```json
{
    "status": "success",
    "request_id": "get-rules-001",
    "data": {
        "automation_rules": [
            {
                "id": 1,
                "name": "Morning Light",
                "description": "Turn on lights at sunrise",
                "enabled": true,
                "priority": 1,
                "trigger": {
                    "type": "sun_based",
                    "event": "sunrise",
                    "offset_minutes": 0
                },
                "actions": [
                    {
                        "type": "gpio_output",
                        "pin_number": 408,
                        "state": "high",
                        "duration_ms": 0
                    }
                ]
            }
        ],
        "global_settings": {
            "automation_enabled": true,
            "check_interval_ms": 1000,
            "max_concurrent_rules": 10,
            "log_rule_execution": true
        }
    }
}
```

### 2. Save Automation Rules (msg_id: 31)
### 2. ذخیره قوانین اتوماسیون (msg_id: 31)

Saves automation rules to the system and manages the automation thread.
قوانین اتوماسیون را در سیستم ذخیره می‌کند و thread اتوماسیون را مدیریت می‌کند.

**Request / درخواست:**
```json
{
    "msg_id": 31,
    "request_id": "save-rules-001",
    "data": {
        "automation_rules": [
            {
                "id": 1,
                "name": "Evening Light",
                "description": "Turn off lights at sunset",
                "enabled": true,
                "priority": 1,
                "trigger": {
                    "type": "sun_based",
                    "event": "sunset",
                    "offset_minutes": 30
                },
                "actions": [
                    {
                        "type": "gpio_output",
                        "pin_number": 408,
                        "state": "low",
                        "duration_ms": 0
                    }
                ]
            }
        ],
        "global_settings": {
            "automation_enabled": true,
            "check_interval_ms": 1000,
            "max_concurrent_rules": 10,
            "log_rule_execution": true
        }
    }
}
```

**Response / پاسخ:**
```json
{
    "status": "success",
    "request_id": "save-rules-001",
    "message": "Automation rules saved successfully and automation system started"
}
```

### 3. Get Automation Status (msg_id: 32)
### 3. دریافت وضعیت اتوماسیون (msg_id: 32)

Retrieves the current status of the automation system.
وضعیت فعلی سیستم اتوماسیون را دریافت می‌کند.

**Request / درخواست:**
```json
{
    "msg_id": 32,
    "request_id": "get-status-001"
}
```

**Response / پاسخ:**
```json
{
    "status": "success",
    "request_id": "get-status-001",
    "data": {
        "automation_enabled": true,
        "thread_running": true,
        "total_rules": 5,
        "last_check": "2024-01-15 14:30:25"
    }
}
```

## Global Variables / متغیرهای سراسری

The following global variables are now accessible across files:
متغیرهای سراسری زیر اکنون در تمام فایل‌ها قابل دسترسی هستند:

```cpp
// In extra.hpp
extern nlohmann::json automation_rules;
extern bool automation_system_enabled;
extern std::mutex automation_mutex;
extern std::thread automation_thread;
extern bool automation_thread_running;
extern std::map<int, time_t> rule_last_execution;
extern std::map<int, bool> rule_current_state;
```

## Testing / تست

Use the provided test script to verify MQTT automation functionality:
از اسکریپت تست ارائه شده برای تأیید عملکرد اتوماسیون MQTT استفاده کنید:

```bash
python test_mqtt_automation.py
```

Make sure to configure the MQTT broker settings in the test script:
مطمئن شوید که تنظیمات بروکر MQTT را در اسکریپت تست پیکربندی کرده‌اید:

```python
MQTT_BROKER = "localhost"  # Your MQTT broker address
MQTT_PORT = 1883
MQTT_USERNAME = "mahan"
MQTT_PASSWORD = "Mahan313"
MQTT_TOPIC = "giot/device/001"  # Your device topic
```

## Error Handling / مدیریت خطا

All MQTT handlers include proper error handling and will return appropriate error messages:
تمام handler های MQTT شامل مدیریت خطای مناسب هستند و پیام‌های خطای مناسب را برمی‌گردانند:

```json
{
    "status": "error",
    "request_id": "request-id",
    "message": "Error description"
}
```

## Integration Notes / نکات یکپارچه‌سازی

1. **No Session Validation**: Unlike web APIs, MQTT handlers do not require session validation
   **بدون اعتبارسنجی جلسه**: برخلاف API های وب، handler های MQTT نیازی به اعتبارسنجی جلسه ندارند

2. **Thread Management**: The automation thread is automatically started/stopped based on `automation_enabled` setting
   **مدیریت Thread**: thread اتوماسیون به طور خودکار بر اساس تنظیم `automation_enabled` شروع/متوقف می‌شود

3. **File Synchronization**: Changes made via MQTT are saved to `gpio_automation.json` file
   **همگام‌سازی فایل**: تغییرات انجام شده از طریق MQTT در فایل `gpio_automation.json` ذخیره می‌شوند

4. **Global Access**: All automation variables are now globally accessible for cross-file operations
   **دسترسی سراسری**: تمام متغیرهای اتوماسیون اکنون برای عملیات بین فایل‌ها به صورت سراسری قابل دسترسی هستند

## Compilation / کامپایل

Make sure to include the necessary headers in your MQTT files:
مطمئن شوید که header های لازم را در فایل‌های MQTT خود قرار داده‌اید:

```cpp
#include "extra.hpp"  // For automation functions and global variables
```

The system should compile without issues as all dependencies are properly declared.
سیستم باید بدون مشکل کامپایل شود زیرا تمام وابستگی‌ها به درستی اعلام شده‌اند.