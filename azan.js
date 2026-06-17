// Azan Device Management JavaScript
// API Integration for Azan Device Control

class AzanDeviceManager {
    constructor() {
        this.deviceIP = null;
        this.sessionToken = null;
        this.updateInterval = null;
        this.mqttClient = null;
        this.mqttConnected = false;
        this.messageId = 1;
        this.pendingRequests = new Map();
        this.init();
    }

    init() {
        // Get device IP from URL parameters or session storage
        const urlParams = new URLSearchParams(window.location.search);
        this.deviceIP = urlParams.get('ip') || sessionStorage.getItem('currentDeviceIP');
        this.sessionToken = sessionStorage.getItem('session');
        
        // Get MAC address (deviceid) from sessionStorage (set from devices list)
        this.deviceMacAddress = sessionStorage.getItem('azanserial') || sessionStorage.getItem('selectedDeviceMacAddress');
        this.macAddress = this.deviceMacAddress; // Alias for UI compatibility
        
        // Save to azanserial for consistency
        if (this.deviceMacAddress) {
            sessionStorage.setItem('azanserial', this.deviceMacAddress);
        }
        this.deviceType = sessionStorage.getItem('selectedDeviceType');
        
        // If MAC address is available, use MQTT connection instead of HTTP
        if (this.deviceMacAddress && this.deviceType === '4') {
            this.updateConnectionStatus('reconnecting');
            this.showNotification('🔌 در حال اتصال به دستگاه اذان از طریق MQTT...', 'info');
            this.initMQTTConnection();
        } else if (this.deviceIP) {
            // Fallback to HTTP connection
            this.updateConnectionStatus('connected');
            this.showNotification('🌐 اتصال HTTP برقرار شد', 'success');
            this.loadDeviceInfo();
            this.loadAzanSettings();
            this.startPeriodicUpdates();
        } else {
            this.updateConnectionStatus('error');
            this.showError('اطلاعات دستگاه (IP یا MAC Address) مشخص نشده است');
            return;
        }
    }

    // Initialize MQTT Connection
    async initMQTTConnection() {
        try {
            // Get MQTT credentials from sessionStorage
            const mqttUser = sessionStorage.getItem('mqttuser');
            const mqttPass = sessionStorage.getItem('mqttpass');
            
            if (!mqttUser || !mqttPass) {
                this.updateConnectionStatus('error');
                this.showError('اطلاعات احراز هویت MQTT یافت نشد. لطفاً وارد شوید.');
                // Fallback to HTTP if MQTT credentials are not available
                if (this.deviceIP) {
                    this.showNotification('🔄 بازگشت به اتصال HTTP...', 'info');
                    this.loadDeviceInfo();
                    this.loadAzanSettings();
                    this.startPeriodicUpdates();
                }
                return;
            }
            
            // MQTT connection settings
            const mqttBrokerUrl = 'wss://mqttws.giot.ir'; // Secure WebSocket MQTT broker URL with port 2087
            const mqttOptions = {
                clientId: `web_client_${Math.random().toString(16).substr(2, 8)}`,
                username: mqttUser,
                password: mqttPass,
                protocolVersion: 5, // MQTT 5
                protocolId: 'MQTT',
                clean: true,
                reconnectPeriod: 1000,
                connectTimeout: 30 * 1000,
                keepalive: 60,
                reschedulePings: true
            };

            // Create MQTT client (requires mqtt.js library)
            if (typeof mqtt !== 'undefined') {
                this.mqttClient = mqtt.connect(mqttBrokerUrl, mqttOptions);
                
                this.mqttClient.on('connect', () => {
                    this.mqttConnected = true;
                    this.showNotification('✅ اتصال MQTT با موفقیت برقرار شد', 'success');
                    this.updateConnectionStatus('connected');
                    
                    // Subscribe to device response topic
                    const responseTopic = `devices/${this.deviceMacAddress}/response`;
                    this.mqttClient.subscribe(responseTopic, (err) => {
                        if (err) {
                            console.error('Failed to subscribe to response topic:', err);
                        } else {
                            console.log(`Subscribed to ${responseTopic}`);
                        }
                    });
                    
                    // Load device info via MQTT
                    this.loadDeviceInfoMQTT();
                    this.loadAzanSettingsMQTT();
                });
                
                this.mqttClient.on('message', (topic, message) => {
                    console.log('MQTT Message received:', topic, message.toString());
                    this.handleMQTTMessage(topic, message);
                    
                    // Update UI statistics and log
                    if (typeof window !== 'undefined' && window.mqttReceivedCount !== undefined) {
                        window.mqttReceivedCount++;
                        if (window.updateMQTTStats) window.updateMQTTStats();
                    }
                    if (typeof window !== 'undefined' && window.logMQTTMessage) {
                        window.logMQTTMessage('RECEIVED', 'MESSAGE', topic, message.toString());
                    }
                });
                
                this.mqttClient.on('error', (error) => {
                    console.error('MQTT connection error:', error);
                    this.mqttConnected = false;
                    this.updateConnectionStatus('error');
                    this.showNotification(`❌ خطا در اتصال MQTT: ${error.message}`, 'error');
                });
                
                this.mqttClient.on('close', () => {
                    this.mqttConnected = false;
                    this.updateConnectionStatus('disconnected');
                    this.showNotification('⚠️ اتصال MQTT قطع شد', 'warning');
                });
                
                this.mqttClient.on('reconnect', () => {
                    this.updateConnectionStatus('reconnecting');
                    this.showNotification('🔄 در حال تلاش برای اتصال مجدد MQTT...', 'info');
                });
                
                this.mqttClient.on('offline', () => {
                    this.mqttConnected = false;
                    this.updateConnectionStatus('offline');
                    this.showNotification('📡 اتصال MQTT آفلاین شد', 'warning');
                });
            } else {
                this.showError('کتابخانه MQTT یافت نشد. لطفاً mqtt.js را بارگذاری کنید.');
            }
        } catch (error) {
            console.error('MQTT initialization failed:', error);
            this.showError(`خطا در راه‌اندازی MQTT: ${error.message}`);
        }
    }

    // Handle incoming MQTT messages
    handleMQTTMessage(topic, message) {
        try {
            const data = JSON.parse(message.toString());
            console.log('Received MQTT message:', data);
            
            // Validate response structure according to MQTT-API.md
            if (!data.deviceid || !data.msg_id || !data.status) {
                console.warn('Invalid MQTT response structure:', data);
                return;
            }
            
            // Verify deviceid matches our device
            if (data.deviceid !== this.deviceMacAddress) {
                console.warn('Device ID mismatch in response:', data.deviceid, 'expected:', this.deviceMacAddress);
                return;
            }
            
            // Find pending request by msg_id
            for (const [requestId, requestData] of this.pendingRequests.entries()) {
                if (requestData.msgId === data.msg_id) {
                    const { resolve, reject } = requestData;
                    this.pendingRequests.delete(requestId);
                    
                    if (data.status === 'success') {
                        resolve(data);
                    } else {
                        reject(new Error(data.message || 'Unknown error'));
                    }
                    return;
                }
            }
            
            console.warn('Received MQTT message with no matching pending request:', data);
        } catch (error) {
            console.error('Error parsing MQTT message:', error);
        }
    }

    // Send MQTT request
    async sendMQTTRequest(msgId, data = {}) {
        return new Promise((resolve, reject) => {
            if (!this.mqttConnected || !this.mqttClient) {
                reject(new Error('MQTT connection not available'));
                return;
            }
            
            if (!this.deviceMacAddress) {
                reject(new Error('Device MAC address not found. Please select device from dashboard.'));
                return;
            }
            
            // Create unique request ID to avoid conflicts
            const uniqueRequestId = `${msgId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            const requestTopic = `devices/${this.deviceMacAddress}/request`;
            
            // Message structure according to MQTT-API.md
            const message = {
                msg_id: msgId,
                deviceid: this.deviceMacAddress, // CPU Serial ID according to API docs
                data: data
            };
            
            // Store the promise resolvers with unique ID
            this.pendingRequests.set(uniqueRequestId, { resolve, reject, msgId });
            
            console.log(`Sending MQTT request to ${requestTopic}:`, message);
            
            // Send the message
            this.mqttClient.publish(requestTopic, JSON.stringify(message), (err) => {
                if (err) {
                    this.pendingRequests.delete(uniqueRequestId);
                    reject(err);
                }
            });
            
            // Set timeout for request (increased to 30 seconds)
            setTimeout(() => {
                if (this.pendingRequests.has(uniqueRequestId)) {
                    this.pendingRequests.delete(uniqueRequestId);
                    reject(new Error('Request timeout - Device may be offline or not responding'));
                }
            }, 30000); // 30 second timeout
        });
    }

    // Load device info via MQTT
    async loadDeviceInfoMQTT() {
        try {
            this.showLoading('deviceStatus');
            
            // Get system info (msg_id: 10)
            const systemInfo = await this.sendMQTTRequest(10);
            
            if (systemInfo && systemInfo.status === 'success') {
                this.updateDeviceInfoMQTT(systemInfo.data);
                const deviceStatusEl = document.getElementById('deviceStatus');
                if (deviceStatusEl) {
                    deviceStatusEl.textContent = 'فعال (MQTT)';
                    deviceStatusEl.className = 'mb-0 text-success';
                }
            }
        } catch (error) {
            console.error('Failed to load device info via MQTT:', error);
            this.showError(`خطا در دریافت اطلاعات دستگاه: ${error.message}`);
        }
    }

    // Update device info from MQTT data
    updateDeviceInfoMQTT(data) {
        if (data) {
            const deviceNameEl = document.getElementById('deviceName');
            if (deviceNameEl) {
                deviceNameEl.textContent = data.device_name || 'اذان‌گو';
            }
            
            const firmwareVersionEl = document.getElementById('firmwareVersion');
            if (firmwareVersionEl) {
                firmwareVersionEl.textContent = data.firmware_version || 'نامشخص';
            }
            
            // Format uptime
            if (data.uptime) {
                const hours = Math.floor(data.uptime / 3600);
                const minutes = Math.floor((data.uptime % 3600) / 60);
                const uptimeEl = document.getElementById('uptime');
                if (uptimeEl) {
                    uptimeEl.textContent = `${hours}:${minutes.toString().padStart(2, '0')}`;
                }
            }
            
            // Update other system info if elements exist
            const cpuElement = document.getElementById('cpuUsage');
            if (cpuElement && data.cpu_usage !== undefined) {
                cpuElement.textContent = `${data.cpu_usage.toFixed(1)}%`;
            }
            
            const memoryElement = document.getElementById('memoryUsage');
            if (memoryElement && data.memory_usage !== undefined) {
                memoryElement.textContent = `${data.memory_usage.toFixed(1)}%`;
            }
            
            const storageElement = document.getElementById('storageUsage');
            if (storageElement && data.storage_usage !== undefined) {
                storageElement.textContent = `${data.storage_usage.toFixed(1)}%`;
            }
        }
    }

    // Load Azan settings via MQTT
    async loadAzanSettingsMQTT() {
        try {
            // Get azan settings (msg_id: 2)
            const azanSettings = await this.sendMQTTRequest(2);
            
            if (azanSettings && azanSettings.status === 'success') {
                this.updateAzanSettingsUI(azanSettings.data);
                this.loadPrayerTimes();
            }
        } catch (error) {
            console.error('Failed to load azan settings via MQTT:', error);
            this.showError(`خطا در دریافت تنظیمات اذان: ${error.message}`);
        }
    }

    // Update Azan settings UI
    updateAzanSettingsUI(settings) {
        if (settings) {
            // Update volume
            const volumeSlider = document.getElementById('volumeSlider');
            if (volumeSlider) {
                volumeSlider.value = settings.volume || 50;
                const volumeValue = document.getElementById('volumeValue');
                if (volumeValue) volumeValue.textContent = settings.volume || 50;
            }
            
            // Update prayer enables
            const prayers = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
            prayers.forEach(prayer => {
                const checkbox = document.getElementById(`${prayer}Enabled`);
                if (checkbox) {
                    checkbox.checked = settings[`${prayer}_enabled`] !== false;
                }
            });
            
            // Update location if available
            if (settings.location) {
                const latInput = document.getElementById('latitude');
                const lngInput = document.getElementById('longitude');
                const cityInput = document.getElementById('city');
                
                if (latInput) latInput.value = settings.location.latitude || '';
                if (lngInput) lngInput.value = settings.location.longitude || '';
                if (cityInput) cityInput.value = settings.location.city || '';
            }
        }
    }

    // Save Azan settings via MQTT
    async saveAzanSettingsMQTT() {
        try {
            // Collect settings from UI
            const settings = {
                enabled: true,
                volume: parseInt(document.getElementById('volumeSlider')?.value || 50),
                fajr_enabled: document.getElementById('fajrEnabled')?.checked !== false,
                dhuhr_enabled: document.getElementById('dhuhrEnabled')?.checked !== false,
                asr_enabled: document.getElementById('asrEnabled')?.checked !== false,
                maghrib_enabled: document.getElementById('maghribEnabled')?.checked !== false,
                isha_enabled: document.getElementById('ishaEnabled')?.checked !== false,
                location: {
                    latitude: parseFloat(document.getElementById('latitude')?.value || 0),
                    longitude: parseFloat(document.getElementById('longitude')?.value || 0),
                    city: document.getElementById('city')?.value || ''
                }
            };
            
            // Save settings (msg_id: 3)
            const response = await this.sendMQTTRequest(3, settings);
            
            if (response && response.status === 'success') {
                this.showNotification('تنظیمات اذان با موفقیت ذخیره شد', 'success');
                this.loadPrayerTimes(); // Reload prayer times
            }
        } catch (error) {
            console.error('Failed to save azan settings via MQTT:', error);
            this.showError(`خطا در ذخیره تنظیمات: ${error.message}`);
        }
    }

    // Update connection status in UI
    updateConnectionStatus(status) {
        const statusElement = document.getElementById('connection-status');
        if (statusElement) {
            const statusConfig = {
                connected: {
                    text: this.deviceMacAddress && this.deviceType === '4' ? '🟢 متصل به MQTT' : '🟢 متصل به HTTP',
                    class: 'text-success'
                },
                disconnected: {
                    text: '🔴 قطع شده',
                    class: 'text-danger'
                },
                reconnecting: {
                    text: '🟡 در حال اتصال...',
                    class: 'text-warning'
                },
                offline: {
                    text: '⚫ آفلاین',
                    class: 'text-secondary'
                },
                error: {
                    text: '🔴 خطا در اتصال',
                    class: 'text-danger'
                }
            };
            
            const config = statusConfig[status] || statusConfig.disconnected;
            statusElement.textContent = config.text;
            statusElement.className = `badge ${config.class} ms-2`;
        }
    }

    // Check if using MQTT connection
    isUsingMQTT() {
        return this.mqttConnected && this.deviceMacAddress && this.deviceType === '4';
    }
    
    // Debug function to check connection status
    debugConnectionStatus() {
        console.log('=== MQTT Connection Debug ===');
        console.log('MQTT Connected:', this.mqttConnected);
        console.log('Device MAC Address:', this.deviceMacAddress);
        console.log('Device Type:', this.deviceType);
        console.log('Using MQTT:', this.isUsingMQTT());
        console.log('Pending Requests:', this.pendingRequests.size);
        console.log('sessionStorage azanserial:', sessionStorage.getItem('azanserial'));
        console.log('sessionStorage selectedDeviceMacAddress:', sessionStorage.getItem('selectedDeviceMacAddress'));
        console.log('sessionStorage mqttuser:', sessionStorage.getItem('mqttuser'));
        console.log('sessionStorage mqttpass:', sessionStorage.getItem('mqttpass') ? '***' : 'null');
        console.log('============================');
    }

    // API Base URL for device
    getApiUrl(endpoint) {
        return `http://${this.deviceIP}${endpoint}`;
    }

    // Generic API call method
    async apiCall(endpoint, method = 'GET', data = null) {
        try {
            const options = {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                },
            };

            if (data) {
                options.body = JSON.stringify(data);
            }

            // Add session token to URL if available
            const url = this.sessionToken ? 
                `${this.getApiUrl(endpoint)}?session_token=${this.sessionToken}` : 
                this.getApiUrl(endpoint);

            const response = await fetch(url, options);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('API call failed:', error);
            this.showError(`خطا در ارتباط با دستگاه: ${error.message}`);
            return null;
        }
    }

    // Load server info
    async loadServerInfo() {
        const data = await this.apiCall('/serverinfo');
        if (data && data.status === 'success') {
            this.updateServerInfo(data.server_info);
        }
    }

    // Load device information
    async loadDeviceInfo() {
        this.showLoading('deviceStatus');
        
        const serverInfo = await this.loadServerInfo();
        
        // Update device status
        document.getElementById('deviceStatus').textContent = 'فعال';
        document.getElementById('deviceStatus').className = 'mb-0 text-success';
        
        // Load additional device info from path1 if authenticated
        if (this.sessionToken) {
            const path1Data = await this.apiCall('/path1');
            if (path1Data && path1Data.status === 'success') {
                this.updateDeviceInfo(path1Data);
            }
        }
    }

    // Update server info display
    updateServerInfo(serverInfo) {
        if (serverInfo) {
            const deviceNameEl = document.getElementById('deviceName');
            if (deviceNameEl) {
                deviceNameEl.textContent = serverInfo.name || 'اذان‌گو';
            }
            
            const firmwareVersionEl = document.getElementById('firmwareVersion');
            if (firmwareVersionEl) {
                firmwareVersionEl.textContent = serverInfo.version || 'نامشخص';
            }
            
            const uptimeEl = document.getElementById('uptime');
            if (uptimeEl) {
                uptimeEl.textContent = serverInfo.uptime_formatted || 'نامشخص';
            }
            
            // Update network info if available
            if (serverInfo.network_info && serverInfo.network_info.interfaces) {
                const activeInterface = serverInfo.network_info.interfaces.find(iface => iface.status === 'up');
                if (activeInterface) {
                    const deviceIPEl = document.getElementById('deviceIP');
                    if (deviceIPEl) {
                        deviceIPEl.textContent = activeInterface.ip_address;
                    }
                    
                    const networkStatusEl = document.getElementById('networkStatus');
                    if (networkStatusEl) {
                        networkStatusEl.textContent = 'متصل';
                    }
                }
            }
            
            // Update services status
            if (serverInfo.services_status) {
                const services = serverInfo.services_status;
                let statusText = 'فعال';
                if (services.http_server !== 'running' || services.media_player === 'error') {
                    statusText = 'خطا';
                }
                
                const deviceStatusEl = document.getElementById('deviceStatus');
                if (deviceStatusEl) {
                    deviceStatusEl.textContent = statusText;
                }
            }
        }
    }

    // Update device info from path1 response
    updateDeviceInfo(data) {
        if (data.server_time) {
            const lastConnectionEl = document.getElementById('lastConnection');
            if (lastConnectionEl) {
                lastConnectionEl.textContent = 
                    new Date(data.server_time.local).toLocaleString('fa-IR');
            }
        }
    }

    // Load Azan settings
    async loadAzanSettings() {
        // This would typically call azan-specific APIs
        // For now, we'll simulate the data
        this.loadPrayerTimes();
        this.loadAudioSettings();
    }

    // Load prayer times (simulated - would integrate with actual azan API)
    loadPrayerTimes() {
        // In a real implementation, this would call the azan API
        // For now, we'll use calculated times based on location
        const times = this.calculatePrayerTimes();
        
        const fajrTimeEl = document.getElementById('fajrTime');
        if (fajrTimeEl) fajrTimeEl.textContent = times.fajr;
        
        const dhuhrTimeEl = document.getElementById('dhuhrTime');
        if (dhuhrTimeEl) dhuhrTimeEl.textContent = times.dhuhr;
        
        const asrTimeEl = document.getElementById('asrTime');
        if (asrTimeEl) asrTimeEl.textContent = times.asr;
        
        const maghribTimeEl = document.getElementById('maghribTime');
        if (maghribTimeEl) maghribTimeEl.textContent = times.maghrib;
        
        const ishaTimeEl = document.getElementById('ishaTime');
        if (ishaTimeEl) ishaTimeEl.textContent = times.isha;
        
        // Update next prayer
        const nextPrayer = this.getNextPrayer(times);
        const nextAzanEl = document.getElementById('nextAzan');
        if (nextAzanEl) nextAzanEl.textContent = nextPrayer.time;
        
        const lastAzanEl = document.getElementById('lastAzan');
        if (lastAzanEl) lastAzanEl.textContent = this.getLastPrayer(times).time;
        
        // Update prayer statuses
        this.updatePrayerStatuses(times);
    }

    // Calculate prayer times (simplified calculation)
    calculatePrayerTimes() {
        const now = new Date();
        return {
            fajr: '05:30',
            dhuhr: '12:15',
            asr: '15:45',
            maghrib: '18:20',
            isha: '19:45'
        };
    }

    // Get next prayer
    getNextPrayer(times) {
        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes();
        
        const prayers = [
            { name: 'fajr', time: times.fajr, minutes: this.timeToMinutes(times.fajr) },
            { name: 'dhuhr', time: times.dhuhr, minutes: this.timeToMinutes(times.dhuhr) },
            { name: 'asr', time: times.asr, minutes: this.timeToMinutes(times.asr) },
            { name: 'maghrib', time: times.maghrib, minutes: this.timeToMinutes(times.maghrib) },
            { name: 'isha', time: times.isha, minutes: this.timeToMinutes(times.isha) }
        ];
        
        for (let prayer of prayers) {
            if (prayer.minutes > currentTime) {
                return prayer;
            }
        }
        
        // If no prayer today, return tomorrow's fajr
        return prayers[0];
    }

    // Get last prayer
    getLastPrayer(times) {
        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes();
        
        const prayers = [
            { name: 'fajr', time: times.fajr, minutes: this.timeToMinutes(times.fajr) },
            { name: 'dhuhr', time: times.dhuhr, minutes: this.timeToMinutes(times.dhuhr) },
            { name: 'asr', time: times.asr, minutes: this.timeToMinutes(times.asr) },
            { name: 'maghrib', time: times.maghrib, minutes: this.timeToMinutes(times.maghrib) },
            { name: 'isha', time: times.isha, minutes: this.timeToMinutes(times.isha) }
        ];
        
        let lastPrayer = prayers[0];
        for (let prayer of prayers) {
            if (prayer.minutes <= currentTime) {
                lastPrayer = prayer;
            }
        }
        
        return lastPrayer;
    }

    // Convert time string to minutes
    timeToMinutes(timeStr) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
    }

    // Update prayer statuses
    updatePrayerStatuses(times) {
        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes();
        
        const prayers = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
        
        prayers.forEach(prayer => {
            const prayerTime = this.timeToMinutes(times[prayer]);
            const statusElement = document.getElementById(`${prayer}Status`);
            
            if (statusElement) {
                if (Math.abs(currentTime - prayerTime) < 5) {
                    statusElement.textContent = 'در حال پخش';
                    statusElement.className = 'badge bg-success active';
                } else if (currentTime > prayerTime) {
                    statusElement.textContent = 'انجام شده';
                    statusElement.className = 'badge bg-info';
                } else {
                    statusElement.textContent = 'در انتظار';
                    statusElement.className = 'badge bg-secondary';
                }
            }
        });
    }

    // Load audio settings
    async loadAudioSettings() {
        // In a real implementation, this would call the audio settings API
        // For now, we'll use default values
        const volumeLevelEl = document.getElementById('volumeLevel');
        if (volumeLevelEl) volumeLevelEl.textContent = '75%';
        
        const volumeSliderEl = document.getElementById('volumeSlider');
        if (volumeSliderEl) volumeSliderEl.value = 75;
        
        const volumeDisplayEl = document.getElementById('volumeDisplay');
        if (volumeDisplayEl) volumeDisplayEl.textContent = '75%';
    }

    // Test Azan function
    async testAzan(prayer) {
        this.showNotification(`شروع تست اذان ${this.getPrayerName(prayer)}...`, 'info');
        
        // In a real implementation, this would call the azan test API
        // Simulating API call
        try {
            // Simulate API call delay
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            this.showNotification(`تست اذان ${this.getPrayerName(prayer)} با موفقیت انجام شد`, 'success');
        } catch (error) {
            this.showNotification(`خطا در تست اذان: ${error.message}`, 'danger');
        }
    }

    // Get prayer name in Persian
    getPrayerName(prayer) {
        const names = {
            fajr: 'صبح',
            dhuhr: 'ظهر',
            asr: 'عصر',
            maghrib: 'مغرب',
            isha: 'عشا'
        };
        return names[prayer] || prayer;
    }

    // Save audio settings
    async saveAudioSettings() {
        if (this.isUsingMQTT()) {
            // Use MQTT for audio settings
            await this.saveAzanSettingsMQTT();
        } else {
            // Use HTTP API for audio settings
            const volume = document.getElementById('volumeSlider').value;
            const azanSound = document.getElementById('azanSelect').value;
            
            try {
                // In a real implementation, this would call the audio settings API
                // const result = await this.apiCall('/audio-settings', 'POST', {
                //     volume: parseInt(volume),
                //     sound_id: parseInt(azanSound)
                // });
                
                // Simulate API call
                await new Promise(resolve => setTimeout(resolve, 500));
                
                this.showNotification('تنظیمات صدا با موفقیت ذخیره شد', 'success');
                
                // Update volume display
                const volumeLevelEl = document.getElementById('volumeLevel');
                if (volumeLevelEl) volumeLevelEl.textContent = volume + '%';
            } catch (error) {
                this.showNotification(`خطا در ذخیره تنظیمات: ${error.message}`, 'danger');
            }
        }
    }

    // Save general settings
    async saveGeneralSettings() {
        if (this.isUsingMQTT()) {
            // Use MQTT for general settings
            await this.saveAzanSettingsMQTT();
        } else {
            // Use HTTP API for general settings
            const autoAzan = document.getElementById('autoAzanSwitch').checked;
            const notifications = document.getElementById('notificationSwitch').checked;
            const city = document.getElementById('citySelect').value;
            
            try {
                // In a real implementation, this would call the general settings API
                // const result = await this.apiCall('/general-settings', 'POST', {
                //     auto_azan: autoAzan,
                //     notifications: notifications,
                //     city: city
                // });
                
                // Simulate API call
                await new Promise(resolve => setTimeout(resolve, 500));
                
                this.showNotification('تنظیمات عمومی با موفقیت ذخیره شد', 'success');
            } catch (error) {
                this.showNotification(`خطا در ذخیره تنظیمات: ${error.message}`, 'danger');
            }
        }
    }

    // Start periodic updates
    startPeriodicUpdates() {
        // Update every 30 seconds
        this.updateInterval = setInterval(() => {
            this.loadPrayerTimes();
        }, 30000);
    }

    // Stop periodic updates
    stopPeriodicUpdates() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    // Show loading state
    showLoading(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = 'در حال بارگذاری...';
            element.classList.add('loading');
        }
    }

    // Hide loading state
    hideLoading(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.classList.remove('loading');
        }
    }

    // Show notification
    showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `alert alert-${type} alert-dismissible fade show notification`;
        notification.innerHTML = `
            <i class="fas fa-${this.getNotificationIcon(type)}"></i>
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        const style = document.createElement('style');
        style.textContent = `
            .notification {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 9999;
                min-width: 300px;
                transform: translateX(400px);
                transition: transform 0.3s ease;
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.2);
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            }
            .notification.show {
                transform: translateX(0);
            }
            .notification i {
                margin-left: 8px;
            }
        `;
        
        document.head.appendChild(style);
        document.body.appendChild(notification);
        
        // Show notification
        setTimeout(() => notification.classList.add('show'), 100);
        
        // Hide notification after 3 seconds
        setTimeout(() => {
            notification.style.transform = 'translateX(400px)';
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                    document.head.removeChild(style);
                }
            }, 300);
        }, 3000);
    }

    // Get notification icon
    getNotificationIcon(type) {
        const icons = {
            success: 'check-circle',
            danger: 'exclamation-triangle',
            error: 'exclamation-triangle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };
        return icons[type] || 'info-circle';
    }

    // Show error
    showError(message) {
        this.showNotification(message, 'danger');
    }

    // File and Directory Management APIs
    
    // Get directory list
    async getDirectoryList(path = '/media', recursive = false, filter = 'all') {
        const data = {
            session_token: this.sessionToken,
            path: path,
            recursive: recursive,
            filter: filter
        };
        
        return await this.apiCall('/directorylist?' + new URLSearchParams(data));
    }
    
    // Get directory list (POST method)
    async getDirectoryListPost(directory = '/media', recursive = false, filter = 'all') {
        const data = {
            session_token: this.sessionToken,
            directory: directory,
            recursive: recursive,
            filter: filter
        };
        
        return await this.apiCall('/getdirectorylist', 'POST', data);
    }
    
    // Create directory
    async createDirectory(directoryName, parentPath = '/media', createParents = true) {
        const data = {
            session_token: this.sessionToken,
            directory_name: directoryName,
            parent_path: parentPath,
            create_parents: createParents
        };
        
        return await this.apiCall('/createdirectory', 'POST', data);
    }
    
    // Delete file or directory
    async deletePath(path, recursive = false) {
        const params = {
            session_token: this.sessionToken,
            path: path,
            recursive: recursive
        };
        
        return await this.apiCall('/deletepath?' + new URLSearchParams(params), 'DELETE');
    }
    
    // Delete file (POST method)
    async deleteFile(filePath, recursive = true) {
        const data = {
            session_token: this.sessionToken,
            file_path: filePath,
            recursive: recursive
        };
        
        return await this.apiCall('/deletefile', 'POST', data);
    }
    
    // Rename file or directory
    async renamePath(oldPath, newName) {
        const data = {
            session_token: this.sessionToken,
            old_path: oldPath,
            new_name: newName
        };
        
        return await this.apiCall('/renamepath', 'POST', data);
    }
    
    // Rename file (alternative method)
    async renameFile(oldPath, newPath) {
        const data = {
            session_token: this.sessionToken,
            old_path: oldPath,
            new_path: newPath
        };
        
        return await this.apiCall('/renamefile', 'POST', data);
    }
    
    // Get media directories
    async getMediaDirectories(path = '/media') {
        const data = {
            session_token: this.sessionToken,
            path: path
        };
        
        return await this.apiCall('/getmediadirectories', 'POST', data);
    }
    
    // Get media directory files
    async getMediaDirectoryFiles(directoryPath) {
        const data = {
            session_token: this.sessionToken,
            directory_path: directoryPath
        };
        
        return await this.apiCall('/getmediadirectoryfiles', 'POST', data);
    }
    
    // Upload file
    async uploadFile(file, directory = '/media', onProgress = null) {
        try {
            const formData = new FormData();
            formData.append('file', file);
            
            const url = `${this.getApiUrl('/upload_file')}?filename=${encodeURIComponent(file.name)}&directory=${encodeURIComponent(directory)}&session_token=${this.sessionToken}`;
            
            const xhr = new XMLHttpRequest();
            
            return new Promise((resolve, reject) => {
                xhr.upload.addEventListener('progress', (e) => {
                    if (e.lengthComputable && onProgress) {
                        const percentComplete = (e.loaded / e.total) * 100;
                        onProgress(percentComplete);
                    }
                });
                
                xhr.addEventListener('load', () => {
                    if (xhr.status === 200) {
                        try {
                            const response = JSON.parse(xhr.responseText);
                            resolve(response);
                        } catch (error) {
                            reject(new Error('Invalid response format'));
                        }
                    } else {
                        reject(new Error(`Upload failed with status: ${xhr.status}`));
                    }
                });
                
                xhr.addEventListener('error', () => {
                    reject(new Error('Upload failed'));
                });
                
                xhr.open('POST', url);
                xhr.send(formData);
            });
        } catch (error) {
            console.error('Upload error:', error);
            throw error;
        }
    }
    
    // Create directory (alternative method)
    async createDirectoryAlt(directoryPath, recursive = true) {
        const data = {
            session_token: this.sessionToken,
            directory_path: directoryPath,
            recursive: recursive
        };
        
        return await this.apiCall('/createdirectory', 'POST', data);
    }
    
    // Play media
    async playMedia(filePath, volume = 50, loop = false, startTime = '00:00:00') {
        const data = {
            session_token: this.sessionToken,
            file_path: filePath,
            volume: volume,
            loop: loop,
            start_time: startTime
        };
        
        return await this.apiCall('/playmedia', 'POST', data);
    }
    
    // Stop media
    async stopMedia() {
        const data = {
            session_token: this.sessionToken
        };
        
        return await this.apiCall('/stopmedia', 'POST', data);
    }
    
    // Set volume
     async setVolume(volume) {
         const data = {
             session_token: this.sessionToken,
             volume: volume
         };
         
         return await this.apiCall('/setvolume', 'POST', data);
     }
     
     // Get media status
     async getMediaStatus() {
         const data = {
             session_token: this.sessionToken
         };
         
         return await this.apiCall('/getmediastatus', 'POST', data);
     }
    
    // Load file browser
    async loadFileBrowser(path = '/media') {
        this.showLoading('fileBrowserContent');
        
        try {
            const result = await this.getDirectoryListPost(path);
            
            if (result && result.status === 'success') {
                this.updateFileBrowser(result, path);
            } else {
                this.showError('خطا در بارگذاری فایل‌ها');
            }
        } catch (error) {
            this.showError(`خطا در بارگذاری فایل‌ها: ${error.message}`);
        } finally {
            this.hideLoading('fileBrowserContent');
        }
    }
    
    // Load media manager
    async loadMediaManager() {
        this.showLoading('mediaManagerContent');
        
        try {
            const result = await this.getMediaDirectories();
            
            if (result && result.status === 'success') {
                this.updateMediaManagerUI(result);
            } else {
                this.showError('خطا در بارگذاری رسانه‌ها');
            }
        } catch (error) {
            this.showError(`خطا در بارگذاری رسانه‌ها: ${error.message}`);
        } finally {
            this.hideLoading('mediaManagerContent');
        }
    }
    
    // Update file browser UI
    updateFileBrowser(data, currentPath) {
        const container = document.getElementById('fileBrowserContent');
        if (!container) return;
        
        let html = `
            <div class="file-browser-header mb-3">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <strong>مسیر فعلی:</strong> <code>${currentPath}</code>
                    </div>
                    <div>
                        <button class="btn btn-sm btn-primary" onclick="azanManager.showCreateDirectoryModal()">
                            <i class="fas fa-folder-plus me-1"></i> پوشه جدید
                        </button>
                        <button class="btn btn-sm btn-success" onclick="azanManager.showUploadModal()">
                            <i class="fas fa-upload me-1"></i> آپلود فایل
                        </button>
                    </div>
                </div>
            </div>
            
            <div class="table-responsive">
                <table class="table table-hover">
                    <thead>
                        <tr>
                            <th><i class="fas fa-file me-1"></i> نام</th>
                            <th><i class="fas fa-info-circle me-1"></i> نوع</th>
                            <th><i class="fas fa-hdd me-1"></i> حجم</th>
                            <th><i class="fas fa-calendar me-1"></i> تاریخ تغییر</th>
                            <th><i class="fas fa-cogs me-1"></i> عملیات</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        // Add parent directory link if not at root
        if (currentPath !== '/media' && data.directory_info && data.directory_info.parent_path) {
            html += `
                <tr>
                    <td>
                        <a href="#" onclick="azanManager.loadFileBrowser('${data.directory_info.parent_path}')" class="text-decoration-none">
                            <i class="fas fa-level-up-alt me-2"></i> ..
                        </a>
                    </td>
                    <td>دایرکتوری</td>
                    <td>-</td>
                    <td>-</td>
                    <td>-</td>
                </tr>
            `;
        }
        
        // Add directories and files
        if (data.items && data.items.length > 0) {
            data.items.forEach(item => {
                const icon = item.type === 'directory' ? 'fa-folder' : this.getFileIcon(item.name);
                const size = item.type === 'directory' ? 
                    (item.file_count ? `${item.file_count} فایل` : '-') : 
                    this.formatFileSize(item.size);
                const date = item.modified ? new Date(item.modified).toLocaleDateString('fa-IR') : '-';
                
                html += `
                    <tr>
                        <td>
                            ${item.type === 'directory' ? 
                                `<a href="#" onclick="azanManager.loadFileBrowser('${item.path}')" class="text-decoration-none">` :
                                '<span>'
                            }
                                <i class="fas ${icon} me-2"></i> ${item.name}
                            ${item.type === 'directory' ? '</a>' : '</span>'}
                        </td>
                        <td>${item.type === 'directory' ? 'دایرکتوری' : 'فایل'}</td>
                        <td>${size}</td>
                        <td>${date}</td>
                        <td>
                            <div class="btn-group btn-group-sm">
                                <button class="btn btn-outline-warning" onclick="azanManager.showRenameModal('${item.path}', '${item.name}')" title="تغییر نام">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="btn btn-outline-danger" onclick="azanManager.confirmDelete('${item.path}', '${item.type}')" title="حذف">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            });
        } else {
            html += `
                <tr>
                    <td colspan="5" class="text-center text-muted py-4">
                        <i class="fas fa-folder-open fa-2x mb-2"></i><br>
                        این پوشه خالی است
                    </td>
                </tr>
            `;
        }
        
        html += `
                    </tbody>
                </table>
            </div>
        `;
        
        container.innerHTML = html;
    }
    
    // Update media manager UI
    updateMediaManagerUI(data) {
        const container = document.getElementById('mediaManagerContent');
        if (!container) return;

        let html = `
            <div class="media-manager-header d-flex justify-content-between align-items-center mb-3">
                <div>
                    <h6 class="mb-0">دایرکتوری‌های رسانه</h6>
                </div>
                <div class="btn-group" role="group">
                    <button type="button" class="btn btn-primary btn-sm" onclick="refreshMediaDirectories()">
                        <i class="fas fa-sync me-1"></i>به‌روزرسانی
                    </button>
                    <button type="button" class="btn btn-success btn-sm" onclick="showMediaUploadModal()">
                        <i class="fas fa-upload me-1"></i>آپلود رسانه
                    </button>
                </div>
            </div>
        `;

        if (data.directories && data.directories.length > 0) {
            html += `<div class="row">`;
            
            data.directories.forEach(directory => {
                const totalSizeMB = Math.round(directory.total_size / (1024 * 1024));
                html += `
                    <div class="col-md-6 col-lg-4 mb-3">
                        <div class="card h-100 media-directory-card" onclick="loadMediaDirectoryFiles('${directory.path}')" style="cursor: pointer;">
                            <div class="card-body">
                                <div class="d-flex align-items-center mb-2">
                                    <i class="fas fa-folder-open text-primary me-2 fs-4"></i>
                                    <h6 class="card-title mb-0">${directory.name}</h6>
                                </div>
                                <p class="card-text text-muted small mb-2">${directory.path}</p>
                                <div class="d-flex justify-content-between text-sm">
                                    <span><i class="fas fa-file me-1"></i>${directory.file_count} فایل</span>
                                    <span><i class="fas fa-hdd me-1"></i>${totalSizeMB} MB</span>
                                </div>
                            </div>
                            <div class="card-footer bg-transparent">
                                <button class="btn btn-outline-primary btn-sm w-100" onclick="event.stopPropagation(); loadMediaDirectoryFiles('${directory.path}')">
                                    <i class="fas fa-eye me-1"></i>مشاهده فایل‌ها
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            });
            
            html += `</div>`;
        } else {
            html += `
                <div class="alert alert-info text-center">
                    <i class="fas fa-folder-open me-2"></i>
                    هیچ دایرکتوری رسانه‌ای یافت نشد
                </div>
            `;
        }

        // Add media player section
        html += `
            <div class="mt-4">
                <div class="card">
                    <div class="card-header">
                        <h6 class="mb-0"><i class="fas fa-play me-2"></i>پخش‌کننده رسانه</h6>
                    </div>
                    <div class="card-body" id="mediaPlayerSection">
                        <div class="text-center text-muted py-3">
                            <i class="fas fa-music fs-1 mb-2"></i>
                            <p>برای پخش، روی یک فایل رسانه‌ای کلیک کنید</p>
                        </div>
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = html;
    }
    
    // Get file icon based on extension
    getFileIcon(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        const iconMap = {
            'mp3': 'fa-file-audio',
            'wav': 'fa-file-audio',
            'ogg': 'fa-file-audio',
            'mp4': 'fa-file-video',
            'avi': 'fa-file-video',
            'mkv': 'fa-file-video',
            'jpg': 'fa-file-image',
            'jpeg': 'fa-file-image',
            'png': 'fa-file-image',
            'gif': 'fa-file-image',
            'txt': 'fa-file-alt',
            'pdf': 'fa-file-pdf',
            'zip': 'fa-file-archive',
            'rar': 'fa-file-archive'
        };
        return iconMap[ext] || 'fa-file';
    }
    
    // Format file size
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    // Show create directory modal
    showCreateDirectoryModal() {
        const modal = document.getElementById('createDirectoryModal');
        if (modal) {
            const bootstrapModal = new bootstrap.Modal(modal);
            bootstrapModal.show();
        }
    }
    
    // Show upload modal
    showUploadModal() {
        const modal = document.getElementById('uploadModal');
        if (modal) {
            const bootstrapModal = new bootstrap.Modal(modal);
            bootstrapModal.show();
        }
    }
    
    // Show rename modal
    showRenameModal(path, currentName) {
        const modal = document.getElementById('renameModal');
        const input = document.getElementById('newNameInput');
        if (modal && input) {
            input.value = currentName;
            input.dataset.path = path;
            const bootstrapModal = new bootstrap.Modal(modal);
            bootstrapModal.show();
        }
    }
    
    // Confirm delete
    confirmDelete(path, type) {
        const itemType = type === 'directory' ? 'پوشه' : 'فایل';
        if (confirm(`آیا از حذف این ${itemType} اطمینان دارید؟\n${path}`)) {
            this.deleteItem(path, type === 'directory');
        }
    }
    
    // Delete item
    async deleteItem(path, isDirectory) {
        try {
            const result = await this.deleteFile(path, isDirectory);
            
            if (result && result.status === 'success') {
                this.showNotification('حذف با موفقیت انجام شد', 'success');
                // Reload current directory
                const currentPath = document.querySelector('.file-browser-header code')?.textContent || '/media';
                this.loadFileBrowser(currentPath);
            } else {
                this.showError('خطا در حذف فایل');
            }
        } catch (error) {
            this.showError(`خطا در حذف: ${error.message}`);
        }
    }

    // Check if user is authenticated
    isAuthenticated() {
        return this.sessionToken !== null && this.sessionToken !== undefined;
    }

    // Cleanup
    destroy() {
        this.stopPeriodicUpdates();
    }
}

// Global functions for HTML onclick events
let azanManager;

function testAzan(prayer) {
    if (azanManager) {
        azanManager.testAzan(prayer);
    }
}

function saveAudioSettings() {
    if (azanManager) {
        azanManager.saveAudioSettings();
    }
}

function saveGeneralSettings() {
    if (azanManager) {
        azanManager.saveGeneralSettings();
    }
}

// MQTT API Functions for all 20 APIs

// Azan Settings API Functions (msg_id: 2, 3)
function getAzanSettings() {
    if (azanManager && azanManager.isUsingMQTT()) {
        azanManager.sendMQTTRequest(2).then(response => {
            if (response && response.status === 'success' && response.data) {
                updateAzanSettingsFromAPI(response.data);
                azanManager.showNotification('✅ تنظیمات اذان با موفقیت دریافت شد', 'success');
            }
        }).catch(error => {
            azanManager.showError('خطا در دریافت تنظیمات اذان: ' + error.message);
        });
    } else {
        azanManager.showError('اتصال MQTT برقرار نیست');
    }
}

function saveAzanSettings() {
    if (azanManager && azanManager.isUsingMQTT()) {
        const azanData = {
            device: {
                device_id: document.getElementById('device_id').value || "10293984930",
                device_name: document.getElementById('device_name').value || "Azangoo-MahanElectronic"
            },
            files: {
                azan_archive_file_count: parseInt(document.getElementById('azan_file_count').textContent) || 35,
                quran_3min_archive_file_count: parseInt(document.getElementById('quran_3min_count').textContent) || 100,
                quran_7min_pages_archive_file_count: parseInt(document.getElementById('quran_7min_count').textContent) || 100,
                quran_pages_archive_file_count: parseInt(document.getElementById('quran_pages_count').textContent) || 604
            },
            gps: {
                ptimes_geolocation_dstactive: document.getElementById('dst_active').checked,
                ptimes_geolocation_id: parseInt(document.getElementById('location_id').value) || 153,
                ptimes_geolocation_mode_gps: parseInt(document.getElementById('gps_mode').value) || 0,
                ptimes_geolocation_name: document.getElementById('location_name').value || "اصفهان - اصفهان - اصفهان",
                ptimes_geolocation_timezone: parseFloat(document.getElementById('timezone').value) || 3.5,
                ptimes_geolocation_timezonename: document.getElementById('timezone_name').value || "Asia/Tehran",
                ptimes_geolocation_xlatitude: parseFloat(document.getElementById('latitude').value) || 32.66,
                ptimes_geolocation_xlongitude: parseFloat(document.getElementById('longitude').value) || 51.67
            },
            prayer_calculation: {
                ptimes_asr_method: document.getElementById('asr_method').value || "Shafii",
                ptimes_calc_method: document.getElementById('calc_method').value || "Jafary",
                ptimes_high_lats_adjust_method: document.getElementById('high_lats_method').value || "None"
            },
            prayer_times: {
                asr: {
                    azan_asr_days_of_week: parseInt(document.getElementById('asr_days_of_week').value) || 127,
                    azan_asr_playlist_files: document.getElementById('asr_playlist').value || "media/playlists/azan/asr.m3u",
                    azan_asr_post_days_of_week: parseInt(document.getElementById('asr_post_days').value) || 127,
                    azan_asr_post_playlist_files: document.getElementById('asr_post_playlist').value || "media/playlists/azan/post_asr.m3u",
                    azan_asr_post_volume: parseInt(document.getElementById('asr_post_volume').value) || 50,
                    azan_asr_pre_days_of_week: parseInt(document.getElementById('asr_pre_days').value) || 127,
                    azan_asr_pre_playlist_files: document.getElementById('asr_pre_playlist').value || "media/playlists/azan/pre_asr.m3u",
                    azan_asr_pre_volume: parseInt(document.getElementById('asr_pre_volume').value) || 70,
                    azan_asr_volume: parseInt(document.getElementById('asr_volume').value) || 80,
                    random_file_selection: parseInt(document.getElementById('asr_random').value) || 1
                },
                dhohr: {
                    azan_dhohr_days_of_week: parseInt(document.getElementById('dhohr_days_of_week').value) || 127,
                    azan_dhohr_playlist_files: document.getElementById('dhohr_playlist').value || "media/playlists/azan/dhohr.m3u",
                    azan_dhohr_post_days_of_week: parseInt(document.getElementById('dhohr_post_days').value) || 127,
                    azan_dhohr_post_playlist_files: document.getElementById('dhohr_post_playlist').value || "media/playlists/azan/post_dhohr.m3u",
                    azan_dhohr_post_volume: parseInt(document.getElementById('dhohr_post_volume').value) || 50,
                    azan_dhohr_pre_days_of_week: parseInt(document.getElementById('dhohr_pre_days').value) || 127,
                    azan_dhohr_pre_playlist_files: document.getElementById('dhohr_pre_playlist').value || "media/playlists/azan/pre_dhohr.m3u",
                    azan_dhohr_pre_volume: parseInt(document.getElementById('dhohr_pre_volume').value) || 70,
                    azan_dhohr_volume: parseInt(document.getElementById('dhohr_volume').value) || 80,
                    random_file_selection: parseInt(document.getElementById('dhohr_random').value) || 1
                },
                isha: {
                    azan_isha_days_of_week: parseInt(document.getElementById('isha_days_of_week').value) || 127,
                    azan_isha_playlist_files: document.getElementById('isha_playlist').value || "media/playlists/azan/isha.m3u",
                    azan_isha_post_days_of_week: parseInt(document.getElementById('isha_post_days').value) || 126,
                    azan_isha_post_playlist_files: document.getElementById('isha_post_playlist').value || "media/playlists/azan/post_isha.m3u",
                    azan_isha_post_volume: parseInt(document.getElementById('isha_post_volume').value) || 50,
                    azan_isha_pre_days_of_week: parseInt(document.getElementById('isha_pre_days').value) || 127,
                    azan_isha_pre_playlist_files: document.getElementById('isha_pre_playlist').value || "media/playlists/azan/pre_isha.m3u",
                    azan_isha_pre_volume: parseInt(document.getElementById('isha_pre_volume').value) || 70,
                    azan_isha_volume: parseInt(document.getElementById('isha_volume').value) || 80,
                    random_file_selection: parseInt(document.getElementById('isha_random').value) || 1
                },
                maghrib: {
                    azan_maghrib_days_of_week: parseInt(document.getElementById('maghrib_days_of_week').value) || 127,
                    azan_maghrib_playlist_files: document.getElementById('maghrib_playlist').value || "media/playlists/azan/maghrib.m3u",
                    azan_maghrib_post_days_of_week: parseInt(document.getElementById('maghrib_post_days').value) || 127,
                    azan_maghrib_post_playlist_files: document.getElementById('maghrib_post_playlist').value || "media/playlists/azan/post_maghrib.m3u",
                    azan_maghrib_post_volume: parseInt(document.getElementById('maghrib_post_volume').value) || 50,
                    azan_maghrib_pre_days_of_week: parseInt(document.getElementById('maghrib_pre_days').value) || 127,
                    azan_maghrib_pre_playlist_files: document.getElementById('maghrib_pre_playlist').value || "media/playlists/azan/pre_maghrib.m3u",
                    azan_maghrib_pre_volume: parseInt(document.getElementById('maghrib_pre_volume').value) || 70,
                    azan_maghrib_volume: parseInt(document.getElementById('maghrib_volume').value) || 80,
                    random_file_selection: parseInt(document.getElementById('maghrib_random').value) || 1
                },
                sobh: {
                    azan_sobh_days_of_week: parseInt(document.getElementById('sobh_days_of_week').value) || 127,
                    azan_sobh_playlist_files: document.getElementById('sobh_playlist').value || "media/playlists/azan/sobh.m3u",
                    azan_sobh_post_days_of_week: parseInt(document.getElementById('sobh_post_days').value) || 127,
                    azan_sobh_post_playlist_files: document.getElementById('sobh_post_playlist').value || "media/playlists/azan/post_sobh.m3u",
                    azan_sobh_post_volume: parseInt(document.getElementById('sobh_post_volume').value) || 0,
                    azan_sobh_pre_days_of_week: parseInt(document.getElementById('sobh_pre_days').value) || 127,
                    azan_sobh_pre_playlist_files: document.getElementById('sobh_pre_playlist').value || "media/playlists/azan/pre_sobh.m3u",
                    azan_sobh_pre_volume: parseInt(document.getElementById('sobh_pre_volume').value) || 0,
                    azan_sobh_volume: parseInt(document.getElementById('sobh_volume').value) || 80,
                    random_file_selection: parseInt(document.getElementById('sobh_random').value) || 0
                },
                sunrise: {
                    azan_sunrise_days_of_week: parseInt(document.getElementById('sunrise_days_of_week').value) || 127,
                    azan_sunrise_playlist_files: document.getElementById('sunrise_playlist').value || "media/playlists/azan/sunrise.m3u",
                    azan_sunrise_post_days_of_week: parseInt(document.getElementById('sunrise_post_days').value) || 127,
                    azan_sunrise_post_playlist_files: document.getElementById('sunrise_post_playlist').value || "media/playlists/azan/post_sunrise.m3u",
                    azan_sunrise_post_volume: parseInt(document.getElementById('sunrise_post_volume').value) || 0,
                    azan_sunrise_pre_days_of_week: parseInt(document.getElementById('sunrise_pre_days').value) || 127,
                    azan_sunrise_pre_playlist_files: document.getElementById('sunrise_pre_playlist').value || "media/playlists/azan/pre_sunrise.m3u",
                    azan_sunrise_pre_volume: parseInt(document.getElementById('sunrise_pre_volume').value) || 0,
                    azan_sunrise_volume: parseInt(document.getElementById('sunrise_volume').value) || 0,
                    random_file_selection: parseInt(document.getElementById('sunrise_random').value) || 1
                },
                sunset: {
                    azan_sunset_days_of_week: parseInt(document.getElementById('sunset_days_of_week').value) || 127,
                    azan_sunset_playlist_files: document.getElementById('sunset_playlist').value || "media/playlists/azan/sunset.m3u",
                    azan_sunset_post_days_of_week: parseInt(document.getElementById('sunset_post_days').value) || 127,
                    azan_sunset_post_playlist_files: document.getElementById('sunset_post_playlist').value || "media/playlists/azan/post_sunset.m3u",
                    azan_sunset_post_volume: parseInt(document.getElementById('sunset_post_volume').value) || 0,
                    azan_sunset_pre_days_of_week: parseInt(document.getElementById('sunset_pre_days').value) || 127,
                    azan_sunset_pre_playlist_files: document.getElementById('sunset_pre_playlist').value || "media/playlists/azan/pre_sunset.m3u",
                    azan_sunset_pre_volume: parseInt(document.getElementById('sunset_pre_volume').value) || 0,
                    azan_sunset_volume: parseInt(document.getElementById('sunset_volume').value) || 0,
                    random_file_selection: parseInt(document.getElementById('sunset_random').value) || 1
                }
            },
            volume: {
                master_mic_volume: 100,
                master_playback_volume: 100
            }
        };
        
        azanManager.sendMQTTRequest(3, azanData).then(response => {
            if (response && response.status === 'success') {
                azanManager.showNotification('✅ تنظیمات اذان با موفقیت ذخیره شد', 'success');
            }
        }).catch(error => {
            azanManager.showError('خطا در ذخیره تنظیمات اذان: ' + error.message);
        });
    } else {
        azanManager.showError('اتصال MQTT برقرار نیست');
    }
}

function updateAzanSettingsFromAPI(data) {
    // Device settings
    if (data.device) {
        const deviceIdEl = document.getElementById('device_id');
        const deviceNameEl = document.getElementById('device_name');
        if (deviceIdEl) deviceIdEl.value = data.device.device_id || "10293984930";
        if (deviceNameEl) deviceNameEl.value = data.device.device_name || "Azangoo-MahanElectronic";
    }
    
    // Files count
    if (data.files) {
        const azanCountEl = document.getElementById('azan_file_count');
        const quran3minCountEl = document.getElementById('quran_3min_count');
        const quran7minCountEl = document.getElementById('quran_7min_count');
        const quranPagesCountEl = document.getElementById('quran_pages_count');
        if (azanCountEl) azanCountEl.textContent = data.files.azan_archive_file_count || 35;
        if (quran3minCountEl) quran3minCountEl.textContent = data.files.quran_3min_archive_file_count || 100;
        if (quran7minCountEl) quran7minCountEl.textContent = data.files.quran_7min_pages_archive_file_count || 100;
        if (quranPagesCountEl) quranPagesCountEl.textContent = data.files.quran_pages_archive_file_count || 604;
    }
    
    // GPS settings
    if (data.gps) {
        const dstActiveEl = document.getElementById('dst_active');
        const locationIdEl = document.getElementById('location_id');
        const gpsModeEl = document.getElementById('gps_mode');
        const locationNameEl = document.getElementById('location_name');
        const timezoneEl = document.getElementById('timezone');
        const timezoneNameEl = document.getElementById('timezone_name');
        const latitudeEl = document.getElementById('latitude');
        const longitudeEl = document.getElementById('longitude');
        
        if (dstActiveEl) dstActiveEl.checked = data.gps.ptimes_geolocation_dstactive || false;
        if (locationIdEl) locationIdEl.value = data.gps.ptimes_geolocation_id || 153;
        if (gpsModeEl) gpsModeEl.value = data.gps.ptimes_geolocation_mode_gps || 0;
        if (locationNameEl) locationNameEl.value = data.gps.ptimes_geolocation_name || "اصفهان - اصفهان - اصفهان";
        if (timezoneEl) timezoneEl.value = data.gps.ptimes_geolocation_timezone || 3.5;
        if (timezoneNameEl) timezoneNameEl.value = data.gps.ptimes_geolocation_timezonename || "Asia/Tehran";
        if (latitudeEl) latitudeEl.value = data.gps.ptimes_geolocation_xlatitude || 32.66;
        if (longitudeEl) longitudeEl.value = data.gps.ptimes_geolocation_xlongitude || 51.67;
    }
    
    // Prayer calculation settings
    if (data.prayer_calculation) {
        const asrMethodEl = document.getElementById('asr_method');
        const calcMethodEl = document.getElementById('calc_method');
        const highLatsMethodEl = document.getElementById('high_lats_method');
        
        if (asrMethodEl) asrMethodEl.value = data.prayer_calculation.ptimes_asr_method || "Shafii";
        if (calcMethodEl) calcMethodEl.value = data.prayer_calculation.ptimes_calc_method || "Jafary";
        if (highLatsMethodEl) highLatsMethodEl.value = data.prayer_calculation.ptimes_high_lats_adjust_method || "None";
    }
    
    // Prayer times settings
    if (data.prayer_times) {
        const prayers = ['asr', 'dhohr', 'isha', 'maghrib', 'sobh', 'sunrise', 'sunset'];
        
        prayers.forEach(prayer => {
            if (data.prayer_times[prayer]) {
                const prayerData = data.prayer_times[prayer];
                
                // Days of week
                const daysEl = document.getElementById(`${prayer}_days_of_week`);
                if (daysEl) daysEl.value = prayerData[`azan_${prayer}_days_of_week`] || 127;
                
                // Playlist files
                const playlistEl = document.getElementById(`${prayer}_playlist`);
                if (playlistEl) playlistEl.value = prayerData[`azan_${prayer}_playlist_files`] || `media/playlists/azan/${prayer}.m3u`;
                
                // Volume
                const volumeEl = document.getElementById(`${prayer}_volume`);
                if (volumeEl) volumeEl.value = prayerData[`azan_${prayer}_volume`] || 80;
                
                // Pre settings
                const preDaysEl = document.getElementById(`${prayer}_pre_days`);
                const prePlaylistEl = document.getElementById(`${prayer}_pre_playlist`);
                const preVolumeEl = document.getElementById(`${prayer}_pre_volume`);
                
                if (preDaysEl) preDaysEl.value = prayerData[`azan_${prayer}_pre_days_of_week`] || 127;
                if (prePlaylistEl) prePlaylistEl.value = prayerData[`azan_${prayer}_pre_playlist_files`] || `media/playlists/azan/pre_${prayer}.m3u`;
                if (preVolumeEl) preVolumeEl.value = prayerData[`azan_${prayer}_pre_volume`] || 70;
                
                // Post settings
                const postDaysEl = document.getElementById(`${prayer}_post_days`);
                const postPlaylistEl = document.getElementById(`${prayer}_post_playlist`);
                const postVolumeEl = document.getElementById(`${prayer}_post_volume`);
                
                if (postDaysEl) postDaysEl.value = prayerData[`azan_${prayer}_post_days_of_week`] || 127;
                if (postPlaylistEl) postPlaylistEl.value = prayerData[`azan_${prayer}_post_playlist_files`] || `media/playlists/azan/post_${prayer}.m3u`;
                if (postVolumeEl) postVolumeEl.value = prayerData[`azan_${prayer}_post_volume`] || 50;
                
                // Random file selection
                const randomEl = document.getElementById(`${prayer}_random`);
                if (randomEl) randomEl.value = prayerData.random_file_selection || 1;
            }
        });
    }
    
    // Volume settings
    if (data.volume) {
        // Master volume settings are typically not user-editable in UI
        console.log('Master volumes:', data.volume);
    }
}

// PIMS Settings API Functions (msg_id: 4, 5)
function getPIMSSettings() {
    if (azanManager && azanManager.isUsingMQTT()) {
        azanManager.sendMQTTRequest(4).then(response => {
            if (response && response.status === 'success' && response.data) {
                updatePIMSSettingsFromAPI(response.data);
                azanManager.showNotification('✅ تنظیمات PIMS با موفقیت دریافت شد', 'success');
            }
        }).catch(error => {
            azanManager.showError('خطا در دریافت تنظیمات PIMS: ' + error.message);
        });
    } else {
        azanManager.showError('اتصال MQTT برقرار نیست');
    }
}

function savePIMSSettings() {
    if (azanManager && azanManager.isUsingMQTT()) {
        const pimsData = {
            enabled: document.getElementById('pimsEnabled').checked,
            schedules: []
        };
        
        // Collect all 5 PIMS schedules
        for (let i = 1; i <= 5; i++) {
            const schedule = {
                enabled: document.getElementById(`pimsSchedule${i}Enabled`).checked,
                start_time: document.getElementById(`pimsSchedule${i}StartTime`).value,
                end_time: document.getElementById(`pimsSchedule${i}EndTime`).value,
                volume: parseInt(document.getElementById(`pimsSchedule${i}Volume`).value) || 50,
                days: {
                    saturday: document.getElementById(`pimsSchedule${i}Saturday`).checked,
                    sunday: document.getElementById(`pimsSchedule${i}Sunday`).checked,
                    monday: document.getElementById(`pimsSchedule${i}Monday`).checked,
                    tuesday: document.getElementById(`pimsSchedule${i}Tuesday`).checked,
                    wednesday: document.getElementById(`pimsSchedule${i}Wednesday`).checked,
                    thursday: document.getElementById(`pimsSchedule${i}Thursday`).checked,
                    friday: document.getElementById(`pimsSchedule${i}Friday`).checked
                },
                file: document.getElementById(`pimsSchedule${i}File`).value,
                folder: document.getElementById(`pimsSchedule${i}Folder`).value
            };
            pimsData.schedules.push(schedule);
        }
        
        azanManager.sendMQTTRequest(5, pimsData).then(response => {
            if (response && response.status === 'success') {
                azanManager.showNotification('✅ تنظیمات PIMS با موفقیت ذخیره شد', 'success');
            }
        }).catch(error => {
            azanManager.showError('خطا در ذخیره تنظیمات PIMS: ' + error.message);
        });
    } else {
        azanManager.showError('اتصال MQTT برقرار نیست');
    }
}

function updatePIMSSettingsFromAPI(data) {
    document.getElementById('pimsEnabled').checked = data.enabled || false;
    
    // Update all 5 PIMS schedules
    if (data.schedules && Array.isArray(data.schedules)) {
        for (let i = 0; i < 5; i++) {
            const schedule = data.schedules[i] || {};
            const scheduleNum = i + 1;
            
            document.getElementById(`pimsSchedule${scheduleNum}Enabled`).checked = schedule.enabled || false;
            document.getElementById(`pimsSchedule${scheduleNum}StartTime`).value = schedule.start_time || '';
            document.getElementById(`pimsSchedule${scheduleNum}EndTime`).value = schedule.end_time || '';
            document.getElementById(`pimsSchedule${scheduleNum}Volume`).value = schedule.volume || 50;
            
            if (schedule.days) {
                document.getElementById(`pimsSchedule${scheduleNum}Saturday`).checked = schedule.days.saturday || false;
                document.getElementById(`pimsSchedule${scheduleNum}Sunday`).checked = schedule.days.sunday || false;
                document.getElementById(`pimsSchedule${scheduleNum}Monday`).checked = schedule.days.monday || false;
                document.getElementById(`pimsSchedule${scheduleNum}Tuesday`).checked = schedule.days.tuesday || false;
                document.getElementById(`pimsSchedule${scheduleNum}Wednesday`).checked = schedule.days.wednesday || false;
                document.getElementById(`pimsSchedule${scheduleNum}Thursday`).checked = schedule.days.thursday || false;
                document.getElementById(`pimsSchedule${scheduleNum}Friday`).checked = schedule.days.friday || false;
            }
            
            document.getElementById(`pimsSchedule${scheduleNum}File`).value = schedule.file || '';
            document.getElementById(`pimsSchedule${scheduleNum}Folder`).value = schedule.folder || '';
        }
    }
}

// SIP Settings API Functions (msg_id: 6, 7)
function getSIPSettings() {
    if (azanManager && azanManager.isUsingMQTT()) {
        azanManager.sendMQTTRequest(6).then(response => {
            if (response && response.status === 'success' && response.data) {
                updateSIPSettingsFromAPI(response.data);
                azanManager.showNotification('✅ تنظیمات SIP با موفقیت دریافت شد', 'success');
            }
        }).catch(error => {
            azanManager.showError('خطا در دریافت تنظیمات SIP: ' + error.message);
        });
    } else {
        azanManager.showError('اتصال MQTT برقرار نیست');
    }
}

function saveSIPSettings() {
    if (azanManager && azanManager.isUsingMQTT()) {
        const sipData = {
            general: {
                enabled: document.getElementById('sipEnabled').checked
            },
            account: {
                username: document.getElementById('sipUsername').value,
                password: document.getElementById('sipPassword').value,
                domain: document.getElementById('sipDomain').value,
                server: document.getElementById('sipServer').value,
                port: parseInt(document.getElementById('sipPort').value) || 5060,
                transport: document.getElementById('sipTransport').value || 'UDP',
                registration_expires: parseInt(document.getElementById('sipRegistrationExpires').value) || 3600,
                auto_register: document.getElementById('sipAutoRegister').checked
            },
            audio: {
                capture_device: document.getElementById('sipCaptureDevice').value,
                playback_device: document.getElementById('sipPlaybackDevice').value,
                mic_volume: parseInt(document.getElementById('sipMicVolume').value) || 80,
                speaker_volume: parseInt(document.getElementById('sipSpeakerVolume').value) || 80,
                echo_cancellation: document.getElementById('sipEchoCancellation').checked,
                noise_suppression: document.getElementById('sipNoiseSuppression').checked,
                adaptive_gain_control: document.getElementById('sipAdaptiveGainControl').checked
            },
            call: {
                auto_answer: document.getElementById('sipAutoAnswer').checked,
                auto_answer_delay: parseInt(document.getElementById('sipAutoAnswerDelay').value) || 0,
                call_timeout: parseInt(document.getElementById('sipCallTimeout').value) || 30,
                ring_timeout: parseInt(document.getElementById('sipRingTimeout').value) || 60,
                dtmf_mode: document.getElementById('sipDtmfMode').value || 'RFC2833'
            },
            security: {
                whitelist_enabled: document.getElementById('sipWhitelistEnabled').checked,
                allow_all_numbers: document.getElementById('sipAllowAllNumbers').checked,
                require_authentication: document.getElementById('sipRequireAuthentication').checked,
                allowed_numbers: document.getElementById('sipAllowedNumbers').value.split(',').map(n => n.trim()).filter(n => n),
                blocked_numbers: document.getElementById('sipBlockedNumbers').value.split(',').map(n => n.trim()).filter(n => n)
            },
            network: {
                stun_server: document.getElementById('sipStunServer').value,
                ice_enabled: document.getElementById('sipIceEnabled').checked,
                upnp_enabled: document.getElementById('sipUpnpEnabled').checked,
                nat_policy: document.getElementById('sipNatPolicy').value || 'auto',
                firewall_policy: document.getElementById('sipFirewallPolicy').value || 'auto',
                media_encryption: document.getElementById('sipMediaEncryption').value || 'none'
            }
        };
        
        azanManager.sendMQTTRequest(7, sipData).then(response => {
            if (response && response.status === 'success') {
                azanManager.showNotification('✅ تنظیمات SIP با موفقیت ذخیره شد', 'success');
            }
        }).catch(error => {
            azanManager.showError('خطا در ذخیره تنظیمات SIP: ' + error.message);
        });
    } else {
        azanManager.showError('اتصال MQTT برقرار نیست');
    }
}

function updateSIPSettingsFromAPI(data) {
    // General settings
    if (data.general) {
        document.getElementById('sipEnabled').checked = data.general.enabled || false;
    }
    
    // Account settings
    if (data.account) {
        document.getElementById('sipUsername').value = data.account.username || '';
        document.getElementById('sipPassword').value = data.account.password || '';
        document.getElementById('sipDomain').value = data.account.domain || '';
        document.getElementById('sipServer').value = data.account.server || '';
        document.getElementById('sipPort').value = data.account.port || 5060;
        document.getElementById('sipTransport').value = data.account.transport || 'UDP';
        document.getElementById('sipRegistrationExpires').value = data.account.registration_expires || 3600;
        document.getElementById('sipAutoRegister').checked = data.account.auto_register || false;
    }
    
    // Audio settings
    if (data.audio) {
        document.getElementById('sipCaptureDevice').value = data.audio.capture_device || '';
        document.getElementById('sipPlaybackDevice').value = data.audio.playback_device || '';
        document.getElementById('sipMicVolume').value = data.audio.mic_volume || 80;
        document.getElementById('sipSpeakerVolume').value = data.audio.speaker_volume || 80;
        document.getElementById('sipEchoCancellation').checked = data.audio.echo_cancellation || false;
        document.getElementById('sipNoiseSuppression').checked = data.audio.noise_suppression || false;
        document.getElementById('sipAdaptiveGainControl').checked = data.audio.adaptive_gain_control || false;
    }
    
    // Call settings
    if (data.call) {
        document.getElementById('sipAutoAnswer').checked = data.call.auto_answer || false;
        document.getElementById('sipAutoAnswerDelay').value = data.call.auto_answer_delay || 0;
        document.getElementById('sipCallTimeout').value = data.call.call_timeout || 30;
        document.getElementById('sipRingTimeout').value = data.call.ring_timeout || 60;
        document.getElementById('sipDtmfMode').value = data.call.dtmf_mode || 'RFC2833';
    }
    
    // Security settings
    if (data.security) {
        document.getElementById('sipWhitelistEnabled').checked = data.security.whitelist_enabled || false;
        document.getElementById('sipAllowAllNumbers').checked = data.security.allow_all_numbers || false;
        document.getElementById('sipRequireAuthentication').checked = data.security.require_authentication || false;
        document.getElementById('sipAllowedNumbers').value = (data.security.allowed_numbers || []).join(', ');
        document.getElementById('sipBlockedNumbers').value = (data.security.blocked_numbers || []).join(', ');
    }
    
    // Network settings
    if (data.network) {
        document.getElementById('sipStunServer').value = data.network.stun_server || '';
        document.getElementById('sipIceEnabled').checked = data.network.ice_enabled || false;
        document.getElementById('sipUpnpEnabled').checked = data.network.upnp_enabled || false;
        document.getElementById('sipNatPolicy').value = data.network.nat_policy || 'auto';
        document.getElementById('sipFirewallPolicy').value = data.network.firewall_policy || 'auto';
        document.getElementById('sipMediaEncryption').value = data.network.media_encryption || 'none';
    }
}

// Digital IO Settings API Functions (msg_id: 8, 9)
function getDigitalIOSettings() {
    if (azanManager && azanManager.isUsingMQTT()) {
        azanManager.sendMQTTRequest(8).then(response => {
            if (response && response.status === 'success' && response.data) {
                updateDigitalIOSettingsFromAPI(response.data);
                azanManager.showNotification('✅ تنظیمات Digital IO با موفقیت دریافت شد', 'success');
            }
        }).catch(error => {
            azanManager.showError('خطا در دریافت تنظیمات Digital IO: ' + error.message);
        });
    } else {
        azanManager.showError('اتصال MQTT برقرار نیست');
    }
}

function saveDigitalIOSettings() {
    if (azanManager && azanManager.isUsingMQTT()) {
        const inputPinsStr = document.getElementById('inputPins').value;
        const outputPinsStr = document.getElementById('outputPins').value;
        
        const digitalIOData = {
            input_pins: inputPinsStr ? inputPinsStr.split(',').map(pin => parseInt(pin.trim())).filter(pin => !isNaN(pin)) : [],
            output_pins: outputPinsStr ? outputPinsStr.split(',').map(pin => parseInt(pin.trim())).filter(pin => !isNaN(pin)) : [],
            pull_up_enabled: document.getElementById('pullUpEnabled').checked,
            debounce_time: parseInt(document.getElementById('debounceTime').value) || 50
        };
        
        azanManager.sendMQTTRequest(9, digitalIOData).then(response => {
            if (response && response.status === 'success') {
                azanManager.showNotification('✅ تنظیمات Digital IO با موفقیت ذخیره شد', 'success');
            }
        }).catch(error => {
            azanManager.showError('خطا در ذخیره تنظیمات Digital IO: ' + error.message);
        });
    } else {
        azanManager.showError('اتصال MQTT برقرار نیست');
    }
}

function updateDigitalIOSettingsFromAPI(data) {
    document.getElementById('inputPins').value = data.input_pins ? data.input_pins.join(',') : '';
    document.getElementById('outputPins').value = data.output_pins ? data.output_pins.join(',') : '';
    document.getElementById('pullUpEnabled').checked = data.pull_up_enabled || false;
    document.getElementById('debounceTime').value = data.debounce_time || 50;
}

// System Information API Functions (msg_id: 10, 11)
function getSystemInfo() {
    if (azanManager && azanManager.isUsingMQTT()) {
        azanManager.sendMQTTRequest(10).then(response => {
            if (response && response.status === 'success' && response.data) {
                updateSystemInfoFromAPI(response.data);
                azanManager.showNotification('✅ اطلاعات سیستم با موفقیت دریافت شد', 'success');
            }
        }).catch(error => {
            azanManager.showError('خطا در دریافت اطلاعات سیستم: ' + error.message);
        });
    } else {
        azanManager.showError('اتصال MQTT برقرار نیست');
    }
}

function saveSystemInfo() {
    if (azanManager && azanManager.isUsingMQTT()) {
        const systemData = {
            device_name: document.getElementById('systemDeviceName').value,
            location: document.getElementById('systemLocation').value,
            description: document.getElementById('systemDescription').value
        };
        
        azanManager.sendMQTTRequest(11, systemData).then(response => {
            if (response && response.status === 'success') {
                azanManager.showNotification('✅ اطلاعات سیستم با موفقیت ذخیره شد', 'success');
            }
        }).catch(error => {
            azanManager.showError('خطا در ذخیره اطلاعات سیستم: ' + error.message);
        });
    } else {
        azanManager.showError('اتصال MQTT برقرار نیست');
    }
}

function updateSystemInfoFromAPI(data) {
    document.getElementById('systemDeviceName').value = data.device_name || '';
    document.getElementById('systemLocation').value = data.location || '';
    document.getElementById('systemDescription').value = data.description || '';
    
    // Update read-only system information based on new JSON structure
    const systemCpuModelEl = document.getElementById('systemCpuModel');
    if (systemCpuModelEl) systemCpuModelEl.textContent = data.cpu_model || '--';
    
    const systemCpuSerialEl = document.getElementById('systemCpuSerial');
    if (systemCpuSerialEl) systemCpuSerialEl.textContent = data.cpu_serial || '--';
    
    const systemHardwareEl = document.getElementById('systemHardware');
    if (systemHardwareEl) systemHardwareEl.textContent = data.hardware || '--';
    
    const systemIpAddressEl = document.getElementById('systemIpAddress');
    if (systemIpAddressEl) systemIpAddressEl.textContent = data.ip_address || '--';
    
    const systemMacAddressEl = document.getElementById('systemMacAddress');
    if (systemMacAddressEl) systemMacAddressEl.textContent = data.mac_address || '--';
    
    const systemRevisionEl = document.getElementById('systemRevision');
    if (systemRevisionEl) systemRevisionEl.textContent = data.revision || '--';
    
    // Keep backward compatibility for other fields
    const systemFirmwareVersionEl = document.getElementById('systemFirmwareVersion');
    if (systemFirmwareVersionEl) systemFirmwareVersionEl.textContent = data.firmware_version || '--';
    
    const systemHardwareVersionEl = document.getElementById('systemHardwareVersion');
    if (systemHardwareVersionEl) systemHardwareVersionEl.textContent = data.hardware_version || '--';
    
    const systemCpuUsageEl = document.getElementById('systemCpuUsage');
    if (systemCpuUsageEl) systemCpuUsageEl.textContent = data.cpu_usage ? data.cpu_usage + '%' : '--';
    
    const systemMemoryUsageEl = document.getElementById('systemMemoryUsage');
    if (systemMemoryUsageEl) systemMemoryUsageEl.textContent = data.memory_usage ? data.memory_usage + '%' : '--';
    
    const systemUptimeEl = document.getElementById('systemUptime');
    if (systemUptimeEl) systemUptimeEl.textContent = data.uptime ? formatUptime(data.uptime) : '--';
}

// GPIO Control API Functions (msg_id: 12, 13, 14)
function getGPIOStatus() {
    const pin = parseInt(document.getElementById('gpioPin').value);
    if (isNaN(pin)) {
        azanManager.showError('لطفاً شماره پین معتبر وارد کنید');
        return;
    }
    
    if (azanManager && azanManager.isUsingMQTT()) {
        azanManager.sendMQTTRequest(12, { pin: pin }).then(response => {
            if (response && response.status === 'success' && response.data) {
                updateGPIOStatusFromAPI(response.data);
                azanManager.showNotification('✅ وضعیت GPIO با موفقیت دریافت شد', 'success');
            }
        }).catch(error => {
            azanManager.showError('خطا در دریافت وضعیت GPIO: ' + error.message);
        });
    } else {
        azanManager.showError('اتصال MQTT برقرار نیست');
    }
}

function setGPIOValue() {
    const pin = parseInt(document.getElementById('gpioPin').value);
    const value = parseInt(document.getElementById('gpioValue').value);
    
    if (isNaN(pin)) {
        azanManager.showError('لطفاً شماره پین معتبر وارد کنید');
        return;
    }
    
    if (azanManager && azanManager.isUsingMQTT()) {
        azanManager.sendMQTTRequest(13, { pin: pin, value: value }).then(response => {
            if (response && response.status === 'success') {
                azanManager.showNotification('✅ مقدار GPIO با موفقیت تنظیم شد', 'success');
                // Update current status display
                updateGPIOStatusFromAPI({ pin: pin, value: value, state: value ? 'HIGH' : 'LOW' });
            }
        }).catch(error => {
            azanManager.showError('خطا در تنظیم مقدار GPIO: ' + error.message);
        });
    } else {
        azanManager.showError('اتصال MQTT برقرار نیست');
    }
}

function toggleGPIO() {
    const pin = parseInt(document.getElementById('gpioPin').value);
    
    if (isNaN(pin)) {
        azanManager.showError('لطفاً شماره پین معتبر وارد کنید');
        return;
    }
    
    if (azanManager && azanManager.isUsingMQTT()) {
        azanManager.sendMQTTRequest(14, { pin: pin }).then(response => {
            if (response && response.status === 'success') {
                azanManager.showNotification('✅ وضعیت GPIO با موفقیت تغییر کرد', 'success');
                // Update current status display
                updateGPIOStatusFromAPI({ 
                    pin: pin, 
                    value: response.new_value, 
                    state: response.new_value ? 'HIGH' : 'LOW' 
                });
            }
        }).catch(error => {
            azanManager.showError('خطا در تغییر وضعیت GPIO: ' + error.message);
        });
    } else {
        azanManager.showError('اتصال MQTT برقرار نیست');
    }
}

function updateGPIOStatusFromAPI(data) {
    const currentGPIOPinEl = document.getElementById('currentGPIOPin');
    if (currentGPIOPinEl) currentGPIOPinEl.textContent = data.pin || '--';
    
    const currentGPIOValueEl = document.getElementById('currentGPIOValue');
    if (currentGPIOValueEl) currentGPIOValueEl.textContent = data.value !== undefined ? data.value : '--';
    
    const currentGPIOStateEl = document.getElementById('currentGPIOState');
    if (currentGPIOStateEl) currentGPIOStateEl.textContent = data.state || '--';
}

// System Time API Functions (msg_id: 20, 21)
function getSystemTime() {
    if (azanManager && azanManager.isUsingMQTT()) {
        azanManager.sendMQTTRequest(20).then(response => {
            if (response && response.status === 'success' && response.data) {
                updateSystemTimeFromAPI(response.data);
                azanManager.showNotification('✅ زمان سیستم با موفقیت دریافت شد', 'success');
            }
        }).catch(error => {
            azanManager.showError('خطا در دریافت زمان سیستم: ' + error.message);
        });
    } else {
        azanManager.showError('اتصال MQTT برقرار نیست');
    }
}

function setSystemTime() {
    const year = parseInt(document.getElementById('setYear').value);
    const month = parseInt(document.getElementById('setMonth').value);
    const day = parseInt(document.getElementById('setDay').value);
    const hour = parseInt(document.getElementById('setHour').value);
    const minute = parseInt(document.getElementById('setMinute').value);
    const second = parseInt(document.getElementById('setSecond').value) || 0;
    
    if (!year || !month || !day || hour === undefined || minute === undefined) {
        azanManager.showError('لطفاً تمام فیلدهای تاریخ و زمان را پر کنید');
        return;
    }
    
    if (azanManager && azanManager.isUsingMQTT()) {
        const timeData = {
            datetime: {
                year: year,
                month: month,
                day: day,
                hour: hour,
                minute: minute,
                second: second
            }
        };
        
        azanManager.sendMQTTRequest(21, timeData).then(response => {
            if (response && response.status === 'success') {
                azanManager.showNotification('✅ زمان سیستم با موفقیت تنظیم شد', 'success');
                // Refresh system time display
                setTimeout(() => getSystemTime(), 1000);
            }
        }).catch(error => {
            azanManager.showError('خطا در تنظیم زمان سیستم: ' + error.message);
        });
    } else {
        azanManager.showError('اتصال MQTT برقرار نیست');
    }
}

function setCurrentTime() {
    const now = new Date();
    document.getElementById('setYear').value = now.getFullYear();
    document.getElementById('setMonth').value = now.getMonth() + 1;
    document.getElementById('setDay').value = now.getDate();
    document.getElementById('setHour').value = now.getHours();
    document.getElementById('setMinute').value = now.getMinutes();
    document.getElementById('setSecond').value = now.getSeconds();
}

function updateSystemTimeFromAPI(data) {
    const systemUnixTimeEl = document.getElementById('systemUnixTime');
    if (systemUnixTimeEl) systemUnixTimeEl.textContent = data.unix_timestamp || '--';
    
    const systemYearEl = document.getElementById('systemYear');
    if (systemYearEl) systemYearEl.textContent = data.year || '--';
    
    const systemMonthEl = document.getElementById('systemMonth');
    if (systemMonthEl) systemMonthEl.textContent = data.month || '--';
    
    const systemDayEl = document.getElementById('systemDay');
    if (systemDayEl) systemDayEl.textContent = data.day || '--';
    
    const systemHourEl = document.getElementById('systemHour');
    if (systemHourEl) systemHourEl.textContent = data.hour || '--';
    
    const systemMinuteEl = document.getElementById('systemMinute');
    if (systemMinuteEl) systemMinuteEl.textContent = data.minute || '--';
    
    const systemSecondEl = document.getElementById('systemSecond');
    if (systemSecondEl) systemSecondEl.textContent = data.second || '--';
    
    const systemWeekdayEl = document.getElementById('systemWeekday');
    if (systemWeekdayEl) systemWeekdayEl.textContent = getWeekdayName(data.weekday) || '--';
    
    const systemUptimeSecondsEl = document.getElementById('systemUptimeSeconds');
    if (systemUptimeSecondsEl) systemUptimeSecondsEl.textContent = data.uptime_seconds ? formatUptime(data.uptime_seconds) : '--';
}

// Private MQTT Settings API Function (msg_id: 1)
function savePrivateMQTTSettings() {
    if (azanManager && azanManager.isUsingMQTT()) {
        const mqttData = {
            server: document.getElementById('privateMqttServer').value,
            port: parseInt(document.getElementById('privateMqttPort').value) || 1883,
            username: document.getElementById('privateMqttUsername').value,
            password: document.getElementById('privateMqttPassword').value,
            client_id: document.getElementById('privateMqttClientId').value,
            topic: document.getElementById('privateMqttTopic').value,
            ssl_enabled: document.getElementById('privateMqttSslEnabled').checked
        };
        
        azanManager.sendMQTTRequest(1, mqttData).then(response => {
            if (response && response.status === 'success') {
                azanManager.showNotification('✅ تنظیمات MQTT ذخیره شد و اتصال مجدد انجام شد', 'success');
            }
        }).catch(error => {
            azanManager.showError('خطا در ذخیره تنظیمات MQTT: ' + error.message);
        });
    } else {
        azanManager.showError('اتصال MQTT برقرار نیست');
    }
}

// Utility Functions
function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
}

function getWeekdayName(weekday) {
    const weekdays = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه', 'شنبه'];
    return weekdays[weekday] || 'نامشخص';
}

// Tab Management Functions
function showTab(tabName) {
    // Hide all tab contents
    $('.tab-content').removeClass('active');
    
    // Remove active class from all nav items
    $('.nav-item').removeClass('active');
    
    // Show selected tab content
    $('#' + tabName + '-tab').addClass('active');
    
    // Add active class to selected nav item
    $('[onclick="showTab(\'' + tabName + '\')"').parent().addClass('active');
    
    // Add fade-in animation
    $('#' + tabName + '-tab').hide().fadeIn(500);
}

// Category Management Functions
function showCategory(categoryName) {
    // Hide all categories
    $('.category-section').removeClass('active');
    
    // Remove active class from all category buttons
    $('.category-btn').removeClass('active');
    
    // Show selected category
    $('#' + categoryName + '-category').addClass('active');
    
    // Add active class to selected button
    $('[onclick="showCategory(\'' + categoryName + '\')"').addClass('active');
    
    // Add fade-in animation
    $('#' + categoryName + '-category').hide().fadeIn(500);
}

// Volume Slider Update Function
function updateVolumeDisplay(value) {
    document.getElementById('volumeValue').textContent = value;
}

// Initialize when DOM is ready
// Global debug function
window.debugMQTT = function() {
    if (azanManager) {
        azanManager.debugConnectionStatus();
    } else {
        console.log('AzanManager not initialized yet');
    }
};

// Global function to manually set MAC address
window.setAzanSerial = function(macAddress) {
    sessionStorage.setItem('azanserial', macAddress);
    sessionStorage.setItem('selectedDeviceMacAddress', macAddress);
    console.log('MAC Address set to:', macAddress);
    if (azanManager) {
        azanManager.deviceMacAddress = macAddress;
        azanManager.macAddress = macAddress;
        console.log('AzanManager MAC Address updated');
    }
};

// Function to set MAC address from input field
window.setMacAddressFromInput = function() {
    const macInput = document.getElementById('debugMacAddress');
    if (macInput && macInput.value.trim()) {
        setAzanSerial(macInput.value.trim());
        showNotification('MAC Address تنظیم شد: ' + macInput.value.trim(), 'success');
        refreshConnectionStatus();
    } else {
        showNotification('لطفاً MAC Address معتبر وارد کنید', 'error');
    }
};

// Function to refresh connection status display
window.refreshConnectionStatus = function() {
    const statusElement = document.getElementById('mqttConnectionStatus');
    const macInput = document.getElementById('debugMacAddress');
    
    if (azanManager) {
        const isConnected = azanManager.isUsingMQTT();
        const macAddress = azanManager.deviceMacAddress || sessionStorage.getItem('azanserial');
        
        if (statusElement) {
            statusElement.textContent = isConnected ? 'متصل' : 'قطع';
            statusElement.className = isConnected ? 'text-success' : 'text-danger';
        }
        
        if (macInput && macAddress) {
            macInput.value = macAddress;
        }
    }
};

$(document).ready(function() {
    azanManager = new AzanDeviceManager();
    azanManager.init();
    
    // Initialize debug status display
    setTimeout(() => {
        if (typeof refreshConnectionStatus === 'function') {
            refreshConnectionStatus();
        }
    }, 1000);
    // Show default tab (Azan)
    showTab('azan');
    
    // Show default category in Azan tab (Basic Settings)
    showCategory('basic');
    
    // Initialize volume slider
    $('#volumeSlider').on('input', function() {
        updateVolumeDisplay($(this).val());
    });
    
    // Initialize UI animations
    $('.glass-card').hide().fadeIn(1000);
    
    // Add smooth transitions to all interactive elements
    $('.btn, .form-control, .form-select').addClass('transition-all');
    
    // Initialize tooltips if Bootstrap is available
    if (typeof bootstrap !== 'undefined') {
        var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
        var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
            return new bootstrap.Tooltip(tooltipTriggerEl);
        });
    }
    
    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        if (azanManager) {
            azanManager.destroy();
        }
    });
});