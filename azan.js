// Azan Device Management JavaScript
// Based on MQTT-API.md documentation

// Global variables
let mqttClient = null;
let deviceId = null;
let isConnected = false;
let connectionStatus = 'disconnected';
let responseHandlers = new Map();
let currentMsgId = 1;

// MQTT Configuration
const MQTT_CONFIG = {
    broker: 'wss://mqttws.giot.ir/',
    options: {
        username: '',
        password: '',
        clientId: 'azan_device_' + Math.random().toString(36).substr(2, 9),
        clean: true,
        reconnectPeriod: 5000,
        connectTimeout: 30000
    }
};

// Topics
const TOPICS = {
    request: 'device/request',
    response: 'device/response'
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    console.log('Azan Device Management loaded');
    
    // Check user session first
    CheckSession();
    
    // Load device ID from session storage (azanserial)
    deviceId = sessionStorage.getItem('azanserial');
    
    // Load MQTT credentials from session storage
    const mqttUser = sessionStorage.getItem('mqttuser');
    const mqttPass = sessionStorage.getItem('mqttpass');
    
    // Load MQTT topics from session storage
    const mqttTopic = sessionStorage.getItem('mqtttopic');
    const mqttChatTopic = sessionStorage.getItem('mqttchattopic');
    
    if (mqttUser && mqttPass) {
        MQTT_CONFIG.options.username = mqttUser;
        MQTT_CONFIG.options.password = mqttPass;
    }
    
    // Update topics if available in session storage
    if (mqttTopic && mqttChatTopic) {
        TOPICS.request = `${mqttTopic}/${mqttChatTopic}`;
        TOPICS.response = `${mqttTopic}/${mqttChatTopic}`;
        console.log('MQTT topics loaded from session storage:', {
            request: TOPICS.request,
            response: TOPICS.response
        });
    } else {
        console.log('Using default MQTT topics:', {
            request: TOPICS.request,
            response: TOPICS.response
        });
    }
    
    // Update debug info
    updateDebugInfo();
    
    // Initialize MQTT connection if credentials are available
    if (mqttUser && mqttPass) {
        initializeMQTT();
    } else {
        showNotification('اطلاعات MQTT یافت نشد. لطفاً ابتدا وارد داشبورد شوید.', 'warning');
    }
    
    // Load initial settings
    setTimeout(() => {
        if (isConnected) {
            // First get system info to obtain device ID, then loadAzanSettings will be called automatically
            getSystemInfo();
            // Also get system time automatically
            getSystemTime();
            // Load azan settings
            loadAzanSettings();
            // Load prayer times and detailed info
            refreshPrayerTimes();
        }
    }, 2000);
});

// Session validation function
async function CheckSession() {
    var _userid = sessionStorage.getItem('userid');
    var _session = sessionStorage.getItem('session');
    if (!_userid || !_session) {
        showNotification("شما نشست فعالی ندارید و باید ابتدا لاگین کنید.", "error");
        sessionStorage.clear();
        window.location.href = 'https://my.giot.ir';
        return;
    }
    var data = {
        userid: _userid,
        session: _session
    };
    try {
        const result = await postData(data, '/sessionvalidate');

        if (result && result.status) {
            if (result.status === 'success') {
                showNotification("تایید امنیت نشست جاری", "success");
            } else {
                showNotification("نشست شما معتبر شناسائی نشد لطفا لاگین کنید.", "error");
                sessionStorage.clear();
                window.location.href = 'https://my.giot.ir';
            }
        }
    } catch (error) {
        console.error("Error - ", error);
        showNotification("خطا در برقراری ارتباط با سرور ...", "error");
        // Don't redirect on network errors, allow offline usage
    }
}

// Initialize MQTT connection
function initializeMQTT() {
    try {
        console.log('Connecting to MQTT broker:', MQTT_CONFIG.broker);
        
        mqttClient = mqtt.connect(MQTT_CONFIG.broker, MQTT_CONFIG.options);
        
        mqttClient.on('connect', function() {
            console.log('Connected to MQTT broker');
            isConnected = true;
            connectionStatus = 'connected';
            updateConnectionStatus();
            
            // Subscribe to response topic
            mqttClient.subscribe(TOPICS.response, function(err) {
                if (err) {
                    console.error('Failed to subscribe to response topic:', TOPICS.response, err);
                } else {
                    console.log('Successfully subscribed to response topic:', TOPICS.response);
                }
            });
            
            showNotification('اتصال MQTT برقرار شد', 'success');
        });
        
        mqttClient.on('message', function(topic, message) {
            try {
                const response = JSON.parse(message.toString());
                console.log('Received MQTT message:', response);
                handleMQTTResponse(response);
            } catch (error) {
                console.error('Error parsing MQTT message:', error);
            }
        });
        
        mqttClient.on('error', function(error) {
            console.error('MQTT connection error:', error);
            isConnected = false;
            connectionStatus = 'error';
            updateConnectionStatus();
            showNotification('خطا در اتصال MQTT: ' + error.message, 'error');
        });
        
        mqttClient.on('close', function() {
            console.log('MQTT connection closed');
            isConnected = false;
            connectionStatus = 'disconnected';
            updateConnectionStatus();
        });
        
        mqttClient.on('reconnect', function() {
            console.log('Reconnecting to MQTT broker...');
            connectionStatus = 'reconnecting';
            updateConnectionStatus();
        });
        
    } catch (error) {
        console.error('Error initializing MQTT:', error);
        showNotification('خطا در راه‌اندازی MQTT: ' + error.message, 'error');
    }
}

// Send MQTT request
function sendMQTTRequest(msgId, data = {}) {
    return new Promise((resolve, reject) => {
        if (!mqttClient || !isConnected) {
            reject(new Error('MQTT connection not available'));
            return;
        }
        
        if (!deviceId) {
            // For system info request (msg_id: 10), we can use any deviceid initially
            // as mentioned in MQTT-API.md documentation
            if (msgId === 10) {
                deviceId = 'temp_device_id';
                console.log('Using temporary device ID for system info request');
            } else {
                reject(new Error('Device ID not available. Please get system info first.'));
                return;
            }
        }
        
        // Build request according to MQTT-API.md structure
        const request = {
            msg_id: msgId,
            deviceid: deviceId
        };
        
        // Add data field for requests that require it according to MQTT-API.md
        // GET requests (2, 4, 6, 8, 10, 12, 20, 30, 32) typically don't need data
        // SET/SAVE requests (1, 3, 5, 7, 9, 11, 13, 14, 21, 31) may need data
        const getRequests = [2, 4, 6, 8, 10, 20, 30, 32]; // GET requests that don't need data
        const gpioRequests = [12, 13, 14]; // GPIO requests that may need pin/value data
        
        if (!getRequests.includes(msgId)) {
            // For GPIO requests, add pin/value directly to request (not in data field)
            if (gpioRequests.includes(msgId)) {
                if (data.pin !== undefined) request.pin = data.pin;
                if (data.value !== undefined) request.value = data.value;
            }
            // For other requests, add data field if provided
            else {
                request.data = data;
                console.log('Adding data field to request:', data);
            }
        }
        
        console.log('Sending MQTT API request:', {
            topic: TOPICS.request,
            msgId: msgId,
            deviceId: deviceId,
            request: request
        });
        
        // Store response handler for promise resolution
        responseHandlers.set(msgId, { resolve, reject, timestamp: Date.now() });
        
        // Publish request to MQTT broker
        mqttClient.publish(TOPICS.request, JSON.stringify(request), { qos: 1 }, function(err) {
            if (err) {
                console.error('Failed to publish MQTT request:', err);
                responseHandlers.delete(msgId);
                reject(new Error('Failed to send MQTT request: ' + err.message));
            } else {
                console.log('MQTT request sent successfully');
            }
        });
        
        // Set timeout for response (as recommended in MQTT-API.md)
        setTimeout(() => {
            if (responseHandlers.has(msgId)) {
                responseHandlers.delete(msgId);
                reject(new Error(`Request timeout for msg_id: ${msgId}`));
            }
        }, 10000); // 10 second timeout
    });
}

// Handle MQTT response
function handleMQTTResponse(response) {
    console.log('Received MQTT message:', response);
    
    const msgId = response.msg_id;
    
    // According to MQTT-API.md, all valid API responses must have msg_id
    // Messages without msg_id are not part of the official API
    if (!msgId) {
        console.log('Received message without msg_id - not a valid API response:', response);
        
        // Handle special case: device status updates (not part of API but useful for monitoring)
        if (response.DeviceMACAddress && response.status) {
            console.log('Device status update:', {
                deviceId: response.DeviceMACAddress,
                status: response.status,
                uptime: response.uptime,
                timestamp: response.timestamp
            });
            
            // Update device ID if we don't have one
            if (!deviceId && response.DeviceMACAddress) {
                deviceId = response.DeviceMACAddress;
                sessionStorage.setItem('azanserial', deviceId);
                updateDebugInfo();
                console.log('Device ID updated from status message:', deviceId);
            }
        }
        return;
    }
    
    // Validate response structure according to MQTT-API.md
    // Special handling for automation messages (msg_id: 30, 31, 32) which may have different structure
    if (msgId === 30 || msgId === 31 || msgId === 32) {
        // Automation messages may not have deviceid/timestamp but should have status
        // msg_id 31 may also include request_id field
        if (!response.status) {
            console.error('Invalid automation response structure:', response);
            return;
        }
        console.log('Valid automation response received:', response);
    } else {
        // Standard API messages require deviceid, timestamp, and status
        if (!response.deviceid || !response.timestamp || !response.status) {
            console.error('Invalid API response structure:', response);
            return;
        }
    }
    
    // Verify device ID matches (security check) - skip for automation messages
    if (deviceId && response.deviceid && response.deviceid !== deviceId && ![30, 31, 32].includes(msgId)) {
        console.warn('Device ID mismatch in response. Expected:', deviceId, 'Received:', response.deviceid);
        // Still process but log the mismatch
    }
    
    // Update device ID if received from system info (msg_id: 10)
    if (msgId === 10 && response.status === 'success' && response.data) {
        // According to MQTT-API.md, system info should contain cpu_serial in data
        if (response.data.cpu_serial) {
            deviceId = response.data.cpu_serial;
            sessionStorage.setItem('azanserial', deviceId);
            updateDebugInfo();
            console.log('Device ID updated from system info:', deviceId);
        }
        // Also update from deviceid field if cpu_serial not available
        else if (!deviceId && response.deviceid) {
            deviceId = response.deviceid;
            sessionStorage.setItem('azanserial', deviceId);
            updateDebugInfo();
            console.log('Device ID updated from response deviceid:', deviceId);
        }
    }
    
    // Check if we have a promise handler for this message
    if (responseHandlers.has(msgId)) {
        const handler = responseHandlers.get(msgId);
        responseHandlers.delete(msgId);
        
        if (response.status === 'success') {
            handler.resolve(response);
        } else {
            handler.reject(new Error(response.message || 'Unknown error'));
        }
        return; // Exit early if handler was found and processed
    }
    
    // Handle specific API responses according to MQTT-API.md
    if (response.status === 'success') {
        switch (msgId) {
            case 2: // Get Azan Settings (msg_id: 2)
                if (response.data) {
                    console.log('Loading azan settings from API response:', response.data);
                    populateAzanSettings(response.data);
                } else {
                    console.error('Azan settings response missing data field');
                }
                break;
                
            case 3: // Save Azan Settings (msg_id: 3)
                console.log('Azan settings saved successfully');
                showNotification('تنظیمات اذان با موفقیت ذخیره شد', 'success');
                break;
                
            case 10: // Get System Info (msg_id: 10)
                if (response.data) {
                    console.log('Loading system info from API response:', response.data);
                    populateSystemInfo(response.data);
                    // Load azan settings after getting system info
                    setTimeout(() => loadAzanSettings(), 1000);
                } else {
                    console.error('System info response missing data field');
                }
                break;
                
            case 11: // Save System Info (msg_id: 11)
                console.log('System info saved successfully');
                showNotification('اطلاعات سیستم با موفقیت ذخیره شد', 'success');
                break;
                
            case 12: // Get GPIO Status (msg_id: 12)
                console.log('GPIO status received:', response);
                if (response.data && response.data.pin !== undefined && response.data.value !== undefined) {
                    updateGPIOStatus(response.data);
                }
                break;
                
            case 13: // Set GPIO Value (msg_id: 13)
                console.log('GPIO value set successfully:', response);
                if (response.data) {
                    showNotification(`GPIO ${response.data.pin} تنظیم شد به ${response.data.value}`, 'success');
                    updateGPIOStatus(response.data);
                }
                break;
                
            case 14: // Toggle GPIO (msg_id: 14)
                console.log('GPIO toggled successfully:', response);
                if (response.data) {
                    showNotification(`GPIO ${response.data.pin} از ${response.data.old_value || 'قبلی'} به ${response.data.new_value || response.data.value} تغییر کرد`, 'success');
                    updateGPIOStatus(response.data);
                }
                break;
                
            case 30: // Get Automation Rules (msg_id: 30)
                if (response.data) {
                    console.log('Loading automation rules from API response:', response.data);
                    // Handle automation rules data here
                    if (typeof populateAutomationRules === 'function') {
                        populateAutomationRules(response.data);
                    }
                } else {
                    console.log('Automation rules response received:', response);
                }
                break;
                
            case 31: // Save Automation Rules (msg_id: 31)
                console.log('Automation rules saved successfully');
                showNotification('قوانین اتوماسیون با موفقیت ذخیره شد', 'success');
                break;
                
            case 32: // Get Automation Status (msg_id: 32)
                if (response.data) {
                    console.log('Loading automation status from API response:', response.data);
                    if (typeof updateAutomationStatusDisplay === 'function') {
                        updateAutomationStatusDisplay(response.data);
                    }
                } else {
                    console.log('Automation status response received:', response);
                }
                break;
                
            case 20: // Get System Time (msg_id: 20)
                if (response.data) {
                    console.log('Loading system time from API response:', response.data);
                    updateSystemTime(response.data);
                    
                    // Also update prayer times if available in the same response
                    if (response.data.prayer_times_debug) {
                        console.log('Loading prayer times from system time response:', response.data.prayer_times_debug);
                        updatePrayerTimesDisplay(response.data);
                    }
                } else {
                    console.error('System time response missing data field');
                }
                break;
                
            case 21: // Set System Time (msg_id: 21)
                console.log('System time set successfully');
                showNotification('زمان سیستم با موفقیت تنظیم شد', 'success');
                break;
                
            case 4: // Get PIMS Settings (msg_id: 4)
                if (response.data) {
                    console.log('Loading PIMS settings from API response:', response.data);
                    populatePIMSSettings(response.data);
                } else {
                    console.error('PIMS settings response missing data field');
                }
                break;
                
            case 5: // Save PIMS Settings (msg_id: 5)
                console.log('PIMS settings saved successfully');
                showNotification('تنظیمات PIMS با موفقیت ذخیره شد', 'success');
                break;
                
            case 6: // Get SIP Settings (msg_id: 6)
                if (response.data) {
                    console.log('Loading SIP settings from API response:', response.data);
                    populateSIPSettings(response.data);
                } else {
                    console.error('SIP settings response missing data field');
                }
                break;
                
            case 7: // Save SIP Settings (msg_id: 7)
                console.log('SIP settings saved successfully');
                showNotification('تنظیمات SIP با موفقیت ذخیره شد', 'success');
                break;
                
            case 8: // Get Digital IO Settings (msg_id: 8)
                if (response.data) {
                    console.log('Loading Digital IO settings from API response:', response.data);
                    populateDigitalIOSettings(response.data);
                } else {
                    console.error('Digital IO settings response missing data field');
                }
                break;
                
            case 9: // Save Digital IO Settings (msg_id: 9)
                console.log('Digital IO settings saved successfully');
                showNotification('تنظیمات Digital IO با موفقیت ذخیره شد', 'success');
                break;
                
            case 31: // Test Next Prayer (custom msg_id for testing prayer)
                console.log('Next prayer test executed successfully');
                showNotification('تست اذان بعدی با موفقیت انجام شد', 'success');
                break;
                
            default:
                console.log('Unhandled successful API response:', response);
                break;
        }
    } else {
        // Handle error responses
        console.error('API Error Response:', response);
        const errorMessage = response.message || 'خطای نامشخص';
        const errorDetails = response.error_details ? ` (${response.error_details})` : '';
        showNotification(`خطا در API (msg_id: ${msgId}): ${errorMessage}${errorDetails}`, 'error');
    }
}

// Tab and Category Management
function showTab(tabName, event) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Remove active class from all nav links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    // Show selected tab
    const selectedTab = document.getElementById(tabName + '-tab');
    if (selectedTab) {
        selectedTab.classList.add('active');
    }
    
    // Add active class to clicked nav link
    const activeLink = event ? event.target : document.querySelector(`[onclick="showTab('${tabName}')"]`);
    if (activeLink) {
        activeLink.classList.add('active');
    }
    
    // Load specific data for each tab ONLY when that tab is active
    if (tabName === 'prayer-times') {
        refreshPrayerTimes();
    } else if (tabName === 'system') {
        getSystemInfo();
        getSystemTime();
    } else if (tabName === 'pims') {
        // Load PIMS settings when PIMS tab is selected
        console.log('Loading PIMS settings for tab:', tabName);
        loadPIMSSettings();
    } else if (tabName === 'sip') {
        // Load SIP settings when SIP tab is selected
        console.log('Loading SIP settings for tab:', tabName);
        loadSIPSettings();
    } else if (tabName === 'hardware') {
        // First update GPIO status, then load automation settings
        getGPIOStatus();
        loadDigitalIOSettings();
        // Load GPIO Automation settings when Hardware tab is selected
        console.log('Loading GPIO Automation settings for tab:', tabName);
        // Ensure GPIO status is updated before loading automation rules
        setTimeout(() => {
            loadAutomationRules();
            getAutomationStatus();
        }, 500); // Small delay to ensure GPIO status is loaded first
    }
}

function showCategory(categoryName) {
    // Hide all categories
    document.querySelectorAll('.category-section').forEach(category => {
        category.classList.remove('active');
    });
    
    // Remove active class from all category buttons
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected category
    const selectedCategory = document.getElementById(categoryName + '-category');
    if (selectedCategory) {
        selectedCategory.classList.add('active');
    }
    
    // Add active class to clicked button
    event.target.classList.add('active');
}

// Azan Settings Functions
function loadAzanSettings() {
    sendMQTTRequest(2) // No data parameter for msg_id 2
        .then(response => {
            console.log('Azan settings loaded:', response.data);
            if (response.data) {
                populateAzanSettings(response.data);
            }
            showNotification('تنظیمات اذان بارگذاری شد', 'success');
        })
        .catch(error => {
            console.error('Error loading azan settings:', error);
            showNotification('خطا در بارگذاری تنظیمات اذان: ' + error.message, 'error');
        });
}

function populateAzanSettings(data) {
    console.log('Populating azan settings with complete data:', data);
    
    // Store the complete settings data globally for later use
    window.currentAzanSettings = data;
    
    // Device information
    if (data.device) {
        if (data.device.device_id && document.getElementById('device_id')) {
            document.getElementById('device_id').value = data.device.device_id;
        }
        if (data.device.device_name && document.getElementById('device_name')) {
            document.getElementById('device_name').value = data.device.device_name;
        }
    }
    
    // GPS/Location settings
    if (data.gps) {
        if (data.gps.ptimes_geolocation_name && document.getElementById('location_name')) {
            document.getElementById('location_name').value = data.gps.ptimes_geolocation_name;
        }
        if (data.gps.ptimes_geolocation_xlatitude && document.getElementById('latitude')) {
            document.getElementById('latitude').value = data.gps.ptimes_geolocation_xlatitude;
        }
        if (data.gps.ptimes_geolocation_xlongitude && document.getElementById('longitude')) {
            document.getElementById('longitude').value = data.gps.ptimes_geolocation_xlongitude;
        }
        if (data.gps.ptimes_geolocation_timezone && document.getElementById('timezone')) {
            document.getElementById('timezone').value = data.gps.ptimes_geolocation_timezone;
        }
        if (data.gps.ptimes_geolocation_timezonename && document.getElementById('timezone_name')) {
            document.getElementById('timezone_name').value = data.gps.ptimes_geolocation_timezonename;
        }
        if (data.gps.ptimes_geolocation_dstactive !== undefined && document.getElementById('dst_active')) {
            document.getElementById('dst_active').checked = data.gps.ptimes_geolocation_dstactive;
        }
        if (data.gps.ptimes_geolocation_mode_gps !== undefined && document.getElementById('gps_mode')) {
            document.getElementById('gps_mode').value = data.gps.ptimes_geolocation_mode_gps;
        }
    }
    
    // Prayer calculation settings
    if (data.prayer_calculation) {
        if (data.prayer_calculation.ptimes_calc_method && document.getElementById('calc_method')) {
            document.getElementById('calc_method').value = data.prayer_calculation.ptimes_calc_method;
        }
        if (data.prayer_calculation.ptimes_asr_method && document.getElementById('asr_method')) {
            document.getElementById('asr_method').value = data.prayer_calculation.ptimes_asr_method;
        }
        if (data.prayer_calculation.ptimes_high_lats_adjust_method && document.getElementById('high_lats_method')) {
            document.getElementById('high_lats_method').value = data.prayer_calculation.ptimes_high_lats_adjust_method;
        }
        // Prayer time adjustments
        if (data.prayer_calculation.fajr_offset !== undefined && document.getElementById('fajr_offset')) {
            document.getElementById('fajr_offset').value = data.prayer_calculation.fajr_offset;
        }
        if (data.prayer_calculation.dhuhr_offset !== undefined && document.getElementById('dhuhr_offset')) {
            document.getElementById('dhuhr_offset').value = data.prayer_calculation.dhuhr_offset;
        }
        if (data.prayer_calculation.asr_offset !== undefined && document.getElementById('asr_offset')) {
            document.getElementById('asr_offset').value = data.prayer_calculation.asr_offset;
        }
        if (data.prayer_calculation.maghrib_offset !== undefined && document.getElementById('maghrib_offset')) {
            document.getElementById('maghrib_offset').value = data.prayer_calculation.maghrib_offset;
        }
        if (data.prayer_calculation.isha_offset !== undefined && document.getElementById('isha_offset')) {
            document.getElementById('isha_offset').value = data.prayer_calculation.isha_offset;
        }
    }
    
    // Volume settings
    if (data.volume) {
        if (data.volume.master_mic_volume !== undefined && document.getElementById('master_mic_volume')) {
            document.getElementById('master_mic_volume').value = data.volume.master_mic_volume;
        }
        if (data.volume.master_playback_volume !== undefined && document.getElementById('master_playback_volume')) {
            document.getElementById('master_playback_volume').value = data.volume.master_playback_volume;
        }
        if (data.volume.master_volume !== undefined && document.getElementById('master_volume')) {
            document.getElementById('master_volume').value = data.volume.master_volume;
        }
        if (data.volume.enabled !== undefined && document.getElementById('azanEnabled')) {
            document.getElementById('azanEnabled').checked = data.volume.enabled;
        }
        if (data.volume.fajrEnabled !== undefined && document.getElementById('fajrEnabled')) {
            document.getElementById('fajrEnabled').checked = data.volume.fajrEnabled;
        }
        if (data.volume.dhuhrEnabled !== undefined && document.getElementById('dhuhrEnabled')) {
            document.getElementById('dhuhrEnabled').checked = data.volume.dhuhrEnabled;
        }
        if (data.volume.asrEnabled !== undefined && document.getElementById('asrEnabled')) {
            document.getElementById('asrEnabled').checked = data.volume.asrEnabled;
        }
        if (data.volume.maghribEnabled !== undefined && document.getElementById('maghribEnabled')) {
            document.getElementById('maghribEnabled').checked = data.volume.maghribEnabled;
        }
        if (data.volume.ishaEnabled !== undefined && document.getElementById('ishaEnabled')) {
            document.getElementById('ishaEnabled').checked = data.volume.ishaEnabled;
        }
        if (data.volume.azan_audio_file && document.getElementById('azan_audio_file')) {
            document.getElementById('azan_audio_file').value = data.volume.azan_audio_file;
        }
    }
    
    // Prayer times settings
    if (data.prayer_times) {
        const prayers = ['sobh', 'sunrise', 'dhohr', 'asr', 'maghrib', 'sunset', 'isha'];
        
        prayers.forEach(prayer => {
            if (data.prayer_times[prayer]) {
                const prayerData = data.prayer_times[prayer];
                
                // Days of week settings
                if (prayerData[`azan_${prayer}_days_of_week`] !== undefined) {
                    const element = document.getElementById(`${prayer}_days_of_week`);
                    if (element) element.value = prayerData[`azan_${prayer}_days_of_week`];
                }
                
                // Volume settings
                if (prayerData[`azan_${prayer}_volume`] !== undefined) {
                    const element = document.getElementById(`${prayer}_volume`);
                    if (element) {
                        element.value = prayerData[`azan_${prayer}_volume`];
                        updateVolumeDisplay(prayerData[`azan_${prayer}_volume`]);
                    }
                }
                
                // Playlist files
                if (prayerData[`azan_${prayer}_playlist_files`]) {
                    const element = document.getElementById(`${prayer}_playlist`);
                    if (element) element.value = prayerData[`azan_${prayer}_playlist_files`];
                }
                
                // Pre-azan settings
                if (prayerData[`azan_${prayer}_pre_days_of_week`] !== undefined) {
                    const element = document.getElementById(`${prayer}_pre_days_of_week`);
                    if (element) element.value = prayerData[`azan_${prayer}_pre_days_of_week`];
                }
                
                if (prayerData[`azan_${prayer}_pre_volume`] !== undefined) {
                    const element = document.getElementById(`${prayer}_pre_volume`);
                    if (element) element.value = prayerData[`azan_${prayer}_pre_volume`];
                }
                
                if (prayerData[`azan_${prayer}_pre_playlist_files`]) {
                    const element = document.getElementById(`${prayer}_pre_playlist`);
                    if (element) element.value = prayerData[`azan_${prayer}_pre_playlist_files`];
                }
                
                // Post-azan settings
                if (prayerData[`azan_${prayer}_post_days_of_week`] !== undefined) {
                    const element = document.getElementById(`${prayer}_post_days_of_week`);
                    if (element) element.value = prayerData[`azan_${prayer}_post_days_of_week`];
                }
                
                if (prayerData[`azan_${prayer}_post_volume`] !== undefined) {
                    const element = document.getElementById(`${prayer}_post_volume`);
                    if (element) element.value = prayerData[`azan_${prayer}_post_volume`];
                }
                
                if (prayerData[`azan_${prayer}_post_playlist_files`]) {
                    const element = document.getElementById(`${prayer}_post_playlist`);
                    if (element) element.value = prayerData[`azan_${prayer}_post_playlist_files`];
                }
                
                // Random file selection
                if (prayerData.random_file_selection !== undefined) {
                    const element = document.getElementById(`${prayer}_random_selection`);
                    if (element) element.checked = prayerData.random_file_selection === 1;
                }
            }
        });
    }
    
    // Files information (display only)
    if (data.files) {
        const azanFileCountEl = document.getElementById('azan_file_count');
        if (data.files.azan_archive_file_count !== undefined && azanFileCountEl) {
            azanFileCountEl.textContent = data.files.azan_archive_file_count;
        }
        
        const quran3minCountEl = document.getElementById('quran_3min_count');
        if (data.files.quran_3min_archive_file_count !== undefined && quran3minCountEl) {
            quran3minCountEl.textContent = data.files.quran_3min_archive_file_count;
        }
        
        const quran7minCountEl = document.getElementById('quran_7min_count');
        if (data.files.quran_7min_pages_archive_file_count !== undefined && quran7minCountEl) {
            quran7minCountEl.textContent = data.files.quran_7min_pages_archive_file_count;
        }
        
        const quranPagesCountEl = document.getElementById('quran_pages_count');
        if (data.files.quran_pages_archive_file_count !== undefined && quranPagesCountEl) {
            quranPagesCountEl.textContent = data.files.quran_pages_archive_file_count;
        }
    }
}

function saveAzanSettings() {
    // Start with the current loaded settings as base
    const azanData = window.currentAzanSettings ? JSON.parse(JSON.stringify(window.currentAzanSettings)) : {};
    
    // Ensure all main sections exist
    if (!azanData.device) azanData.device = {};
    if (!azanData.gps) azanData.gps = {};
    if (!azanData.prayer_calculation) azanData.prayer_calculation = {};
    if (!azanData.prayer_times) azanData.prayer_times = {};
    if (!azanData.volume) azanData.volume = {};
    if (!azanData.files) azanData.files = {};
    
    // Update device information
    const deviceIdEl = document.getElementById('device_id');
    const deviceNameEl = document.getElementById('device_name');
    if (deviceIdEl && deviceIdEl.value) azanData.device.device_id = deviceIdEl.value;
    if (deviceNameEl && deviceNameEl.value) azanData.device.device_name = deviceNameEl.value;
    
    // Update GPS/Location settings
    const locationNameEl = document.getElementById('location_name');
    const latitudeEl = document.getElementById('latitude');
    const longitudeEl = document.getElementById('longitude');
    const timezoneEl = document.getElementById('timezone');
    const timezoneNameEl = document.getElementById('timezone_name');
    const dstActiveEl = document.getElementById('dst_active');
    const gpsModeEl = document.getElementById('gps_mode');
    
    if (locationNameEl && locationNameEl.value) azanData.gps.ptimes_geolocation_name = locationNameEl.value;
    if (latitudeEl && latitudeEl.value) azanData.gps.ptimes_geolocation_xlatitude = parseFloat(latitudeEl.value);
    if (longitudeEl && longitudeEl.value) azanData.gps.ptimes_geolocation_xlongitude = parseFloat(longitudeEl.value);
    if (timezoneEl && timezoneEl.value) azanData.gps.ptimes_geolocation_timezone = parseFloat(timezoneEl.value);
    if (timezoneNameEl && timezoneNameEl.value) azanData.gps.ptimes_geolocation_timezonename = timezoneNameEl.value;
    if (dstActiveEl) azanData.gps.ptimes_geolocation_dstactive = dstActiveEl.checked;
    if (gpsModeEl && gpsModeEl.value !== '') azanData.gps.ptimes_geolocation_mode_gps = parseInt(gpsModeEl.value);
    
    // Update prayer calculation settings
    const calcMethodEl = document.getElementById('calc_method');
    const asrMethodEl = document.getElementById('asr_method');
    const highLatsMethodEl = document.getElementById('high_lats_method');
    const fajrOffsetEl = document.getElementById('fajr_offset');
    const dhuhrOffsetEl = document.getElementById('dhuhr_offset');
    const asrOffsetEl = document.getElementById('asr_offset');
    const maghribOffsetEl = document.getElementById('maghrib_offset');
    const ishaOffsetEl = document.getElementById('isha_offset');
    
    if (calcMethodEl && calcMethodEl.value) azanData.prayer_calculation.ptimes_calc_method = calcMethodEl.value;
    if (asrMethodEl && asrMethodEl.value) azanData.prayer_calculation.ptimes_asr_method = asrMethodEl.value;
    if (highLatsMethodEl && highLatsMethodEl.value) azanData.prayer_calculation.ptimes_high_lats_adjust_method = highLatsMethodEl.value;
    if (fajrOffsetEl && fajrOffsetEl.value !== '') azanData.prayer_calculation.fajr_offset = parseInt(fajrOffsetEl.value);
    if (dhuhrOffsetEl && dhuhrOffsetEl.value !== '') azanData.prayer_calculation.dhuhr_offset = parseInt(dhuhrOffsetEl.value);
    if (asrOffsetEl && asrOffsetEl.value !== '') azanData.prayer_calculation.asr_offset = parseInt(asrOffsetEl.value);
    if (maghribOffsetEl && maghribOffsetEl.value !== '') azanData.prayer_calculation.maghrib_offset = parseInt(maghribOffsetEl.value);
    if (ishaOffsetEl && ishaOffsetEl.value !== '') azanData.prayer_calculation.isha_offset = parseInt(ishaOffsetEl.value);
    
    // Update prayer times settings
    const prayers = ['sobh', 'sunrise', 'dhohr', 'asr', 'maghrib', 'sunset', 'isha'];
    
    prayers.forEach(prayer => {
        if (!azanData.prayer_times[prayer]) azanData.prayer_times[prayer] = {};
        
        // Days of week settings
        const daysOfWeekEl = document.getElementById(`${prayer}_days_of_week`);
        if (daysOfWeekEl && daysOfWeekEl.value !== '') {
            azanData.prayer_times[prayer][`azan_${prayer}_days_of_week`] = parseInt(daysOfWeekEl.value);
        }
        
        // Volume settings
        const volumeEl = document.getElementById(`${prayer}_volume`);
        if (volumeEl && volumeEl.value !== '') {
            azanData.prayer_times[prayer][`azan_${prayer}_volume`] = parseInt(volumeEl.value);
        }
        
        // Playlist files
        const playlistEl = document.getElementById(`${prayer}_playlist`);
        if (playlistEl && playlistEl.value) {
            azanData.prayer_times[prayer][`azan_${prayer}_playlist_files`] = playlistEl.value;
        }
        
        // Pre-azan settings
        const preDaysOfWeekEl = document.getElementById(`${prayer}_pre_days_of_week`);
        if (preDaysOfWeekEl && preDaysOfWeekEl.value !== '') {
            azanData.prayer_times[prayer][`azan_${prayer}_pre_days_of_week`] = parseInt(preDaysOfWeekEl.value);
        }
        
        const preVolumeEl = document.getElementById(`${prayer}_pre_volume`);
        if (preVolumeEl && preVolumeEl.value !== '') {
            azanData.prayer_times[prayer][`azan_${prayer}_pre_volume`] = parseInt(preVolumeEl.value);
        }
        
        const prePlaylistEl = document.getElementById(`${prayer}_pre_playlist`);
        if (prePlaylistEl && prePlaylistEl.value) {
            azanData.prayer_times[prayer][`azan_${prayer}_pre_playlist_files`] = prePlaylistEl.value;
        }
        
        // Post-azan settings
        const postDaysOfWeekEl = document.getElementById(`${prayer}_post_days_of_week`);
        if (postDaysOfWeekEl && postDaysOfWeekEl.value !== '') {
            azanData.prayer_times[prayer][`azan_${prayer}_post_days_of_week`] = parseInt(postDaysOfWeekEl.value);
        }
        
        const postVolumeEl = document.getElementById(`${prayer}_post_volume`);
        if (postVolumeEl && postVolumeEl.value !== '') {
            azanData.prayer_times[prayer][`azan_${prayer}_post_volume`] = parseInt(postVolumeEl.value);
        }
        
        const postPlaylistEl = document.getElementById(`${prayer}_post_playlist`);
        if (postPlaylistEl && postPlaylistEl.value) {
            azanData.prayer_times[prayer][`azan_${prayer}_post_playlist_files`] = postPlaylistEl.value;
        }
        
        // Random file selection
        const randomSelectionEl = document.getElementById(`${prayer}_random_selection`);
        if (randomSelectionEl) {
            azanData.prayer_times[prayer].random_file_selection = randomSelectionEl.checked ? 1 : 0;
        }
    });
    
    // Update files information
    const azanFileCountEl = document.getElementById('azan_archive_file_count');
    const quran3minFileCountEl = document.getElementById('quran_3min_archive_file_count');
    const quran7minFileCountEl = document.getElementById('quran_7min_pages_archive_file_count');
    const quranPagesFileCountEl = document.getElementById('quran_pages_archive_file_count');
    
    if (azanFileCountEl && azanFileCountEl.value !== '') {
        azanData.files.azan_archive_file_count = parseInt(azanFileCountEl.value);
    }
    if (quran3minFileCountEl && quran3minFileCountEl.value !== '') {
        azanData.files.quran_3min_archive_file_count = parseInt(quran3minFileCountEl.value);
    }
    if (quran7minFileCountEl && quran7minFileCountEl.value !== '') {
        azanData.files.quran_7min_pages_archive_file_count = parseInt(quran7minFileCountEl.value);
    }
    if (quranPagesFileCountEl && quranPagesFileCountEl.value !== '') {
        azanData.files.quran_pages_archive_file_count = parseInt(quranPagesFileCountEl.value);
    }
    
    // Update volume settings
    const masterMicVolumeEl = document.getElementById('master_mic_volume');
    const masterPlaybackVolumeEl = document.getElementById('master_playback_volume');
    
    if (masterMicVolumeEl && masterMicVolumeEl.value !== '') {
        azanData.volume.master_mic_volume = parseInt(masterMicVolumeEl.value);
    }
    if (masterPlaybackVolumeEl && masterPlaybackVolumeEl.value !== '') {
        azanData.volume.master_playback_volume = parseInt(masterPlaybackVolumeEl.value);
    }
    
    console.log('Saving complete azan settings:', azanData);
    
    sendMQTTRequest(3, azanData)
        .then(response => {
            console.log('Azan settings saved:', response);
            showNotification('تنظیمات اذان ذخیره شد', 'success');
        })
        .catch(error => {
            console.error('Error saving azan settings:', error);
            showNotification('خطا در ذخیره تنظیمات اذان: ' + error.message, 'error');
        });
}

function saveAudioSettings() {
    const volume = parseInt(document.getElementById('volume').value);
    const audioFile = document.getElementById('audio_file').value;
    
    const audioData = {
        volume: volume,
        audio_file: audioFile
    };
    
    sendMQTTRequest(3, audioData)
        .then(response => {
            console.log('Audio settings saved:', response);
            showNotification('تنظیمات صوتی ذخیره شد', 'success');
        })
        .catch(error => {
            console.error('Error saving audio settings:', error);
            showNotification('خطا در ذخیره تنظیمات صوتی: ' + error.message, 'error');
        });
}

function updateVolumeDisplay(value) {
    const volumeValueEl = document.getElementById('volumeValue');
    if (volumeValueEl) {
        volumeValueEl.textContent = value;
    }
}

function testAzan(prayerType) {
    showNotification('در حال تست اذان...', 'info');
    
    // Send test command (this would be a custom implementation)
    const testData = {
        test_prayer: prayerType,
        volume: parseInt(document.getElementById('volume').value)
    };
    
    // Note: This is not in the official API, but could be implemented
    console.log('Testing azan for:', prayerType, testData);
    showNotification('تست اذان ارسال شد', 'success');
}

// System Functions
function getSystemInfo() {
    sendMQTTRequest(10) // No data parameter for msg_id 10
        .then(response => {
            console.log('System info received:', response.data);
            if (response.data) {
                populateSystemInfo(response.data);
            }
            showNotification('اطلاعات سیستم بروزرسانی شد', 'success');
        })
        .catch(error => {
            console.error('Error getting system info:', error);
            showNotification('خطا در دریافت اطلاعات سیستم: ' + error.message, 'error');
        });
}

function populateSystemInfo(data) {
    console.log('System info received:', data);
    
    const cpuModelEl = document.getElementById('systemCpuModel');
    if (cpuModelEl) {
        cpuModelEl.textContent = data.cpu_model || 'نامشخص';
    }
    
    const cpuSerialEl = document.getElementById('systemCpuSerial');
    if (cpuSerialEl) {
        cpuSerialEl.textContent = data.cpu_serial || 'نامشخص';
    }
    
    const hardwareEl = document.getElementById('systemHardware');
    if (hardwareEl) {
        hardwareEl.textContent = data.hardware || 'نامشخص';
    }
    
    const ipAddressEl = document.getElementById('systemIpAddress');
    if (ipAddressEl) {
        ipAddressEl.textContent = data.ip_address || 'نامشخص';
    }
    
    const macAddressEl = document.getElementById('systemMacAddress');
    if (macAddressEl) {
        macAddressEl.textContent = data.mac_address || 'نامشخص';
    }
    
    const revisionEl = document.getElementById('systemRevision');
    if (revisionEl) {
        revisionEl.textContent = data.revision || 'نامشخص';
    }
}

// Time Management Functions
function getSystemTime() {
    sendMQTTRequest(20)
        .then(response => {
            console.log('System time received:', response.data);
            if (response.data) {
                updateSystemTime(response.data);
            }
            showNotification('زمان سیستم دریافت شد', 'success');
        })
        .catch(error => {
            console.error('Error getting system time:', error);
            showNotification('خطا در دریافت زمان سیستم: ' + error.message, 'error');
        });
}

function getWeekdayName(weekday) {
    const weekdays = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه', 'شنبه'];
    return weekday !== undefined ? weekdays[weekday] : 'نامشخص';
}

function formatUptime(seconds) {
    if (!seconds) return 'نامشخص';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function updateSystemTime(data) {
    console.log('System time received:', data);
    console.log('Data keys:', Object.keys(data));
    console.log('Individual data values:', {
        year: data.year,
        month: data.month,
        day: data.day,
        hour: data.hour,
        minute: data.minute,
        second: data.second,
        weekday: data.weekday,
        unix_timestamp: data.unix_timestamp,
        uptime_seconds: data.uptime_seconds
    });
    
    // نمایش زمان فعلی سیستم
    const currentTimeElement = document.getElementById('current-time');
    const currentSystemTimeElement = document.getElementById('currentSystemTime');
    
    if (data.unix_timestamp) {
        const date = new Date(data.unix_timestamp * 1000);
        const formattedTime = date.toLocaleString('fa-IR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZone: 'Asia/Tehran'
        });
        
        if (currentTimeElement) {
            currentTimeElement.textContent = formattedTime;
            console.log('Updated current time element:', formattedTime);
        }
        
        if (currentSystemTimeElement) {
            currentSystemTimeElement.textContent = formattedTime;
            console.log('Updated current system time element:', formattedTime);
        }
    } else {
        console.log('unix_timestamp missing in data');
    }
    

}

function displayPrayerTimesInfo(prayerDebug) {
    console.log('Displaying prayer times info:', prayerDebug);
    
    let html = `
        <div class="prayer-times-section">
            <h4><i class="fas fa-mosque"></i> اطلاعات اوقات شرعی</h4>
    `;
    
    // Display calculation settings
    if (prayerDebug.calculation_method || prayerDebug.asr_method) {
        html += `
            <div class="calculation-settings">
                <h5>تنظیمات محاسبه</h5>
                <div class="settings-grid">
                    <div class="setting-item">
                        <span class="label">روش محاسبه:</span>
                        <span class="value">${prayerDebug.calculation_method || 'نامشخص'}</span>
                    </div>
                    <div class="setting-item">
                        <span class="label">روش عصر:</span>
                        <span class="value">${prayerDebug.asr_method || 'نامشخص'}</span>
                    </div>
                    <div class="setting-item">
                        <span class="label">عرض‌های بالا:</span>
                        <span class="value">${prayerDebug.high_lats_method || 'نامشخص'}</span>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Display location info
    if (prayerDebug.location) {
        html += `
            <div class="location-info">
                <h5>اطلاعات مکان</h5>
                <div class="location-grid">
                    <div class="location-item">
                        <span class="label">عرض جغرافیایی:</span>
                        <span class="value">${prayerDebug.location.latitude}°</span>
                    </div>
                    <div class="location-item">
                        <span class="label">طول جغرافیایی:</span>
                        <span class="value">${prayerDebug.location.longitude}°</span>
                    </div>
                    <div class="location-item">
                        <span class="label">منطقه زمانی:</span>
                        <span class="value">${prayerDebug.location.timezone_name || prayerDebug.location.timezone}</span>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Display date information
    if (prayerDebug.date) {
        html += `
            <div class="date-info">
                <h5>اطلاعات تاریخ</h5>
                <div class="date-grid">
        `;
        
        if (prayerDebug.date.gregorian) {
            html += `
                <div class="date-item">
                    <span class="label">میلادی:</span>
                    <span class="value">${prayerDebug.date.gregorian.formatted} (${prayerDebug.date.gregorian.month_name})</span>
                </div>
            `;
        }
        
        if (prayerDebug.date.jalali) {
            html += `
                <div class="date-item">
                    <span class="label">شمسی:</span>
                    <span class="value">${prayerDebug.date.jalali.formatted} (${prayerDebug.date.jalali.month_name})</span>
                </div>
            `;
        }
        
        if (prayerDebug.date.lunar) {
            html += `
                <div class="date-item">
                    <span class="label">قمری:</span>
                    <span class="value">${prayerDebug.date.lunar.formatted} (${prayerDebug.date.lunar.month_name})</span>
                </div>
            `;
        }
        
        html += `
                </div>
            </div>
        `;
    }
    
    // Display prayer times
    if (prayerDebug.prayer_times) {
        html += `
            <div class="prayer-times">
                <h5>اوقات شرعی</h5>
                <div class="prayer-grid">
        `;
        
        const prayerNames = {
            'Fajr': 'صبح',
            'Sunrise': 'طلوع',
            'Dhuhr': 'ظهر',
            'Asr': 'عصر',
            'Sunset': 'غروب',
            'Maghrib': 'مغرب',
            'Isha': 'عشا'
        };
        
        Object.entries(prayerDebug.prayer_times).forEach(([key, value]) => {
            if (key !== 'status' && prayerNames[key]) {
                html += `
                    <div class="prayer-item">
                        <span class="prayer-name">${prayerNames[key]}</span>
                        <span class="prayer-time">${value}</span>
                    </div>
                `;
            }
        });
        
        html += `
                </div>
            </div>
        `;
    }
    
    // Display debug azan times (with epoch times)
    if (prayerDebug.debug_azan_times) {
        html += `
            <div class="debug-azan-times">
                <h5>اطلاعات تکمیلی اذان</h5>
                <div class="azan-grid">
        `;
        
        Object.entries(prayerDebug.debug_azan_times).forEach(([key, value]) => {
            if (key.includes('_formatted') || key.includes('_volume')) return;
            
            const formattedKey = key.replace('Pre', '');
            const volumeKey = key + '_volume';
            const formattedKey_full = key + '_formatted';
            
            const prayerNameMap = {
                'Fajr': 'صبح',
                'Dhuhr': 'ظهر',
                'Asr': 'عصر',
                'Maghrib': 'مغرب',
                'Isha': 'عشا'
            };
            
            const displayName = prayerNameMap[formattedKey] || formattedKey;
            const volume = prayerDebug.debug_azan_times[volumeKey] || 0;
            const formatted = prayerDebug.debug_azan_times[formattedKey_full] || '';
            
            // تبدیل Epoch به تاریخ فارسی
            let persianDate = '';
            if (value && value > 0) {
                const date = new Date(value * 1000);
                persianDate = date.toLocaleString('fa-IR', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    timeZone: 'Asia/Tehran'
                });
            }
            
            html += `
                <div class="azan-item">
                    <div class="azan-name">${displayName}</div>
                    <div class="azan-details">
                        <div class="azan-persian">${persianDate || 'نامشخص'}</div>
                        <div class="azan-formatted">${formatted}</div>
                        <div class="azan-volume">صدا: ${volume}%</div>
                    </div>
                </div>
            `;
        });
        
        html += `
                </div>
            </div>
        `;
    }
    
    // Display lunar and sun information
    if (prayerDebug.lunar_info) {
        html += `
            <div class="astronomical-info">
                <h5>اطلاعات نجومی</h5>
        `;
        
        // Moon Information
        if (prayerDebug.lunar_info.moon) {
            const moon = prayerDebug.lunar_info.moon;
            html += `
                <div class="moon-info">
                    <h6><i class="fas fa-moon"></i> اطلاعات ماه</h6>
                    <div class="moon-grid">
                        <div class="moon-item">
                            <span class="label">سن ماه:</span>
                            <span class="value">${moon['moon age']?.toFixed(2)} روز</span>
                        </div>
                        <div class="moon-item">
                            <span class="label">فاز ماه:</span>
                            <span class="value">${moon['moon phase name']}</span>
                        </div>
                        <div class="moon-item">
                            <span class="label">طلوع ماه:</span>
                            <span class="value">${moon.rises?.[0] || 'نامشخص'}</span>
                        </div>
                        <div class="moon-item">
                            <span class="label">غروب ماه:</span>
                            <span class="value">${moon.sets?.[0] || 'نامشخص'}</span>
                        </div>
                    </div>
                </div>
            `;
        }
        
        // Sun Information
        if (prayerDebug.lunar_info.sun) {
            const sun = prayerDebug.lunar_info.sun;
            html += `
                <div class="sun-info">
                    <h6><i class="fas fa-sun"></i> اطلاعات خورشید</h6>
                    <div class="sun-grid">
                        <div class="sun-item">
                            <span class="label">طلوع:</span>
                            <span class="value">${sun.sunrise}</span>
                        </div>
                        <div class="sun-item">
                            <span class="label">غروب:</span>
                            <span class="value">${sun.sunset}</span>
                        </div>
                        <div class="sun-item">
                            <span class="label">اوج خورشید:</span>
                            <span class="value">${sun['high noon']}</span>
                        </div>
                        <div class="sun-item">
                            <span class="label">ارتفاع در اوج:</span>
                            <span class="value">${sun['sun altitude at high noon']?.toFixed(2)}°</span>
                        </div>
                        <div class="sun-item">
                            <span class="label">شروع گرگ و میش مدنی:</span>
                            <span class="value">${sun['start civil twilight']}</span>
                        </div>
                        <div class="sun-item">
                            <span class="label">پایان گرگ و میش مدنی:</span>
                            <span class="value">${sun['end civil twilight']}</span>
                        </div>
                    </div>
                </div>
            `;
        }
        
        html += `
            </div>
        `;
    }
    
    html += `
        </div>
    `;
    
    return html;
}

function displayTimeComponents(data) {
    // Update the current system time display in the time management section
    const currentTimeEl = document.getElementById('currentSystemTime');
    if (currentTimeEl) {
        const weekdays = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه', 'شنبه'];
        const weekdayName = data.weekday !== undefined ? weekdays[data.weekday] : 'نامشخص';
        const formattedUptime = `${Math.floor(data.uptime_seconds / 3600).toString().padStart(2, '0')}:${Math.floor((data.uptime_seconds % 3600) / 60).toString().padStart(2, '0')}:${(data.uptime_seconds % 60).toString().padStart(2, '0')}`;
        
        // Convert unix timestamp to readable date
        const unixDate = new Date(data.unix_timestamp * 1000);
        const readableDate = unixDate.toLocaleString('fa-IR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZone: 'Asia/Tehran'
        });
        
        currentTimeEl.innerHTML = `
            <div class="system-time-container">
                <h4 class="system-time-title">
                    <i class="fas fa-clock"></i>
                    اطلاعات زمان سیستم
                </h4>
                <div class="time-grid">
                    <div class="time-item">
                        <div class="time-label">سال</div>
                        <div class="time-value">${data.year}</div>
                    </div>
                    <div class="time-item">
                        <div class="time-label">ماه</div>
                        <div class="time-value">${data.month}</div>
                    </div>
                    <div class="time-item">
                        <div class="time-label">روز</div>
                        <div class="time-value">${data.day}</div>
                    </div>
                    <div class="time-item">
                        <div class="time-label">ساعت</div>
                        <div class="time-value">${data.hour.toString().padStart(2, '0')}</div>
                    </div>
                    <div class="time-item">
                        <div class="time-label">دقیقه</div>
                        <div class="time-value">${data.minute.toString().padStart(2, '0')}</div>
                    </div>
                    <div class="time-item">
                        <div class="time-label">ثانیه</div>
                        <div class="time-value">${data.second.toString().padStart(2, '0')}</div>
                    </div>
                    <div class="time-item">
                        <div class="time-label">روز هفته</div>
                        <div class="time-value">${weekdayName}</div>
                    </div>
                    <div class="time-item time-unix">
                        <div class="time-label">تاریخ و زمان</div>
                        <div class="time-value" style="font-size: 1rem;">${readableDate}</div>
                    </div>
                    <div class="time-item time-uptime">
                        <div class="time-label">مدت فعالیت</div>
                        <div class="time-value">${formattedUptime}</div>
                    </div>
                </div>
            </div>
        `;
    }
}

function setCurrentTime() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const second = now.getSeconds();
    
    // According to MQTT-API docs, the data structure should match msg_id: 21 format
    const timeData = {
        unix_timestamp: Math.floor(now.getTime() / 1000),
        year: year,
        month: month,
        day: day,
        hour: hour,
        minute: minute,
        second: second
    };
    
    sendMQTTRequest(21, timeData)
        .then(response => {
            console.log('System time set:', response);
            showNotification('زمان سیستم تنظیم شد', 'success');
            getSystemTime(); // Refresh display
        })
        .catch(error => {
            console.error('Error setting system time:', error);
            showNotification('خطا در تنظیم زمان سیستم: ' + error.message, 'error');
        });
}

function setSystemTime() {
    const dateInput = document.getElementById('systemDate').value;
    const timeInput = document.getElementById('systemTime').value;
    
    if (!dateInput || !timeInput) {
        showNotification('لطفاً تاریخ و زمان را وارد کنید', 'warning');
        return;
    }
    
    const dateTime = new Date(dateInput + 'T' + timeInput);
    
    // According to MQTT-API docs, the data structure should match msg_id: 21 format
    const timeData = {
        unix_timestamp: Math.floor(dateTime.getTime() / 1000),
        year: dateTime.getFullYear(),
        month: dateTime.getMonth() + 1,
        day: dateTime.getDate(),
        hour: dateTime.getHours(),
        minute: dateTime.getMinutes(),
        second: dateTime.getSeconds()
    };
    
    sendMQTTRequest(21, timeData)
        .then(response => {
            console.log('System time set manually:', response);
            showNotification('زمان سیستم به صورت دستی تنظیم شد', 'success');
            getSystemTime(); // Refresh display
        })
        .catch(error => {
            console.error('Error setting system time manually:', error);
            showNotification('خطا در تنظیم دستی زمان سیستم: ' + error.message, 'error');
        });
}

// GPIO Functions - Updated according to MQTT_GPIO_DEVELOPER_GUIDE
function getGPIOStatus() {
    // According to MQTT_GPIO_DEVELOPER_GUIDE, msg_id 12 gets all available GPIO pins status
    const request = {
        msg_id: 12,
        deviceid: deviceId
    };
    
    if (!mqttClient || !isConnected) {
        showNotification('اتصال MQTT برقرار نیست', 'error');
        return Promise.reject(new Error('MQTT not connected'));
    }
    
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            responseHandlers.delete(12);
            reject(new Error('درخواست منقضی شد'));
        }, 10000);
        
        responseHandlers.set(12, { resolve, reject, timeout });
        
        mqttClient.publish(TOPICS.request, JSON.stringify(request));
        console.log('GPIO status request sent:', request);
    })
    .then(response => {
        console.log('GPIO status received:', response);
        if (response.status === 'success' && response.data) {
            updateGPIOStatusDisplay(response.data);
            showNotification('وضعیت تمام GPIO ها دریافت شد', 'success');
        } else {
            console.error('Invalid GPIO response structure:', response);
            showNotification('پاسخ نامعتبر از دستگاه دریافت شد', 'warning');
        }
        return response;
    })
    .catch(error => {
        console.error('Error getting GPIO status:', error);
        showNotification('خطا در دریافت وضعیت GPIO: ' + error.message, 'error');
        throw error;
    });
}

// New function to display all GPIO pins status according to MQTT_GPIO_DEVELOPER_GUIDE
function updateGPIOStatusDisplay(data) {
    console.log('Updating GPIO status display with data:', data);
    
    // Store available output pins for automation
    if (data.available_output_pins && data.available_output_pins.length > 0) {
        availableOutputPins = data.available_output_pins;
    }
    
    const gpioStatusContainer = document.getElementById('gpioStatusContainer');
    const outputPinsSection = document.getElementById('outputPinsSection');
    const inputPinsSection = document.getElementById('inputPinsSection');
    const outputPinsContainer = document.getElementById('outputPinsContainer');
    const inputPinsContainer = document.getElementById('inputPinsContainer');
    
    if (!gpioStatusContainer) {
        console.error('GPIO status container not found');
        return;
    }
    
    // Update main status container with summary
    let summaryHtml = `<div class="alert alert-info">`;
    summaryHtml += `<h6><i class="fas fa-microchip me-2"></i>خلاصه وضعیت GPIO</h6>`;
    summaryHtml += `<p class="mb-1"><strong>تعداد پین‌های خروجی:</strong> ${data.total_output_pins || 0}</p>`;
    summaryHtml += `<p class="mb-1"><strong>تعداد پین‌های ورودی:</strong> ${data.total_input_pins || 0}</p>`;
    if (data.detected_banks && data.detected_banks.length > 0) {
        summaryHtml += `<p class="mb-0"><strong>بانک‌های شناسایی شده:</strong> ${data.detected_banks.join(', ')}</p>`;
    }
    summaryHtml += `</div>`;
    gpioStatusContainer.innerHTML = summaryHtml;
    
    // Display output pins in individual boxes
    if (data.available_output_pins && data.available_output_pins.length > 0 && outputPinsContainer) {
        let outputHtml = '<div class="row">';
        data.available_output_pins.forEach(pin => {
            const pinState = data.pin_states && data.pin_states[pin] !== undefined ? data.pin_states[pin] : 0;
            const statusColor = pinState === 1 ? 'success' : 'danger';
            const statusText = pinState === 1 ? 'روشن' : 'خاموش';
            const statusValue = pinState === 1 ? '1' : '0';
            const statusIcon = pinState === 1 ? 'fa-lightbulb' : 'fa-lightbulb';
            
            outputHtml += `
                <div class="col-lg-3 col-md-4 col-sm-6 mb-3">
                    <div class="card border-primary h-100">
                        <div class="card-header bg-primary text-white text-center">
                            <h6 class="mb-0">
                                <i class="fas ${statusIcon}"></i>
                                پین ${pin}
                            </h6>
                        </div>
                        <div class="card-body text-center d-flex flex-column">
                            <div class="mb-3">
                                <span class="badge badge-lg fs-6 px-3 py-2" style="background-color: ${pinState === 1 ? '#28a745' : '#dc3545'}; color: white;">
                                    ${statusText} (${statusValue})
                                </span>
                            </div>
                            <div class="mt-auto">
                                <div class="d-grid gap-2">
                                    <button class="btn btn-sm ${pinState === 1 ? 'btn-danger' : 'btn-success'}" 
                                            onclick="setSpecificGPIO(${pin}, ${pinState === 1 ? 0 : 1})">
                                        ${pinState === 1 ? '🔴 خاموش کن' : '🟢 روشن کن'}
                                    </button>
                                    <button class="btn btn-sm btn-warning" onclick="toggleSpecificGPIO(${pin})">
                                        🔄 تغییر وضعیت
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
        outputHtml += '</div>';
        outputPinsContainer.innerHTML = outputHtml;
        if (outputPinsSection) outputPinsSection.style.display = 'block';
    }
    
    // Display input pins in individual boxes
    if (data.available_input_pins && data.available_input_pins.length > 0 && inputPinsContainer) {
        let inputHtml = '<div class="row">';
        data.available_input_pins.forEach(pin => {
            const pinState = data.pin_states && data.pin_states[pin] !== undefined ? data.pin_states[pin] : 0;
            const statusColor = pinState === 1 ? 'success' : 'secondary';
            const statusText = pinState === 1 ? 'فعال' : 'غیرفعال';
            const statusValue = pinState === 1 ? '1' : '0';
            const statusIcon = pinState === 1 ? 'fa-toggle-on' : 'fa-toggle-off';
            const bankText = data.detected_banks && data.detected_banks.length > 0 ? ` (بانک ${data.detected_banks[0]})` : '';
            
            inputHtml += `
                <div class="col-lg-3 col-md-4 col-sm-6 mb-3">
                    <div class="card border-info h-100">
                        <div class="card-header bg-info text-white text-center">
                            <h6 class="mb-0">
                                <i class="fas ${statusIcon}"></i>
                                پین ${pin}${bankText}
                            </h6>
                        </div>
                        <div class="card-body text-center d-flex flex-column">
                            <div class="mb-3">
                                <span class="badge badge-lg fs-6 px-3 py-2" style="background-color: ${pinState === 1 ? '#28a745' : '#6c757d'}; color: white;">
                                    ${statusText} (${statusValue})
                                </span>
                            </div>
                            <div class="mt-auto">
                                <small class="text-muted">
                                    📖 فقط خواندنی
                                </small>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
        inputHtml += '</div>';
        inputPinsContainer.innerHTML = inputHtml;
        if (inputPinsSection) inputPinsSection.style.display = 'block';
    }
}

// Function to refresh GPIO status - called by button
function refreshGPIOStatus() {
    getGPIOStatus();
}

// Function to refresh all GPIO pins
function refreshAllGPIOPins() {
    showNotification('در حال بروزرسانی همه پین‌ها...', 'info');
    getGPIOStatus().then(() => {
        showNotification('همه پین‌ها بروزرسانی شدند', 'success');
    }).catch(error => {
        showNotification('خطا در بروزرسانی پین‌ها: ' + error.message, 'error');
    });
}

// Updated function to display GPIO pins with new format


function setGPIOValue() {
    const pin = parseInt(document.getElementById('gpioPin').value);
    const value = parseInt(document.getElementById('gpioValue').value);
    
    if (isNaN(pin)) {
        showNotification('لطفاً شماره پین معتبر وارد کنید', 'warning');
        return;
    }
    
    return setSpecificGPIO(pin, value);
}

// New function for setting specific GPIO pin according to MQTT_GPIO_DEVELOPER_GUIDE
function setSpecificGPIO(pin, value) {
    // According to MQTT_GPIO_DEVELOPER_GUIDE, GPIO set requests should include pin and value
    const request = {
        msg_id: 13,
        deviceid: deviceId,
        pin: pin,
        value: value
    };
    
    if (!mqttClient || !isConnected) {
        showNotification('اتصال MQTT برقرار نیست', 'error');
        return Promise.reject(new Error('MQTT not connected'));
    }
    
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            responseHandlers.delete(13);
            reject(new Error('درخواست منقضی شد'));
        }, 10000);
        
        responseHandlers.set(13, { resolve, reject, timeout });
        
        mqttClient.publish(TOPICS.request, JSON.stringify(request));
        console.log('GPIO set request sent:', request);
    })
    .then(response => {
        console.log('GPIO value set:', response);
        if (response.status === 'success') {
            showNotification(`پین ${response.pin}: ${response.requested_value === 1 ? 'روشن' : 'خاموش'} شد`, 'success');
            getGPIOStatus(); // Refresh status
        } else if (response.status === 'error') {
            showNotification(`خطا: ${response.message}`, 'error');
            if (response.available_pins) {
                console.log('Available pins:', response.available_pins);
            }
        }
        return response;
    })
    .catch(error => {
        console.error('Error setting GPIO value:', error);
        showNotification('خطا در تنظیم مقدار GPIO: ' + error.message, 'error');
        throw error;
    });
}

function toggleGPIO() {
    const pin = parseInt(document.getElementById('gpioPin').value);
    
    if (isNaN(pin)) {
        showNotification('لطفاً شماره پین معتبر وارد کنید', 'warning');
        return;
    }
    
    return toggleSpecificGPIO(pin);
}

// New function for toggling specific GPIO pin according to MQTT_GPIO_DEVELOPER_GUIDE
function toggleSpecificGPIO(pin) {
    // According to MQTT_GPIO_DEVELOPER_GUIDE, GPIO toggle requests should include pin
    const request = {
        msg_id: 14,
        deviceid: deviceId,
        pin: pin
    };
    
    if (!mqttClient || !isConnected) {
        showNotification('اتصال MQTT برقرار نیست', 'error');
        return Promise.reject(new Error('MQTT not connected'));
    }
    
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            responseHandlers.delete(14);
            reject(new Error('درخواست منقضی شد'));
        }, 10000);
        
        responseHandlers.set(14, { resolve, reject, timeout });
        
        mqttClient.publish(TOPICS.request, JSON.stringify(request));
        console.log('GPIO toggle request sent:', request);
    })
    .then(response => {
        console.log('GPIO toggled:', response);
        if (response.status === 'success') {
            const prevText = response.previous_value === 1 ? 'روشن' : 'خاموش';
            const newText = response.actual_value === 1 ? 'روشن' : 'خاموش';
            showNotification(`پین ${response.pin}: ${prevText} → ${newText}`, 'success');
            getGPIOStatus(); // Refresh status
        } else if (response.status === 'error') {
            showNotification(`خطا: ${response.message}`, 'error');
            if (response.available_pins) {
                console.log('Available pins:', response.available_pins);
            }
        }
        return response;
    })
    .catch(error => {
        console.error('Error toggling GPIO:', error);
        showNotification('خطا در تغییر وضعیت GPIO: ' + error.message, 'error');
        throw error;
    });
}

// Digital IO Settings
function loadDigitalIOSettings() {
    sendMQTTRequest(2) // Use msg_id 2 for loading Digital IO settings
        .then(response => {
            console.log('Digital IO settings loaded:', response.data);
            if (response.data) {
                populateDigitalIOSettings(response.data);
            }
            showNotification('تنظیمات Digital IO بارگذاری شد', 'success');
        })
        .catch(error => {
            console.error('Error loading Digital IO settings:', error);
            showNotification('خطا در بارگذاری تنظیمات Digital IO: ' + error.message, 'error');
        });
}

function populateDigitalIOSettings(data) {
    try {
        console.log('Digital IO settings loaded: ', data);
        
        // Populate analog inputs
        if (data.analog_inputs) {
            // Temperature sensor (channel 0)
            if (data.analog_inputs[0]) {
                const temp = data.analog_inputs[0];
                const enabledEl = document.getElementById('analog0_enabled');
                if (enabledEl) enabledEl.value = temp.enabled.toString();
                
                const sampleRateEl = document.getElementById('analog0_sample_rate');
                if (sampleRateEl) sampleRateEl.value = temp.sample_rate;
                
                const voltageRefEl = document.getElementById('analog0_voltage_ref');
                if (voltageRefEl) voltageRefEl.value = temp.voltage_reference;
                
                const resolutionEl = document.getElementById('analog0_resolution');
                if (resolutionEl) resolutionEl.value = temp.resolution;
                
                const scaleEl = document.getElementById('analog0_scale');
                if (scaleEl) scaleEl.value = temp.calibration.scale;
                
                const offsetEl = document.getElementById('analog0_offset');
                if (offsetEl) offsetEl.value = temp.calibration.offset;
                
                const minWarningEl = document.getElementById('analog0_min_warning');
                if (minWarningEl) minWarningEl.value = temp.thresholds.min_warning;
                
                const maxWarningEl = document.getElementById('analog0_max_warning');
                if (maxWarningEl) maxWarningEl.value = temp.thresholds.max_warning;
            }
            
            // Light sensor (channel 1)
            if (data.analog_inputs[1]) {
                const light = data.analog_inputs[1];
                const enabledEl = document.getElementById('analog1_enabled');
                if (enabledEl) enabledEl.value = light.enabled.toString();
                
                const sampleRateEl = document.getElementById('analog1_sample_rate');
                if (sampleRateEl) sampleRateEl.value = light.sample_rate;
                
                const voltageRefEl = document.getElementById('analog1_voltage_ref');
                if (voltageRefEl) voltageRefEl.value = light.voltage_reference;
                
                const resolutionEl = document.getElementById('analog1_resolution');
                if (resolutionEl) resolutionEl.value = light.resolution;
                
                const scaleEl = document.getElementById('analog1_scale');
                if (scaleEl) scaleEl.value = light.calibration.scale;
                
                const offsetEl = document.getElementById('analog1_offset');
                if (offsetEl) offsetEl.value = light.calibration.offset;
                
                const minWarningEl = document.getElementById('analog1_min_warning');
                if (minWarningEl) minWarningEl.value = light.thresholds.min_warning;
                
                const maxWarningEl = document.getElementById('analog1_max_warning');
                if (maxWarningEl) maxWarningEl.value = light.thresholds.max_warning;
            }
        }
        
        // Populate GPIO pins
        if (data.gpio_pins) {
            // Input pins
            if (data.gpio_pins.input_pins) {
                const inputPinsEl = document.getElementById('inputPins');
                if (inputPinsEl) inputPinsEl.value = data.gpio_pins.input_pins.pins.join(',');
                
                const pullModeEl = document.getElementById('pullMode');
                if (pullModeEl) pullModeEl.value = data.gpio_pins.input_pins.pull_mode;
                
                const debounceEl = document.getElementById('debounceTime');
                if (debounceEl) debounceEl.value = data.gpio_pins.input_pins.debounce_time;
                
                const interruptEl = document.getElementById('interruptEnabled');
                if (interruptEl) interruptEl.value = data.gpio_pins.input_pins.interrupt_enabled.toString();
            }
            
            // Output pins
            if (data.gpio_pins.output_pins) {
                const outputPinsEl = document.getElementById('outputPins');
                if (outputPinsEl) outputPinsEl.value = data.gpio_pins.output_pins.pins.join(',');
                
                const initialStateEl = document.getElementById('initialState');
                if (initialStateEl) initialStateEl.value = data.gpio_pins.output_pins.initial_state;
                
                const pwmEnabledEl = document.getElementById('pwmEnabled');
                if (pwmEnabledEl) pwmEnabledEl.value = data.gpio_pins.output_pins.pwm_enabled.toString();
                
                const pwmFreqEl = document.getElementById('pwmFrequency');
                if (pwmFreqEl) pwmFreqEl.value = data.gpio_pins.output_pins.pwm_frequency;
            }
        }
        
        // Populate settings
        if (data.settings) {
            const scanIntervalEl = document.getElementById('scanInterval');
            if (scanIntervalEl) scanIntervalEl.value = data.settings.scan_interval;
            
            const autoSaveEl = document.getElementById('autoSaveState');
            if (autoSaveEl) autoSaveEl.value = data.settings.auto_save_state.toString();
            
            const mqttPublishEl = document.getElementById('mqttPublish');
            if (mqttPublishEl) mqttPublishEl.value = data.settings.mqtt_publish.toString();
        }
        
    } catch (error) {
        console.error('Error populating Digital IO settings:', error);
    }
}

function saveDigitalIOSettings() {
    try {
        const digitalIOSettings = {
            analog_inputs: [
                {
                    channel: 0,
                    name: "Temperature Sensor",
                    enabled: document.getElementById('analog0_enabled')?.value === 'true',
                    sample_rate: parseInt(document.getElementById('analog0_sample_rate')?.value) || 1000,
                    voltage_reference: parseFloat(document.getElementById('analog0_voltage_ref')?.value) || 3.3,
                    resolution: parseInt(document.getElementById('analog0_resolution')?.value) || 12,
                    calibration: {
                        scale: parseFloat(document.getElementById('analog0_scale')?.value) || 1.0,
                        offset: parseFloat(document.getElementById('analog0_offset')?.value) || 0.0
                    },
                    thresholds: {
                        min_warning: parseFloat(document.getElementById('analog0_min_warning')?.value) || -10.0,
                        max_warning: parseFloat(document.getElementById('analog0_max_warning')?.value) || 50.0
                    }
                },
                {
                    channel: 1,
                    name: "Light Sensor",
                    enabled: document.getElementById('analog1_enabled')?.value === 'true',
                    sample_rate: parseInt(document.getElementById('analog1_sample_rate')?.value) || 1000,
                    voltage_reference: parseFloat(document.getElementById('analog1_voltage_ref')?.value) || 3.3,
                    resolution: parseInt(document.getElementById('analog1_resolution')?.value) || 12,
                    calibration: {
                        scale: parseFloat(document.getElementById('analog1_scale')?.value) || 1.0,
                        offset: parseFloat(document.getElementById('analog1_offset')?.value) || 0.0
                    },
                    thresholds: {
                        min_warning: parseFloat(document.getElementById('analog1_min_warning')?.value) || 0.0,
                        max_warning: parseFloat(document.getElementById('analog1_max_warning')?.value) || 100.0
                    }
                }
            ],
            gpio_pins: {
                input_pins: {
                    pins: document.getElementById('inputPins')?.value.split(',').map(pin => parseInt(pin.trim())).filter(pin => !isNaN(pin)) || [],
                    pull_mode: document.getElementById('pullMode')?.value || "none",
                    debounce_time: parseInt(document.getElementById('debounceTime')?.value) || 50,
                    interrupt_enabled: document.getElementById('interruptEnabled')?.value === 'true'
                },
                output_pins: {
                    pins: document.getElementById('outputPins')?.value.split(',').map(pin => parseInt(pin.trim())).filter(pin => !isNaN(pin)) || [],
                    initial_state: document.getElementById('initialState')?.value || "low",
                    pwm_enabled: document.getElementById('pwmEnabled')?.value === 'true',
                    pwm_frequency: parseInt(document.getElementById('pwmFrequency')?.value) || 1000
                }
            },
            settings: {
                scan_interval: parseInt(document.getElementById('scanInterval')?.value) || 1000,
                auto_save_state: document.getElementById('autoSaveState')?.value === 'true',
                mqtt_publish: document.getElementById('mqttPublish')?.value === 'true'
            }
        };

        sendMQTTRequest(3, digitalIOSettings)
            .then(response => {
                console.log('Digital IO settings saved:', response);
                showNotification('تنظیمات Digital IO ذخیره شد', 'success');
            })
            .catch(error => {
                console.error('Error saving Digital IO settings:', error);
                showNotification('خطا در ذخیره تنظیمات Digital IO: ' + error.message, 'error');
            });
    } catch (error) {
        console.error('Error preparing Digital IO settings:', error);
        showNotification('خطا در آماده‌سازی تنظیمات Digital IO', 'error');
    }
}

// Service Settings Functions
function loadPIMSSettings() {
    // Only load PIMS settings if we're in the PIMS tab
    const pimsTab = document.getElementById('pims-tab');
    if (!pimsTab || !pimsTab.classList.contains('active')) {
        console.log('PIMS settings load skipped - not in PIMS tab');
        return;
    }
    
    sendMQTTRequest(4) // No data parameter for msg_id 4
        .then(response => {
            console.log('PIMS settings loaded:', response.data);
            if (response.data) {
                populatePIMSSettings(response.data);
            }
            showNotification('تنظیمات PIMS بارگذاری شد', 'success');
        })
        .catch(error => {
            console.error('Error loading PIMS settings:', error);
            showNotification('خطا در بارگذاری تنظیمات PIMS: ' + error.message, 'error');
        });
}

function populatePIMSSettings(data) {
    try {
        console.log('PIMS settings loaded: ', data);
        
        // Check if data has nested structure
        const pimsData = data.pims || data;
        console.log('PIMS data structure:', pimsData);
        
        // Clear previous info displays and existing schedules
        clearAllPIMSSchedules();
        
        // Get actual schedule numbers from data (preserve original numbering)
        const scheduleKeys = Object.keys(pimsData).filter(key => !isNaN(parseInt(key))).map(key => parseInt(key)).sort((a, b) => a - b);
        console.log('Schedule keys found:', scheduleKeys);
        
        // Generate PIMS schedules for each existing schedule number
        scheduleKeys.forEach(scheduleNum => {
            const schedule = pimsData[scheduleNum];
            
            // Generate HTML for this specific schedule number
            const pimsContainer = document.getElementById('pimsSchedulesContainer');
            if (pimsContainer) {
                const scheduleHtml = `
                    <div class="card mb-3" id="pimsSchedule${scheduleNum}">
                        <div class="card-header d-flex justify-content-between align-items-center">
                            <h6 class="mb-0">📅 برنامه زمان‌بندی PIMS ${scheduleNum}</h6>
                            <button type="button" class="btn btn-sm btn-outline-danger" onclick="removePIMSSchedule(${scheduleNum})" title="حذف این برنامه">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                        <div class="card-body">
                            <div class="row">
                                <div class="col-md-6">
                                    <div class="form-group">
                                        <label for="pims${scheduleNum}_enabled">وضعیت:</label>
                                        <select class="form-control" id="pims${scheduleNum}_enabled" style="border: 3px solid #808080 !important; background: rgba(255, 255, 255, 0.15) !important;">
                                            <option value="false">غیرفعال</option>
                                            <option value="true">فعال</option>
                                        </select>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="form-group">
                                        <label for="pims${scheduleNum}_volume">صدا (0-100):</label>
                                        <input type="number" class="form-control" id="pims${scheduleNum}_volume" min="0" max="100" value="50" style="border: 3px solid #808080 !important; background: rgba(255, 255, 255, 0.15) !important;">
                                    </div>
                                </div>
                            </div>
                            <div class="row">
                                <div class="col-md-6">
                                    <div class="form-group">
                                        <label for="pims${scheduleNum}_time_of_play">زمان شروع:</label>
                                        <input type="time" class="form-control" id="pims${scheduleNum}_time_of_play" style="border: 3px solid #808080 !important; background: rgba(255, 255, 255, 0.15) !important;">
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="form-group">
                                        <label for="pims${scheduleNum}_time_of_stop">زمان پایان:</label>
                                        <input type="time" class="form-control" id="pims${scheduleNum}_time_of_stop" style="border: 3px solid #808080 !important; background: rgba(255, 255, 255, 0.15) !important;">
                                    </div>
                                </div>
                            </div>
                            <div class="row">
                                <div class="col-md-6">
                                    <div class="form-group">
                                        <label for="pims${scheduleNum}_day_of_week">روزهای هفته:</label>
                                        <select class="form-control" id="pims${scheduleNum}_day_of_week" style="border: 3px solid #808080 !important; background: rgba(255, 255, 255, 0.15) !important;">
                                            <option value="127">همه روزها</option>
                                            <option value="1">شنبه</option>
                                            <option value="2">یکشنبه</option>
                                            <option value="4">دوشنبه</option>
                                            <option value="8">سه‌شنبه</option>
                                            <option value="16">چهارشنبه</option>
                                            <option value="32">پنج‌شنبه</option>
                                            <option value="64">جمعه</option>
                                            <option value="62">روزهای کاری</option>
                                            <option value="65">آخر هفته</option>
                                        </select>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="form-group">
                                        <label for="pims${scheduleNum}_file">فایل صوتی:</label>
                                        <input type="text" class="form-control" id="pims${scheduleNum}_file" placeholder="مسیر فایل یا URL" style="border: 3px solid #808080 !important; background: rgba(255, 255, 255, 0.15) !important;">
                                    </div>
                                </div>
                            </div>
                            <div class="row">
                                <div class="col-md-6">
                                    <div class="form-group">
                                        <label for="pims${scheduleNum}_folder">پوشه:</label>
                                        <input type="text" class="form-control" id="pims${scheduleNum}_folder" placeholder="مسیر پوشه" style="border: 3px solid #808080 !important; background: rgba(255, 255, 255, 0.15) !important;">
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="form-group">
                                        <label for="pims${scheduleNum}_url">URL استریم:</label>
                                        <input type="url" class="form-control" id="pims${scheduleNum}_url" placeholder="http://example.com/stream.m3u8" style="border: 3px solid #808080 !important; background: rgba(255, 255, 255, 0.15) !important;">
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                
                pimsContainer.insertAdjacentHTML('beforeend', scheduleHtml);
            }
        });
        
        // Update schedule counter
        updateScheduleCounter(scheduleKeys.length);
        
        // Populate PIMS schedules data
        let schedulesLoaded = 0;
        const loadedSchedules = [];
        
        scheduleKeys.forEach(i => {
            if (pimsData[i]) {
                const schedule = pimsData[i];
                schedulesLoaded++;
                loadedSchedules.push(i);
                
                // Enabled select (using correct ID format)
                const enabledEl = document.getElementById(`pims${i}_enabled`);
                if (enabledEl) {
                    enabledEl.value = (schedule.enabled === true || schedule.enabled === 'true' || schedule.enabled === 1) ? 'true' : 'false';
                }
                
                // Start time
                const startTimeEl = document.getElementById(`pims${i}_time_of_play`);
                if (startTimeEl) {
                    startTimeEl.value = schedule.time_of_play || '';
                }
                
                // Stop time
                const stopTimeEl = document.getElementById(`pims${i}_time_of_stop`);
                if (stopTimeEl) {
                    stopTimeEl.value = schedule.time_of_stop || '';
                }
                
                // Volume
                const volumeEl = document.getElementById(`pims${i}_volume`);
                if (volumeEl) {
                    volumeEl.value = schedule.volume !== undefined ? schedule.volume : 50;
                }
                
                // Days of week
                const dayOfWeekEl = document.getElementById(`pims${i}_day_of_week`);
                if (dayOfWeekEl) {
                    dayOfWeekEl.value = schedule.day_of_week !== undefined ? schedule.day_of_week : '127';
                }
                
                // URL field
                const urlEl = document.getElementById(`pims${i}_url`);
                if (urlEl) {
                    urlEl.value = schedule.url || '';
                }
                
                // File path
                const fileEl = document.getElementById(`pims${i}_file`);
                if (fileEl) {
                    if (schedule.file && schedule.file !== 'NAN' && schedule.file !== '') {
                        fileEl.value = schedule.file;
                    } else {
                        fileEl.value = '';
                    }
                }
                
                // Folder path
                const folderEl = document.getElementById(`pims${i}_folder`);
                if (folderEl) {
                    if (schedule.folder && schedule.folder !== 'NAN' && schedule.folder !== '') {
                        folderEl.value = schedule.folder;
                    } else {
                        folderEl.value = '';
                    }
                }
                
                // Add info display under each schedule
                const scheduleContainer = document.querySelector(`#pims${i}_enabled`)?.closest('.form-group')?.parentElement;
                if (scheduleContainer) {
                    const infoDiv = document.createElement('div');
                    infoDiv.id = `pimsInfo${i}`;
                    infoDiv.className = 'alert alert-info mt-2';
                    infoDiv.style.fontSize = '0.9em';
                    infoDiv.style.backgroundColor = '#e3f2fd';
                    infoDiv.style.border = '1px solid #2196f3';
                    infoDiv.style.borderRadius = '8px';
                    infoDiv.style.padding = '10px';
                    
                    const enabledText = (schedule.enabled === true || schedule.enabled === 'true' || schedule.enabled === 1) ? 'فعال' : 'غیرفعال';
                    const fileText = schedule.file && schedule.file !== 'NAN' && schedule.file !== '' ? schedule.file : 'تعریف نشده';
                    const folderText = schedule.folder && schedule.folder !== 'NAN' && schedule.folder !== '' ? schedule.folder : 'تعریف نشده';
                    const urlText = schedule.url ? schedule.url : 'تعریف نشده';
                    
                    // Convert day_of_week number to readable text
                    let dayText = 'نامشخص';
                    if (schedule.day_of_week) {
                        const dayNum = parseInt(schedule.day_of_week);
                        if (dayNum === 127) {
                            dayText = 'همه روزها';
                        } else {
                            const days = [];
                            if (dayNum & 1) days.push('شنبه');
                            if (dayNum & 2) days.push('یکشنبه');
                            if (dayNum & 4) days.push('دوشنبه');
                            if (dayNum & 8) days.push('سه‌شنبه');
                            if (dayNum & 16) days.push('چهارشنبه');
                            if (dayNum & 32) days.push('پنج‌شنبه');
                            if (dayNum & 64) days.push('جمعه');
                            dayText = days.length > 0 ? days.join(', ') : 'هیچ روز';
                        }
                    }
                    
                    infoDiv.innerHTML = `
                        <strong>📋 اطلاعات بارگذاری شده برنامه ${i}:</strong><br>
                        <div style="margin-top: 5px; line-height: 1.4;">
                            🔘 وضعیت: <span style="color: ${schedule.enabled ? '#4caf50' : '#f44336'}; font-weight: bold;">${enabledText}</span><br>
                            ⏰ زمان پخش: <strong>${schedule.time_of_play || 'تعریف نشده'}</strong> تا <strong>${schedule.time_of_stop || 'تعریف نشده'}</strong><br>
                            🔊 صدا: <strong>${schedule.volume || 'نامشخص'}</strong> | 📅 روزها: <strong>${dayText}</strong><br>
                            📁 فایل: <strong>${fileText}</strong><br>
                            📂 پوشه: <strong>${folderText}</strong><br>
                            🌐 URL: <strong>${urlText}</strong>
                        </div>
                    `;
                    
                    scheduleContainer.appendChild(infoDiv);
                }
            }
        }
        
        // Show success message with detailed info
     );
      if (schedulesLoaded > 0) {
            const scheduleNumbers = loadedSchedules.join(', ');
            showNotification(`✅ تنظیمات PIMS با موفقیت بارگذاری شد\n📊 تعداد برنامه‌ها: ${schedulesLoaded}\n🔢 شماره برنامه‌ها: ${scheduleNumbers}`, 'success');
        } else if (pimsData.server_url || pimsData.api_key || Object.keys(pimsData).length > 0) {
            showNotification('⚙️ تنظیمات پایه PIMS با موفقیت بارگذاری شد', 'success');
        } else {
            showNotification('ℹ️ هیچ تنظیمات PIMS‌ای یافت نشد', 'info');
        }
        
    } catch (error) {
        console.error('Error populating PIMS settings:', error);
        showNotification('❌ خطا در بارگذاری تنظیمات PIMS: ' + error.message, 'error');
    }
}


function savePIMSSettings() {
    try {
        const pimsData = {};
        
        // Save PIMS schedules (برنامه‌های زمان‌بندی شده)
        let hasScheduleData = false;
        
        // Get actual schedule numbers from DOM elements (preserve original numbering)
        const pimsContainer = document.getElementById('pimsSchedulesContainer');
        if (!pimsContainer) {
            console.error('PIMS container not found');
            return;
        }
        
        // Get schedule numbers from existing DOM elements
        const scheduleElements = Array.from(pimsContainer.children);
        const scheduleNumbers = scheduleElements.map(element => {
            const match = element.id.match(/pimsSchedule(\d+)/);
            return match ? parseInt(match[1]) : null;
        }).filter(num => num !== null);
        
        console.log('Saving schedules for numbers:', scheduleNumbers);
        
        scheduleNumbers.forEach(i => {
            const enabledEl = document.getElementById(`pims${i}_enabled`);
            const startTimeEl = document.getElementById(`pims${i}_time_of_play`);
            const stopTimeEl = document.getElementById(`pims${i}_time_of_stop`);
            const volumeEl = document.getElementById(`pims${i}_volume`);
            const dayOfWeekEl = document.getElementById(`pims${i}_day_of_week`);
            const fileEl = document.getElementById(`pims${i}_file`);
            const folderEl = document.getElementById(`pims${i}_folder`);
            const urlEl = document.getElementById(`pims${i}_url`);
            
            // Check if any of the schedule elements exist for this index
            if (enabledEl || startTimeEl || stopTimeEl || volumeEl || dayOfWeekEl || fileEl || folderEl || urlEl) {
                const schedule = {
                    enabled: false,
                    time_of_play: '',
                    time_of_stop: '',
                    volume: 50,
                    day_of_week: '127',
                    file: '',
                    folder: ''
                };
                
                // Enabled
                if (enabledEl) {
                    schedule.enabled = enabledEl.value === 'true';
                }
                
                // Times
                if (startTimeEl && startTimeEl.value) {
                    schedule.time_of_play = startTimeEl.value;
                    hasScheduleData = true;
                }
                if (stopTimeEl && stopTimeEl.value) {
                    schedule.time_of_stop = stopTimeEl.value;
                    hasScheduleData = true;
                }
                
                // Volume
                if (volumeEl) {
                    schedule.volume = parseInt(volumeEl.value) || 50;
                }
                
                // Days of week
                if (dayOfWeekEl && dayOfWeekEl.value) {
                    schedule.day_of_week = dayOfWeekEl.value;
                }
                
                // URL field
                if (urlEl && urlEl.value) {
                    schedule.url = urlEl.value;
                    hasScheduleData = true;
                }
                
                // File field
                if (fileEl && fileEl.value) {
                    // Check if it's a URL
                    if (fileEl.value.startsWith('http://') || fileEl.value.startsWith('https://')) {
                        schedule.url = fileEl.value;
                        schedule.file = '';
                    } else {
                        schedule.file = fileEl.value;
                    }
                    hasScheduleData = true;
                }
                
                // Folder field
                if (folderEl && folderEl.value) {
                    schedule.folder = folderEl.value;
                    hasScheduleData = true;
                }
                
                // Only add schedule if it has meaningful data
                if (hasScheduleData || schedule.enabled || schedule.time_of_play || schedule.file || schedule.folder || schedule.url) {
                    pimsData[i] = schedule;
                }
            }
        });
        
        console.log('Saving PIMS data:', pimsData);
        console.log('PIMS data keys:', Object.keys(pimsData));
        console.log('PIMS data structure:', JSON.stringify(pimsData, null, 2));
        
        // Always send data, even if empty (server might need to clear settings)
        sendMQTTRequest(5, pimsData)
            .then(response => {
                console.log('PIMS settings saved successfully:', response);
                showNotification('تنظیمات PIMS با موفقیت ذخیره شد', 'success');
            })
            .catch(error => {
                console.error('Error saving PIMS settings:', error);
                showNotification('خطا در ذخیره تنظیمات PIMS: ' + error.message, 'error');
            });
    } catch (error) {
        console.error('Error in savePIMSSettings:', error);
        showNotification('خطا در ذخیره تنظیمات PIMS: ' + error.message, 'error');
    }
}

function loadSIPSettings() {
    // Only load SIP settings if we're in the SIP tab
    const sipTab = document.getElementById('sip-tab');
    if (!sipTab || !sipTab.classList.contains('active')) {
        console.log('SIP settings load skipped - not in SIP tab');
        return;
    }
    
    sendMQTTRequest(6) // No data parameter for msg_id 6
        .then(response => {
            console.log('SIP settings loaded:', response.data);
            if (response.data) {
                populateSIPSettings(response.data);
            }
            showNotification('تنظیمات SIP بارگذاری شد', 'success');
        })
        .catch(error => {
            console.error('Error loading SIP settings:', error);
            showNotification('خطا در بارگذاری تنظیمات SIP: ' + error.message, 'error');
        });
}

function populateSIPSettings(data) {
    // Only populate SIP settings if we're in the SIP tab and elements exist
    const sipTab = document.getElementById('sip-tab');
    if (!sipTab || !sipTab.classList.contains('active')) {
        return;
    }
    
    try {
        console.log('Populating SIP settings with data:', data);
        
        // Handle nested SIP data structure
        const sipData = data.sip || data;
        
        // General settings
        if (sipData.enabled !== undefined) {
            const sipEnabledEl = document.getElementById('sipEnabled');
            if (sipEnabledEl) sipEnabledEl.value = sipData.enabled ? 'true' : 'false';
        }
        
        // Account settings
        if (sipData.account) {
            const accountData = sipData.account;
            
            if (accountData.username !== undefined) {
                const sipUsernameEl = document.getElementById('sipUsername');
                if (sipUsernameEl) sipUsernameEl.value = accountData.username;
            }
            if (accountData.password !== undefined) {
                const sipPasswordEl = document.getElementById('sipPassword');
                if (sipPasswordEl) sipPasswordEl.value = accountData.password;
            }
            if (accountData.domain !== undefined) {
                const sipDomainEl = document.getElementById('sipDomain');
                if (sipDomainEl) sipDomainEl.value = accountData.domain;
            }
            if (accountData.server !== undefined) {
                const sipServerEl = document.getElementById('sipServer');
                if (sipServerEl) sipServerEl.value = accountData.server;
            }
            if (accountData.port !== undefined) {
                const sipPortEl = document.getElementById('sipPort');
                if (sipPortEl) sipPortEl.value = accountData.port;
            }
            if (accountData.transport !== undefined) {
                const sipTransportEl = document.getElementById('sipTransport');
                if (sipTransportEl) sipTransportEl.value = accountData.transport;
            }
            if (accountData.register_expires !== undefined) {
                const sipRegisterExpiresEl = document.getElementById('sipRegisterExpires');
                if (sipRegisterExpiresEl) sipRegisterExpiresEl.value = accountData.register_expires;
            }
            if (accountData.auto_register !== undefined) {
                const sipAutoRegisterEl = document.getElementById('sipAutoRegister');
                if (sipAutoRegisterEl) sipAutoRegisterEl.value = accountData.auto_register ? 'true' : 'false';
            }
        }
        
        // Audio settings
        if (sipData.audio) {
            const audioData = sipData.audio;
            
            if (audioData.capture_device !== undefined) {
                const sipCaptureDeviceEl = document.getElementById('sipCaptureDevice');
                if (sipCaptureDeviceEl) sipCaptureDeviceEl.value = audioData.capture_device;
            }
            if (audioData.playback_device !== undefined) {
                const sipPlaybackDeviceEl = document.getElementById('sipPlaybackDevice');
                if (sipPlaybackDeviceEl) sipPlaybackDeviceEl.value = audioData.playback_device;
            }
            if (audioData.volume) {
                if (audioData.volume.microphone !== undefined) {
                    const sipMicrophoneVolumeEl = document.getElementById('sipMicrophoneVolume');
                    if (sipMicrophoneVolumeEl) sipMicrophoneVolumeEl.value = audioData.volume.microphone;
                }
                if (audioData.volume.speaker !== undefined) {
                    const sipSpeakerVolumeEl = document.getElementById('sipSpeakerVolume');
                    if (sipSpeakerVolumeEl) sipSpeakerVolumeEl.value = audioData.volume.speaker;
                }
            }
            if (audioData.echo_cancellation !== undefined) {
                const sipEchoCancellationEl = document.getElementById('sipEchoCancellation');
                if (sipEchoCancellationEl) sipEchoCancellationEl.value = audioData.echo_cancellation ? 'true' : 'false';
            }
            if (audioData.noise_suppression !== undefined) {
                const sipNoiseSuppressionEl = document.getElementById('sipNoiseSuppression');
                if (sipNoiseSuppressionEl) sipNoiseSuppressionEl.value = audioData.noise_suppression ? 'true' : 'false';
            }
            if (audioData.adaptive_gain_control !== undefined) {
                const sipAdaptiveGainControlEl = document.getElementById('sipAdaptiveGainControl');
                if (sipAdaptiveGainControlEl) sipAdaptiveGainControlEl.value = audioData.adaptive_gain_control ? 'true' : 'false';
            }
        }
        
        // Call settings
        if (sipData.call_settings) {
            const callData = sipData.call_settings;
            
            if (callData.auto_answer !== undefined) {
                const sipAutoAnswerEl = document.getElementById('sipAutoAnswer');
                if (sipAutoAnswerEl) sipAutoAnswerEl.value = callData.auto_answer ? 'true' : 'false';
            }
            if (callData.auto_answer_delay !== undefined) {
                const sipAutoAnswerDelayEl = document.getElementById('sipAutoAnswerDelay');
                if (sipAutoAnswerDelayEl) sipAutoAnswerDelayEl.value = callData.auto_answer_delay;
            }
            if (callData.call_timeout !== undefined) {
                const sipCallTimeoutEl = document.getElementById('sipCallTimeout');
                if (sipCallTimeoutEl) sipCallTimeoutEl.value = callData.call_timeout;
            }
            if (callData.ring_timeout !== undefined) {
                const sipRingTimeoutEl = document.getElementById('sipRingTimeout');
                if (sipRingTimeoutEl) sipRingTimeoutEl.value = callData.ring_timeout;
            }
            if (callData.dtmf_mode !== undefined) {
                const sipDtmfModeEl = document.getElementById('sipDtmfMode');
                if (sipDtmfModeEl) sipDtmfModeEl.value = callData.dtmf_mode;
            }
        }
        
        // Security settings
        if (sipData.security) {
            const securityData = sipData.security;
            
            if (securityData.whitelist_enabled !== undefined) {
                const sipWhitelistEnabledEl = document.getElementById('sipWhitelistEnabled');
                if (sipWhitelistEnabledEl) sipWhitelistEnabledEl.value = securityData.whitelist_enabled ? 'true' : 'false';
            }
            if (securityData.allow_all_numbers !== undefined) {
                const sipAllowAllNumbersEl = document.getElementById('sipAllowAllNumbers');
                if (sipAllowAllNumbersEl) sipAllowAllNumbersEl.value = securityData.allow_all_numbers ? 'true' : 'false';
            }
            if (securityData.require_authentication !== undefined) {
                const sipRequireAuthenticationEl = document.getElementById('sipRequireAuthentication');
                if (sipRequireAuthenticationEl) sipRequireAuthenticationEl.value = securityData.require_authentication ? 'true' : 'false';
            }
            // Note: allowed_numbers and blocked_numbers are not in the JSON structure but exist in HTML
            // These fields will be empty by default
            const sipAllowedNumbersEl = document.getElementById('sipAllowedNumbers');
            if (sipAllowedNumbersEl) sipAllowedNumbersEl.value = '';
            
            const sipBlockedNumbersEl = document.getElementById('sipBlockedNumbers');
            if (sipBlockedNumbersEl) sipBlockedNumbersEl.value = '';
        }
        
        // Network settings
        if (sipData.network) {
            const networkData = sipData.network;
            
            if (networkData.stun_server !== undefined) {
                const sipStunServerEl = document.getElementById('sipStunServer');
                if (sipStunServerEl) sipStunServerEl.value = networkData.stun_server;
            }
            if (networkData.ice_enabled !== undefined) {
                const sipIceEnabledEl = document.getElementById('sipIceEnabled');
                if (sipIceEnabledEl) sipIceEnabledEl.value = networkData.ice_enabled ? 'true' : 'false';
            }
            if (networkData.upnp_enabled !== undefined) {
                const sipUpnpEnabledEl = document.getElementById('sipUpnpEnabled');
                if (sipUpnpEnabledEl) sipUpnpEnabledEl.value = networkData.upnp_enabled ? 'true' : 'false';
            }
            if (networkData.nat_policy !== undefined) {
                const sipNatPolicyEl = document.getElementById('sipNatPolicy');
                if (sipNatPolicyEl) sipNatPolicyEl.value = networkData.nat_policy;
            }
            if (networkData.firewall_policy !== undefined) {
                const sipFirewallPolicyEl = document.getElementById('sipFirewallPolicy');
                if (sipFirewallPolicyEl) sipFirewallPolicyEl.value = networkData.firewall_policy;
            }
            if (networkData.media_encryption !== undefined) {
                const sipMediaEncryptionEl = document.getElementById('sipMediaEncryption');
                if (sipMediaEncryptionEl) sipMediaEncryptionEl.value = networkData.media_encryption;
            }
        }
        
        // Advanced settings (no HTML fields available for these)
        if (sipData.advanced) {
            // Note: Advanced settings exist in JSON but have no corresponding HTML fields
            // They will maintain their default values
        }
        
        console.log('SIP settings populated successfully');
        showNotification('تنظیمات SIP با موفقیت بارگذاری شد', 'success');
    } catch (error) {
        console.error('Error populating SIP settings:', error);
        showNotification('خطا در بارگذاری تنظیمات SIP', 'error');
    }
}

function saveSIPSettings() {
    // Only save SIP settings if we're in the SIP tab and elements exist
    const sipTab = document.getElementById('sip-tab');
    if (!sipTab || !sipTab.classList.contains('active')) {
        showNotification('خطا: تنظیمات SIP فقط در تب SIP قابل ذخیره است', 'error');
        return;
    }
    
    try {
        // Build SIP data structure matching the exact JSON format
        const sipData = {
            sip: {
                enabled: false,
                account: {
                    auto_register: false,
                    domain: '',
                    password: '',
                    port: 5060,
                    register_expires: 3600,
                    server: '',
                    transport: 'UDP',
                    username: ''
                },
                advanced: {
                    adaptive_rate_control: true,
                    bandwidth_limit: 0,
                    keep_alive_interval: 0,
                    log_level: 'message',
                    session_expires: 0,
                    use_info_for_dtmf: false,
                    use_rfc2833_for_dtmf: true
                },
                audio: {
                    adaptive_gain_control: true,
                    capture_device: 'plughw:CARD=Codec,DEV=0',
                    codecs: {
                        g722: {
                            enabled: false,
                            priority: 4
                        },
                        g729: {
                            enabled: false,
                            priority: 5
                        },
                        opus: {
                            bitrate: 64000,
                            channels: 1,
                            complexity: 10,
                            enabled: true,
                            priority: 1,
                            sample_rate: 48000,
                            use_dtx: true,
                            use_vbr: true
                        },
                        pcma: {
                            enabled: true,
                            priority: 3
                        },
                        pcmu: {
                            enabled: true,
                            priority: 2
                        },
                        speex: {
                            enabled: false,
                            priority: 6
                        }
                    },
                    echo_cancellation: false,
                    noise_suppression: true,
                    playback_device: 'plughw:CARD=Codec,DEV=0',
                    volume: {
                        microphone: 50,
                        speaker: 50
                    }
                },
                call_settings: {
                    auto_answer: false,
                    auto_answer_delay: 0,
                    call_timeout: 30,
                    dtmf_mode: 'rfc2833',
                    ring_timeout: 30
                },
                network: {
                    firewall_policy: 'default',
                    ice_enabled: true,
                    media_encryption: 'none',
                    nat_policy: 'default',
                    sip_encryption: 'none',
                    stun_server: '',
                    upnp_enabled: false
                },
                security: {
                    allow_all_numbers: false,
                    require_authentication: false,
                    whitelist_enabled: false
                }
            }
        };
        
        // General settings
        const sipEnabledEl = document.getElementById('sipEnabled');
        if (sipEnabledEl) {
            sipData.sip.enabled = sipEnabledEl.value === 'true';
        }
        
        // Account settings
        const sipUsernameEl = document.getElementById('sipUsername');
        if (sipUsernameEl) sipData.sip.account.username = sipUsernameEl.value;
        
        const sipPasswordEl = document.getElementById('sipPassword');
        if (sipPasswordEl) sipData.sip.account.password = sipPasswordEl.value;
        
        const sipDomainEl = document.getElementById('sipDomain');
        if (sipDomainEl) sipData.sip.account.domain = sipDomainEl.value;
        
        const sipServerEl = document.getElementById('sipServer');
        if (sipServerEl) sipData.sip.account.server = sipServerEl.value;
        
        const sipPortEl = document.getElementById('sipPort');
        if (sipPortEl) sipData.sip.account.port = parseInt(sipPortEl.value) || 5060;
        
        const sipTransportEl = document.getElementById('sipTransport');
        if (sipTransportEl) sipData.sip.account.transport = sipTransportEl.value;
        
        const sipRegisterExpiresEl = document.getElementById('sipRegisterExpires');
        if (sipRegisterExpiresEl) sipData.sip.account.register_expires = parseInt(sipRegisterExpiresEl.value) || 3600;
        
        const sipAutoRegisterEl = document.getElementById('sipAutoRegister');
        if (sipAutoRegisterEl) sipData.sip.account.auto_register = sipAutoRegisterEl.value === 'true';
        
        // Audio settings
        const sipCaptureDeviceEl = document.getElementById('sipCaptureDevice');
        if (sipCaptureDeviceEl) sipData.sip.audio.capture_device = sipCaptureDeviceEl.value;
        
        const sipPlaybackDeviceEl = document.getElementById('sipPlaybackDevice');
        if (sipPlaybackDeviceEl) sipData.sip.audio.playback_device = sipPlaybackDeviceEl.value;
        
        const sipMicrophoneVolumeEl = document.getElementById('sipMicrophoneVolume');
        if (sipMicrophoneVolumeEl) sipData.sip.audio.volume.microphone = parseInt(sipMicrophoneVolumeEl.value) || 50;
        
        const sipSpeakerVolumeEl = document.getElementById('sipSpeakerVolume');
        if (sipSpeakerVolumeEl) sipData.sip.audio.volume.speaker = parseInt(sipSpeakerVolumeEl.value) || 50;
        
        const sipEchoCancellationEl = document.getElementById('sipEchoCancellation');
        if (sipEchoCancellationEl) sipData.sip.audio.echo_cancellation = sipEchoCancellationEl.value === 'true';
        
        const sipNoiseSuppressionEl = document.getElementById('sipNoiseSuppression');
        if (sipNoiseSuppressionEl) sipData.sip.audio.noise_suppression = sipNoiseSuppressionEl.value === 'true';
        
        const sipAdaptiveGainControlEl = document.getElementById('sipAdaptiveGainControl');
        if (sipAdaptiveGainControlEl) sipData.sip.audio.adaptive_gain_control = sipAdaptiveGainControlEl.value === 'true';
        
        // Call settings
        const sipAutoAnswerEl = document.getElementById('sipAutoAnswer');
        if (sipAutoAnswerEl) sipData.sip.call_settings.auto_answer = sipAutoAnswerEl.value === 'true';
        
        const sipAutoAnswerDelayEl = document.getElementById('sipAutoAnswerDelay');
        if (sipAutoAnswerDelayEl) sipData.sip.call_settings.auto_answer_delay = parseInt(sipAutoAnswerDelayEl.value) || 0;
        
        const sipCallTimeoutEl = document.getElementById('sipCallTimeout');
        if (sipCallTimeoutEl) sipData.sip.call_settings.call_timeout = parseInt(sipCallTimeoutEl.value) || 30;
        
        const sipRingTimeoutEl = document.getElementById('sipRingTimeout');
        if (sipRingTimeoutEl) sipData.sip.call_settings.ring_timeout = parseInt(sipRingTimeoutEl.value) || 30;
        
        const sipDtmfModeEl = document.getElementById('sipDtmfMode');
        if (sipDtmfModeEl) sipData.sip.call_settings.dtmf_mode = sipDtmfModeEl.value;
        
        // Security settings (only fields that exist in JSON)
        const sipWhitelistEnabledEl = document.getElementById('sipWhitelistEnabled');
        if (sipWhitelistEnabledEl) sipData.sip.security.whitelist_enabled = sipWhitelistEnabledEl.value === 'true';
        
        const sipAllowAllNumbersEl = document.getElementById('sipAllowAllNumbers');
        if (sipAllowAllNumbersEl) sipData.sip.security.allow_all_numbers = sipAllowAllNumbersEl.value === 'true';
        
        const sipRequireAuthenticationEl = document.getElementById('sipRequireAuthentication');
        if (sipRequireAuthenticationEl) sipData.sip.security.require_authentication = sipRequireAuthenticationEl.value === 'true';
        
        // Note: allowed_numbers and blocked_numbers fields exist in HTML but not in JSON structure
        // They are ignored during save to match the JSON schema exactly
        
        // Network settings
        const sipStunServerEl = document.getElementById('sipStunServer');
        if (sipStunServerEl) sipData.sip.network.stun_server = sipStunServerEl.value;
        
        const sipIceEnabledEl = document.getElementById('sipIceEnabled');
        if (sipIceEnabledEl) sipData.sip.network.ice_enabled = sipIceEnabledEl.value === 'true';
        
        const sipUpnpEnabledEl = document.getElementById('sipUpnpEnabled');
        if (sipUpnpEnabledEl) sipData.sip.network.upnp_enabled = sipUpnpEnabledEl.value === 'true';
        
        const sipNatPolicyEl = document.getElementById('sipNatPolicy');
        if (sipNatPolicyEl) sipData.sip.network.nat_policy = sipNatPolicyEl.value;
        
        const sipFirewallPolicyEl = document.getElementById('sipFirewallPolicy');
        if (sipFirewallPolicyEl) sipData.sip.network.firewall_policy = sipFirewallPolicyEl.value;
        
        const sipMediaEncryptionEl = document.getElementById('sipMediaEncryption');
        if (sipMediaEncryptionEl) sipData.sip.network.media_encryption = sipMediaEncryptionEl.value;
        
        // Note: Advanced settings exist in JSON structure but have no corresponding HTML fields
        // They will maintain their default values from the initial structure
        
        console.log('Saving SIP data:', sipData);
        
        sendMQTTRequest(7, sipData)
            .then(response => {
                console.log('SIP settings saved:', response);
                showNotification('تنظیمات SIP ذخیره شد', 'success');
            })
            .catch(error => {
                console.error('Error saving SIP settings:', error);
                showNotification('خطا در ذخیره تنظیمات SIP: ' + error.message, 'error');
            });
    } catch (error) {
        console.error('Error in saveSIPSettings:', error);
        showNotification('خطا در ذخیره تنظیمات SIP: ' + error.message, 'error');
    }
}



// Debug and Connection Functions
function updateDebugInfo() {
    const sessionMqttUserEl = document.getElementById('sessionMqttUser');
    if (sessionMqttUserEl) {
        sessionMqttUserEl.textContent = sessionStorage.getItem('mqttuser') || '-';
    }
    
    const sessionMqttPassEl = document.getElementById('sessionMqttPass');
    if (sessionMqttPassEl) {
        sessionMqttPassEl.textContent = sessionStorage.getItem('mqttpass') ? '***' : '-';
    }
    
    const sessionDeviceMacEl = document.getElementById('sessionDeviceMac');
    if (sessionDeviceMacEl) {
        sessionDeviceMacEl.textContent = sessionStorage.getItem('azanserial') || '-';
    }
}

function updateConnectionStatus() {
    const statusElement = document.getElementById('mqttConnectionStatus');
    if (statusElement) {
        let statusText = '';
        let statusClass = '';
        
        switch (connectionStatus) {
            case 'connected':
                statusText = 'متصل';
                statusClass = 'status-connected';
                break;
            case 'disconnected':
                statusText = 'قطع شده';
                statusClass = 'status-disconnected';
                break;
            case 'reconnecting':
                statusText = 'در حال اتصال مجدد';
                statusClass = 'status-reconnecting';
                break;
            case 'error':
                statusText = 'خطا در اتصال';
                statusClass = 'status-disconnected';
                break;
            default:
                statusText = 'نامشخص';
                statusClass = 'status-disconnected';
        }
        
        statusElement.innerHTML = `<span class="status-indicator ${statusClass}">${statusText}</span>`;
    }
}

function debugMQTT() {
    console.log('MQTT Debug Info:');
    console.log('Connected:', isConnected);
    console.log('Status:', connectionStatus);
    console.log('Device ID:', deviceId);
    console.log('MQTT User:', MQTT_CONFIG.options.username);
    console.log('Client ID:', MQTT_CONFIG.options.clientId);
    
    showNotification('اطلاعات عیب‌یابی در کنسول نمایش داده شد', 'info');
}

function setMacAddressFromInput() {
    const macAddress = document.getElementById('debugMacAddress').value;
    if (macAddress) {
        sessionStorage.setItem('azanserial', macAddress);
        deviceId = macAddress;
        updateDebugInfo();
        showNotification('MAC Address تنظیم شد', 'success');
    } else {
        showNotification('لطفاً MAC Address معتبر وارد کنید', 'warning');
    }
}

function refreshConnectionStatus() {
    updateConnectionStatus();
    updateDebugInfo();
    showNotification('وضعیت اتصال بروزرسانی شد', 'info');
}

function testAndFixMQTT() {
    showNotification('در حال تست و رفع مشکل MQTT...', 'info');
    
    // Test connection
    if (!isConnected) {
        initializeMQTT();
    }
    
    // Test device communication
    setTimeout(() => {
        if (isConnected) {
            getSystemInfo()
                .then(() => {
                    showNotification('تست MQTT موفقیت‌آمیز بود', 'success');
                })
                .catch(() => {
                    showNotification('تست MQTT ناموفق - مشکل در ارتباط با دستگاه', 'error');
                });
        } else {
            showNotification('تست MQTT ناموفق - عدم اتصال به broker', 'error');
        }
    }, 3000);
}

function forceConnectMQTT() {
    if (mqttClient) {
        mqttClient.end(true);
    }
    
    setTimeout(() => {
        initializeMQTT();
        showNotification('اتصال اجباری MQTT آغاز شد', 'info');
    }, 1000);
}

function setDemoMQTTCredentials() {
    // Set demo credentials for testing
    sessionStorage.setItem('mqttuser', 'demo_user');
    sessionStorage.setItem('mqttpass', 'demo_pass');
    sessionStorage.setItem('azanserial', '1000000012345678');
    
    // Update configuration
    MQTT_CONFIG.options.username = 'demo_user';
    MQTT_CONFIG.options.password = 'demo_pass';
    deviceId = '1000000012345678';
    
    updateDebugInfo();
    showNotification('اطلاعات نمونه تنظیم شد', 'success');
}

// Notification System
function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    if (!notification) return;
    
    // Set message
    notification.textContent = message;
    
    // Remove existing classes
    notification.className = '';
    
    // Add type-specific styling
    switch (type) {
        case 'success':
            notification.style.backgroundColor = '#10b981';
            notification.style.color = 'white';
            break;
        case 'error':
            notification.style.backgroundColor = '#ef4444';
            notification.style.color = 'white';
            break;
        case 'warning':
            notification.style.backgroundColor = '#f59e0b';
            notification.style.color = 'white';
            break;
        case 'info':
        default:
            notification.style.backgroundColor = '#3b82f6';
            notification.style.color = 'white';
            break;
    }
    
    // Show notification
    notification.style.display = 'block';
    
    // Hide after 5 seconds
    setTimeout(() => {
        notification.style.display = 'none';
    }, 5000);
    
    // Play notification sound
    try {
        if (type === 'success') {
            document.getElementById('OKnotificationSound')?.play();
        } else if (type === 'error') {
            document.getElementById('AlarmnotificationSound')?.play();
        }
    } catch (error) {
        console.log('Could not play notification sound:', error);
    }
}

// Utility Functions
function generateMsgId() {
    return currentMsgId++;
}

// Export functions for global access
window.showTab = showTab;
window.showCategory = showCategory;
window.saveAzanSettings = saveAzanSettings;
window.saveAudioSettings = saveAudioSettings;
window.updateVolumeDisplay = updateVolumeDisplay;
window.testAzan = testAzan;
window.getSystemInfo = getSystemInfo;
window.getSystemTime = getSystemTime;
window.setCurrentTime = setCurrentTime;
window.setSystemTime = setSystemTime;
window.getGPIOStatus = getGPIOStatus;
window.setGPIOValue = setGPIOValue;
window.toggleGPIO = toggleGPIO;
window.refreshGPIOStatus = refreshGPIOStatus;
window.refreshAllGPIOPins = refreshAllGPIOPins;
window.setSpecificGPIO = setSpecificGPIO;
window.toggleSpecificGPIO = toggleSpecificGPIO;
window.saveDigitalIOSettings = saveDigitalIOSettings;
window.savePIMSSettings = savePIMSSettings;
window.saveSIPSettings = saveSIPSettings;

window.debugMQTT = debugMQTT;
window.setMacAddressFromInput = setMacAddressFromInput;
window.refreshConnectionStatus = refreshConnectionStatus;
window.testAndFixMQTT = testAndFixMQTT;
window.forceConnectMQTT = forceConnectMQTT;
window.setDemoMQTTCredentials = setDemoMQTTCredentials;
window.loadAzanSettings = loadAzanSettings;
window.loadPIMSSettings = loadPIMSSettings;
window.loadSIPSettings = loadSIPSettings;
window.loadDigitalIOSettings = loadDigitalIOSettings;
window.refreshPrayerTimes = refreshPrayerTimes;
window.testNextPrayer = testNextPrayer;
window.updatePrayerTimesDisplay = updatePrayerTimesDisplay;

// Prayer Times Functions
function refreshPrayerTimes() {
    const msgId = 20; // Use same msg_id as system time since they come together
    const requestData = {
        msg_id: msgId,
        deviceid: deviceId || 'unknown',
        timestamp: Math.floor(Date.now() / 1000)
    };
    
    sendMQTTRequest(msgId, requestData);
    showNotification('در حال دریافت اوقات شرعی...', 'info');
}

function testNextPrayer() {
    const msgId = 31; // Use fixed msg_id for testing prayer
    const requestData = {
        msg_id: msgId,
        deviceid: deviceId || 'unknown',
        timestamp: Math.floor(Date.now() / 1000),
        action: 'test_next_prayer'
    };
    
    sendMQTTRequest(msgId, requestData);
    showNotification('تست اذان بعدی...', 'info');
}

function updatePrayerTimesDisplay(data) {
    console.log('updatePrayerTimesDisplay called with data:', data);
    
    // Check for prayer times in the response structure
    let times = null;
    
    if (data.prayer_times_debug && data.prayer_times_debug.prayer_times) {
        times = data.prayer_times_debug.prayer_times;
        console.log('Found prayer times in prayer_times_debug:', times);
    } else if (data.prayer_times) {
        times = data.prayer_times;
        console.log('Found prayer times in prayer_times:', times);
    }
    
    if (times) {
        console.log('Updating prayer times display with:', times);
        
        // Update prayer times with correct field names from API and proper null checks
        const fajrEl = document.getElementById('fajr-time');
        if (fajrEl && times.Fajr) {
            fajrEl.textContent = times.Fajr;
            console.log('Updated Fajr time:', times.Fajr);
        }
        
        const sunriseEl = document.getElementById('sunrise-time');
        if (sunriseEl && times.Sunrise) {
            sunriseEl.textContent = times.Sunrise;
            console.log('Updated Sunrise time:', times.Sunrise);
        }
        
        const dhuhrEl = document.getElementById('dhuhr-time');
        if (dhuhrEl && times.Dhuhr) {
            dhuhrEl.textContent = times.Dhuhr;
            console.log('Updated Dhuhr time:', times.Dhuhr);
        }
        
        const asrEl = document.getElementById('asr-time');
        if (asrEl && times.Asr) {
            asrEl.textContent = times.Asr;
            console.log('Updated Asr time:', times.Asr);
        }
        
        const maghribEl = document.getElementById('maghrib-time');
        if (maghribEl && times.Maghrib) {
            maghribEl.textContent = times.Maghrib;
            console.log('Updated Maghrib time:', times.Maghrib);
        }
        
        const ishaEl = document.getElementById('isha-time');
        if (ishaEl && times.Isha) {
            ishaEl.textContent = times.Isha;
            console.log('Updated Isha time:', times.Isha);
        }
        
        const sunsetEl = document.getElementById('sunset-time');
        if (sunsetEl && times.Sunset) {
            sunsetEl.textContent = times.Sunset;
            console.log('Updated Sunset time:', times.Sunset);
        }
        
        // Update current time
        updateCurrentTime();
        
        // Update prayer status
        updatePrayerStatus(times);
        
        // Display additional prayer times info if available
        if (data.prayer_times_debug) {
            const detailedInfoElement = document.getElementById('prayer-times-detailed-info');
            if (detailedInfoElement) {
                detailedInfoElement.innerHTML = displayPrayerTimesInfo(data.prayer_times_debug);
                console.log('Prayer times detailed info displayed in prayer times tab');
            }
        }
        
        console.log('Prayer times display update completed');
    } else {
        console.log('No prayer times found in data');
    }
}

function updateCurrentTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('fa-IR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'Asia/Tehran'
    });
    const dateString = now.toLocaleDateString('fa-IR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long',
        timeZone: 'Asia/Tehran'
    });
    
    const currentTimeEl = document.getElementById('current-time');
    const currentDateEl = document.getElementById('current-date');
    
    if (currentTimeEl) currentTimeEl.textContent = timeString;
    if (currentDateEl) currentDateEl.textContent = dateString;
}

function updatePrayerStatus(times) {
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    const prayerTimes = {
        fajr: parseTime(times.Fajr || times.fajr),
        sunrise: parseTime(times.Sunrise || times.sunrise),
        dhuhr: parseTime(times.Dhuhr || times.dhuhr),
        asr: parseTime(times.Asr || times.asr),
        maghrib: parseTime(times.Maghrib || times.maghrib),
        isha: parseTime(times.Isha || times.isha)
    };
    
    // Reset all statuses
    ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha', 'sunset'].forEach(prayer => {
        const statusEl = document.getElementById(prayer + '-status');
        if (statusEl) statusEl.textContent = 'در انتظار';
    });
    
    // Find current and next prayer
    let nextPrayer = null;
    let currentPrayer = null;
    
    Object.keys(prayerTimes).forEach(prayer => {
        const prayerTime = prayerTimes[prayer];
        if (prayerTime <= currentTime && (!currentPrayer || prayerTime > prayerTimes[currentPrayer])) {
            currentPrayer = prayer;
        }
        if (prayerTime > currentTime && (!nextPrayer || prayerTime < prayerTimes[nextPrayer])) {
            nextPrayer = prayer;
        }
    });
    
    // Update status
    if (currentPrayer) {
        const statusEl = document.getElementById(currentPrayer + '-status');
        if (statusEl) statusEl.textContent = 'گذشته';
    }
    
    if (nextPrayer) {
        const statusEl = document.getElementById(nextPrayer + '-status');
        if (statusEl) statusEl.textContent = 'بعدی';
    }
}

function parseTime(timeString) {
    if (!timeString) return 0;
    const parts = timeString.split(':');
    return parseInt(parts[0]) * 60 + parseInt(parts[1]);
}

// PIMS Dynamic Schedule Management Functions
function clearAllPIMSSchedules() {
    // Remove all existing PIMS schedule containers
    const pimsContainer = document.getElementById('pimsSchedulesContainer');
    if (pimsContainer) {
        pimsContainer.innerHTML = '';
    }
    
    // Remove info displays
    for (let i = 1; i <= 20; i++) {
        const infoDiv = document.getElementById(`pimsInfo${i}`);
        if (infoDiv) {
            infoDiv.remove();
        }
    }
}

function generatePIMSSchedules(count) {
    const pimsContainer = document.getElementById('pimsSchedulesContainer');
    if (!pimsContainer) {
        console.error('PIMS schedules container not found');
        return;
    }
    
    for (let i = 1; i <= count; i++) {
        const scheduleHtml = `
            <div class="card mb-3" id="pimsSchedule${i}">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <h6 class="mb-0">📅 برنامه زمان‌بندی PIMS ${i}</h6>
                    <button type="button" class="btn btn-sm btn-outline-danger" onclick="removePIMSSchedule(${i})" title="حذف این برنامه">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
                <div class="card-body">
                    <div class="row">
                        <div class="col-md-6">
                            <div class="form-group">
                                <label for="pims${i}_enabled">وضعیت:</label>
                                <select class="form-control" id="pims${i}_enabled" style="border: 3px solid #808080 !important; background: rgba(255, 255, 255, 0.15) !important;">
                                    <option value="false">غیرفعال</option>
                                    <option value="true">فعال</option>
                                </select>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="form-group">
                                <label for="pims${i}_volume">صدا (0-100):</label>
                                <input type="number" class="form-control" id="pims${i}_volume" min="0" max="100" value="50" style="border: 3px solid #808080 !important; background: rgba(255, 255, 255, 0.15) !important;">
                            </div>
                        </div>
                    </div>
                    <div class="row">
                        <div class="col-md-6">
                            <div class="form-group">
                                <label for="pims${i}_time_of_play">زمان شروع:</label>
                                <input type="time" class="form-control" id="pims${i}_time_of_play" style="border: 3px solid #808080 !important; background: rgba(255, 255, 255, 0.15) !important;">
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="form-group">
                                <label for="pims${i}_time_of_stop">زمان پایان:</label>
                                <input type="time" class="form-control" id="pims${i}_time_of_stop" style="border: 3px solid #808080 !important; background: rgba(255, 255, 255, 0.15) !important;">
                            </div>
                        </div>
                    </div>
                    <div class="row">
                        <div class="col-md-6">
                            <div class="form-group">
                                <label for="pims${i}_day_of_week">روزهای هفته:</label>
                                <select class="form-control" id="pims${i}_day_of_week" style="border: 3px solid #808080 !important; background: rgba(255, 255, 255, 0.15) !important;">
                                    <option value="127">همه روزها</option>
                                    <option value="1">شنبه</option>
                                    <option value="2">یکشنبه</option>
                                    <option value="4">دوشنبه</option>
                                    <option value="8">سه‌شنبه</option>
                                    <option value="16">چهارشنبه</option>
                                    <option value="32">پنج‌شنبه</option>
                                    <option value="64">جمعه</option>
                                    <option value="62">روزهای کاری</option>
                                    <option value="65">آخر هفته</option>
                                </select>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="form-group">
                                <label for="pims${i}_file">فایل صوتی:</label>
                                <input type="text" class="form-control" id="pims${i}_file" placeholder="مسیر فایل یا URL" style="border: 3px solid #808080 !important; background: rgba(255, 255, 255, 0.15) !important;">
                            </div>
                        </div>
                    </div>
                    <div class="row">
                        <div class="col-md-6">
                            <div class="form-group">
                                <label for="pims${i}_folder">پوشه:</label>
                                <input type="text" class="form-control" id="pims${i}_folder" placeholder="مسیر پوشه" style="border: 3px solid #808080 !important; background: rgba(255, 255, 255, 0.15) !important;">
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="form-group">
                                <label for="pims${i}_url">URL استریم:</label>
                                <input type="url" class="form-control" id="pims${i}_url" placeholder="http://example.com/stream.m3u8" style="border: 3px solid #808080 !important; background: rgba(255, 255, 255, 0.15) !important;">
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        pimsContainer.insertAdjacentHTML('beforeend', scheduleHtml);
    }
}

function addPIMSSchedule() {
    const pimsContainer = document.getElementById('pimsSchedulesContainer');
    if (!pimsContainer) {
        showNotification('❌ خطا: کانتینر برنامه‌های PIMS یافت نشد', 'error');
        return;
    }
    
    // Find the highest existing schedule number
    const existingSchedules = Array.from(pimsContainer.children).map(child => {
        const match = child.id.match(/pimsSchedule(\d+)/);
        return match ? parseInt(match[1]) : 0;
    }).filter(num => num > 0);
    
    const newScheduleNumber = existingSchedules.length > 0 ? Math.max(...existingSchedules) + 1 : 1;
    
    if (newScheduleNumber > 20) {
        showNotification('❌ حداکثر تعداد برنامه‌ها (20) رسیده است', 'error');
        return;
    }
    
    // Add only one new schedule
    const scheduleHtml = `
        <div class="card mb-3" id="pimsSchedule${newScheduleNumber}">
            <div class="card-header d-flex justify-content-between align-items-center">
                <h6 class="mb-0">📅 برنامه زمان‌بندی PIMS ${newScheduleNumber}</h6>
                <button type="button" class="btn btn-sm btn-outline-danger" onclick="removePIMSSchedule(${newScheduleNumber})" title="حذف این برنامه">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
            <div class="card-body">
                <div class="row">
                    <div class="col-md-6">
                        <div class="form-group">
                            <label for="pims${newScheduleNumber}_enabled">وضعیت:</label>
                            <select class="form-control" id="pims${newScheduleNumber}_enabled" style="border: 3px solid #808080 !important; background: rgba(255, 255, 255, 0.15) !important;">
                                <option value="false">غیرفعال</option>
                                <option value="true">فعال</option>
                            </select>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="form-group">
                            <label for="pims${newScheduleNumber}_volume">صدا (0-100):</label>
                            <input type="number" class="form-control" id="pims${newScheduleNumber}_volume" min="0" max="100" value="50" style="border: 3px solid #808080 !important; background: rgba(255, 255, 255, 0.15) !important;">
                        </div>
                    </div>
                </div>
                <div class="row">
                    <div class="col-md-6">
                        <div class="form-group">
                            <label for="pims${newScheduleNumber}_time_of_play">زمان شروع:</label>
                            <input type="time" class="form-control" id="pims${newScheduleNumber}_time_of_play" style="border: 3px solid #808080 !important; background: rgba(255, 255, 255, 0.15) !important;">
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="form-group">
                            <label for="pims${newScheduleNumber}_time_of_stop">زمان پایان:</label>
                            <input type="time" class="form-control" id="pims${newScheduleNumber}_time_of_stop" style="border: 3px solid #808080 !important; background: rgba(255, 255, 255, 0.15) !important;">
                        </div>
                    </div>
                </div>
                <div class="row">
                    <div class="col-md-6">
                        <div class="form-group">
                            <label for="pims${newScheduleNumber}_day_of_week">روزهای هفته:</label>
                            <select class="form-control" id="pims${newScheduleNumber}_day_of_week" style="border: 3px solid #808080 !important; background: rgba(255, 255, 255, 0.15) !important;">
                                <option value="127">همه روزها</option>
                                <option value="1">شنبه</option>
                                <option value="2">یکشنبه</option>
                                <option value="4">دوشنبه</option>
                                <option value="8">سه‌شنبه</option>
                                <option value="16">چهارشنبه</option>
                                <option value="32">پنج‌شنبه</option>
                                <option value="64">جمعه</option>
                                <option value="62">روزهای کاری</option>
                                <option value="65">آخر هفته</option>
                            </select>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="form-group">
                            <label for="pims${newScheduleNumber}_file">فایل صوتی:</label>
                            <input type="text" class="form-control" id="pims${newScheduleNumber}_file" placeholder="مسیر فایل یا URL" style="border: 3px solid #808080 !important; background: rgba(255, 255, 255, 0.15) !important;">
                        </div>
                    </div>
                </div>
                <div class="row">
                    <div class="col-md-6">
                        <div class="form-group">
                            <label for="pims${newScheduleNumber}_folder">پوشه:</label>
                            <input type="text" class="form-control" id="pims${newScheduleNumber}_folder" placeholder="مسیر پوشه" style="border: 3px solid #808080 !important; background: rgba(255, 255, 255, 0.15) !important;">
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="form-group">
                            <label for="pims${newScheduleNumber}_url">URL استریم:</label>
                            <input type="url" class="form-control" id="pims${newScheduleNumber}_url" placeholder="http://example.com/stream.m3u8" style="border: 3px solid #808080 !important; background: rgba(255, 255, 255, 0.15) !important;">
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    pimsContainer.insertAdjacentHTML('beforeend', scheduleHtml);
    
    // Update counter
    const totalSchedules = pimsContainer.children.length;
    updateScheduleCounter(totalSchedules);
    
    showNotification(`✅ برنامه PIMS ${newScheduleNumber} اضافه شد`, 'success');
    
    // Scroll to the new schedule
    const newSchedule = document.getElementById(`pimsSchedule${newScheduleNumber}`);
    if (newSchedule) {
        newSchedule.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

function removePIMSSchedule(scheduleNumber) {
    const scheduleElement = document.getElementById(`pimsSchedule${scheduleNumber}`);
    if (!scheduleElement) {
        showNotification('❌ برنامه مورد نظر یافت نشد', 'error');
        return;
    }
    
    const pimsContainer = document.getElementById('pimsSchedulesContainer');
    const currentSchedules = pimsContainer.children.length;
    
    if (currentSchedules <= 1) {
        showNotification('❌ نمی‌توان آخرین برنامه را حذف کرد', 'error');
        return;
    }
    
    if (confirm(`آیا مطمئن هستید که می‌خواهید برنامه PIMS ${scheduleNumber} را حذف کنید؟`)) {
        // Only remove the HTML element, don't send JSON
        scheduleElement.remove();
        
        // Remove info display if exists
        const infoDiv = document.getElementById(`pimsInfo${scheduleNumber}`);
        if (infoDiv) {
            infoDiv.remove();
        }
        
        // Update counter without renumbering (preserve original schedule numbers)
        const remainingSchedules = pimsContainer.children.length;
        updateScheduleCounter(remainingSchedules);
        
        showNotification(`✅ برنامه PIMS ${scheduleNumber} حذف شد. برای ذخیره تغییرات دکمه ذخیره را فشار دهید.`, 'success');
    }
}

function renumberPIMSSchedules() {
    const pimsContainer = document.getElementById('pimsSchedulesContainer');
    if (!pimsContainer) return;
    
    const schedules = Array.from(pimsContainer.children);
    
    schedules.forEach((schedule, index) => {
        const newNumber = index + 1;
        const oldNumber = schedule.id.replace('pimsSchedule', '');
        
        if (oldNumber !== newNumber.toString()) {
            // Update schedule container ID
            schedule.id = `pimsSchedule${newNumber}`;
            
            // Update header text
            const header = schedule.querySelector('.card-header h6');
            if (header) {
                header.textContent = `📅 برنامه زمان‌بندی PIMS ${newNumber}`;
            }
            
            // Update remove button onclick
            const removeBtn = schedule.querySelector('.btn-outline-danger');
            if (removeBtn) {
                removeBtn.setAttribute('onclick', `removePIMSSchedule(${newNumber})`);
            }
            
            // Update all form element IDs
            const formElements = schedule.querySelectorAll('[id^="pims"]');
            formElements.forEach(element => {
                const oldId = element.id;
                const newId = oldId.replace(/pims\d+/, `pims${newNumber}`);
                element.id = newId;
                
                // Update corresponding label
                const label = schedule.querySelector(`label[for="${oldId}"]`);
                if (label) {
                    label.setAttribute('for', newId);
                }
            });
        }
    });
}

function updateScheduleCounter(count) {
    const counterElement = document.getElementById('pimsScheduleCounter');
    if (counterElement) {
        counterElement.textContent = count;
    }
}

// Add functions to window object
window.addPIMSSchedule = addPIMSSchedule;
window.removePIMSSchedule = removePIMSSchedule;
window.clearAllPIMSSchedules = clearAllPIMSSchedules;
window.generatePIMSSchedules = generatePIMSSchedules;

// Start updating// GPIO Automation Functions
let automationRules = [];
let automationRuleCounter = 0;
let availableOutputPins = [];

// Load automation rules from server
function loadAutomationRules() {
    console.log('Loading automation rules...');
    sendMQTTRequest(30)
        .then(response => {
            if (response.status === 'success' && response.data) {
                populateAutomationSettings(response.data);
                showNotification('قوانین اتوماسیون با موفقیت بارگذاری شد', 'success');
            } else {
                showNotification('خطا در بارگذاری قوانین اتوماسیون: ' + (response.message || 'خطای نامشخص'), 'error');
            }
        })
        .catch(error => {
            console.error('Error loading automation rules:', error);
            showNotification('خطا در بارگذاری قوانین اتوماسیون: ' + error.message, 'error');
        });
}

// Populate automation rules (alias for populateAutomationSettings)
function populateAutomationRules(data) {
    populateAutomationSettings(data);
}

// Populate automation settings in UI
function populateAutomationSettings(data) {
    console.log('Populating automation settings:', data);
    
    // Set global settings
    if (data.global_settings) {
        const settings = data.global_settings;
        document.getElementById('automationEnabled').value = settings.automation_enabled ? 'true' : 'false';
        document.getElementById('checkInterval').value = settings.check_interval_ms || 1000;
        document.getElementById('maxConcurrentRules').value = settings.max_concurrent_rules || 10;
        document.getElementById('logRuleExecution').value = settings.log_rule_execution ? 'true' : 'false';
    }
    
    // Set automation rules
    if (data.automation_rules && Array.isArray(data.automation_rules)) {
        automationRules = data.automation_rules;
        // Update counter to be higher than the highest existing rule ID
        const maxId = automationRules.length > 0 ? Math.max(...automationRules.map(rule => rule.id || 0)) : 0;
        automationRuleCounter = maxId;
        console.log(`Updated automationRuleCounter to ${automationRuleCounter} based on existing rules`);
        generateAutomationRules();
    }
}

// Save automation rules to server
function saveAutomationRules() {
    console.log('Saving automation rules...');
    
    // Create array to hold all rules - declare outside of .then blocks
    let allRules = [];
    
    // First, load existing rules from server to get the complete structure
    sendMQTTRequest(30, {})
        .then(response => {
            if (response.status === 'success' && response.data) {
                const existingData = response.data;
                console.log('Loaded existing automation data from server:', existingData);
                
                // Use existing global settings as base, then override with UI values
                const globalSettings = {
                    automation_enabled: document.getElementById('automationEnabled')?.value === 'true' || existingData.global_settings?.automation_enabled || true,
                    check_interval_ms: parseInt(document.getElementById('checkInterval')?.value) || existingData.global_settings?.check_interval_ms || 1000,
                    max_concurrent_rules: parseInt(document.getElementById('maxConcurrentRules')?.value) || existingData.global_settings?.max_concurrent_rules || 10,
                    log_rule_execution: document.getElementById('logRuleExecution')?.value === 'true' || existingData.global_settings?.log_rule_execution || true,
                    latitude: existingData.global_settings?.latitude || 35.6892,
                    longitude: existingData.global_settings?.longitude || 51.389,
                    timezone: existingData.global_settings?.timezone || "Asia/Tehran",
                    mqtt_publish_events: existingData.global_settings?.mqtt_publish_events || true,
                    mqtt_topic_prefix: existingData.global_settings?.mqtt_topic_prefix || "automation/gpio"
                };
                
                console.log('Global settings:', globalSettings);
                console.log('Existing automation rules from server:', existingData.automation_rules);
                
                // Start with existing rules from server
                const existingRules = existingData.automation_rules || [];
                
                // Collect all automation rules from UI
                const ruleElements = document.querySelectorAll('[id^="automationRule"]');
                
                // Reset allRules array
                allRules = [];
                
                // Process UI rules
                const uiRuleIds = new Set();
                
                console.log(`Found ${ruleElements.length} rule elements in UI`);
                
                ruleElements.forEach((ruleElement, index) => {
                    // Extract rule ID from element ID (e.g., "automationRule3" -> 3)
                    const elementId = ruleElement.id;
                    const extractedId = parseInt(elementId.replace('automationRule', ''));
                    const ruleId = !isNaN(extractedId) && extractedId > 0 ? extractedId : (index + 1);
                    
                    // Skip if this rule ID has already been processed (prevent duplicates)
                    if (uiRuleIds.has(ruleId)) {
                        console.log(`Skipping duplicate rule ID: ${ruleId} from element: ${elementId}`);
                        return;
                    }
                    
                    uiRuleIds.add(ruleId);
                    
                    console.log(`Processing UI rule element: ${elementId}, extracted ruleId: ${ruleId}`);
                    
                    const nameElement = ruleElement.querySelector(`#ruleName${ruleId}`);
                    const descElement = ruleElement.querySelector(`#ruleDescription${ruleId}`);
                    const enabledElement = ruleElement.querySelector(`#ruleEnabled${ruleId}`);
                    const priorityElement = ruleElement.querySelector(`#rulePriority${ruleId}`);
                    const triggerTypeElement = ruleElement.querySelector(`#triggerType${ruleId}`);
                    const actionTypeElement = ruleElement.querySelector(`#actionType${ruleId}`);
                    
                    if (nameElement && descElement && enabledElement && priorityElement && triggerTypeElement && actionTypeElement) {
                        // Get the corresponding existing rule if it exists
                        const existingRule = existingRules.find(r => r.id === ruleId) || {};
                        
                        const rule = {
                            id: ruleId,
                            name: nameElement.value || existingRule.name || `Rule ${ruleId}`,
                            description: descElement.value || existingRule.description || '',
                            enabled: enabledElement.value === 'true',
                            priority: parseInt(priorityElement.value) || existingRule.priority || 1,
                            trigger: {
                                type: triggerTypeElement.value || existingRule.trigger?.type || 'time_based'
                            },
                            actions: [{
                                type: actionTypeElement.value || existingRule.actions?.[0]?.type || 'gpio_output'
                            }]
                        };
            
                        console.log(`Rule ${ruleId} basic data:`, {
                            name: nameElement.value,
                            description: descElement.value,
                            enabled: enabledElement.value,
                            priority: priorityElement.value,
                            triggerType: triggerTypeElement.value,
                            actionType: actionTypeElement.value
                        });
            
                        // Add trigger-specific data based on type
                        if (rule.trigger.type === 'time_based') {
                            const timeElement = ruleElement.querySelector(`#triggerTime${ruleId}`);
                            rule.trigger.time = timeElement ? timeElement.value : existingRule.trigger?.time || '00:00';
                            
                            // Collect weekdays from UI
                        const weekdays = [];
                        for (let i = 0; i < 7; i++) {
                            const weekdayElement = ruleElement.querySelector(`#weekday${ruleId}_${i}`);
                            if (weekdayElement && weekdayElement.checked) {
                                weekdays.push(i + 1); // Convert to 1-7 format
                            }
                        }
                        rule.trigger.days_of_week = weekdays.length > 0 ? weekdays : existingRule.trigger?.days_of_week || [1, 2, 3, 4, 5, 6, 7];
                        
                        console.log(`Rule ${ruleId} weekdays collected:`, {
                            checkedElements: Array.from({length: 7}, (_, i) => {
                                const el = ruleElement.querySelector(`#weekday${ruleId}_${i}`);
                                return el ? el.checked : false;
                            }),
                            weekdaysArray: weekdays,
                            finalDaysOfWeek: rule.trigger.days_of_week
                        });
                            
                            // Add time_conditions for compatibility with sample JSON
                            rule.trigger.time_conditions = [{
                                time: rule.trigger.time,
                                action: "activate"
                            }];
                            
                            // Add date_range for compatibility
                            rule.trigger.date_range = existingRule.trigger?.date_range || {
                                start_date: null,
                                end_date: null
                            };
                            
                        } else if (rule.trigger.type === 'sun_based') {
                            const eventElement = ruleElement.querySelector(`#triggerEvent${ruleId}`);
                            const offsetElement = ruleElement.querySelector(`#triggerOffset${ruleId}`);
                            
                            rule.trigger.event = eventElement ? eventElement.value : existingRule.trigger?.event || 'sunrise';
                            rule.trigger.offset_minutes = offsetElement ? parseInt(offsetElement.value) || 0 : existingRule.trigger?.offset_minutes || 0;
                            
                            // Add sun_conditions for compatibility with sample JSON
                            rule.trigger.sun_conditions = [{
                                event: rule.trigger.event,
                                offset_minutes: rule.trigger.offset_minutes,
                                action: "activate"
                            }];
                            
                        } else {
                            // For other trigger types (analog_input, digital_input, combined), preserve existing data
                            Object.assign(rule.trigger, existingRule.trigger || {});
                        }
            
                        // Add action-specific data
                        if (rule.actions[0].type === 'gpio_output') {
                            const pinElement = ruleElement.querySelector(`#actionPin${ruleId}`);
                            const stateElement = ruleElement.querySelector(`#actionState${ruleId}`);
                            const durationElement = ruleElement.querySelector(`#actionDuration${ruleId}`);
                            
                            rule.actions[0].pin_number = pinElement ? parseInt(pinElement.value) || 0 : existingRule.actions?.[0]?.pin_number || 0;
                            rule.actions[0].state = stateElement ? stateElement.value : existingRule.actions?.[0]?.state || 'high';
                            rule.actions[0].duration_ms = durationElement ? parseInt(durationElement.value) || null : existingRule.actions?.[0]?.duration_ms || null;
                            rule.actions[0].pwm_enabled = existingRule.actions?.[0]?.pwm_enabled || false;
                            rule.actions[0].pwm_duty_cycle = existingRule.actions?.[0]?.pwm_duty_cycle || 50;
                            
                        } else if (rule.actions[0].type === 'notification') {
                            // For notification actions, preserve existing data or set defaults
                            rule.actions[0].message = existingRule.actions?.[0]?.message || "Automation rule triggered";
                            rule.actions[0].priority = existingRule.actions?.[0]?.priority || "normal";
                            
                        } else {
                            // For other action types, preserve existing data
                            Object.assign(rule.actions[0], existingRule.actions?.[0] || {});
                        }
                        
                        console.log(`Rule ${ruleId} FINAL COMPLETE DATA:`, JSON.stringify(rule, null, 2));
                        allRules.push(rule);
                    }
                });
                
                // Note: We no longer preserve existing rules that are not in UI
                // This allows proper deletion of rules when they are removed from UI
                console.log('Only saving rules currently visible in UI - deleted rules will be removed');
                
                // Build complete request data matching sample JSON structure
                const requestData = {
                    automation_rules: allRules,
                    global_settings: globalSettings,
                    rule_types: existingData.rule_types || {
                        "time_based": {
                            "description": "Rules triggered at specific times",
                            "supported_parameters": ["time", "days_of_week", "date_range", "time_conditions"]
                        },
                        "sun_based": {
                            "description": "Rules triggered by sunrise/sunset events",
                            "supported_parameters": ["event", "offset_minutes", "sun_conditions"]
                        },
                        "analog_input": {
                            "description": "Rules triggered by analog sensor readings",
                            "supported_parameters": ["pin_number", "threshold", "comparison", "hysteresis"]
                        },
                        "digital_input": {
                            "description": "Rules triggered by digital input changes",
                            "supported_parameters": ["pin_number", "state", "debounce_ms"]
                        },
                        "combined": {
                            "description": "Rules with multiple trigger conditions",
                            "supported_parameters": ["conditions", "logic_operator"]
                        }
                    },
                    action_types: existingData.action_types || {
                        "gpio_output": {
                            "description": "Control GPIO output pins",
                            "supported_parameters": ["pin_number", "state", "duration_ms", "pwm_enabled", "pwm_duty_cycle"]
                        },
                        "notification": {
                            "description": "Send notifications",
                            "supported_parameters": ["message", "priority"]
                        }
                    }
                };
                
                console.log('=== AUTOMATION RULES SAVE DEBUG ===');
                console.log('Existing automation rules from server:', existingData.automation_rules);
                console.log('UI rule IDs found:', Array.from(uiRuleIds));
                console.log('UI rules collected (only these will be saved):', allRules);
                console.log('Global settings:', globalSettings);
                console.log('Complete request data:', requestData);
                console.log('Total rules to save:', allRules.length);
                console.log('Rule IDs in final array:', allRules.map(r => r.id));
                console.log('Note: Deleted rules are permanently removed');
                console.log('=====================================');
                
                return sendMQTTRequest(31, requestData);
            } else {
                throw new Error('Failed to load existing automation rules');
            }
        })
        .then(response => {
            if (response.status === 'success') {
                showNotification('قوانین اتوماسیون با موفقیت ذخیره شد', 'success');
                // Update local automationRules array with the saved rules
                automationRules = allRules;
                console.log('Updated local automationRules array:', automationRules);
            } else {
                showNotification('خطا در ذخیره قوانین اتوماسیون: ' + (response.message || 'خطای نامشخص'), 'error');
            }
        })
        .catch(error => {
            console.error('Error saving automation rules:', error);
            showNotification('خطا در ذخیره قوانین اتوماسیون: ' + error.message, 'error');
        });
}

// Get automation status from server
function getAutomationStatus() {
    console.log('Getting automation status...');
    return sendMQTTRequest(32, {})
        .then(response => {
            if (response.status === 'success' && response.data) {
                updateAutomationStatusDisplay(response.data);
                showNotification('وضعیت اتوماسیون دریافت شد', 'success');
            } else {
                showNotification('خطا در دریافت وضعیت اتوماسیون: ' + (response.message || 'خطای نامشخص'), 'error');
            }
            return response;
        })
        .catch(error => {
            console.error('Error getting automation status:', error);
            showNotification('خطا در دریافت وضعیت اتوماسیون: ' + error.message, 'error');
            throw error;
        });
}

// Update automation status display
function updateAutomationStatusDisplay(data) {
    console.log('Updating automation status display:', data);
    
    const statusElement = document.getElementById('automationStatus');
    const totalRulesElement = document.getElementById('totalRules');
    const lastCheckElement = document.getElementById('lastCheck');
    
    if (statusElement) {
        if (data.automation_enabled && data.thread_running) {
            statusElement.textContent = 'فعال';
            statusElement.className = 'badge bg-success';
        } else if (data.automation_enabled && !data.thread_running) {
            statusElement.textContent = 'فعال اما متوقف';
            statusElement.className = 'badge bg-warning';
        } else {
            statusElement.textContent = 'غیرفعال';
            statusElement.className = 'badge bg-danger';
        }
    }
    
    if (totalRulesElement) {
        totalRulesElement.textContent = data.total_rules || 0;
    }
    
    if (lastCheckElement) {
        lastCheckElement.textContent = data.last_check || '-';
    }
}

// Generate automation rules UI
function generateAutomationRules() {
    const container = document.getElementById('automationRulesContainer');
    if (!container) return;
    
    container.innerHTML = '';
    
    automationRules.forEach((rule, index) => {
        // Use the actual rule ID instead of index + 1 to maintain consistency
        const ruleNumber = rule.id || (index + 1);
        const ruleHtml = createAutomationRuleHTML(rule, ruleNumber);
        container.insertAdjacentHTML('beforeend', ruleHtml);
    });
    
    // Update counter to be higher than the highest existing rule ID
    const maxId = automationRules.length > 0 ? Math.max(...automationRules.map(rule => rule.id || 0)) : 0;
    automationRuleCounter = maxId;
}

// Create HTML for a single automation rule
function createAutomationRuleHTML(rule, ruleNumber) {
    const isEnabled = rule.enabled !== false;
    const cardStyle = isEnabled ? 'opacity: 1; border: 2px solid #28a745;' : 'opacity: 0.6; border: 2px solid #dc3545;';
    
    return `
        <div class="glass-card mb-3" id="automationRule${ruleNumber}" style="${cardStyle}">
            <div class="d-flex justify-content-between align-items-center mb-3">
                <h6 class="mb-0">قانون اتوماسیون ${ruleNumber}</h6>
                <div>
                    <button class="btn btn-warning btn-sm me-2" onclick="toggleAutomationRule(${ruleNumber})" title="فعال/غیرفعال کردن سریع">
                        <i class="fas fa-power-off"></i>
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="removeAutomationRule(${ruleNumber})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            
            <div class="row">
                <div class="col-md-3">
                    <div class="mb-3">
                        <label class="form-label">نام قانون</label>
                        <input type="text" class="form-control" id="ruleName${ruleNumber}" value="${rule.name || ''}" style="border: 3px solid #808080 !important; background: rgba(255, 255, 255, 0.15) !important;">
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="mb-3">
                        <label class="form-label">توضیحات</label>
                        <input type="text" class="form-control" id="ruleDescription${ruleNumber}" value="${rule.description || ''}" style="border: 3px solid #808080 !important; background: rgba(255, 255, 255, 0.15) !important;">
                    </div>
                </div>
                <div class="col-md-2">
                    <div class="mb-3">
                        <label class="form-label">وضعیت</label>
                        <select class="form-select" id="ruleEnabled${ruleNumber}" style="border: 3px solid #808080 !important; background: rgba(255, 255, 255, 0.15) !important;">
                            <option value="true" ${rule.enabled ? 'selected' : ''}>فعال</option>
                            <option value="false" ${!rule.enabled ? 'selected' : ''}>غیرفعال</option>
                        </select>
                    </div>
                </div>
                <div class="col-md-2">
                    <div class="mb-3">
                        <label class="form-label">اولویت</label>
                        <input type="number" class="form-control" id="rulePriority${ruleNumber}" value="${rule.priority || 1}" min="1" max="10" style="border: 3px solid #808080 !important; background: rgba(255, 255, 255, 0.15) !important;">
                    </div>
                </div>
                <div class="col-md-2">
                    <div class="mb-3">
                        <label class="form-label">نوع تریگر</label>
                        <select class="form-select" id="triggerType${ruleNumber}" onchange="updateTriggerFields(${ruleNumber})" style="border: 3px solid #808080 !important; background: rgba(255, 255, 255, 0.15) !important;">
                            <option value="time_based" ${rule.trigger?.type === 'time_based' ? 'selected' : ''}>زمان مشخص</option>
                            <option value="sun_based" ${rule.trigger?.type === 'sun_based' ? 'selected' : ''}>طلوع خورشید</option>
                            <option value="sunset" ${rule.trigger?.type === 'sunset' ? 'selected' : ''}>غروب خورشید</option>
                            <option value="sunrise" ${rule.trigger?.type === 'sunrise' ? 'selected' : ''}>طلوع خورشید</option>
                            <option value="maghrib" ${rule.trigger?.type === 'maghrib' ? 'selected' : ''}>غروب خورشید</option>
                            <option value="fajr" ${rule.trigger?.type === 'fajr' ? 'selected' : ''}>اذان فجر</option>
                            <option value="dhuhr" ${rule.trigger?.type === 'dhuhr' ? 'selected' : ''}>اذان ظهر</option>
                            <option value="asr" ${rule.trigger?.type === 'asr' ? 'selected' : ''}>اذان عصر</option>
                            <option value="isha" ${rule.trigger?.type === 'isha' ? 'selected' : ''}>اذان عشاء</option>
                            <option value="temperature" ${rule.trigger?.type === 'temperature' ? 'selected' : ''}>پیرودی فیزیکی</option>
                            <option value="humidity" ${rule.trigger?.type === 'humidity' ? 'selected' : ''}>پیرودی دیجیتال</option>
                            <option value="motion" ${rule.trigger?.type === 'motion' ? 'selected' : ''}>تشخیص حرکت</option>
                            <option value="interval" ${rule.trigger?.type === 'interval' ? 'selected' : ''}>ارکسی</option>
                        </select>
                    </div>
                </div>
            </div>
            
            <!-- Trigger Fields -->
            <div class="row" id="triggerFields${ruleNumber}">
                ${generateTriggerFields(rule, ruleNumber)}
            </div>
            
            <!-- Action Fields -->
            <div class="row">
                <div class="col-md-3">
                    <div class="mb-3">
                        <label class="form-label">نوع عمل</label>
                        <select class="form-select" id="actionType${ruleNumber}" onchange="updateActionFields(${ruleNumber})" style="border: 3px solid #808080 !important; background: rgba(255, 255, 255, 0.15) !important;">
                            <option value="gpio_output" ${rule.actions?.[0]?.type === 'gpio_output' ? 'selected' : ''}>شماره GPIO</option>
                            <option value="pwm" ${rule.actions?.[0]?.type === 'pwm' ? 'selected' : ''}>شماره PWM</option>
                            <option value="delay" ${rule.actions?.[0]?.type === 'delay' ? 'selected' : ''}>تاخیر</option>
                        </select>
                    </div>
                </div>
                <div class="col-md-9" id="actionFields${ruleNumber}">
                    ${generateActionFields(rule, ruleNumber)}
                </div>
            </div>
        </div>
    `;
}

// Generate trigger fields based on trigger type
function generateTriggerFields(rule, ruleNumber) {
    const triggerType = rule.trigger?.type || 'time_based';
    
    if (triggerType === 'sun_based') {
        return `
            <div class="col-md-6">
                <div class="mb-3">
                    <label class="form-label">رویداد خورشید</label>
                    <select class="form-select" id="triggerEvent${ruleNumber}" style="border: 3px solid #808080 !important; background: rgba(255, 255, 255, 0.15) !important;">
                        <option value="sunrise" ${rule.trigger?.event === 'sunrise' ? 'selected' : ''}>طلوع آفتاب</option>
                        <option value="sunset" ${rule.trigger?.event === 'sunset' ? 'selected' : ''}>غروب آفتاب</option>
                    </select>
                </div>
            </div>
            <div class="col-md-6">
                <div class="mb-3">
                    <label class="form-label">تاخیر (دقیقه)</label>
                    <input type="number" class="form-control" id="triggerOffset${ruleNumber}" value="${rule.trigger?.offset_minutes || 0}" style="border: 3px solid #808080 !important; background: rgba(255, 255, 255, 0.15) !important;">
                </div>
            </div>
        `;
    } else if (triggerType === 'time_based') {
        const weekdays = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه', 'شنبه'];
        // Convert days_of_week (1-7 format) to UI format (0-6)
        const daysOfWeek = rule.trigger?.days_of_week || [1, 2, 3, 4, 5, 6, 7];
        const selectedDays = daysOfWeek.map(day => day - 1); // Convert 1-7 to 0-6
        
        return `
            <div class="col-md-6">
                <div class="mb-3">
                    <label class="form-label">زمان</label>
                    <input type="time" class="form-control" id="triggerTime${ruleNumber}" value="${rule.trigger?.time || '00:00'}" style="border: 3px solid #808080 !important; background: rgba(255, 255, 255, 0.15) !important;">
                </div>
            </div>
            <div class="col-md-6">
                <div class="mb-3">
                    <label class="form-label">روزهای هفته</label>
                    <div class="d-flex flex-wrap gap-2">
                        ${weekdays.map((day, index) => `
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="weekday${ruleNumber}_${index}" ${selectedDays.includes(index) ? 'checked' : ''}>
                                <label class="form-check-label" for="weekday${ruleNumber}_${index}">${day}</label>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    } else if (triggerType === 'interval') {
        return `
            <div class="col-md-6">
                <div class="mb-3">
                    <label class="form-label">بازه زمانی (دقیقه)</label>
                    <input type="number" class="form-control" id="triggerInterval${ruleNumber}" value="${rule.trigger?.interval_minutes || 60}" min="1" style="border: 3px solid #808080 !important; background: rgba(255, 255, 255, 0.15) !important;">
                </div>
            </div>
            <div class="col-md-6">
                <div class="mb-3">
                    <label class="form-label">تکرار</label>
                    <select class="form-select" id="triggerRepeat${ruleNumber}" style="border: 3px solid #808080 !important; background: rgba(255, 255, 255, 0.15) !important;">
                        <option value="continuous" ${rule.trigger?.repeat === 'continuous' ? 'selected' : ''}>مداوم</option>
                        <option value="once" ${rule.trigger?.repeat === 'once' ? 'selected' : ''}>یک بار</option>
                    </select>
                </div>
            </div>
        `;
    } else if (triggerType === 'sunset') {
        return `
            <div class="col-md-6">
                <div class="mb-3">
                    <label class="form-label">تاخیر (دقیقه)</label>
                    <input type="number" class="form-control" id="triggerOffset${ruleNumber}" value="${rule.trigger?.offset_minutes || 0}" style="border: 3px solid #808080 !important; background: rgba(255, 255, 255, 0.15) !important;">
                </div>
            </div>
        `;
    } else if (triggerType === 'temperature') {
        return `
            <div class="col-md-6">
                <div class="mb-3">
                    <label class="form-label">شماره پین</label>
                    <input type="number" class="form-control" id="triggerPin${ruleNumber}" value="${rule.trigger?.pin_number || 0}" style="border: 3px solid #808080 !important; background: rgba(255, 255, 255, 0.15) !important;">
                </div>
            </div>
            <div class="col-md-6">
                <div class="mb-3">
                    <label class="form-label">وضعیت</label>
                    <select class="form-select" id="triggerState${ruleNumber}" style="border: 3px solid #808080 !important; background: rgba(255, 255, 255, 0.15) !important;">
                        <option value="high" ${rule.trigger?.state === 'high' ? 'selected' : ''}>بالا (HIGH)</option>
                        <option value="low" ${rule.trigger?.state === 'low' ? 'selected' : ''}>پایین (LOW)</option>
                    </select>
                </div>
            </div>
        `;
    } else if (triggerType === 'humidity') {
        return `
            <div class="col-md-6">
                <div class="mb-3">
                    <label class="form-label">شماره پین</label>
                    <input type="number" class="form-control" id="triggerPin${ruleNumber}" value="${rule.trigger?.pin_number || 0}" style="border: 3px solid #808080 !important; background: rgba(255, 255, 255, 0.15) !important;">
                </div>
            </div>
            <div class="col-md-6">
                <div class="mb-3">
                    <label class="form-label">وضعیت</label>
                    <select class="form-select" id="triggerState${ruleNumber}" style="border: 3px solid #808080 !important; background: rgba(255, 255, 255, 0.15) !important;">
                        <option value="high" ${rule.trigger?.state === 'high' ? 'selected' : ''}>بالا (HIGH)</option>
                        <option value="low" ${rule.trigger?.state === 'low' ? 'selected' : ''}>پایین (LOW)</option>
                    </select>
                </div>
            </div>
        `;
    } else if (triggerType === 'motion') {
        return `
            <div class="col-md-6">
                <div class="mb-3">
                    <label class="form-label">شماره پین</label>
                    <input type="number" class="form-control" id="triggerPin${ruleNumber}" value="${rule.trigger?.pin_number || 0}" style="border: 3px solid #808080 !important; background: rgba(255, 255, 255, 0.15) !important;">
                </div>
            </div>
            <div class="col-md-6">
                <div class="mb-3">
                    <label class="form-label">وضعیت</label>
                    <select class="form-select" id="triggerState${ruleNumber}" style="border: 3px solid #808080 !important; background: rgba(255, 255, 255, 0.15) !important;">
                        <option value="high" ${rule.trigger?.state === 'high' ? 'selected' : ''}>بالا (HIGH)</option>
                        <option value="low" ${rule.trigger?.state === 'low' ? 'selected' : ''}>پایین (LOW)</option>
                    </select>
                </div>
            </div>
        `;
    } else if (triggerType === 'light') {
        return `
            <div class="col-md-4">
                <div class="mb-3">
                    <label class="form-label">شرط</label>
                    <select class="form-select" id="triggerCondition${ruleNumber}" style="border: 3px solid #808080 !important; background: rgba(255, 255, 255, 0.15) !important;">
                        <option value="greater" ${rule.trigger?.condition === 'greater' ? 'selected' : ''}>روشن‌تر از</option>
                        <option value="less" ${rule.trigger?.condition === 'less' ? 'selected' : ''}>تاریک‌تر از</option>
                        <option value="equal" ${rule.trigger?.condition === 'equal' ? 'selected' : ''}>برابر با</option>
                    </select>
                </div>
            </div>
            <div class="col-md-4">
                <div class="mb-3">
                    <label class="form-label">مقدار (lux)</label>
                    <input type="number" class="form-control" id="triggerValue${ruleNumber}" value="${rule.trigger?.value || 100}" min="0" style="border: 3px solid #808080 !important; background: rgba(255, 255, 255, 0.15) !important;">
                </div>
            </div>
            <div class="col-md-4">
                <div class="mb-3">
                    <label class="form-label">سنسور</label>
                    <input type="text" class="form-control" id="triggerSensor${ruleNumber}" value="${rule.trigger?.sensor || 'LDR'}" style="border: 3px solid #808080 !important; background: rgba(255, 255, 255, 0.15) !important;">
                </div>
            </div>
        `;
    } else if (triggerType === 'sound') {
        return `
            <div class="col-md-4">
                <div class="mb-3">
                    <label class="form-label">شرط</label>
                    <select class="form-select" id="triggerCondition${ruleNumber}" style="border: 3px solid #808080 !important; background: rgba(255, 255, 255, 0.15) !important;">
                        <option value="greater" ${rule.trigger?.condition === 'greater' ? 'selected' : ''}>بلندتر از</option>
                        <option value="less" ${rule.trigger?.condition === 'less' ? 'selected' : ''}>آرام‌تر از</option>
                        <option value="detected" ${rule.trigger?.condition === 'detected' ? 'selected' : ''}>تشخیص صدا</option>
                    </select>
                </div>
            </div>
            <div class="col-md-4">
                <div class="mb-3">
                    <label class="form-label">مقدار (dB)</label>
                    <input type="number" class="form-control" id="triggerValue${ruleNumber}" value="${rule.trigger?.value || 60}" min="0" max="120" style="border: 3px solid #808080 !important; background: rgba(255, 255, 255, 0.15) !important;">
                </div>
            </div>
            <div class="col-md-4">
                <div class="mb-3">
                    <label class="form-label">سنسور</label>
                    <input type="text" class="form-control" id="triggerSensor${ruleNumber}" value="${rule.trigger?.sensor || 'MIC'}" style="border: 3px solid #808080 !important; background: rgba(255, 255, 255, 0.15) !important;">
                </div>
            </div>
        `;
    } else if (triggerType === 'gpio_input') {
        return `
            <div class="col-md-6">
                <div class="mb-3">
                    <label class="form-label">شماره پین</label>
                    <input type="number" class="form-control" id="triggerPin${ruleNumber}" value="${rule.trigger?.pin_number || 0}" style="border: 3px solid #808080 !important; background: rgba(255, 255, 255, 0.15) !important;">
                </div>
            </div>
            <div class="col-md-6">
                <div class="mb-3">
                    <label class="form-label">وضعیت</label>
                    <select class="form-select" id="triggerState${ruleNumber}" style="border: 3px solid #808080 !important; background: rgba(255, 255, 255, 0.15) !important;">
                        <option value="high" ${rule.trigger?.state === 'high' ? 'selected' : ''}>بالا</option>
                        <option value="low" ${rule.trigger?.state === 'low' ? 'selected' : ''}>پایین</option>
                    </select>
                </div>
            </div>
        `;
    } else if (triggerType === 'sunrise') {
        return `
            <div class="col-md-12">
                <div class="mb-3">
                    <label class="form-label">تاخیر (دقیقه)</label>
                    <input type="number" class="form-control" id="triggerDelay${ruleNumber}" value="${rule.trigger?.delay || 0}" style="border: 3px solid #808080 !important; background: rgba(255, 255, 255, 0.15) !important;">
                </div>
            </div>
        `;
    } else if (triggerType === 'maghrib') {
        return `
            <div class="col-md-12">
                <div class="mb-3">
                    <label class="form-label">تاخیر (دقیقه)</label>
                    <input type="number" class="form-control" id="triggerDelay${ruleNumber}" value="${rule.trigger?.delay || 0}" style="border: 3px solid #808080 !important; background: rgba(255, 255, 255, 0.15) !important;">
                </div>
            </div>
        `;
    } else if (triggerType === 'fajr') {
        return `
            <div class="col-md-12">
                <div class="mb-3">
                    <label class="form-label">تاخیر (دقیقه)</label>
                    <input type="number" class="form-control" id="triggerDelay${ruleNumber}" value="${rule.trigger?.delay || 0}" style="border: 3px solid #808080 !important; background: rgba(255, 255, 255, 0.15) !important;">
                </div>
            </div>
        `;
    } else if (triggerType === 'dhuhr') {
        return `
            <div class="col-md-12">
                <div class="mb-3">
                    <label class="form-label">تاخیر (دقیقه)</label>
                    <input type="number" class="form-control" id="triggerDelay${ruleNumber}" value="${rule.trigger?.delay || 0}" style="border: 3px solid #808080 !important; background: rgba(255, 255, 255, 0.15) !important;">
                </div>
            </div>
        `;
    } else if (triggerType === 'asr') {
        return `
            <div class="col-md-12">
                <div class="mb-3">
                    <label class="form-label">تاخیر (دقیقه)</label>
                    <input type="number" class="form-control" id="triggerDelay${ruleNumber}" value="${rule.trigger?.delay || 0}" style="border: 3px solid #808080 !important; background: rgba(255, 255, 255, 0.15) !important;">
                </div>
            </div>
        `;
    } else if (triggerType === 'isha') {
        return `
            <div class="col-md-12">
                <div class="mb-3">
                    <label class="form-label">تاخیر (دقیقه)</label>
                    <input type="number" class="form-control" id="triggerDelay${ruleNumber}" value="${rule.trigger?.delay || 0}" style="border: 3px solid #808080 !important; background: rgba(255, 255, 255, 0.15) !important;">
                </div>
            </div>
        `;
    }
    
    return '';
}

// Generate action fields based on action type
function generateActionFields(rule, ruleNumber) {
    const actionType = rule.actions?.[0]?.type || 'gpio_output';
    
    if (actionType === 'gpio_output') {
        // Generate options for available output pins
        let pinOptions = '<option value="">انتخاب پین</option>';
        if (availableOutputPins && availableOutputPins.length > 0) {
            availableOutputPins.forEach(pin => {
                const selected = rule.actions?.[0]?.pin_number == pin ? 'selected' : '';
                pinOptions += `<option value="${pin}" ${selected}>پین ${pin}</option>`;
            });
        }
        
        return `
            <div class="col-md-4">
                <div class="mb-3">
                    <label class="form-label">شماره پین</label>
                    <select class="form-select" id="actionPin${ruleNumber}" style="border: 3px solid #808080 !important; background: rgba(255, 255, 255, 0.15) !important;">
                        ${pinOptions}
                    </select>
                </div>
            </div>
            <div class="col-md-4">
                <div class="mb-3">
                    <label class="form-label">وضعیت</label>
                    <select class="form-select" id="actionState${ruleNumber}" style="border: 3px solid #808080 !important; background: rgba(255, 255, 255, 0.15) !important;">
                        <option value="high" ${rule.actions?.[0]?.state === 'high' ? 'selected' : ''}>بالا</option>
                        <option value="low" ${rule.actions?.[0]?.state === 'low' ? 'selected' : ''}>پایین</option>
                    </select>
                </div>
            </div>
            <div class="col-md-4">
                <div class="mb-3">
                    <label class="form-label">مدت زمان (میلی‌ثانیه)</label>
                    <input type="number" class="form-control" id="actionDuration${ruleNumber}" value="${rule.actions?.[0]?.duration_ms || 0}" style="border: 3px solid #808080 !important; background: rgba(255, 255, 255, 0.15) !important;">
                </div>
            </div>
        `;
    } else if (actionType === 'pwm') {
        // Generate options for available PWM pins
        let pwmPinOptions = '<option value="">انتخاب پین PWM</option>';
        if (availableOutputPins && availableOutputPins.length > 0) {
            availableOutputPins.forEach(pin => {
                const selected = rule.actions?.[0]?.pin_number == pin ? 'selected' : '';
                pwmPinOptions += `<option value="${pin}" ${selected}>پین PWM ${pin}</option>`;
            });
        }
        
        return `
            <div class="col-md-4">
                <div class="mb-3">
                    <label class="form-label">شماره پین PWM</label>
                    <select class="form-select" id="actionPin${ruleNumber}" style="border: 3px solid #808080 !important; background: rgba(255, 255, 255, 0.15) !important;">
                        ${pwmPinOptions}
                    </select>
                </div>
            </div>
            <div class="col-md-4">
                <div class="mb-3">
                    <label class="form-label">مقدار PWM (0-255)</label>
                    <input type="number" class="form-control" id="actionPwmValue${ruleNumber}" value="${rule.actions?.[0]?.pwm_value || 128}" min="0" max="255" style="border: 3px solid #808080 !important; background: rgba(255, 255, 255, 0.15) !important;">
                </div>
            </div>
            <div class="col-md-4">
                <div class="mb-3">
                    <label class="form-label">مدت زمان (میلی‌ثانیه)</label>
                    <input type="number" class="form-control" id="actionDuration${ruleNumber}" value="${rule.actions?.[0]?.duration_ms || 0}" style="border: 3px solid #808080 !important; background: rgba(255, 255, 255, 0.15) !important;">
                </div>
            </div>
        `;
    } else if (actionType === 'delay') {
        return `
            <div class="col-md-12">
                <div class="mb-3">
                    <label class="form-label">تاخیر (میلی‌ثانیه)</label>
                    <input type="number" class="form-control" id="actionDelay${ruleNumber}" value="${rule.actions?.[0]?.delay_ms || 1000}" style="border: 3px solid #808080 !important; background: rgba(255, 255, 255, 0.15) !important;">
                </div>
            </div>
        `;
    } else if (actionType === 'notification') {
        return `
            <div class="col-md-6">
                <div class="mb-3">
                    <label class="form-label">عنوان</label>
                    <input type="text" class="form-control" id="actionTitle${ruleNumber}" value="${rule.actions?.[0]?.title || ''}" style="border: 3px solid #808080 !important; background: rgba(255, 255, 255, 0.15) !important;">
                </div>
            </div>
            <div class="col-md-6">
                <div class="mb-3">
                    <label class="form-label">پیام</label>
                    <input type="text" class="form-control" id="actionMessage${ruleNumber}" value="${rule.actions?.[0]?.message || 'Automation triggered'}" style="border: 3px solid #808080 !important; background: rgba(255, 255, 255, 0.15) !important;">
                </div>
            </div>
        `;
    } else if (actionType === 'email') {
        return `
            <div class="col-md-6">
                <div class="mb-3">
                    <label class="form-label">آدرس ایمیل</label>
                    <input type="email" class="form-control" id="actionEmail${ruleNumber}" value="${rule.actions?.[0]?.email || ''}" style="border: 3px solid #808080 !important; background: rgba(255, 255, 255, 0.15) !important;">
                </div>
            </div>
            <div class="col-md-6">
                <div class="mb-3">
                    <label class="form-label">موضوع</label>
                    <input type="text" class="form-control" id="actionSubject${ruleNumber}" value="${rule.actions?.[0]?.subject || ''}" style="border: 3px solid #808080 !important; background: rgba(255, 255, 255, 0.15) !important;">
                </div>
            </div>
            <div class="col-md-12">
                <div class="mb-3">
                    <label class="form-label">متن پیام</label>
                    <textarea class="form-control" id="actionBody${ruleNumber}" rows="3" style="border: 3px solid #808080 !important; background: rgba(255, 255, 255, 0.15) !important;">${rule.actions?.[0]?.body || ''}</textarea>
                </div>
            </div>
        `;
    } else if (actionType === 'sms') {
        return `
            <div class="col-md-6">
                <div class="mb-3">
                    <label class="form-label">شماره تلفن</label>
                    <input type="tel" class="form-control" id="actionPhone${ruleNumber}" value="${rule.actions?.[0]?.phone || ''}" style="border: 3px solid #808080 !important; background: rgba(255, 255, 255, 0.15) !important;">
                </div>
            </div>
            <div class="col-md-6">
                <div class="mb-3">
                    <label class="form-label">متن پیام</label>
                    <textarea class="form-control" id="actionMessage${ruleNumber}" rows="2" style="border: 3px solid #808080 !important; background: rgba(255, 255, 255, 0.15) !important;">${rule.actions?.[0]?.message || ''}</textarea>
                </div>
            </div>
        `;
    } else if (actionType === 'webhook') {
        return `
            <div class="col-md-6">
                <div class="mb-3">
                    <label class="form-label">URL</label>
                    <input type="url" class="form-control" id="actionUrl${ruleNumber}" value="${rule.actions?.[0]?.url || ''}" style="border: 3px solid #808080 !important; background: rgba(255, 255, 255, 0.15) !important;">
                </div>
            </div>
            <div class="col-md-6">
                <div class="mb-3">
                    <label class="form-label">روش HTTP</label>
                    <select class="form-select" id="actionMethod${ruleNumber}" style="border: 3px solid #808080 !important; background: rgba(255, 255, 255, 0.15) !important;">
                        <option value="GET" ${rule.actions?.[0]?.method === 'GET' ? 'selected' : ''}>GET</option>
                        <option value="POST" ${rule.actions?.[0]?.method === 'POST' ? 'selected' : ''}>POST</option>
                        <option value="PUT" ${rule.actions?.[0]?.method === 'PUT' ? 'selected' : ''}>PUT</option>
                        <option value="DELETE" ${rule.actions?.[0]?.method === 'DELETE' ? 'selected' : ''}>DELETE</option>
                    </select>
                </div>
            </div>
            <div class="col-md-12">
                <div class="mb-3">
                    <label class="form-label">داده JSON (اختیاری)</label>
                    <textarea class="form-control" id="actionData${ruleNumber}" rows="3" style="border: 3px solid #808080 !important; background: rgba(255, 255, 255, 0.15) !important;">${rule.actions?.[0]?.data || ''}</textarea>
                </div>
            </div>
        `;
    } else if (actionType === 'mqtt_publish') {
        return `
            <div class="col-md-6">
                <div class="mb-3">
                    <label class="form-label">موضوع (Topic)</label>
                    <input type="text" class="form-control" id="actionTopic${ruleNumber}" value="${rule.actions?.[0]?.topic || ''}" style="border: 3px solid #808080 !important; background: rgba(255, 255, 255, 0.15) !important;">
                </div>
            </div>
            <div class="col-md-6">
                <div class="mb-3">
                    <label class="form-label">QoS</label>
                    <select class="form-select" id="actionQos${ruleNumber}" style="border: 3px solid #808080 !important; background: rgba(255, 255, 255, 0.15) !important;">
                        <option value="0" ${rule.actions?.[0]?.qos === 0 ? 'selected' : ''}>0 - At most once</option>
                        <option value="1" ${rule.actions?.[0]?.qos === 1 ? 'selected' : ''}>1 - At least once</option>
                        <option value="2" ${rule.actions?.[0]?.qos === 2 ? 'selected' : ''}>2 - Exactly once</option>
                    </select>
                </div>
            </div>
            <div class="col-md-12">
                <div class="mb-3">
                    <label class="form-label">پیام</label>
                    <textarea class="form-control" id="actionPayload${ruleNumber}" rows="3" style="border: 3px solid #808080 !important; background: rgba(255, 255, 255, 0.15) !important;">${rule.actions?.[0]?.payload || ''}</textarea>
                </div>
            </div>
        `;
    }
    
    return '';
}

// Update trigger fields when trigger type changes
function updateTriggerFields(ruleNumber) {
    const triggerType = document.getElementById(`triggerType${ruleNumber}`).value;
    const triggerFieldsContainer = document.getElementById(`triggerFields${ruleNumber}`);
    
    const dummyRule = {
        trigger: { type: triggerType }
    };
    
    triggerFieldsContainer.innerHTML = generateTriggerFields(dummyRule, ruleNumber);
}

// Update action fields when action type changes
function updateActionFields(ruleNumber) {
    const actionType = document.getElementById(`actionType${ruleNumber}`).value;
    const actionFieldsContainer = document.getElementById(`actionFields${ruleNumber}`);
    
    const dummyRule = {
        actions: [{ type: actionType }]
    };
    
    actionFieldsContainer.innerHTML = generateActionFields(dummyRule, ruleNumber);
}

// Add new automation rule
function addAutomationRule() {
    automationRuleCounter++;
    const newRule = {
        id: automationRuleCounter,
        name: `قانون ${automationRuleCounter}`,
        description: '',
        enabled: true,
        priority: 1,
        trigger: {
            type: 'time_based',
            time: '00:00',
            days_of_week: [1, 2, 3, 4, 5, 6, 7] // Default to all days
        },
        actions: [{
            type: 'gpio_output',
            pin_number: 0,
            state: 'high',
            duration_ms: 0
        }]
    };
    
    console.log('Adding new automation rule:', newRule);
    
    automationRules.push(newRule);
    
    const container = document.getElementById('automationRulesContainer');
    if (container) {
        const ruleHtml = createAutomationRuleHTML(newRule, automationRuleCounter);
        container.insertAdjacentHTML('beforeend', ruleHtml);
    }
    
    // Save updated rules to server
    saveAutomationRules();
    
    showNotification('قانون جدید اضافه شد و ذخیره شد', 'success');
}

// Remove automation rule
function removeAutomationRule(ruleNumber) {
    const ruleElement = document.getElementById(`automationRule${ruleNumber}`);
    if (ruleElement) {
        // Find the rule to be deleted for logging
        const ruleToDelete = automationRules.find(rule => rule.id === ruleNumber);
        console.log(`Removing rule ${ruleNumber}:`, ruleToDelete?.name || 'Unknown');
        
        ruleElement.remove();
        
        // Remove from automationRules array using the actual rule ID
        const beforeCount = automationRules.length;
        automationRules = automationRules.filter(rule => rule.id !== ruleNumber);
        const afterCount = automationRules.length;
        
        console.log(`Rules count: ${beforeCount} -> ${afterCount}`);
        console.log('Remaining rules:', automationRules.map(r => `${r.id}: ${r.name}`));
        
        // Regenerate all rules to fix numbering
        generateAutomationRules();
        
        // Save updated rules to server
        saveAutomationRules();
        
        showNotification('قانون حذف شد و تغییرات ذخیره شد', 'success');
    }
}

// Clear all automation rules
function clearAllAutomationRules() {
    if (confirm('آیا مطمئن هستید که می‌خواهید همه قوانین اتوماسیون را پاک کنید؟')) {
        automationRules = [];
        automationRuleCounter = 0;
        
        const container = document.getElementById('automationRulesContainer');
        if (container) {
            container.innerHTML = '';
        }
        
        // Save empty rules to server
        saveAutomationRules();
        
        showNotification('همه قوانین اتوماسیون پاک شدند و تغییرات ذخیره شد', 'success');
    }
}

// Update current time every second
setInterval(updateCurrentTime, 1000);

// Make GPIO Automation functions globally available
// Toggle automation rule enabled/disabled state
function toggleAutomationRule(ruleNumber) {
    const enabledElement = document.getElementById(`ruleEnabled${ruleNumber}`);
    if (enabledElement) {
        const currentValue = enabledElement.value;
        enabledElement.value = currentValue === 'true' ? 'false' : 'true';
        
        // Update the rule in automationRules array
        const ruleIndex = automationRules.findIndex(rule => rule.id === ruleNumber);
        if (ruleIndex !== -1) {
            automationRules[ruleIndex].enabled = enabledElement.value === 'true';
        }
        
        // Visual feedback
        const ruleCard = document.getElementById(`automationRule${ruleNumber}`);
        if (ruleCard) {
            if (enabledElement.value === 'false') {
                ruleCard.style.opacity = '0.6';
                ruleCard.style.border = '2px solid #dc3545';
            } else {
                ruleCard.style.opacity = '1';
                ruleCard.style.border = '2px solid #28a745';
            }
        }
        
        // Save the updated rules
        saveAutomationRules();
        
        console.log(`Rule ${ruleNumber} ${enabledElement.value === 'true' ? 'enabled' : 'disabled'}`);
    }
}

window.loadAutomationRules = loadAutomationRules;
window.saveAutomationRules = saveAutomationRules;
window.getAutomationStatus = getAutomationStatus;
window.addAutomationRule = addAutomationRule;
window.removeAutomationRule = removeAutomationRule;
window.clearAllAutomationRules = clearAllAutomationRules;
window.updateTriggerFields = updateTriggerFields;
window.updateActionFields = updateActionFields;
window.toggleAutomationRule = toggleAutomationRule;

// Add load button for Digital IO settings in HTML
// This should be added to the Digital IO settings section