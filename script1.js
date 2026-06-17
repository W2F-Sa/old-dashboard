// Global variables
let map, markers = {};
let isHistoryEnabled = false, 
    isSatelliteMode = false;
let deviceData = {}; // Store device data (coordinates, time, id)
let initialPositions = {}; // Store initial positions
let mqttClient = null;
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
    const mqttSendTopic = sessionStorage.getItem('mqttsendtopic');

    if (!mqttUser || !mqttPass || !mqttTopic || !mqttSendTopic) {
        Swal.fire({
            icon: 'error',
            title: 'خطای ورود',
            text: 'لطفاً ابتدا وارد سیستم شوید',
            confirmButtonText: 'تایید'
        });
		window.location.href = 'https://my.giot.ir';
        return false;
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

// Connect to MQTT server
function connectToMQTT() {
    const mqttUser = sessionStorage.getItem('mqttuser');
    const mqttPass = sessionStorage.getItem('mqttpass');
    const mqttTopic = sessionStorage.getItem('mqtttopic');
    const mqttSendTopic = sessionStorage.getItem('mqttsendtopic');
    const fullTopic = `${mqttTopic}/${mqttSendTopic}`;
    
    // Show connecting status
    $('#locationInfo').html(`
        <div class="text-center p-4">
            <div class="spinner-border text-primary mb-3" role="status">
                <span class="visually-hidden">در حال اتصال...</span>
            </div>
            <p>در انتظار دریافت مختصات</p>
        </div>
    `);
    
    // Generate a unique client ID
    const clientId = `ws_${Date.now()}_${Math.random().toString(36).substring(2, 16)}`;
    
    try {
        // Create MQTT client
        mqttClient = new Paho.MQTT.Client("wss://mqttws.giot.ir/mqtt", clientId);
        
        // Set callback handlers before connecting
        mqttClient.onConnectionLost = function(responseObject) {
            if (responseObject.errorCode !== 0) {
                console.error('MQTT Connection lost:', responseObject.errorMessage);
                
                // Update connection status indicator
                $('#mqtt-status').show();
                $('#mqtt-status-text').text('قطع');
                $('#mqtt-status').css('background-color', 'rgba(220,53,69,0.7)');
                
                // Show error notification
                Swal.fire({
                    icon: 'error',
                    title: 'قطع اتصال',
                    text: `اتصال به سرور MQTT قطع شد: ${responseObject.errorMessage}`,
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 5000
                });
                
                // Try to reconnect after delay
                setTimeout(connectToMQTT, CONFIG.mqtt.reconnectTimeout);
            }
        };
        
        mqttClient.onMessageArrived = function(message) {
            console.log('MQTT Message received:', message.payloadString);
            try {
                const data = JSON.parse(message.payloadString);
                if (data && data.latitude && data.longitude) {
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
            }
        };
        
        // Connection options
        const options = {
            useSSL: CONFIG.mqtt.useSSL,
            userName: mqttUser,
            password: mqttPass,
            keepAliveInterval: CONFIG.mqtt.keepAliveInterval,
            onSuccess: function() {
                console.log('MQTT Connected successfully');
                mqttClient.subscribe(fullTopic);
                
                // Update UI
                $('#mqtt-status').show();
                $('#mqtt-status-text').text('متصل');
                $('#mqtt-status').css('background-color', 'rgba(40,167,69,0.7)');
                
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
            },
            onFailure: function(message) {
                console.error('Connection failed:', message.errorMessage);
                
                // Show error notification
                Swal.fire({
                    icon: 'error',
                    title: 'خطای اتصال',
                    text: `اتصال به سرور MQTT با خطا مواجه شد: ${message.errorMessage}`,
                    confirmButtonText: 'تلاش مجدد',
                }).then((result) => {
                    if (result.isConfirmed) {
                        connectToMQTT();
                    }
                });
            }
        };
        
        // Connect
        mqttClient.connect(options);
        
    } catch (error) {
        console.error('Error creating MQTT client:', error);
        Swal.fire({
            icon: 'error',
            title: 'خطای MQTT',
            text: `خطا در ایجاد کلاینت MQTT: ${error.message}`,
            confirmButtonText: 'تایید'
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
function processDeviceData(data) {
    // Parse coordinates from string format (if needed)
    let lat, lng;
    
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
