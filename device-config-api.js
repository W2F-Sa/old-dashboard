/**
 * Device Configuration API Module
 * این ماژول شامل توابع مدیریت پیکربندی دستگاه است که با api.giot.ir کار می‌کند
 */

class DeviceConfigAPI {
    constructor() {
        this.apiBaseUrl = 'https://api.giot.ir';
        this.jwtToken = null;
    }

    /**
     * تنظیم توکن JWT برای احراز هویت
     * @param {string} token - JWT Token معتبر
     */
    setJwtToken(token) {
        this.jwtToken = token;
    }

    /**
     * دریافت توکن JWT از sessionStorage
     * @returns {string|null} - JWT Token یا null
     */
    getJwtToken() {
        if (!this.jwtToken) {
            this.jwtToken = sessionStorage.getItem('session') || sessionStorage.getItem('jwtToken');
        }
        return this.jwtToken;
    }

    /**
     * تابع مدیریت خطاهای عمومی
     * @param {Error} error - شیء خطا
     * @param {string} context - زمینه خطا برای نمایش در لاگ
     * @returns {Object} - شیء خطای استاندارد
     */
    handleApiError(error, context) {
        console.error(`Error in ${context}:`, error);
        
        // نمایش پیام خطا به کاربر
        let errorMessage = 'خطای نامشخص در سرور';
        let errorCode = 500;

        if (error.response) {
            // خطای پاسخ از سرور
            errorCode = error.response.status;
            switch (errorCode) {
                case 400:
                    errorMessage = 'پارامترهای ورودی نامعتبر هستند - لطفاً اطلاعات دستگاه را بررسی کنید';
                    break;
                case 401:
                    errorMessage = 'JWT Token نامعتبر یا منقضی شده است - لطفاً مجدداً وارد شوید';
                    break;
                case 403:
                    errorMessage = 'شما دسترسی لازم به این دستگاه را ندارید - لطفاً با مدیر سیستم تماس بگیرید';
                    break;
                case 404:
                    errorMessage = 'دستگاه مورد نظر یافت نشد - احتمالاً MAC Address اشتباه است';
                    break;
                case 503:
                    errorMessage = 'سرویس MQTT در دسترس نیست - لطفاً بعداً تلاش کنید';
                    break;
                default:
                    errorMessage = error.response.data?.message || 'خطای داخلی سرور - لطفاً بعداً تلاش کنید';
            }
        } else if (error.request) {
            // خطای درخواست (بدون پاسخ)
            errorMessage = 'عدم برقراری ارتباط با سرور - لطفاً اتصال اینترنت خود را بررسی کنید';
            errorCode = 0;
        } else {
            // خطای عمومی
            errorMessage = error.message || 'خطا در پردازش درخواست';
            
            // بررسی خطاهای خاص
            if (error.message.includes('پیکربندی خالی')) {
                errorMessage = 'پیکربندی دستگاه خالی است - احتمالاً دستگاه هنوز تنظیم نشده است. لطفاً ابتدا پیکربندی را تنظیم کنید.';
            } else if (error.message.includes('JWT Token')) {
                errorMessage = 'مشکل در احراز هویت - لطفاً مجدداً وارد شوید';
            } else if (error.message.includes('کد ملی') || error.message.includes('MAC')) {
                errorMessage = 'اطلاعات دستگاه ناقص است - لطفاً دستگاه مناسب را انتخاب کنید';
            }
        }

        // نمایش نوتیفیکیشن خطا به کاربر
        this.showNotification(errorMessage, 'error');

        return {
            status: 'error',
            message: errorMessage,
            code: errorCode,
            originalError: error
        };
    }

    /**
     * نمایش نوتیفیکیشن به کاربر
     * @param {string} message - پیام
     * @param {string} type - نوع پیام (success, error, warning)
     */
    showNotification(message, type = 'info') {
        // استفاده از سیستم نوتیفیکیشن موجود در agriculture.js
        if (typeof showNotification === 'function') {
            showNotification(message, type);
        } else {
            // fallback ساده
            console.log(`[${type.toUpperCase()}] ${message}`);
            alert(message);
        }
    }

    /**
     * تابع 1: دریافت پیکربندی فعلی دستگاه
     * @param {string} codemelli - کد ملی کاربر
     * @param {string} macaddress - آدرس MAC دستگاه
     * @returns {Promise<Object>} - پیکربندی دستگاه
     */
    async getDeviceConfig(codemelli, macaddress) {
        try {
            const token = this.getJwtToken();
            if (!token) {
                throw new Error('JWT Token مورد نیاز است - لطفاً مجدداً وارد شوید');
            }

            if (!codemelli || !macaddress) {
                throw new Error('کد ملی و آدرس MAC مورد نیاز است - اطلاعات دستگاه ناقص است');
            }

            console.log('Sending request to API with:', { codemelli, macaddress });

            const response = await fetch(`${this.apiBaseUrl}/getdeviceconfig`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userid: codemelli,
                    macaddress: macaddress,
                    session: token
                })
            });

            console.log('API response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('API error response:', errorText);
                throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
            }

            const result = await response.json();
            console.log('API response data:', result);

            if (result.status === 'success') {
                // بررسی وجود deviceconfig در پاسخ
                if (result.deviceconfig) {
                    console.log('Configuration retrieved:', result.deviceconfig);
                    this.showNotification('پیکربندی دستگاه با موفقیت دریافت شد', 'success');
                    return result.deviceconfig;
                } else {
                    console.warn('No deviceconfig found in response');
                    this.showNotification('پیکربندی خالی یا نامعتبر است - احتمالاً دستگاه هنوز پیکربندی نشده است', 'warning');
                    return null;
                }
            } else {
                // اگر سرور پیام خطای خاصی ارسال کرده، آن را نمایش دهیم
                const errorMessage = result.message || 'خطا در دریافت پیکربندی';
                console.error('Server error:', errorMessage);
                throw new Error(errorMessage);
            }
        } catch (error) {
            console.error('Error in getDeviceConfig:', error);
            return this.handleApiError(error, 'getDeviceConfig');
        }
    }

    /**
     * تابع 2: تنظیم و ذخیره پیکربندی جدید برای دستگاه
     * @param {string} codemelli - کد ملی کاربر
     * @param {string} macaddress - آدرس MAC دستگاه
     * @param {Object} deviceconfig - پیکربندی جدید دستگاه
     * @returns {Promise<boolean>} - نتیجه عملیات
     */
    async setDeviceConfig(codemelli, macaddress, deviceconfig) {
        try {
            // اعتبارسنجی پارامترهای ورودی
            if (!codemelli || !macaddress || !deviceconfig) {
                throw new Error('تمام پارامترها (کد ملی، آدرس MAC و پیکربندی) مورد نیاز است');
            }

            const token = this.getJwtToken();
            if (!token) {
                throw new Error('JWT Token مورد نیاز است');
            }

            const response = await fetch(`${this.apiBaseUrl}/setdeviceconfig`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userid: codemelli,
                    macaddress: macaddress,
                    deviceconfig: deviceconfig,
                    session: token
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();

            if (result.status === 'success') {
                console.log('Configuration updated successfully');
                this.showNotification('پیکربندی دستگاه با موفقیت به‌روزرسانی شد', 'success');
                return true;
            } else {
                throw new Error(result.message || 'خطا در به‌روزرسانی پیکربندی');
            }
        } catch (error) {
            return this.handleApiError(error, 'setDeviceConfig');
        }
    }

    /**
     * ارسال پیکربندی دستگاه از طریق MQTT
     * @param {string} codemelli - کد ملی کاربر
     * @param {string} macaddress - آدرس MAC دستگاه
     * @param {string} deviceconfig - پیکربندی دستگاه به صورت رشته
     * @returns {Promise<boolean>} - نتیجه عملیات
     */
    async uploadDeviceConfig(codemelli, macaddress, deviceconfig) {
        try {
            // اعتبارسنجی پارامترهای ورودی
            if (!codemelli || !macaddress || !deviceconfig) {
                throw new Error('کد ملی، آدرس MAC و پیکربندی دستگاه مورد نیاز است');
            }

            const token = this.getJwtToken();
            if (!token) {
                throw new Error('JWT Token مورد نیاز است');
            }

            const response = await fetch(`${this.apiBaseUrl}/uploaddeviceconfig`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userid: codemelli,
                    macaddress: macaddress,
                    deviceconfig: deviceconfig, // ارسال به صورت رشته
                    session: token
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();

            if (result.status === 'success') {
                console.log('Configuration uploaded via MQTT successfully');
                this.showNotification('پیکربندی دستگاه با موفقیت از طریق MQTT ارسال شد', 'success');
                return true;
            } else {
                throw new Error(result.message || 'خطا در ارسال پیکربندی از طریق MQTT');
            }
        } catch (error) {
            return this.handleApiError(error, 'uploadDeviceConfig');
        }
    }

    /**
     * تابع کمکی برای دریافت اطلاعات دستگاه از sessionStorage
     * @returns {Object} - اطلاعات دستگاه
     */
    getDeviceInfo() {
        return {
            codemelli: sessionStorage.getItem('userid') || '',
            macaddress: sessionStorage.getItem('agricultureserial') || sessionStorage.getItem('selectedDeviceMacAddress') || ''
        };
    }

    /**
     * تابع کمکی برای بررسی دسترسی به API
     * @returns {boolean} - آیا دسترسی وجود دارد؟
     */
    hasApiAccess() {
        const token = this.getJwtToken();
        const deviceInfo = this.getDeviceInfo();
        
        return !!(token && deviceInfo.codemelli && deviceInfo.macaddress);
    }
}

// ایجاد نمونه جهانی از کلاس
window.deviceConfigAPI = new DeviceConfigAPI();

console.log('Device Config API loaded successfully!');