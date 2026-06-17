// Global variables
let map, markers = {};
let isHistoryEnabled = false, 
    isSatelliteMode = false;
let deviceData = {}; // Store device data (coordinates, time, id)
let initialPositions = {}; // Store initial positions
let mqttClient = null; // MQTT.js client instance
let firstMessageReceived = false;

// Configuration
const CONFIG = {
    mqtt: {
        useSSL: true,
        keepAliveInterval: 60,
        reconnectTimeout: 5000
    },
    map: {
        defaultCenter: [32.4279, 53.6880],
        defaultZoom: 5,
        minZoom: 3,
        maxZoom: 18
    }
};

// Initialize when document is ready
$(document).ready(function() {
    // Dark mode functionality
    initDarkMode();
    
    // Check authentication
    if (!checkAuthentication()) {
        return;
    }
    
    // Initialize map
    initMap();
    
    // Add MQTT status indicator to the UI
    $('body').append(`
        <div id="mqtt-status" style="position: fixed; bottom: 70px; right: 10px; z-index: 1000; 
            background-color: rgba(0,0,0,0.7); color: white; padding: 5px 10px; 
            border-radius: 20px; font-size: 12px; display: none;">
            <i class="fas fa-plug me-1"></i> وضعیت MQTT: <span id="mqtt-status-text">قطع</span>
        </div>
    `);
    
    // Connect to MQTT
    connectToMQTT();
    
    // Initialize UI controls
    initUIControls();
});

// Dark mode initialization
function initDarkMode() {
    const darkModeSwitch = $('#darkModeSwitch');
    
    // Check for saved theme preference or prefer-color-scheme
    const savedTheme = localStorage.getItem('theme');
    const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');
    
    if (savedTheme === 'dark' || (!savedTheme && prefersDarkScheme.matches)) {
        document.documentElement.setAttribute('data-theme', 'dark');
        darkModeSwitch.prop('checked', true);
    }
    
    // Toggle dark mode
    darkModeSwitch.on('change', function() {
        if (this.checked) {
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.removeAttribute('data-theme');
            localStorage.setItem('theme', 'light');
        }
    });
}

// Check if user is authenticated
function checkAuthentication() {
    const mqttUser = sessionStorage.getItem('mqttuser');
    const mqttPass = sessionStorage.getItem('mqttpass');
    const mqttTopic = sessionStorage.getItem('mqtttopic');
    const chatTopic = sessionStorage.getItem('mqttchattopic');
    const userid = sessionStorage.getItem('userid');
    const session = sessionStorage.getItem('session');
    let macaddress = sessionStorage.getItem('macaddress');
    
    // If macaddress is not found, try to get it from selectedDeviceMacAddress
    if (!macaddress) {
        const selectedDeviceMacAddress = sessionStorage.getItem('selectedDeviceMacAddress');
        if (selectedDeviceMacAddress) {
            sessionStorage.setItem('macaddress', selectedDeviceMacAddress);
            macaddress = selectedDeviceMacAddress;
            console.log('MAC address copied from selectedDeviceMacAddress:', macaddress);
        }
    }

    if (!mqttUser || !mqttPass || !mqttTopic || !chatTopic) {
        Swal.fire({
            icon: 'error',
            title: 'خطای ورود',
            text: 'لطفاً ابتدا وارد سیستم شوید',
            confirmButtonText: 'تایید'
        });
		window.location.href = 'https://my.giot.ir';
        return false;
    }
    
    // Check if required session data for historical API is available
    if (!userid || !session || !macaddress) {
        console.warn('Some session data missing for historical API:', { userid, session, macaddress });
        // Don't block the app, just log the warning
    }
    
    return true;
}

// Initialize map
function initMap() {
    // Show loading animation before map loads
    $('#mapid').html(`
        <div class="d-flex justify-content-center align-items-center h-100">
            <div class="text-center">
                <div class="spinner-border text-primary mb-3" role="status">
                    <span class="visually-hidden">در حال بارگذاری...</span>
                </div>
                <p>در حال بارگذاری نقشه...</p>
            </div>
        </div>
    `);
    
    // Initialize map with smooth animation
    setTimeout(() => {
        $('#mapid').empty(); // Clear loading animation
        
        map = L.map('mapid', {
            center: CONFIG.map.defaultCenter,
            zoom: CONFIG.map.defaultZoom,
            minZoom: CONFIG.map.minZoom,
            maxZoom: CONFIG.map.maxZoom,
            zoomControl: false,
            attributionControl: false
        });
        
        // Add zoom control to top-right
        L.control.zoom({
            position: 'topright'
        }).addTo(map);
        
        // Add attribution control to bottom-right
        L.control.attribution({
            position: 'bottomright',
            prefix: 'ماهان الکترونیک پرنیا | Leaflet'
        }).addTo(map);
        
        // Add scale control
        L.control.scale({
            imperial: false,
            position: 'bottomleft'
        }).addTo(map);

        // Set map tiles
        updateMapTiles();
        
        // Add map loaded event
        map.whenReady(() => {
            // Add a subtle animation when map is ready
            $('.map-container').css('opacity', '0').animate({opacity: 1}, 500);
        });
    }, 500);
}

// Update map tiles based on satellite mode
function updateMapTiles() {
    // Remove previous layers
    map.eachLayer((layer) => {
        if (layer instanceof L.TileLayer) {
            map.removeLayer(layer);
        }
    });

    let tileLayer;
    if (isSatelliteMode) {
        // Satellite map
        tileLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}');
    } else {
        // Standard map
        tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png');
    }

    tileLayer.addTo(map);
}

// Initialize UI controls
function initUIControls() {
    // History toggle
    $('#historySwitchSwitch').on('change', function() {
        isHistoryEnabled = this.checked;
        
        // Update all device paths
        for (const deviceId in deviceData) {
            if (isHistoryEnabled) {
                deviceData[deviceId].polyline.setLatLngs(deviceData[deviceId].path);
                if (deviceData[deviceId].historyLine) {
                    deviceData[deviceId].historyLine.setStyle({ opacity: 0.7 });
                }
            } else {
                deviceData[deviceId].polyline.setLatLngs([]);
                if (deviceData[deviceId].historyLine) {
                    deviceData[deviceId].historyLine.setStyle({ opacity: 0 });
                }
            }
        }
    });
    
    // Map type toggle
    $('#mapTypeSwitch').on('change', function() {
        isSatelliteMode = this.checked;
        updateMapTiles();
    });
}

// Connect to MQTT server using MQTT.js v5
function connectToMQTT() {
    const mqttUser = sessionStorage.getItem('mqttuser');
    const mqttPass = sessionStorage.getItem('mqttpass');
    const mqttTopic = sessionStorage.getItem('mqtttopic');
    const chatTopic = sessionStorage.getItem('mqttchattopic'); // Using unified chat topic for MQTTv5
    const fullTopic = `${mqttTopic}/${chatTopic}`; // Construct the full topic path for MQTTv5
    
    // Show connecting status
    $('#locationInfo').html(`
        <div class="text-center p-4">
            <div class="spinner-border text-primary mb-3" role="status">
                <span class="visually-hidden">در حال اتصال...</span>
            </div>
            <p>در انتظار دریافت مختصات</p>
        </div>
    `);
    
    if (mqttClient && mqttClient.connected) {
        console.log('Already connected. Please disconnect first.');
        return;
    }
    if (mqttClient && mqttClient.connecting) {
        console.log('Connection attempt already in progress.');
        return;
    }
    
    // MQTT.js Connection
    const protocol = 'wss';
    const connectUrl = `${protocol}://mqttws.giot.ir`;
    const clientId = 'mqttjs_' + Math.random().toString(16).substr(2, 8);
    
    console.log(`Connecting to ${connectUrl} as ${clientId} (MQTT v5)...`);
    
    // Update status indicator
    $('#mqtt-status').show();
    $('#mqtt-status-text').text('در حال اتصال...');
    $('#mqtt-status').css('background-color', 'rgba(255,193,7,0.7)');
    
    // MQTT.js Connection Options for MQTTv5
    const options = {
        clientId: clientId,
        protocolVersion: 5, // MQTT version 5
        clean: true,        // Clean session
        keepalive: 60,      // Keep alive interval
        connectTimeout: 10000, // Connection timeout
        username: mqttUser,
        password: mqttPass,
        reconnectPeriod: 1000, // Auto reconnect period
        
        // Will message configuration for MQTTv5
        will: {
            topic: 'lwt/websocket/mqttwsuser/' + mqttUser,
            payload: 'Client has disconnected',
            qos: 1,
            retain: false
        }
    };
    
    // Create and connect the client
    mqttClient = mqtt.connect(connectUrl, options);
    
    // MQTT.js Event Handlers
    
    // Called when connection is established
    mqttClient.on('connect', (connack) => {
        console.log('Connect event fired. connack:', connack);
        if (connack.reasonCode === 0) {
            console.log('Connected successfully to MQTT broker!');
            
            // Update UI
            $('#mqtt-status').show();
            $('#mqtt-status-text').text('متصل');
            $('#mqtt-status').css('background-color', 'rgba(40,167,69,0.7)');
            
            // Subscribe to topic
            subscribeToTopic(fullTopic);
            
            // Show success notification
            Swal.fire({
                icon: 'success',
                title: 'اتصال موفق',
                text: `اتصال به سرور MQTT برقرار شد`,
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000
            });
        } else {
            console.log(`Connection Failed! Reason: ${connack.reasonString || connack.reasonCode} (Code: ${connack.reasonCode})`);
            $('#mqtt-status-text').text(`خطا: ${connack.reasonString || connack.reasonCode}`);
            $('#mqtt-status').css('background-color', 'rgba(220,53,69,0.7)');
            mqttClient.end(true);
        }
    });
    
    // Called when a message arrives
    mqttClient.on('message', (topic, payload, packet) => {
        const messageString = payload.toString();
        console.log('MQTT Message received:', messageString);
        try {
            let data;
            
            // Try to parse as JSON first
            try {
                data = JSON.parse(messageString);
            } catch (jsonError) {
                // If JSON parsing fails, try CSV format
                data = parseCSVData(messageString);
            }
            
            if (data && (data.latitude || data.lat) && (data.longitude || data.lng)) {
                processDeviceData(data);
                showMqttNotification(data);
                if (!firstMessageReceived) {
                    firstMessageReceived = true;
                    Swal.fire({
                        icon: 'success',
                        title: 'دریافت اطلاعات',
                        text: 'اولین داده موقعیت دریافت شد',
                        toast: true,
                        position: 'top-end',
                        showConfirmButton: false,
                        timer: 3000
                    });
                }
            }
        } catch (error) {
            console.error('Error processing MQTT message:', error);
            console.log('Raw message:', messageString);
        }
    });
    
    // Called when connection is lost
    mqttClient.on('close', () => {
        console.log('MQTT Connection closed');
        $('#mqtt-status').show();
        $('#mqtt-status-text').text('قطع');
        $('#mqtt-status').css('background-color', 'rgba(220,53,69,0.7)');
    });
    
    // Called when an error occurs
    mqttClient.on('error', (error) => {
        console.error('MQTT Connection error:', error);
        
        // Update connection status indicator
        $('#mqtt-status').show();
        $('#mqtt-status-text').text('خطا');
        $('#mqtt-status').css('background-color', 'rgba(220,53,69,0.7)');
        
        // Show error notification
        Swal.fire({
            icon: 'error',
            title: 'خطای اتصال',
            text: `اتصال به سرور MQTT با خطا مواجه شد: ${error.message}`,
            confirmButtonText: 'تلاش مجدد',
        }).then((result) => {
            if (result.isConfirmed) {
                setTimeout(connectToMQTT, CONFIG.mqtt.reconnectTimeout);
            }
        });
    });
    
    // Called when client goes offline
    mqttClient.on('offline', () => {
        console.log('MQTT Client went offline');
        $('#mqtt-status').show();
        $('#mqtt-status-text').text('آفلاین');
        $('#mqtt-status').css('background-color', 'rgba(108,117,125,0.7)');
    });
    
    // Called when client reconnects
    mqttClient.on('reconnect', () => {
        console.log('MQTT Client reconnecting...');
        $('#mqtt-status').show();
        $('#mqtt-status-text').text('در حال اتصال مجدد...');
        $('#mqtt-status').css('background-color', 'rgba(255,193,7,0.7)');
    });
}

// Function to subscribe to topic
function subscribeToTopic(topic) {
    if (mqttClient && mqttClient.connected) {
        mqttClient.subscribe(topic, { qos: 1 }, (error) => {
            if (error) {
                console.error('Subscription error:', error);
                Swal.fire({
                    icon: 'error',
                    title: 'خطای اشتراک',
                    text: `خطا در اشتراک تاپیک: ${error.message}`,
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 3000
                });
            } else {
                console.log(`Successfully subscribed to topic: ${topic}`);
            }
        });
    }
}

// Function to publish message to topic
function publishMessage(topic, message) {
    if (mqttClient && mqttClient.connected) {
        mqttClient.publish(topic, JSON.stringify(message), { qos: 1 }, (error) => {
            if (error) {
                console.error('Publish error:', error);
                Swal.fire({
                    icon: 'error',
                    title: 'خطای ارسال',
                    text: `خطا در ارسال پیام: ${error.message}`,
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 3000
                });
            } else {
                console.log(`Message published to topic: ${topic}`);
            }
        });
    } else {
        console.error('MQTT client is not connected');
        Swal.fire({
            icon: 'warning',
            title: 'عدم اتصال',
            text: 'کلاینت MQTT متصل نیست',
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3000
        });
    }
}

// Show MQTT notification
function showMqttNotification(data) {
    // Create a notification for new MQTT messages
    const toast = Swal.mixin({
        toast: true,
        position: 'bottom-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        didOpen: (toast) => {
            toast.addEventListener('mouseenter', Swal.stopTimer);
            toast.addEventListener('mouseleave', Swal.resumeTimer);
        }
    });
    
    // Show notification with device info
    const deviceName = data.DevicenickName || `دستگاه ${data.DeviceID}`;
    
    toast.fire({
        icon: 'info',
        title: `اطلاعات جدید از ${deviceName}`,
        html: `<small>موقعیت: ${data.latitude}, ${data.longitude}</small>`
    });
}

// Process device data from MQTT
// Parse CSV format data like: {1,1,32.6485N,51.6398E,0.00,1586,131.02,156,-68}
function parseCSVData(messageString) {
    try {
        // Remove curly braces and split by comma
        const cleanMessage = messageString.replace(/[{}]/g, '').trim();
        const parts = cleanMessage.split(',');
        
        if (parts.length < 4) {
            throw new Error('Invalid CSV format - not enough parts');
        }
        
        // Parse the data based on expected format
        // Format: {deviceId,status,latitude,longitude,speed,timestamp,battery,signal,rssi}
        const deviceId = parts[0] ? parts[0].trim() : '1';
        const status = parts[1] ? parts[1].trim() : '1';
        const latitudeStr = parts[2] ? parts[2].trim() : '';
        const longitudeStr = parts[3] ? parts[3].trim() : '';
        const speed = parts[4] ? parseFloat(parts[4].trim()) : 0;
        const timestamp = parts[5] ? parseInt(parts[5].trim()) : Math.floor(Date.now() / 1000);
        const battery = parts[6] ? parseFloat(parts[6].trim()) : 0;
        const signal = parts[7] ? parseInt(parts[7].trim()) : 0;
        const rssi = parts[8] ? parseInt(parts[8].trim()) : 0;
        
        // Parse latitude with N/S indicator
        let latitude;
        if (latitudeStr.includes('N')) {
            latitude = parseFloat(latitudeStr.replace('N', ''));
        } else if (latitudeStr.includes('S')) {
            latitude = -parseFloat(latitudeStr.replace('S', ''));
        } else {
            latitude = parseFloat(latitudeStr);
        }
        
        // Parse longitude with E/W indicator
        let longitude;
        if (longitudeStr.includes('E')) {
            longitude = parseFloat(longitudeStr.replace('E', ''));
        } else if (longitudeStr.includes('W')) {
            longitude = -parseFloat(longitudeStr.replace('W', ''));
        } else {
            longitude = parseFloat(longitudeStr);
        }
        
        // Validate coordinates
        if (isNaN(latitude) || isNaN(longitude)) {
            throw new Error('Invalid coordinates in CSV data');
        }
        
        // Return parsed data in expected format
        return {
            DeviceID: deviceId,
            DevicenickName: `دستگاه ${deviceId}`,
            latitude: latitude,
            longitude: longitude,
            lat: latitude,  // Alternative format
            lng: longitude, // Alternative format
            speed: speed,
            timestamp: timestamp,
            battery: battery,
            signal: signal,
            rssi: rssi,
            status: status,
            rawData: cleanMessage
        };
        
    } catch (error) {
        console.error('Error parsing CSV data:', error);
        console.log('Raw CSV message:', messageString);
        throw new Error(`خطا در تجزیه داده‌های CSV: ${error.message}`);
    }
}

function processDeviceData(data) {
    // Parse coordinates from string format (if needed)
    let lat, lng;
    
    // Handle different coordinate formats
    if (data.lat !== undefined && data.lng !== undefined) {
        // Already parsed coordinates
        lat = parseFloat(data.lat);
        lng = parseFloat(data.lng);
    } else if (data.latitude !== undefined && data.longitude !== undefined) {
        // Standard latitude/longitude format
        if (typeof data.latitude === 'string' && data.latitude.includes('N')) {
            lat = parseFloat(data.latitude.replace('N', ''));
        } else if (typeof data.latitude === 'string' && data.latitude.includes('S')) {
            lat = -parseFloat(data.latitude.replace('S', ''));
        } else {
            lat = parseFloat(data.latitude);
        }
        
        if (typeof data.longitude === 'string' && data.longitude.includes('E')) {
            lng = parseFloat(data.longitude.replace('E', ''));
        } else if (typeof data.longitude === 'string' && data.longitude.includes('W')) {
            lng = -parseFloat(data.longitude.replace('W', ''));
        } else {
            lng = parseFloat(data.longitude);
        }
    } else {
        console.error('No valid coordinates found in data:', data);
        return;
    }
    
    // Convert timestamp to Iran time using the provided epoch timestamp
    let iranTime;
    if (data.timestamp) {
        const timestamp = parseInt(data.timestamp) * 1000; // Convert to milliseconds
        const date = new Date(timestamp);
        
        // Format date to Iran timezone (UTC+3:30)
        iranTime = new Intl.DateTimeFormat('fa-IR', {
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric',
            timeZone: 'Asia/Tehran'
        }).format(date);
    } else {
        // Fallback if no timestamp provided
        iranTime = new Intl.DateTimeFormat('fa-IR', {
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric',
            timeZone: 'Asia/Tehran'
        }).format(new Date());
    }
    
    const deviceId = data.DeviceID || "unknown";
    const deviceName = data.DevicenickName || "دستگاه " + deviceId;
    
    updateLocation({
        lat: lat,
        lng: lng,
        deviceId: deviceId,
        deviceName: deviceName,
        timestamp: iranTime,
        rawData: data // Store all data for popup display
    });
}

// Update location on map
function updateLocation(locationData) {
    const { lat, lng, deviceId, deviceName, timestamp, rawData } = locationData;
    
    // Store device data
    if (!deviceData[deviceId]) {
        deviceData[deviceId] = {
            path: [],
            lastUpdate: timestamp,
            deviceName: deviceName,
            polyline: L.polyline([], {
                color: getRandomColor(), 
                weight: 3, 
                opacity: 0.7,
                dashArray: '5, 10',
                lineCap: 'round'
            }).addTo(map),
            historyLine: null
        };
    }
    
    // Update device path
    deviceData[deviceId].path.push([lat, lng]);
    deviceData[deviceId].lastUpdate = timestamp;
    deviceData[deviceId].rawData = rawData;
    deviceData[deviceId].deviceName = deviceName;
    
    // Remove old marker if exists
    if (markers[deviceId]) {
        map.removeLayer(markers[deviceId]);
    }
    
    // Create new marker with popup
    const markerIcon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="background-color: ${getComputedStyle(document.documentElement).getPropertyValue('--marker-color')}; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.3); position: relative; overflow: visible;">
            <div style="position: absolute; top: -2px; left: -2px; right: -2px; bottom: -2px; border-radius: 50%; background: transparent; border: 2px solid ${getComputedStyle(document.documentElement).getPropertyValue('--marker-color')}; opacity: 0.5; animation: pulse 1.5s infinite;"></div>
        </div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });
    
    // Create popup content with all available data
    let popupContent = `
        <div class="popup-content" style="direction: rtl; text-align: right;">
            <h5 class="mb-2">${deviceName}</h5>
            <p><strong>شناسه دستگاه:</strong> ${deviceId}</p>
            <p><strong>زمان:</strong> ${timestamp}</p>
            <p><strong>موقعیت:</strong> ${lat.toFixed(6)}, ${lng.toFixed(6)}</p>
    `;
    
    // Add additional data if available
    if (rawData) {
        if (rawData.DeviceMACAddress) {
            popupContent += `<p><strong>آدرس MAC:</strong> ${rawData.DeviceMACAddress}</p>`;
        }
        if (rawData.altitude) {
            popupContent += `<p><strong>ارتفاع:</strong> ${rawData.altitude} متر</p>`;
        }
        if (rawData.batterylevel) {
            popupContent += `<p><strong>باتری:</strong> ${rawData.batterylevel}</p>`;
        }
        if (rawData.speed) {
            popupContent += `<p><strong>سرعت:</strong> ${rawData.speed} کیلومتر/ساعت</p>`;
        }
        if (rawData.rssi) {
            popupContent += `<p><strong>قدرت سیگنال:</strong> ${rawData.rssi} dBm</p>`;
        }
        if (rawData.angle) {
            popupContent += `<p><strong>زاویه:</strong> ${rawData.angle}°</p>`;
        }
        if (rawData.GPSFixStatus) {
            const fixStatus = rawData.GPSFixStatus === "1" ? "فعال" : "غیرفعال";
            popupContent += `<p><strong>وضعیت GPS:</strong> ${fixStatus}</p>`;
        }
    }
    
    popupContent += `</div>`;
    
    const marker = L.marker([lat, lng], {icon: markerIcon}).addTo(map);
    marker.bindPopup(popupContent);
    
    markers[deviceId] = marker;
    
    // Update polyline if history is enabled
    if (isHistoryEnabled) {
        deviceData[deviceId].polyline.setLatLngs(deviceData[deviceId].path);
    } else {
        deviceData[deviceId].polyline.setLatLngs([]);
    }
    
    // Pan to the latest location
    map.panTo([lat, lng]);
    
    // Update location info panel
    updateLocationInfoPanel();
}

// Update location info panel
function updateLocationInfoPanel() {
    let infoHtml = '<div class="row"><div class="col-12"><h5 class="mb-3">اطلاعات دستگاه‌ها</h5></div></div>';
    
    for (const deviceId in deviceData) {
        const device = deviceData[deviceId];
        const lastPos = device.path[device.path.length - 1];
        
        if (lastPos) {
            const deviceColor = device.polyline.options.color;
            let additionalInfo = '';
            
            // Add additional info if available
            if (device.rawData) {
                if (device.rawData.batterylevel) {
                    additionalInfo += `<div class="col-md-3"><strong><i class="fas fa-battery-half me-2"></i>باتری:</strong> ${device.rawData.batterylevel}</div>`;
                }
                if (device.rawData.speed) {
                    additionalInfo += `<div class="col-md-3"><strong><i class="fas fa-tachometer-alt me-2"></i>سرعت:</strong> ${device.rawData.speed} کیلومتر/ساعت</div>`;
                }
            }
            
            infoHtml += `
                <div class="row mb-3 p-3 device-info-card" style="border-radius: 10px; border-right: 4px solid ${deviceColor}; background-color: rgba(var(--bs-light-rgb), 0.05); box-shadow: 0 3px 10px rgba(0,0,0,0.08); transition: all 0.3s ease;">
                    <div class="col-md-3"><strong><i class="fas fa-microchip me-2"></i>دستگاه:</strong> ${device.deviceName || deviceId}</div>
                    <div class="col-md-3"><strong><i class="fas fa-clock me-2"></i>آخرین بروزرسانی:</strong> ${device.lastUpdate}</div>
                    <div class="col-md-3"><strong><i class="fas fa-map-marker-alt me-2"></i>موقعیت:</strong> ${lastPos[0].toFixed(4)}, ${lastPos[1].toFixed(4)}</div>
                    ${additionalInfo}
                    <div class="col-12 mt-2 text-end">
                        <button class="btn btn-sm btn-outline-primary zoom-to-device" data-device="${deviceId}">
                            <i class="fas fa-search-location me-1"></i> بزرگنمایی
                        </button>
                    </div>
                </div>
            `;
        }
    }
    
    // Add empty state if no devices
    if (Object.keys(deviceData).length === 0) {
        infoHtml += `
            <div class="text-center p-4">
                <i class="fas fa-satellite-dish fa-3x mb-3" style="opacity: 0.5;"></i>
                <p>در انتظار دریافت اطلاعات دستگاه...</p>
            </div>
        `;
    }
    
    $('#locationInfo').html(infoHtml);
    
    // Add hover effect with JavaScript for better performance
    $('.device-info-card').hover(
        function() { $(this).css('transform', 'translateY(-3px)').css('box-shadow', '0 8px 15px rgba(0,0,0,0.15)'); },
        function() { $(this).css('transform', 'translateY(0)').css('box-shadow', '0 3px 10px rgba(0,0,0,0.08)'); }
    );
    
    // Add zoom to device functionality
    $('.zoom-to-device').on('click', function() {
        const deviceId = $(this).data('device');
        if (markers[deviceId]) {
            map.setView(markers[deviceId].getLatLng(), 15);
            markers[deviceId].openPopup();
        }
    });
}

// Generate random color for device paths
function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

// Format date to Persian format
function formatPersianDate(date) {
    return new Intl.DateTimeFormat('fa-IR', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        timeZone: 'Asia/Tehran'
    }).format(date);
}

// Format coordinates to readable format
function formatCoordinates(lat, lng) {
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

// تابع getLocationPreview برای نمایش موقعیت در فرمت مناسب
function getLocationPreview(dataString) {
    try {
        // Try to parse as JSON first
        const data = JSON.parse(dataString);
        
        // Check for different location formats
        if (data.lat && data.lng) {
            return `موقعیت: ${parseFloat(data.lat).toFixed(6)}, ${parseFloat(data.lng).toFixed(6)}`;
        } else if (data.latitude && data.longitude) {
            return `موقعیت: ${parseFloat(data.latitude).toFixed(6)}, ${parseFloat(data.longitude).toFixed(6)}`;
        } else if (data.gps && data.gps.lat && data.gps.lng) {
            return `موقعیت: ${parseFloat(data.gps.lat).toFixed(6)}, ${parseFloat(data.gps.lng).toFixed(6)}`;
        }
    } catch (e) {
        // If not JSON, try to parse as CSV format
        try {
            const parsedData = parseCSVData(dataString);
            if (parsedData && parsedData.latitude && parsedData.longitude) {
                return `موقعیت: ${parseFloat(parsedData.latitude).toFixed(6)}, ${parseFloat(parsedData.longitude).toFixed(6)}`;
            }
        } catch (csvError) {
            // If CSV parsing fails, try regex extraction
            const latMatch = dataString.match(/lat[=:]?\s*([+-]?\d*\.?\d+)/i);
            const lngMatch = dataString.match(/lng[=:]?\s*([+-]?\d*\.?\d+)/i) || 
                           dataString.match(/lon[=:]?\s*([+-]?\d*\.?\d+)/i);
            
            if (latMatch && lngMatch) {
                return `موقعیت: ${parseFloat(latMatch[1]).toFixed(6)}, ${parseFloat(lngMatch[1]).toFixed(6)}`;
            }
            
            // Try to extract coordinates from comma-separated values
            const parts = dataString.replace(/[{}]/g, '').split(',');
            if (parts.length >= 4) {
                const lat = parseFloat(parts[2]);
                const lng = parseFloat(parts[3]);
                if (!isNaN(lat) && !isNaN(lng)) {
                    return `موقعیت: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
                }
            }
        }
    }
    
    return 'موقعیت: نامشخص';
}

// Calculate distance between two points in kilometers
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
        Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    const d = R * c; // Distance in km
    return d;
}

function deg2rad(deg) {
    return deg * (Math.PI/180);
}

// Calculate speed from distance and time
function calculateSpeed(distance, timeInSeconds) {
    // Speed in km/h
    return (distance / (timeInSeconds / 3600)).toFixed(2);
}

// API function to get sensor data in time range
async function getSensorDataInTime(startTime, endTime) {
    const userid = sessionStorage.getItem('userid');
    const session = sessionStorage.getItem('session');
    const macaddress = sessionStorage.getItem('macaddress');
    
    console.log('Getting sensor data in time range:', { userid, session, macaddress, startTime, endTime });
    
    if (!userid || !session || !macaddress) {
        console.error('Required session data not found:', { userid, session, macaddress });
        Swal.fire({
            icon: 'error',
            title: 'خطای احراز هویت',
            text: 'اطلاعات جلسه یافت نشد. لطفاً مجدداً وارد شوید.',
            confirmButtonText: 'تایید'
        });
        return null;
    }
    
    // Prepare POST data
    const postData = {
        userid: userid,
        session: session,
        macaddress: macaddress,
        starttime: startTime,
        endtime: endTime
    };
    
    try {
        const response = await fetch('https://api.giot.ir/getsensordataintime', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(postData)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const responseText = await response.text();
        console.log('Raw API response (getSensorDataInTime):', responseText);
        
        let result;
        try {
            result = JSON.parse(responseText);
        } catch (parseError) {
            console.error('Error parsing API response:', parseError);
            throw new Error('پاسخ API قابل تجزیه نیست');
        }
        
        if (result.status === 'success' && result.data && Array.isArray(result.data)) {
            console.log('Successfully loaded sensor data in time range:', result);
            return result;
        } else {
            console.error('API returned error or no data:', result);
            Swal.fire({
                icon: 'error',
                title: 'خطا در دریافت داده‌ها',
                text: 'خطا در دریافت داده‌ها از سرور',
                confirmButtonText: 'تایید'
            });
            return null;
        }
        
    } catch (error) {
        console.error('Error loading sensor data in time:', error);
        Swal.fire({
            icon: 'error',
            title: 'خطا در بارگذاری داده‌ها',
            text: `خطا در بارگذاری داده‌ها: ${error.message}`,
            confirmButtonText: 'تایید'
        });
        return null;
    }
}

// Helper function to format date for API calls
function formatDateForAPI(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// Function to get data for a specific date range
async function getDataForDateRange(startDate, endDate) {
    const startTime = formatDateForAPI(startDate);
    const endTime = formatDateForAPI(endDate);
    
    return await getSensorDataInTime(startTime, endTime);
}

// Function to get data for last N days
async function getDataForLastDays(days) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    return await getDataForDateRange(startDate, endDate);
}

// Function to get data for today
async function getDataForToday() {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
    
    return await getDataForDateRange(startOfDay, endOfDay);
}

// UI Functions for Historical Data
function loadHistoricalData() {
    const startDateTime = document.getElementById('startDateTime').value;
    const endDateTime = document.getElementById('endDateTime').value;
    
    if (!startDateTime || !endDateTime) {
        Swal.fire({
            icon: 'warning',
            title: 'تاریخ ناقص',
            text: 'لطفاً تاریخ شروع و پایان را انتخاب کنید.',
            confirmButtonText: 'تایید'
        });
        return;
    }
    
    if (new Date(startDateTime) >= new Date(endDateTime)) {
        Swal.fire({
            icon: 'warning',
            title: 'تاریخ نامعتبر',
            text: 'تاریخ شروع باید قبل از تاریخ پایان باشد.',
            confirmButtonText: 'تایید'
        });
        return;
    }
    
    // Convert datetime-local format to API format
    const startTime = formatDateTimeLocalToAPI(startDateTime);
    const endTime = formatDateTimeLocalToAPI(endDateTime);
    
    loadDataAndDisplay(startTime, endTime);
}

function loadTodayData() {
    getDataForToday().then(result => {
        if (result) {
            displayHistoricalData(result);
        }
    });
}

function loadLastDaysData(days) {
    getDataForLastDays(days).then(result => {
        if (result) {
            displayHistoricalData(result);
        }
    });
}

async function loadDataAndDisplay(startTime, endTime) {
    // Show loading overlay
    const loadingOverlay = $(`
        <div class="loading-overlay">
            <div class="loading-content">
                <div class="loading-spinner"></div>
                <h5 class="text-center mt-3">در حال بارگذاری داده‌های تاریخی...</h5>
                <p class="text-center text-muted">لطفاً صبر کنید</p>
            </div>
        </div>
    `);
    $('body').append(loadingOverlay);
    
    try {
        const result = await getSensorDataInTime(startTime, endTime);
        loadingOverlay.remove();
        
        if (result) {
            displayHistoricalData(result);
        }
    } catch (error) {
        loadingOverlay.remove();
        console.error('Error loading historical data:', error);
        Swal.fire({
            icon: 'error',
            title: 'خطا',
            text: 'خطا در بارگذاری داده‌های تاریخی',
            confirmButtonText: 'تایید'
        });
    }
}

function displayHistoricalData(result) {
    if (!result || !result.data || result.data.length === 0) {
        $('#historicalDataResults').hide();
        Swal.fire({
            icon: 'info',
            title: 'اطلاعات',
            text: 'داده‌ای برای بازه زمانی انتخابی یافت نشد.',
            confirmButtonText: 'تایید'
        });
        return;
    }

    // Clear previous results
    $('#historicalDataTable tbody').empty();
    
    // Store data globally for actions
    window.historicalData = result.data;
    
    // Show only first 3 items initially
    const initialCount = Math.min(3, result.data.length);
    const hasMoreData = result.data.length > 3;
    
    // Populate table with initial items
    for (let index = 0; index < initialCount; index++) {
        const item = result.data[index];
        const row = `
            <tr class="data-row" data-index="${index}">
                <td>${new Date(item.time).toLocaleString('fa-IR')}</td>
                <td>
                    <div class="data-preview" title="${item.data}">
                        ${getLocationPreview(item.data)}
                    </div>
                </td>
                <td>
                    <span class="badge ${item.datadirection === 'R' ? 'bg-success' : 'bg-info'}">
                        ${item.datadirection === 'R' ? 'دریافت' : 'ارسال'}
                    </span>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-historical" onclick="showFullData(${index})" title="مشاهده کامل">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-historical" onclick="showOnMap('${item.data.replace(/'/g, "\'")}')") title="نمایش روی نقشه">
                            <i class="fas fa-map-marker-alt"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
        $('#historicalDataTable tbody').append(row);
    }
    
    // Add expand button if there are more items
    if (hasMoreData) {
        const expandRow = `
            <tr id="expandRow">
                <td colspan="4" class="text-center">
                    <button class="btn btn-outline-primary btn-expand-data" onclick="expandHistoricalData()" id="expandBtn">
                        <i class="fas fa-chevron-down me-2"></i>
                        نمایش ${result.data.length - 3} داده باقی‌مانده
                    </button>
                </td>
            </tr>
        `;
        $('#historicalDataTable tbody').append(expandRow);
    }

    // Show summary
    const inCount = result.data.filter(item => item.datadirection === 'R').length;
    const outCount = result.data.filter(item => item.datadirection !== 'R').length;
    const summary = `
        <div class="row text-center">
            <div class="col-md-4">
                <div class="d-flex align-items-center justify-content-center">
                    <i class="fas fa-database text-primary me-2"></i>
                    <div>
                        <strong>${result.data.length}</strong><br>
                        <small>کل رکوردها</small>
                    </div>
                </div>
            </div>
            <div class="col-md-4">
                <div class="d-flex align-items-center justify-content-center">
                    <i class="fas fa-download text-success me-2"></i>
                    <div>
                        <strong>${inCount}</strong><br>
                        <small>دریافتی</small>
                    </div>
                </div>
            </div>
            <div class="col-md-4">
                <div class="d-flex align-items-center justify-content-center">
                    <i class="fas fa-upload text-info me-2"></i>
                    <div>
                        <strong>${outCount}</strong><br>
                        <small>ارسالی</small>
                    </div>
                </div>
            </div>
        </div>
    `;
    $('#summaryContent').html(summary);
    
    // Store data for actions
    window.currentHistoricalData = result.data;
    
    // Show results
    $('#historicalDataResults').show();
    
    // Scroll to results
    $('#historicalDataResults')[0].scrollIntoView({ behavior: 'smooth' });
    
    Swal.fire({
        icon: 'success',
        title: 'موفق',
        text: `${result.data.length} رکورد یافت شد.`,
        confirmButtonText: 'تایید',
        timer: 2000
    });
}

function showFullData(index) {
    if (!window.currentHistoricalData || !window.currentHistoricalData[index]) {
        return;
    }
    
    const item = window.currentHistoricalData[index];
    
    Swal.fire({
        title: 'داده‌های کامل',
        html: `
            <div class="text-start">
                <p><strong>زمان:</strong> ${item.time}</p>
                <p><strong>جهت داده:</strong> ${item.datadirection === 'R' ? 'دریافت' : 'ارسال'}</p>
                <p><strong>داده‌ها:</strong></p>
                <pre class="bg-light p-2 rounded"><code>${JSON.stringify(JSON.parse(item.data), null, 2)}</code></pre>
            </div>
        `,
        width: '80%',
        confirmButtonText: 'بستن'
    });
}

function showOnMap(dataString) {
    try {
        let data;
        
        // Try to parse as JSON first
        try {
            data = JSON.parse(dataString);
        } catch (jsonError) {
            // If JSON parsing fails, try CSV format
            data = parseCSVData(dataString);
        }
        
        // Extract coordinates (supporting multiple formats)
        let lat, lng;
        
        if (data.lat !== undefined && data.lng !== undefined) {
            lat = parseFloat(data.lat);
            lng = parseFloat(data.lng);
        } else if (data.latitude !== undefined && data.longitude !== undefined) {
            // Handle string coordinates with N/S/E/W indicators
            if (typeof data.latitude === 'string' && data.latitude.includes('N')) {
                lat = parseFloat(data.latitude.replace('N', ''));
            } else if (typeof data.latitude === 'string' && data.latitude.includes('S')) {
                lat = -parseFloat(data.latitude.replace('S', ''));
            } else {
                lat = parseFloat(data.latitude);
            }
            
            if (typeof data.longitude === 'string' && data.longitude.includes('E')) {
                lng = parseFloat(data.longitude.replace('E', ''));
            } else if (typeof data.longitude === 'string' && data.longitude.includes('W')) {
                lng = -parseFloat(data.longitude.replace('W', ''));
            } else {
                lng = parseFloat(data.longitude);
            }
        } else if (data.gps && data.gps.lat && data.gps.lng) {
            lat = parseFloat(data.gps.lat);
            lng = parseFloat(data.gps.lng);
        } else {
            Swal.fire({
                icon: 'warning',
                title: 'موقعیت یافت نشد',
                text: 'در این داده موقعیت جغرافیایی یافت نشد.',
                confirmButtonText: 'تایید'
            });
            return;
        }
        
        if (isNaN(lat) || isNaN(lng)) {
            Swal.fire({
                icon: 'error',
                title: 'موقعیت نامعتبر',
                text: 'مختصات جغرافیایی نامعتبر است.',
                confirmButtonText: 'تایید'
            });
            return;
        }
        
        // Center map on this location
        map.setView([lat, lng], 15);
        
        // Add temporary marker
        const tempMarker = L.marker([lat, lng], {
            icon: L.divIcon({
                className: 'custom-marker historical-marker',
                html: '<i class="fas fa-history"></i>',
                iconSize: [30, 30]
            })
        }).addTo(map);
        
        // Remove marker after 10 seconds
        setTimeout(() => {
            map.removeLayer(tempMarker);
        }, 10000);
        
        // Show info popup with enhanced information
        let popupContent = `
            <div class="popup-content">
                <h6>موقعیت تاریخی</h6>
                <p><strong>مختصات:</strong> ${formatCoordinates(lat, lng)}</p>
        `;
        
        // Add timestamp information
        if (data.timestamp) {
            if (typeof data.timestamp === 'number') {
                const date = new Date(data.timestamp * 1000);
                const iranTime = new Intl.DateTimeFormat('fa-IR', {
                    year: 'numeric',
                    month: 'numeric',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: 'numeric',
                    second: 'numeric',
                    timeZone: 'Asia/Tehran'
                }).format(date);
                popupContent += `<p><strong>زمان:</strong> ${iranTime}</p>`;
            } else {
                popupContent += `<p><strong>زمان:</strong> ${data.timestamp}</p>`;
            }
        } else {
            popupContent += `<p><strong>زمان:</strong> نامشخص</p>`;
        }
        
        // Add additional information if available
        if (data.DeviceID) {
            popupContent += `<p><strong>شناسه دستگاه:</strong> ${data.DeviceID}</p>`;
        }
        if (data.speed !== undefined) {
            popupContent += `<p><strong>سرعت:</strong> ${data.speed} km/h</p>`;
        }
        if (data.battery !== undefined) {
            popupContent += `<p><strong>باتری:</strong> ${data.battery}%</p>`;
        }
        if (data.signal !== undefined) {
            popupContent += `<p><strong>سیگنال:</strong> ${data.signal}</p>`;
        }
        if (data.rssi !== undefined) {
            popupContent += `<p><strong>RSSI:</strong> ${data.rssi} dBm</p>`;
        }
        
        popupContent += `</div>`;
        
        tempMarker.bindPopup(popupContent).openPopup();
        
    } catch (error) {
        console.error('Error parsing location data:', error);
        Swal.fire({
            icon: 'error',
            title: 'خطا در تجزیه داده‌ها',
            text: 'نمی‌توان داده‌ها را تجزیه کرد.',
            confirmButtonText: 'تایید'
        });
    }
}

function formatDateTimeLocalToAPI(datetimeLocal) {
    // Convert from "YYYY-MM-DDTHH:MM" to "YYYY-MM-DD HH:MM:SS"
    return datetimeLocal.replace('T', ' ') + ':00';
}

// Initialize date inputs with default values
$(document).ready(function() {
    // Set default end time to now
    const now = new Date();
    const endDateTime = now.toISOString().slice(0, 16);
    document.getElementById('endDateTime').value = endDateTime;
    
    // Set default start time to 24 hours ago
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const startDateTime = yesterday.toISOString().slice(0, 16);
    document.getElementById('startDateTime').value = startDateTime;
});

// Function to expand historical data and show all items
function expandHistoricalData() {
    if (!window.historicalData) {
        return;
    }
    
    // Remove the expand row
    $('#expandRow').remove();
    
    // Add remaining items (starting from index 3)
    for (let index = 3; index < window.historicalData.length; index++) {
        const item = window.historicalData[index];
        const row = `
            <tr class="data-row" data-index="${index}">
                <td>${new Date(item.time).toLocaleString('fa-IR')}</td>
                <td>
                    <div class="data-preview" title="${item.data}">
                        ${getLocationPreview(item.data)}
                    </div>
                </td>
                <td>
                    <span class="badge ${item.datadirection === 'R' ? 'bg-success' : 'bg-info'}">
                        ${item.datadirection === 'R' ? 'دریافت' : 'ارسال'}
                    </span>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-historical" onclick="showFullData(${index})" title="مشاهده کامل">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-historical" onclick="showOnMap('${item.data.replace(/'/g, "\'")}')") title="نمایش روی نقشه">
                            <i class="fas fa-map-marker-alt"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
        $('#historicalDataTable tbody').append(row);
    }
    
    // Add collapse button
    const collapseRow = `
        <tr id="collapseRow">
            <td colspan="4" class="text-center">
                <button class="btn btn-outline-secondary btn-collapse-data" onclick="collapseHistoricalData()" id="collapseBtn">
                    <i class="fas fa-chevron-up me-2"></i>
                    بستن و نمایش فقط 3 داده اول
                </button>
            </td>
        </tr>
    `;
    $('#historicalDataTable tbody').append(collapseRow);
}

// Function to collapse historical data back to first 3 items
function collapseHistoricalData() {
    if (!window.historicalData) {
        return;
    }
    
    // Remove all rows except first 3
    $('#historicalDataTable tbody tr').each(function(index) {
        if (index >= 3) {
            $(this).remove();
        }
    });
    
    // Add expand button back
    const expandRow = `
        <tr id="expandRow">
            <td colspan="4" class="text-center">
                <button class="btn btn-outline-primary" onclick="expandHistoricalData()" id="expandBtn">
                    <i class="fas fa-chevron-down me-2"></i>
                    نمایش ${window.historicalData.length - 3} داده باقی‌مانده
                </button>
            </td>
        </tr>
    `;
    $('#historicalDataTable tbody').append(expandRow);
}

// تابع نمایش سوابق دریافتی تاریخی
function showReceivedDataHistory() {
    if (!window.historicalData || window.historicalData.length === 0) {
        Swal.fire({
            title: 'هیچ داده‌ای یافت نشد',
            text: 'ابتدا داده‌های تاریخی را بارگذاری کنید.',
            icon: 'warning',
            confirmButtonText: 'باشه'
        });
        return;
    }
    
    // فیلتر کردن داده‌های دریافتی (datadirection === 'R')
    const receivedData = window.historicalData.filter(item => item.datadirection === 'R');
    
    // ذخیره داده‌ها در متغیر سراسری برای استفاده در توابع دیگر
    window.currentReceivedData = receivedData;
    
    if (receivedData.length === 0) {
        Swal.fire({
            title: 'هیچ داده دریافتی یافت نشد',
            text: 'در بازه زمانی انتخاب شده هیچ داده دریافتی وجود ندارد.',
            icon: 'info',
            confirmButtonText: 'باشه'
        });
        return;
    }
    
    // ایجاد HTML برای نمایش داده‌های دریافتی
    let htmlContent = `
        <div class="received-data-history">
            <h6 class="mb-3">تعداد کل داده‌های دریافتی: ${receivedData.length}</h6>
            <div class="mb-3">
                <button class="btn btn-primary btn-map-display" onclick="showReceivedDataOnMap()">
                    <i class="fas fa-map me-1"></i>
                    نمایش مسیر روی نقشه
                </button>
            </div>
            <div class="table-responsive" style="max-height: 400px; overflow-y: auto;">
                <table class="table table-striped table-sm">
                    <thead class="table-dark">
                        <tr>
                            <th>زمان</th>
                            <th>موقعیت</th>
                            <th>عملیات</th>
                        </tr>
                    </thead>
                    <tbody>
    `;
    
    receivedData.forEach((item, index) => {
        const locationPreview = getLocationPreview(item.data);
        htmlContent += `
            <tr>
                <td>${item.time}</td>
                <td class="location-preview">${locationPreview}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary me-1" onclick="showReceivedDataDetails(${index})">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-success" onclick="showOnMap('${item.data.replace(/'/g, "\\'")}')"> 
                        <i class="fas fa-map-marker-alt"></i>
                    </button>
                </td>
            </tr>
        `;
    });
    
    htmlContent += `
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    // ذخیره داده‌های دریافتی برای استفاده در توابع دیگر
    window.currentReceivedData = receivedData;
    
    Swal.fire({
        title: 'سوابق دریافتی تاریخی',
        html: htmlContent,
        width: '90%',
        showCloseButton: true,
        confirmButtonText: 'بستن',
        customClass: {
            popup: 'received-data-popup'
        }
    });
}

// تابع نمایش جزئیات داده دریافتی
function showReceivedDataDetails(index) {
    if (!window.currentReceivedData || !window.currentReceivedData[index]) {
        return;
    }
    
    const item = window.currentReceivedData[index];
    
    let parsedData;
    try {
        parsedData = JSON.parse(item.data);
    } catch (e) {
        parsedData = item.data;
    }
    
    Swal.fire({
        title: 'جزئیات داده دریافتی',
        html: `
            <div class="text-start">
                <p><strong>زمان:</strong> ${item.time}</p>
                <p><strong>نوع:</strong> داده دریافتی</p>
                <p><strong>داده‌ها:</strong></p>
                <pre class="bg-light p-2 rounded"><code>${JSON.stringify(parsedData, null, 2)}</code></pre>
            </div>
        `,
        width: '80%',
        confirmButtonText: 'بستن'
    });
}

// متغیرهای سراسری برای ذخیره نقاط و خط مسیر سوابق دریافتی
let receivedDataMarkers = [];
let receivedDataPolyline = null;

// تابع نمایش مسیر سوابق دریافتی روی نقشه
function showReceivedDataOnMap() {
    if (!window.currentReceivedData || window.currentReceivedData.length === 0) {
        Swal.fire({
            title: 'خطا',
            text: 'هیچ داده دریافتی برای نمایش وجود ندارد.',
            icon: 'error',
            confirmButtonText: 'باشه'
        });
        return;
    }
    
    // پاک کردن نقاط و خطوط قبلی
    clearReceivedDataFromMap();
    
    const validLocations = [];
    
    // استخراج مختصات از داده‌های دریافتی
    window.currentReceivedData.forEach((item, index) => {
        let lat, lng;
        
        try {
            const data = JSON.parse(item.data);
            
            // بررسی فرمت‌های مختلف مختصات
            if (data.lat && data.lng) {
                lat = parseFloat(data.lat);
                lng = parseFloat(data.lng);
            } else if (data.latitude && data.longitude) {
                lat = parseFloat(data.latitude);
                lng = parseFloat(data.longitude);
            } else if (data.gps && data.gps.lat && data.gps.lng) {
                lat = parseFloat(data.gps.lat);
                lng = parseFloat(data.gps.lng);
            } else if (data.location && data.location.lat && data.location.lng) {
                lat = parseFloat(data.location.lat);
                lng = parseFloat(data.location.lng);
            }
        } catch (e) {
            // اگر داده JSON نیست، سعی کنیم از CSV پارس کنیم
            const csvData = parseCSVData(item.data);
            if (csvData && csvData.lat && csvData.lng) {
                lat = parseFloat(csvData.lat);
                lng = parseFloat(csvData.lng);
            }
        }
        
        if (!isNaN(lat) && !isNaN(lng)) {
            validLocations.push({
                lat: lat,
                lng: lng,
                time: item.time,
                index: index,
                data: item.data
            });
        }
    });
    
    if (validLocations.length === 0) {
        Swal.fire({
            title: 'هیچ موقعیت معتبری یافت نشد',
            text: 'در داده‌های دریافتی هیچ مختصات جغرافیایی معتبری یافت نشد.',
            icon: 'warning',
            confirmButtonText: 'باشه'
        });
        return;
    }
    
    // ایجاد نقاط روی نقشه
    validLocations.forEach((location, index) => {
        const markerIcon = L.divIcon({
            className: 'custom-marker received-data-marker',
            html: `<div style="background-color: #e74c3c; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 8px rgba(231, 76, 60, 0.6); position: relative;">
                <div style="position: absolute; top: -8px; left: -8px; width: 28px; height: 28px; border-radius: 50%; background: rgba(231, 76, 60, 0.2); animation: pulse 2s infinite;"></div>
            </div>`,
            iconSize: [16, 16],
            iconAnchor: [8, 8]
        });
        
        const marker = L.marker([location.lat, location.lng], {icon: markerIcon}).addTo(map);
        
        // محتوای پاپ‌آپ
        const popupContent = `
            <div class="popup-content" style="direction: rtl; text-align: right;">
                <h6 class="mb-2">نقطه ${index + 1}</h6>
                <p><strong>زمان:</strong> ${location.time}</p>
                <p><strong>موقعیت:</strong> ${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}</p>
                <p><strong>ترتیب:</strong> ${index + 1} از ${validLocations.length}</p>
            </div>
        `;
        
        marker.bindPopup(popupContent);
        receivedDataMarkers.push(marker);
    });
    
    // ایجاد خط مسیر
    if (validLocations.length > 1) {
        const pathCoordinates = validLocations.map(loc => [loc.lat, loc.lng]);
        
        receivedDataPolyline = L.polyline(pathCoordinates, {
            color: '#e74c3c',
            weight: 4,
            opacity: 0.8,
            dashArray: '10, 5',
            lineCap: 'round',
            lineJoin: 'round'
        }).addTo(map);
        
        // تنظیم نمای نقشه برای نمایش کل مسیر
        map.fitBounds(receivedDataPolyline.getBounds(), {padding: [20, 20]});
    } else {
        // اگر فقط یک نقطه داریم، روی آن متمرکز شویم
        map.setView([validLocations[0].lat, validLocations[0].lng], 15);
    }
    
    // بستن پاپ‌آپ و نمایش پیام موفقیت
    Swal.close();
    
    Swal.fire({
        title: 'مسیر نمایش داده شد',
        text: `${validLocations.length} نقطه و مسیر آن‌ها روی نقشه نمایش داده شد.`,
        icon: 'success',
        confirmButtonText: 'باشه',
        timer: 3000
    });
}

// تابع پاک کردن نقاط و خطوط سوابق دریافتی از نقشه
function clearReceivedDataFromMap() {
    // پاک کردن نقاط
    receivedDataMarkers.forEach(marker => {
        map.removeLayer(marker);
    });
    receivedDataMarkers = [];
    
    // پاک کردن خط مسیر
    if (receivedDataPolyline) {
        map.removeLayer(receivedDataPolyline);
        receivedDataPolyline = null;
    }
}
