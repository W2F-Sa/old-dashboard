$(document).ready(function() {
	CheckSesssion() ;
	updateGreeting()
	ChartInitialize() ;
	
	// Load devices list on page load
	loadDevicesList();
	
	// اضافه کردن کد مربوط به پنهان شدن خودکار سایدبار
	handleSidebarAutohide();
	
	// Initialize theme toggle
	initializeThemeToggle();
	
	// Initialize MQTT Console
	initializeMQTTConsole();

	
	$('#mobileSignOut').click(function(event) {
		event.preventDefault(); // Prevent the default link behavior
		// Your code to handle the mobile sign out goes here
		console.log('Mobile sign out link clicked');
		SignOut()
	});
	
});

// تابع مدیریت پنهان شدن خودکار سایدبار
function handleSidebarAutohide() {
    const sidebar = document.getElementById('sidebarMenu');
    const mainContent = document.querySelector('main');
    const navbarToggler = document.querySelector('.navbar-toggler');
    let sidebarTimer;
    
    if (sidebar && mainContent) {
        // پنهان کردن سایدبار در حالت موبایل هنگام کلیک روی محتوای اصلی
        mainContent.addEventListener('click', function() {
            if (window.innerWidth < 992 && sidebar.classList.contains('show')) {
                sidebar.classList.remove('show');
            }
        });
        
        // پنهان کردن سایدبار هنگام کلیک روی لینک‌های داخل آن
        const sidebarLinks = sidebar.querySelectorAll('a');
        sidebarLinks.forEach(link => {
            link.addEventListener('click', function() {
                if (window.innerWidth < 992 && sidebar.classList.contains('show')) {
                    sidebar.classList.remove('show');
                }
            });
        });
        
        // اضافه کردن قابلیت نمایش/پنهان کردن سایدبار با کلیک روی دکمه همبرگر
        if (navbarToggler) {
            navbarToggler.addEventListener('click', function() {
                sidebar.classList.toggle('show');
            });
        }
        
        // اضافه کردن قابلیت پنهان شدن خودکار سایدبار
        if (window.innerWidth < 992) {
            // اضافه کردن رویداد mouseenter برای نمایش سایدبار
            sidebar.addEventListener('mouseenter', function() {
                clearTimeout(sidebarTimer);
                sidebar.classList.add('show');
            });
            
            // اضافه کردن رویداد mouseleave برای پنهان کردن سایدبار
            sidebar.addEventListener('mouseleave', function() {
                sidebarTimer = setTimeout(function() {
                    sidebar.classList.remove('show');
                }, 1000); // تاخیر 1 ثانیه‌ای قبل از پنهان شدن
            });
            
            // اضافه کردن رویداد touchstart برای دستگاه‌های لمسی
            document.addEventListener('touchstart', function(e) {
                if (!sidebar.contains(e.target) && 
                    !navbarToggler.contains(e.target) && 
                    sidebar.classList.contains('show')) {
                    sidebar.classList.remove('show');
                }
            });
        }
    }
}

// اضافه کردن رویداد تغییر سایز پنجره برای مدیریت سایدبار
window.addEventListener('resize', function() {
    handleSidebarAutohide();
});

// Theme Toggle Functionality
function initializeThemeToggle() {
    const themeToggle = document.getElementById('theme-toggle');
    const body = document.body;
    
    // Check for saved theme preference or default to light mode
    const savedTheme = localStorage.getItem('theme') || 'light';
    
    // Apply saved theme
    if (savedTheme === 'dark') {
        body.setAttribute('data-theme', 'dark');
        themeToggle.checked = true;
    } else {
        body.setAttribute('data-theme', 'light');
        themeToggle.checked = false;
    }
    
    // Theme toggle event listener
    themeToggle.addEventListener('change', function() {
        if (this.checked) {
            // Switch to dark mode
            body.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
            showNotification('حالت تاریک فعال شد', 'OK');
        } else {
            // Switch to light mode
            body.setAttribute('data-theme', 'light');
            localStorage.setItem('theme', 'light');
            showNotification('حالت روشن فعال شد', 'OK');
        }
    });
    
    // Add smooth transition class after initial load
    setTimeout(() => {
        body.classList.add('theme-transition');
    }, 100);
}

// Function to get current theme
function getCurrentTheme() {
    return document.body.getAttribute('data-theme') || 'light';
}

// Function to toggle theme programmatically
function toggleTheme() {
    const themeToggle = document.getElementById('theme-toggle');
    themeToggle.click();
}

function showNotification(message, alarmtype) {
    var bgColor = "#d4edda" ;
	if (alarmtype === 'OK') {
		bgColor = "#d4edda" ;
		$('#OKnotificationSound')[0].play();
	}else	{
		bgColor = "#f8d7da" ;
		$('#AlarmnotificationSound')[0].play();
	}
	$('#notification').text(message)
                     .css('background', bgColor) // Set background color dynamically
                     .fadeIn()
                     .delay(3000)
                     .fadeOut('slow');
}

/*function senddatatoserver() {
	// Define the URL and the data object to send
	var url = "your-api-endpoint-url";
	var data = {
		key1: 'value1',
		key2: 'value2'
};
/ Retrieving data from sessionStorage
var data = sessionStorage.getItem('key');
console.log(data); // Outputs: 'value'

// Removing data from sessionStorage
sessionStorage.removeItem('key');

// Clearing all data from sessionStorage for the current domain
sessionStorage.clear();
*/

async function sha256(text) {
    // Encode input string as UTF-8
    const msgBuffer = new TextEncoder().encode(text); 
    
    // Hash the message
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    
    // Convert ArrayBuffer to Array
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    
    // Convert bytes to hex string
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

async function CheckSesssion()	{
	var _userid = sessionStorage.getItem('userid');
	var _session = sessionStorage.getItem('session');
	if( !_userid || !_session )	{
		showNotification("شما نشست فعالی ندارید و باید ابتدا لاگین کنید.", "Alarm");
		sessionStorage.clear();
		window.location.href = '../index.html';
	}
	var data = {
    	userid: _userid,
    	session: _session
    };
	try {
		const result = await postData(data, '/sessionvalidate');

		// No need to check if it's a string, as it's already an object
		if (result && result.status) {
			if (result.status === 'success') {
				showNotification("تایید امنیت نشست جاری", "OK");
			} else {
				showNotification("نشست شما معتبر شناسائی نشد لطفا لاگین کنید.", "Alarm");
				sessionStorage.clear();
				window.location.href = '../index.html';
			}
		}
	} catch (error) {
		// Handle errors from postData, including AJAX and potential parsing errors
		console.error("Error - ", error);
		showNotification("خطا در برقراری ارتباط با سرور ...", "Alarm");
	}
};

async function SignOut()	{
	var _userid = sessionStorage.getItem('userid');
	var _session = sessionStorage.getItem('session');
	if( !_userid || !_session )	{
		showNotification("شما نشست فعالی ندارید و باید ابتدا لاگین کنید.", "Alarm");
		sessionStorage.clear();
		window.location.href = '../index.html';
	}
	var data = {
    	userid: _userid,
    	session: _session
    };
	// Assuming postData returns a promise and '/authenticate' is the correct endpoint
    await postData(data, '/signout').then(result => {
    	// Assuming result is the JSON object directly (not a string)
    	// If result is a string, use JSON.parse(result) to convert it to an object
        // Check if result is a string and try to parse it
        if (typeof result === 'string') {
            try {
                result = JSON.parse(result);
            } catch (e) {
                console.error('Parsing error:', e);
                showNotification("خطا در پردازش پاسخ سرور", "Alarm");
                return;
            }
        }
    	// Check if the result contains the session key
    	if (result && result.status) {
			if(result.status === 'success')	{			
				console.log('You have successfully logged out');
				showNotification("شما با موفقیت خارج شدید", "OK") ;
				sessionStorage.clear();
				window.location.href = '../index.html';
			}else {
				// Construct an error message from the JSON response
				let errorMessage = "خطا در هنگام خروج از سامانه:\n";
				for (let key in result) {
					if (result.hasOwnProperty(key)) {
						errorMessage += `${key}: ${result[key]}\n`;
					}
				}
				showNotification(errorMessage, "Alarm");
				sessionStorage.clear();
				window.location.href = '../index.html';
			}
    	} else {
    		console.log('Error receiving logout response');
    		showNotification("خطای دریافت نتیجه خروج از سامانه", "Alarm") ;
			sessionStorage.clear();
			window.location.href = '../index.html';
    	}
    }).catch(error => {
    	console.log('Login request failed:', error);
    	showNotification("خطا در برقراری ارتباط با سرور ...", "Alarm") ;
    });
};

function ChartInitialize()	{
	// Initialize Account Status Chart
	const accountCanvas = document.getElementById("daysRemainingChart");
	if (!accountCanvas) {
		console.log("Chart canvas not found on this page");
		return;
	}
	const accountCtx = accountCanvas.getContext("2d");
	if (!accountCtx) {
        console.error("Failed to get account canvas context");
        return;
    }
	
	// Calculate days based on mqttvalidtime from session storage
	let remainingDays = 0;
	let passedDays = 0;
	const totalDays = 365; // Assuming 1 year subscription
	
	const mqttValidTime = sessionStorage.getItem('mqttvalidtime');
	if (mqttValidTime) {
		const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds (Epoch)
		const validTime = parseInt(mqttValidTime); // End time in seconds (Epoch)
		
		if (validTime > currentTime) {
			// Calculate remaining days
			remainingDays = Math.ceil((validTime - currentTime) / (24 * 60 * 60));
			passedDays = totalDays - remainingDays;
			
			// Ensure passed days is not negative
			if (passedDays < 0) {
				passedDays = 0;
				remainingDays = totalDays;
			}
		} else {
			// Account has expired
			remainingDays = 0;
			passedDays = totalDays;
		}
	} else {
		// Default values if mqttvalidtime is not available
		remainingDays = 30;
		passedDays = totalDays - remainingDays;
	}
	
	const accountChart = new Chart(accountCtx, {
        type: 'doughnut',
        data: {
            labels: ['روزهای باقیمانده', 'روزهای گذشته'],
            datasets: [{
                label: 'اعتبار حساب',
                data: [remainingDays, passedDays],
                backgroundColor: [
                    'rgba(46, 204, 113, 0.8)', // Green for remaining days
                    'rgba(231, 76, 60, 0.8)'   // Red for passed days
                ],
                borderColor: [
                    'rgba(46, 204, 113, 1)',
                    'rgba(231, 76, 60, 1)'
                ],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 20,
                        font: {
                            size: 12
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.label + ': ' + context.raw + ' روز';
                        }
                    }
                }
            },
            animation: {
                animateScale: true,
                animateRotate: true
            }
        }
    });
    
    // Initialize Device Activity Chart
    const deviceCanvas = document.getElementById("deviceActivityChart");
    if (deviceCanvas) {
        const deviceCtx = deviceCanvas.getContext("2d");
        if (!deviceCtx) {
            console.error("Failed to get device canvas context");
            return;
        }
        
        // Sample data for the past week
        const labels = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'];
        const deviceData = {
            connections: [65, 59, 80, 81, 56, 55, 72],
            dataTransmissions: [28, 48, 40, 19, 86, 27, 90]
        };
        
        const deviceChart = new Chart(deviceCtx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'اتصالات',
                        data: deviceData.connections,
                        borderColor: 'rgba(52, 152, 219, 1)',
                        backgroundColor: 'rgba(52, 152, 219, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4
                    },
                    {
                        label: 'انتقال داده',
                        data: deviceData.dataTransmissions,
                        borderColor: 'rgba(46, 204, 113, 1)',
                        backgroundColor: 'rgba(46, 204, 113, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            drawBorder: false,
                            color: 'rgba(0, 0, 0, 0.05)'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                }
            }
        });
    }
};
// Function to update the greeting text
function updateGreeting() {
    // Retrieve the stored name
    var shortname = sessionStorage.getItem('shortname');
	var familyname = sessionStorage.getItem('familyname');
	var userid = sessionStorage.getItem('userid');
    
    // Check if the greeting element exists before trying to update it
    const greetingElement = document.getElementById('main-greeting');
    if (greetingElement) {
        // Check if the name exists in sessionStorage
        if (shortname || familyname || userid) {
            // Update the content of the main greeting element
            greetingElement.innerHTML = `پنل کاربری ${shortname} ${familyname} عزیز - به داشبورد حرفه ای اینترنت اشیاء شرکت دانش بنیان ماهان الکترونیک پرنیا خوش آمدید`;
        } else {
            // Default text if no name is found
            greetingElement.innerHTML = 'به داشبورد حرفه ای اینترنت اشیاء شرکت دانش بنیان ماهان الکترونیک پرنیا خوش آمدید';
        }
    }
}

// Device Management Functions
function showAllDevices() {
    // Show modal or navigate to devices page
    alert('نمایش همه دستگاه‌ها - این قابلیت به زودی اضافه خواهد شد');
    console.log('Showing all devices...');
}

function showDeviceSettings() {
    // Show device settings modal
    const deviceName = prompt('نام جدید دستگاه را وارد کنید:');
    if (deviceName && deviceName.trim()) {
        alert(`نام دستگاه به "${deviceName}" تغییر یافت`);
        console.log('Device name changed to:', deviceName);
    }
}

function showDeleteDevice() {
    // Show delete confirmation
    const confirmDelete = confirm('آیا از حذف این دستگاه اطمینان دارید؟\nاین عمل قابل بازگشت نیست.');
    if (confirmDelete) {
        alert('دستگاه با موفقیت حذف شد');
        console.log('Device deleted');
    }
}

// Add device function (for future use)
function addNewDevice() {
    console.log('Redirecting to add device page...');
    // This will be handled by the href in HTML
}

// MQTT Console Variables
let mqttClient = null;
let isConnected = false;
let connectionStatus = 'disconnected';
let logCount = 0;
const MAX_LOGS = 1000;

// Device management variables
let devicesList = [];
let devicesMap = new Map(); // MAC Address -> Device mapping

// MQTT Configuration
const MQTT_CONFIG = {
    broker: 'wss://mqttws.giot.ir/',
    options: {
        clientId: 'dashboard_' + Math.random().toString(16).substr(2, 8),
        username: sessionStorage.getItem('mqttuser') || 'giot',
        password: sessionStorage.getItem('mqttpass') || 'giot123',
        keepalive: 60,
        reconnectPeriod: 1000,
        protocolId: 'MQTT',
        protocolVersion: 4,
        clean: true,
        encoding: 'utf8'
    }
};

// MQTT Topic - Combined from sessionStorage
const COMBINED_TOPIC = (sessionStorage.getItem('mqtttopic') || 'giot') + '/' + (sessionStorage.getItem('mqttchattopic') || 'request');

// Load devices list from API
async function loadDevicesList() {
    try {
        const session = sessionStorage.getItem('session');
        const userid = sessionStorage.getItem('userid');
        
        if (!session || !userid) {
            console.error('No session or userid found');
            return;
        }

        const requestData = {
            session: session,
            userid: userid
        };

        const response = await fetch(window.GIoTapiBaseUrl + '/getuserdevices', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });

        if (response.ok) {
            const data = await response.json();
            
            if (data.status === 'success' && data.devices) {
                devicesList = data.devices;
                
                // Create MAC address mapping
                devicesMap.clear();
                devicesList.forEach(device => {
                    if (device.macaddress) {
                        devicesMap.set(device.macaddress.toLowerCase(), device);
                    }
                });
                
                // Update active devices count
                updateActiveDevicesCount();
                
                console.log(`Loaded ${devicesList.length} devices`);
            } else {
                console.error('Invalid response format or no devices found');
            }
        } else {
            console.error('Failed to load devices list:', response.status);
        }
    } catch (error) {
        console.error('Error loading devices list:', error);
    }
}

// Update active devices count in dashboard
function updateActiveDevicesCount() {
    const activeCount = devicesList.length;
    const countElement = document.getElementById('activeDevicesCount');
    if (countElement) {
        countElement.textContent = activeCount;
    }
}

// Get device info by MAC address
function getDeviceByMacAddress(macAddress) {
    if (!macAddress) return null;
    return devicesMap.get(macAddress.toLowerCase()) || null;
}

// Initialize MQTT Console
function initializeMQTTConsole() {
    // Add event listeners
    $('#mqttConnectBtn').click(connectMQTT);
    $('#mqttDisconnectBtn').click(disconnectMQTT);
    $('#mqttClearBtn').click(clearLogs);
    
    // Initialize with disconnected state
    updateConnectionStatus('disconnected');
    
    addLogEntry('system', 'کنسول MQTT آماده است. در حال اتصال خودکار...', 'سیستم');
    
    // Auto-connect to MQTT on initialization
    setTimeout(function() {
        connectMQTT();
    }, 1000); // Wait 1 second before auto-connecting
}

// Connect to MQTT Broker
function connectMQTT() {
    if (isConnected) {
        addLogEntry('warning', 'قبلاً به بروکر متصل هستید', 'سیستم');
        return;
    }
    
    try {
        updateConnectionStatus('connecting');
        addLogEntry('info', 'در حال اتصال به بروکر MQTT...', 'سیستم');
        
        mqttClient = mqtt.connect(MQTT_CONFIG.broker, MQTT_CONFIG.options);
        
        mqttClient.on('connect', function() {
            isConnected = true;
            updateConnectionStatus('connected');
            addLogEntry('system', 'با موفقیت به بروکر MQTT متصل شدید', 'سیستم');
            
            // Subscribe to combined topic
            mqttClient.subscribe(COMBINED_TOPIC, function(err) {
                if (!err) {
                    addLogEntry('info', `سابسکرایب شد: ${COMBINED_TOPIC}`, 'سیستم');
                } else {
                    addLogEntry('error', `خطا در سابسکرایب: ${COMBINED_TOPIC} - ${err.message}`, 'سیستم');
                }
            });
        });
        
        mqttClient.on('message', function(topic, message) {
            try {
                const messageStr = message.toString();
                let parsedMessage;
                let deviceInfo = null;
                
                try {
                    parsedMessage = JSON.parse(messageStr);
                    
                    // Check for MAC address in the message
                    if (parsedMessage.DeviceMACAddress) {
                        deviceInfo = getDeviceByMacAddress(parsedMessage.DeviceMACAddress);
                    }
                    
                    // Add device-specific log entry
                    if (deviceInfo) {
                        addLogEntry('mqtt', JSON.stringify(parsedMessage, null, 2), topic, deviceInfo);
                    } else {
                        addLogEntry('mqtt', JSON.stringify(parsedMessage, null, 2), topic);
                    }
                } catch (e) {
                    addLogEntry('mqtt', messageStr, topic);
                }
            } catch (error) {
                addLogEntry('error', `خطا در پردازش پیام: ${error.message}`, topic);
            }
        });
        
        mqttClient.on('error', function(error) {
            addLogEntry('error', `خطای MQTT: ${error.message}`, 'سیستم');
            updateConnectionStatus('error');
        });
        
        mqttClient.on('close', function() {
            isConnected = false;
            updateConnectionStatus('disconnected');
            addLogEntry('warning', 'اتصال MQTT قطع شد', 'سیستم');
        });
        
        mqttClient.on('reconnect', function() {
            updateConnectionStatus('connecting');
            addLogEntry('info', 'تلاش برای اتصال مجدد...', 'سیستم');
        });
        
    } catch (error) {
        addLogEntry('error', `خطا در اتصال: ${error.message}`, 'سیستم');
        updateConnectionStatus('error');
    }
}

// Disconnect from MQTT Broker
function disconnectMQTT() {
    if (!isConnected || !mqttClient) {
        addLogEntry('warning', 'اتصالی برای قطع وجود ندارد', 'سیستم');
        return;
    }
    
    try {
        mqttClient.end();
        isConnected = false;
        updateConnectionStatus('disconnected');
        addLogEntry('info', 'اتصال MQTT قطع شد', 'سیستم');
    } catch (error) {
        addLogEntry('error', `خطا در قطع اتصال: ${error.message}`, 'سیستم');
    }
}

// Update Connection Status
function updateConnectionStatus(status) {
    connectionStatus = status;
    const statusElement = $('#mqttStatus');
    const statusText = $('#mqttStatusText');
    const connectBtn = $('#mqttConnectBtn');
    const disconnectBtn = $('#mqttDisconnectBtn');
    
    // Remove all status classes from both status element and status text
    statusElement.removeClass('connected connecting disconnected error');
    statusText.removeClass('connected connecting disconnected error');
    
    switch (status) {
        case 'connected':
            statusElement.addClass('connected');
            statusText.addClass('connected').text('متصل');
            connectBtn.prop('disabled', true);
            disconnectBtn.prop('disabled', false);
            break;
        case 'connecting':
            statusElement.addClass('connecting');
            statusText.addClass('connecting').text('در حال اتصال...');
            connectBtn.prop('disabled', true);
            disconnectBtn.prop('disabled', true);
            break;
        case 'disconnected':
            statusElement.addClass('disconnected');
            statusText.addClass('disconnected').text('قطع شده');
            connectBtn.prop('disabled', false);
            disconnectBtn.prop('disabled', true);
            break;
        case 'error':
            statusElement.addClass('error');
            statusText.addClass('error').text('خطا در اتصال');
            connectBtn.prop('disabled', false);
            disconnectBtn.prop('disabled', true);
            break;
    }
}

// Add Log Entry
function addLogEntry(type, message, source, deviceInfo = null) {
    const now = new Date();
    const timestamp = `[${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}]`;
    const logContainer = $('#mqttLogs');
    
    // Limit number of logs
    if (logCount >= MAX_LOGS) {
        logContainer.find('.log-entry:first').remove();
    } else {
        logCount++;
    }
    
    // Create device header if device info is available
     let deviceHeader = '';
     if (deviceInfo && deviceInfo.devicenickname) {
         deviceHeader = `<div class="device-header">پیام از دستگاه: ${deviceInfo.devicenickname}</div>`;
     }
    
    const formattedMessage = formatMessage(message);
    
    // For device messages, show only 1/3 of the message by default
    let displayMessage = formattedMessage;
    let isCollapsible = false;
    
    if (deviceInfo && formattedMessage.length > 100) {
        const oneThird = Math.floor(formattedMessage.length / 3);
        displayMessage = formattedMessage.substring(0, oneThird) + '...';
        isCollapsible = true;
    }
    
    const expandButton = isCollapsible ? 
        `<span class="expand-btn" title="نمایش کامل پیام">▼</span>` : '';
    
    const logEntry = $(`
        <div class="log-entry ${type}" data-collapsed="${isCollapsible}">
            ${deviceHeader}
            <span class="timestamp">${timestamp}</span>
            <span class="level ${type}">${getLogTypeLabel(type)}</span>
            <span class="message" data-full-text="${formattedMessage.replace(/"/g, '&quot;')}" data-short-text="${displayMessage.replace(/"/g, '&quot;')}"></span>
            ${expandButton}
        </div>
    `);
    
    // Add click handler for expand button
    if (isCollapsible) {
        logEntry.find('.expand-btn').click(function() {
            const messageSpan = logEntry.find('.message');
            const expandBtn = $(this);
            const isCollapsed = logEntry.attr('data-collapsed') === 'true';
            
            if (isCollapsed) {
                // Expand
                messageSpan.empty();
                typewriterEffect(messageSpan, formattedMessage, 15);
                expandBtn.text('▲').attr('title', 'کوتاه کردن پیام');
                logEntry.attr('data-collapsed', 'false');
            } else {
                // Collapse
                messageSpan.empty();
                typewriterEffect(messageSpan, displayMessage, 15);
                expandBtn.text('▼').attr('title', 'نمایش کامل پیام');
                logEntry.attr('data-collapsed', 'true');
            }
        });
    }
    
    logContainer.append(logEntry);
    
    // Auto scroll to bottom
    logContainer.scrollTop(logContainer[0].scrollHeight);
    
    // Add animation and typewriter effect
    logEntry.hide().fadeIn(300, function() {
        typewriterEffect(logEntry.find('.message'), displayMessage, 30); // 30ms delay between characters
    });
}

// Typewriter effect function
function typewriterEffect(element, text, speed = 50) {
    element.empty();
    let i = 0;
    
    // Handle HTML content
    if (text.includes('<div class="json-data">')) {
        // For JSON data, show it instantly but with typing effect on the content
        const jsonMatch = text.match(/<div class="json-data">(.*?)<\/div>/s);
        if (jsonMatch) {
            const jsonContent = jsonMatch[1];
            element.html('<div class="json-data"></div>');
            const jsonDiv = element.find('.json-data');
            typewriterPlainText(jsonDiv, jsonContent, speed);
            return;
        }
    }
    
    // For plain text
    typewriterPlainText(element, text, speed);
}

// Typewriter effect for plain text
function typewriterPlainText(element, text, speed) {
    let i = 0;
    const timer = setInterval(function() {
        if (i < text.length) {
            element.text(element.text() + text.charAt(i));
            i++;
            
            // Auto scroll to bottom during typing
            const logContainer = $('#mqttLogs');
            logContainer.scrollTop(logContainer[0].scrollHeight);
        } else {
            clearInterval(timer);
        }
    }, speed);
}

// Get Log Type Label
function getLogTypeLabel(type) {
    const labels = {
        'system': 'سیستم',
        'info': 'اطلاعات',
        'warning': 'هشدار',
        'error': 'خطا',
        'mqtt': 'MQTT'
    };
    return labels[type] || type;
}

// Format Message
function formatMessage(message) {
    if (typeof message === 'object') {
        return `<div class="json-data">${JSON.stringify(message, null, 2)}</div>`;
    }
    
    // Check if message is JSON string
    try {
        const parsed = JSON.parse(message);
        return `<div class="json-data">${JSON.stringify(parsed, null, 2)}</div>`;
    } catch (e) {
        // Not JSON, return as is but escape HTML
        return $('<div>').text(message).html();
    }
}

// Clear Logs
function clearLogs() {
    $('#mqttLogs').empty();
    logCount = 0;
    addLogEntry('system', 'لاگ‌ها پاک شدند', 'سیستم');
}