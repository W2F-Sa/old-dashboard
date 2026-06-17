// ===== ADD DEVICE PAGE JAVASCRIPT =====

// Global variables
let html5QrCode = null;
let isScanning = false;


// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function() {
    initializePage();
    setupEventListeners();
    validateSession();
    setupInputValidation();
    initializeTheme();
    
    // Performance monitoring
    if (window.performance && window.performance.mark) {
        window.performance.mark('add-device-page-loaded');
    }
});

// ===== THEME MANAGEMENT =====
function initializeTheme() {
    const savedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme) {
        setTheme(savedTheme);
    } else if (systemPrefersDark) {
        setTheme('dark');
    } else {
        setTheme('light');
    }
    
    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem('theme')) {
            setTheme(e.matches ? 'dark' : 'light');
        }
    });
    
    // Add theme toggle button if it doesn't exist
    addThemeToggleButton();
}

function setTheme(theme) {
    document.documentElement.className = document.documentElement.className.replace(/theme-\w+/g, '');
    document.documentElement.classList.add(`theme-${theme}`);
    
    // Update theme toggle icon
    const themeToggle = document.querySelector('.theme-toggle i');
    if (themeToggle) {
        themeToggle.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    }
    
    // Save theme preference
    localStorage.setItem('theme', theme);
    
    // Dispatch theme change event
    window.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme } }));
}

function toggleTheme() {
    const currentTheme = localStorage.getItem('theme') || 
        (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    
    // Show notification
    showNotification(
        `حالت ${newTheme === 'dark' ? 'شب' : 'روز'} فعال شد`,
        'success'
    );
}

function addThemeToggleButton() {
    // Check if theme toggle already exists
    if (document.querySelector('.theme-toggle')) {
        return;
    }
    
    // Find navigation or create one
    let nav = document.querySelector('.glass-nav');
    if (!nav) {
        nav = document.createElement('nav');
        nav.className = 'glass-nav';
        document.body.insertBefore(nav, document.body.firstChild);
    }
    
    // Create theme toggle button
    const themeToggle = document.createElement('button');
    themeToggle.className = 'theme-toggle';
    themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
    themeToggle.title = 'تغییر تم';
    themeToggle.setAttribute('aria-label', 'تغییر تم');
    
    // Add click event
    themeToggle.addEventListener('click', toggleTheme);
    
    // Add to navigation
    nav.appendChild(themeToggle);
    
    // Update icon based on current theme
    const currentTheme = localStorage.getItem('theme') || 
        (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    themeToggle.querySelector('i').className = currentTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
}

// ===== PAGE INITIALIZATION =====
function initializePage() {
    // Get session data
    userid = sessionStorage.getItem('userid');
    session = sessionStorage.getItem('session');
    
    console.log('Initializing Add Device Page...');
    console.log('User ID:', userid);
    console.log('Session:', session ? 'Available' : 'Not found');
    
    // Check if session data exists
    if (!userid || !session) {
        showNotification('لطفاً ابتدا وارد سیستم شوید', 'error');
        setTimeout(() => {
            window.location.href = '../index.html';
        }, 2000);
        return;
    }
    
    // Initialize QR code scanner
    initializeQRScanner();
    
    // Add input validation
    setupInputValidation();
}

// ===== EVENT LISTENERS =====
function setupEventListeners() {
    // Device ID input
    const deviceIdInput = document.getElementById('deviceId');
    if (deviceIdInput) {
        deviceIdInput.addEventListener('input', handleDeviceIdInput);
        deviceIdInput.addEventListener('paste', handleDeviceIdPaste);
    }
    
    // Device nickname input
    const deviceNicknameInput = document.getElementById('deviceNickname');
    if (deviceNicknameInput) {
        deviceNicknameInput.addEventListener('input', handleFormValidation);
    }
    
    // Device password input
    const devicePasswordInput = document.getElementById('devicePassword');
    if (devicePasswordInput) {
        devicePasswordInput.addEventListener('input', handleFormValidation);
    }
    
    // Device type select
    const deviceTypeSelect = document.getElementById('deviceType');
    if (deviceTypeSelect) {
        deviceTypeSelect.addEventListener('change', handleFormValidation);
    }
    
    // QR Scanner button
    const startScanBtn = document.getElementById('startScanBtn');
    if (startScanBtn) {
        startScanBtn.addEventListener('click', toggleQRScanner);
    }
    
    // Add device button
    const addDeviceBtn = document.getElementById('addDeviceBtn');
    if (addDeviceBtn) {
        addDeviceBtn.addEventListener('click', handleAddDevice);
    }
    
    // Clear button
    const clearBtn = document.getElementById('clearBtn');
    if (clearBtn) {
        clearBtn.addEventListener('click', handleClearForm);
    }
    
    // Theme toggle button
    const themeToggle = document.querySelector('.theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }
    
    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);
}

// ===== SESSION VALIDATION =====
async function validateSession() {
    if (!userid || !session) {
        return;
    }
    
    try {
        const data = {
            userid: userid,
            session: session
        };
        
        const result = await postData(data, '/sessionvalidate');
        
        if (result && result.status === 'success') {
            console.log('Session validated successfully');
        } else {
            console.log('Session validation failed');
            showNotification('جلسه شما منقضی شده است. لطفاً مجدداً وارد شوید', 'error');
            setTimeout(() => {
                sessionStorage.clear();
                window.location.href = '../index.html';
            }, 2000);
        }
    } catch (error) {
        console.error('Session validation error:', error);
        showNotification('خطا در اعتبارسنجی جلسه', 'error');
    }
}

// ===== INPUT HANDLING =====
function handleDeviceIdInput(event) {
    const input = event.target;
    const value = input.value.trim();
    const inputGroup = input.closest('.glass-input-group');
    const helpText = inputGroup ? inputGroup.querySelector('.input-help') : null;
    
    // Add has-value class for styling
    if (value) {
        input.classList.add('has-value');
    } else {
        input.classList.remove('has-value');
    }
    
    // Validate device ID
    const isValid = validateDeviceId(value);
    
    if (inputGroup && helpText) {
        if (value === '') {
            inputGroup.classList.remove('valid', 'invalid');
            helpText.innerHTML = '<i class="fas fa-info-circle me-1"></i>شناسه دستگاه معمولاً روی برچسب دستگاه درج شده است';
            helpText.style.color = 'var(--text-muted)';
        } else if (isValid) {
            inputGroup.classList.remove('invalid');
            inputGroup.classList.add('valid');
            helpText.innerHTML = '<i class="fas fa-check-circle me-1"></i>شناسه دستگاه معتبر است';
            helpText.style.color = 'var(--success-color)';
        } else {
            inputGroup.classList.remove('valid');
            inputGroup.classList.add('invalid');
            helpText.innerHTML = '<i class="fas fa-exclamation-circle me-1"></i>شناسه دستگاه باید 8 کاراکتر هگزادسیمال باشد';
            helpText.style.color = 'var(--error-color)';
        }
    }
    
    // Check overall form validation
    handleFormValidation();
}

function handleFormValidation() {
    const deviceIdInput = document.getElementById('deviceId');
    const deviceNicknameInput = document.getElementById('deviceNickname');
    const deviceTypeSelect = document.getElementById('deviceType');
    const devicePasswordInput = document.getElementById('devicePassword');
    const addDeviceBtn = document.getElementById('addDeviceBtn');
    
    const deviceId = deviceIdInput ? deviceIdInput.value.trim() : '';
    const nickname = deviceNicknameInput ? deviceNicknameInput.value.trim() : '';
    const deviceType = deviceTypeSelect ? deviceTypeSelect.value : '';
    const devicePassword = devicePasswordInput ? devicePasswordInput.value.trim() : '';
    
    // Check if all required fields are valid
    const isDeviceIdValid = validateDeviceId(deviceId);
    const isNicknameValid = nickname.length > 0;
    const isDeviceTypeValid = deviceType !== '';
    const isDevicePasswordValid = devicePassword.length >= 4; // Minimum 4 characters for password
    
    // Update nickname input styling
    if (deviceNicknameInput) {
        const nicknameInputGroup = deviceNicknameInput.closest('.glass-input-group');
        const nicknameHelpText = nicknameInputGroup ? nicknameInputGroup.querySelector('.input-help') : null;
        
        if (nickname) {
            deviceNicknameInput.classList.add('has-value');
        } else {
            deviceNicknameInput.classList.remove('has-value');
        }
        
        if (nicknameInputGroup && nicknameHelpText) {
            if (nickname === '') {
                nicknameInputGroup.classList.remove('valid', 'invalid');
                nicknameHelpText.innerHTML = '<i class="fas fa-info-circle me-1"></i>نام مستعار برای شناسایی آسان‌تر دستگاه';
                nicknameHelpText.style.color = 'var(--text-muted)';
            } else if (isNicknameValid) {
                nicknameInputGroup.classList.remove('invalid');
                nicknameInputGroup.classList.add('valid');
                nicknameHelpText.innerHTML = '<i class="fas fa-check-circle me-1"></i>نام مستعار معتبر است';
                nicknameHelpText.style.color = 'var(--success-color)';
            }
        }
    }
    
    // Update device type styling
    if (deviceTypeSelect) {
        const typeInputGroup = deviceTypeSelect.closest('.glass-input-group');
        const typeHelpText = typeInputGroup ? typeInputGroup.querySelector('.input-help') : null;
        
        if (deviceType) {
            deviceTypeSelect.classList.add('has-value');
        } else {
            deviceTypeSelect.classList.remove('has-value');
        }
        
        if (typeInputGroup && typeHelpText) {
            if (deviceType === '') {
                typeInputGroup.classList.remove('valid', 'invalid');
                typeHelpText.innerHTML = '<i class="fas fa-info-circle me-1"></i>نوع دستگاه IoT خود را مشخص کنید';
                typeHelpText.style.color = 'var(--text-muted)';
            } else if (isDeviceTypeValid) {
                typeInputGroup.classList.remove('invalid');
                typeInputGroup.classList.add('valid');
                typeHelpText.innerHTML = '<i class="fas fa-check-circle me-1"></i>نوع دستگاه انتخاب شد';
                typeHelpText.style.color = 'var(--success-color)';
            }
        }
    }
    
    // Update device password input styling
    if (devicePasswordInput) {
        const passwordInputGroup = devicePasswordInput.closest('.glass-input-group');
        const passwordHelpText = passwordInputGroup ? passwordInputGroup.parentElement.querySelector('.input-help') : null;
        
        if (devicePassword) {
            devicePasswordInput.classList.add('has-value');
        } else {
            devicePasswordInput.classList.remove('has-value');
        }
        
        if (passwordInputGroup && passwordHelpText) {
            if (devicePassword === '') {
                passwordInputGroup.classList.remove('valid', 'invalid');
                passwordHelpText.innerHTML = '<i class="fas fa-info-circle me-1"></i>رمز امنیتی دستگاه برای احراز هویت';
                passwordHelpText.style.color = 'var(--text-muted)';
            } else if (isDevicePasswordValid) {
                passwordInputGroup.classList.remove('invalid');
                passwordInputGroup.classList.add('valid');
                passwordHelpText.innerHTML = '<i class="fas fa-check-circle me-1"></i>رمز دستگاه معتبر است';
                passwordHelpText.style.color = 'var(--success-color)';
            } else {
                passwordInputGroup.classList.remove('valid');
                passwordInputGroup.classList.add('invalid');
                passwordHelpText.innerHTML = '<i class="fas fa-exclamation-circle me-1"></i>رمز دستگاه باید حداقل 4 کاراکتر باشد';
                passwordHelpText.style.color = 'var(--error-color)';
            }
        }
    }
    
    // Enable/disable add button based on all validations
    if (addDeviceBtn) {
        addDeviceBtn.disabled = !(isDeviceIdValid && isNicknameValid && isDeviceTypeValid && isDevicePasswordValid);
    }
}

function handleDeviceIdPaste(event) {
    setTimeout(() => {
        handleDeviceIdInput(event);
    }, 10);
}

function validateDeviceId(deviceId) {
    const inputGroup = document.querySelector('.glass-input-group');
    const helpText = document.querySelector('.input-help');
    
    if (!deviceId) {
        inputGroup.classList.remove('valid', 'invalid');
        return true;
    }
    
    // Hex validation - only 0-9 and a-f (case insensitive)
    const hexPattern = /^[0-9a-fA-F]+$/;
    const isValidHex = hexPattern.test(deviceId);
    const isValidLength = deviceId.length >= 6;
    const isValid = isValidHex && isValidLength;
    
    if (isValid) {
        inputGroup.classList.add('valid');
        inputGroup.classList.remove('invalid');
        if (helpText) {
            helpText.innerHTML = '<i class="fas fa-check-circle me-1"></i>شناسه دستگاه معتبر است';
            helpText.style.color = 'var(--success-color)';
        }
    } else {
        inputGroup.classList.add('invalid');
        inputGroup.classList.remove('valid');
        if (helpText) {
            if (!isValidHex) {
                helpText.innerHTML = '<i class="fas fa-exclamation-circle me-1"></i>شناسه دستگاه باید فقط شامل اعداد (0-9) و حروف a تا f باشد';
            } else if (!isValidLength) {
                helpText.innerHTML = '<i class="fas fa-exclamation-circle me-1"></i>شناسه دستگاه باید حداقل ۶ کاراکتر باشد';
            }
            helpText.style.color = 'var(--error-color)';
        }
    }
    
    return isValid;
}

// ===== QR CODE SCANNER =====
function initializeQRScanner() {
    try {
        // Check if Html5Qrcode is available
        if (typeof Html5Qrcode === 'undefined') {
            console.error('Html5Qrcode library not loaded');
            showNotification('کتابخانه QR Code بارگذاری نشده است', 'error');
            return;
        }
        
        html5QrCode = new Html5Qrcode("qr-reader");
        console.log('QR Scanner initialized successfully');
        
        // Setup file upload for QR codes
        setupQRFileUpload();
    } catch (error) {
        console.error('Failed to initialize QR scanner:', error);
        showNotification('خطا در راه‌اندازی اسکنر QR Code: ' + (error.message || 'نامشخص'), 'error');
    }
}

function setupQRFileUpload() {
    const fileInput = document.getElementById('qrFileInput');
    if (fileInput) {
        fileInput.addEventListener('change', handleQRFileUpload);
    }
}

function handleQRFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
        showNotification('لطفاً یک فایل تصویری انتخاب کنید', 'error');
        return;
    }
    
    // Show loading
    showNotification('در حال پردازش تصویر...', 'info');
    
    // Use Html5Qrcode to scan the uploaded file
    if (html5QrCode) {
        html5QrCode.scanFile(file, true)
            .then(decodedText => {
                console.log('QR Code from file:', decodedText);
                
                // Set the scanned value to input
                const deviceIdInput = document.getElementById('deviceId');
                if (deviceIdInput) {
                    deviceIdInput.value = decodedText;
                    handleDeviceIdInput({ target: deviceIdInput });
                }
                
                showNotification('QR Code با موفقیت از تصویر خوانده شد', 'success');
                
                // Clear file input
                event.target.value = '';
            })
            .catch(error => {
                console.error('Error scanning QR from file:', error);
                showNotification('QR Code در تصویر یافت نشد', 'error');
                event.target.value = '';
            });
    }
}

function triggerFileUpload() {
    const fileInput = document.getElementById('qrFileInput');
    if (fileInput) {
        fileInput.click();
    }
}

async function toggleQRScanner() {
    const startScanBtn = document.getElementById('startScanBtn');
    const qrReaderContainer = document.getElementById('qr-reader');
    
    if (!html5QrCode) {
        showNotification('اسکنر QR Code در دسترس نیست', 'error');
        return;
    }
    
    if (isScanning) {
        // Stop scanning
        try {
            await html5QrCode.stop();
            isScanning = false;
            qrReaderContainer.style.display = 'none';
            startScanBtn.innerHTML = `
                <div class="btn-content">
                    <i class="fas fa-camera me-2"></i>
                    <span>اسکن با دوربین</span>
                </div>
                <div class="btn-glow"></div>
            `;
            console.log('QR scanning stopped');
        } catch (error) {
            console.error('Error stopping QR scanner:', error);
        }
    } else {
        // Start scanning
        try {
            // Check for camera permissions first
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('دوربین در این مرورگر پشتیبانی نمی‌شود');
            }
            
            // Test camera access
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                // Stop the test stream immediately
                stream.getTracks().forEach(track => track.stop());
            } catch (cameraError) {
                console.error('Camera access error:', cameraError);
                let errorMessage = 'دسترسی به دوربین امکان‌پذیر نیست';
                
                if (cameraError.name === 'NotFoundError') {
                    errorMessage = 'دوربین یافت نشد. لطفاً دوربین را متصل کنید';
                } else if (cameraError.name === 'NotAllowedError') {
                    errorMessage = 'دسترسی به دوربین مجاز نیست. لطفاً دسترسی را فعال کنید';
                } else if (cameraError.name === 'NotReadableError') {
                    errorMessage = 'دوربین در حال استفاده توسط برنامه دیگری است';
                }
                
                throw new Error(errorMessage);
            }
            
            qrReaderContainer.style.display = 'block';
            
            const config = {
                fps: 10,
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1.0,
                experimentalFeatures: {
                    useBarCodeDetectorIfSupported: true
                }
            };
            
            // Try different camera constraints
            const cameraConstraints = [
                { facingMode: "environment" }, // Back camera
                { facingMode: "user" }, // Front camera
                true // Any camera
            ];
            
            let scanStarted = false;
            for (const constraint of cameraConstraints) {
                try {
                    await html5QrCode.start(
                        constraint,
                        config,
                        onScanSuccess,
                        onScanFailure
                    );
                    scanStarted = true;
                    break;
                } catch (constraintError) {
                    console.warn('Failed with constraint:', constraint, constraintError);
                    continue;
                }
            }
            
            if (!scanStarted) {
                throw new Error('هیچ دوربین قابل استفاده‌ای یافت نشد');
            }
            
            isScanning = true;
            startScanBtn.innerHTML = `
                <div class="btn-content">
                    <i class="fas fa-stop me-2"></i>
                    <span>توقف اسکن</span>
                </div>
                <div class="btn-glow"></div>
            `;
            
            showNotification('اسکن QR Code شروع شد', 'success');
            console.log('QR scanning started');
        } catch (error) {
            console.error('Error starting QR scanner:', error);
            showNotification('خطا در شروع اسکن QR Code: ' + (error.message || 'نامشخص'), 'error');
            qrReaderContainer.style.display = 'none';
            isScanning = false;
        }
    }
}

function onScanSuccess(decodedText, decodedResult) {
    console.log('QR Code scanned successfully:', decodedText);
    
    // Set the scanned value to input
    const deviceIdInput = document.getElementById('deviceId');
    if (deviceIdInput) {
        deviceIdInput.value = decodedText;
        handleDeviceIdInput({ target: deviceIdInput });
    }
    
    // Stop scanning
    toggleQRScanner();
    
    // Show success notification
    showNotification('QR Code با موفقیت اسکن شد', 'success');
    
    // Add animation to input
    deviceIdInput.classList.add('animate__animated', 'animate__pulse');
    setTimeout(() => {
        deviceIdInput.classList.remove('animate__animated', 'animate__pulse');
    }, 1000);
}

function onScanFailure(error) {
    // Handle scan failure silently (this is called frequently during scanning)
    // console.log('QR scan failure:', error);
}

// ===== DEVICE MANAGEMENT =====
async function handleAddDevice() {
    const deviceIdInput = document.getElementById('deviceId');
    const deviceNicknameInput = document.getElementById('deviceNickname');
    const deviceTypeSelect = document.getElementById('deviceType');
    const devicePasswordInput = document.getElementById('devicePassword');
    const addDeviceBtn = document.getElementById('addDeviceBtn');
    const loadingSpinner = addDeviceBtn.querySelector('.loading-spinner');
    const btnContent = addDeviceBtn.querySelector('.btn-content');
    
    // Validate device ID
    if (!deviceIdInput || !deviceIdInput.value.trim()) {
        showNotification('لطفاً شناسه دستگاه را وارد کنید', 'warning');
        deviceIdInput.focus();
        return;
    }
    
    // Validate nickname
    if (!deviceNicknameInput || !deviceNicknameInput.value.trim()) {
        showNotification('لطفاً نام مستعار دستگاه را وارد کنید', 'warning');
        deviceNicknameInput.focus();
        return;
    }
    
    // Validate device type
    if (!deviceTypeSelect || !deviceTypeSelect.value) {
        showNotification('لطفاً نوع دستگاه را انتخاب کنید', 'warning');
        deviceTypeSelect.focus();
        return;
    }
    
    // Validate device password
    if (!devicePasswordInput || !devicePasswordInput.value.trim()) {
        showNotification('لطفاً رمز دستگاه را وارد کنید', 'warning');
        devicePasswordInput.focus();
        return;
    }
    
    const deviceId = deviceIdInput.value.trim();
    const deviceNickname = deviceNicknameInput.value.trim();
    const deviceType = deviceTypeSelect.value;
    const devicePassword = devicePasswordInput.value.trim();
    
    // Validate device ID format
    if (!validateDeviceId(deviceId)) {
        showNotification('شناسه دستگاه وارد شده معتبر نیست', 'error');
        deviceIdInput.focus();
        return;
    }
    
    // Show loading state
    addDeviceBtn.disabled = true;
    btnContent.style.opacity = '0';
    loadingSpinner.style.display = 'block';
    showLoadingOverlay(true);
    
    try {
        console.log('Device Type:', deviceType, 'Type of deviceType:', typeof deviceType);
        
        const data = {
            userid: userid,
            session: session,
            deviceid: deviceId,
            nickname: deviceNickname,
            devicetype: deviceType,
            Devicepass: devicePassword
        };
        
        console.log('Initial data object:', data);
        
        // Add MQTT configuration for Azan device (devicetype = 100)
        // Check both string and number comparison
        if (deviceType === '100' || deviceType === 100) {
            console.log('Adding MQTT configuration for Azan device...');
            
            // Get MQTT configuration from sessionStorage
            const mainTopic = sessionStorage.getItem('mqtttopic') || 'main';
            const chatTopic = sessionStorage.getItem('mqttchattopic') || 'chat';
            const mqttUser = sessionStorage.getItem('mqttuser') || 'device_user';
            const mqttPass = sessionStorage.getItem('mqttpass') || 'device_pass';
            
            console.log('MQTT Values:', {
                mainTopic: mainTopic,
                chatTopic: chatTopic,
                mqttUser: mqttUser,
                mqttPass: mqttPass
            });
            
            // mqtttopic is always fixed for azan devices
            data.mqtttopic = 'giot/factory/azan/down';
            data.deviceid = deviceId; // Already set above, but ensuring it's correct
            data.deviceconfig = JSON.stringify({
                "msg_id": 1,
                "data": {
                    "server": "mqtt.giot.ir",
                    "port": 8883,
                    "username": mqttUser,
                    "password": mqttPass,
                    "deviceid": deviceId,
                    "topic": `${mainTopic}/${chatTopic}`,
                    "ssl_enabled": true
                }
            });
            
            console.log('Data object after adding MQTT config:', data);
        }
        
        console.log('Adding device with data:', data);
        
        // Send request to API
        const result = await postData(data, '/adddevice');
        
        console.log('Add device response:', result);
        
        if (result && result.status === 'success') {
            // Success
            showNotification('دستگاه با موفقیت اضافه شد', 'success');
            showSuccessCard('دستگاه با موفقیت اضافه شد', `دستگاه "${nickname}" با شناسه ${deviceId} به حساب کاربری شما اضافه شد`);
            
            // Clear form after showing success message
            setTimeout(() => {
                handleClearForm();
            }, 2000);
            
            // No automatic redirect - user stays on the page
        } else {
            // Error from API
            const errorMessage = result?.message || result?.error || 'خطای نامشخص در افزودن دستگاه';
            showNotification(errorMessage, 'error');
            console.error('Add device failed:', result);
        }
    } catch (error) {
        console.error('Add device error:', error);
        showNotification('خطا در برقراری ارتباط با سرور', 'error');
    } finally {
        // Hide loading state
        addDeviceBtn.disabled = false;
        btnContent.style.opacity = '1';
        loadingSpinner.style.display = 'none';
        showLoadingOverlay(false);
    }
}

function handleClearForm() {
    const deviceIdInput = document.getElementById('deviceId');
    const deviceNicknameInput = document.getElementById('deviceNickname');
    const deviceTypeSelect = document.getElementById('deviceType');
    const addDeviceBtn = document.getElementById('addDeviceBtn');
    const inputGroups = document.querySelectorAll('.glass-input-group');
    const helpTexts = document.querySelectorAll('.input-help');
    
    // Clear device ID
    if (deviceIdInput) {
        deviceIdInput.value = '';
        deviceIdInput.classList.remove('has-value');
    }
    
    // Clear nickname
    if (deviceNicknameInput) {
        deviceNicknameInput.value = '';
        deviceNicknameInput.classList.remove('has-value');
    }
    
    // Clear device type
    if (deviceTypeSelect) {
        deviceTypeSelect.value = '';
        deviceTypeSelect.classList.remove('has-value');
    }
    
    // Disable add button
    if (addDeviceBtn) {
        addDeviceBtn.disabled = true;
    }
    
    // Reset input groups
    inputGroups.forEach(inputGroup => {
        inputGroup.classList.remove('valid', 'invalid');
    });
    
    // Reset help texts
    helpTexts.forEach((helpText, index) => {
        if (index === 0) {
            helpText.innerHTML = '<i class="fas fa-info-circle me-1"></i>شناسه دستگاه معمولاً روی برچسب دستگاه درج شده است';
        } else if (index === 1) {
            helpText.innerHTML = '<i class="fas fa-info-circle me-1"></i>نام مستعار برای شناسایی آسان‌تر دستگاه';
        } else if (index === 2) {
            helpText.innerHTML = '<i class="fas fa-info-circle me-1"></i>نوع دستگاه IoT خود را مشخص کنید';
        }
        helpText.style.color = 'var(--text-muted)';
    });
    
    // Stop QR scanning if active
    if (isScanning) {
        toggleQRScanner();
    }
    
    showNotification('فرم پاک شد', 'success');
}

// ===== UI HELPERS =====
function showSuccessCard(title, message) {
    const statusCard = document.querySelector('.status-card');
    const statusTitle = statusCard.querySelector('.status-title');
    const statusMessage = statusCard.querySelector('.status-message');
    
    if (statusCard && statusTitle && statusMessage) {
        statusTitle.textContent = title;
        statusMessage.textContent = message;
        statusCard.style.display = 'block';
        statusCard.classList.add('animate__animated', 'animate__fadeInUp');
        
        setTimeout(() => {
            statusCard.classList.remove('animate__animated', 'animate__fadeInUp');
        }, 1000);
    }
}

function showLoadingOverlay(show) {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = show ? 'flex' : 'none';
    }
}

function showNotification(message, type = 'info') {
    const container = document.getElementById('notification-container');
    if (!container) return;
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <div class="notification-icon">
                <i class="fas ${
                    type === 'success' ? 'fa-check-circle' :
                    type === 'error' ? 'fa-exclamation-circle' :
                    type === 'warning' ? 'fa-exclamation-triangle' :
                    'fa-info-circle'
                }"></i>
            </div>
            <div class="notification-text">${message}</div>
        </div>
    `;
    
    container.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => {
                notification.remove();
            }, 300);
        }
    }, 5000);
}

// ===== KEYBOARD SHORTCUTS =====
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', handleKeyboardShortcuts);
}

function handleKeyboardShortcuts(event) {
    // Ctrl/Cmd + Enter to add device
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        const addDeviceBtn = document.getElementById('addDeviceBtn');
        if (addDeviceBtn && !addDeviceBtn.disabled) {
            handleAddDevice();
        }
    }
    
    // Escape to clear form
    if (event.key === 'Escape') {
        event.preventDefault();
        handleClearForm();
    }
    
    // Ctrl/Cmd + Q to toggle QR scanner
    if ((event.ctrlKey || event.metaKey) && event.key === 'q') {
        event.preventDefault();
        toggleQRScanner();
    }
}

// ===== INPUT VALIDATION SETUP =====
function setupInputValidation() {
    const deviceIdInput = document.getElementById('deviceId');
    if (!deviceIdInput) return;
    
    // Add CSS classes for validation states
    const style = document.createElement('style');
    style.textContent = `
        .glass-input-group.valid .glass-input {
            border-color: var(--success-color) !important;
            box-shadow: 0 0 20px rgba(16, 220, 96, 0.3) !important;
        }
        
        .glass-input-group.invalid .glass-input {
            border-color: var(--error-color) !important;
            box-shadow: 0 0 20px rgba(240, 65, 65, 0.3) !important;
        }
        
        .glass-input.has-value {
            background: rgba(255, 255, 255, 0.12) !important;
        }
        
        @keyframes slideOutRight {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
        
        .notification {
            display: flex;
            align-items: center;
            gap: 1rem;
            color: var(--text-primary);
        }
        
        .notification-content {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            width: 100%;
        }
        
        .notification-icon {
            font-size: 1.2rem;
        }
        
        .notification-text {
            flex: 1;
            font-weight: 500;
        }
    `;
    document.head.appendChild(style);
}

// ===== UTILITY FUNCTIONS =====
function generateDeviceId() {
    // Generate a random device ID for testing purposes
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = 'DEV-';
    for (let i = 0; i < 8; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function copyToClipboard(text) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
            showNotification('متن کپی شد', 'success');
        }).catch(err => {
            console.error('Failed to copy text:', err);
            showNotification('خطا در کپی کردن متن', 'error');
        });
    } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            showNotification('متن کپی شد', 'success');
        } catch (err) {
            console.error('Failed to copy text:', err);
            showNotification('خطا در کپی کردن متن', 'error');
        }
        document.body.removeChild(textArea);
    }
}

// ===== ERROR HANDLING =====
window.addEventListener('error', function(event) {
    console.error('Global error:', event.error);
    showNotification('خطای غیرمنتظره رخ داد', 'error');
});

window.addEventListener('unhandledrejection', function(event) {
    console.error('Unhandled promise rejection:', event.reason);
    showNotification('خطا در پردازش درخواست', 'error');
});

// ===== PERFORMANCE MONITORING =====
if ('performance' in window) {
    window.addEventListener('load', function() {
        setTimeout(() => {
            const perfData = performance.getEntriesByType('navigation')[0];
            console.log('Page load time:', perfData.loadEventEnd - perfData.loadEventStart, 'ms');
        }, 0);
    });
}

// ===== EXPORT FOR TESTING =====
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        validateDeviceId,
        generateDeviceId,
        showNotification
    };
}

// Sign out function
async function SignOut() {
    var _userid = sessionStorage.getItem('userid');
    var _session = sessionStorage.getItem('session');
    if (!_userid || !_session) {
        showNotification("شما نشست فعالی ندارید و باید ابتدا لاگین کنید.", "Alarm");
        sessionStorage.clear();
        window.location.href = '../index.html';
        return;
    }
    var data = {
        userid: _userid,
        session: _session
    };
    
    try {
        const result = await postData(data, '/signout');
        
        // Check if result is a string and try to parse it
        let parsedResult = result;
        if (typeof result === 'string') {
            try {
                parsedResult = JSON.parse(result);
            } catch (e) {
                console.error('Parsing error:', e);
                showNotification("خطا در پردازش پاسخ سرور", "Alarm");
                return;
            }
        }
        
        // Check if the result contains the status key
        if (parsedResult && parsedResult.status) {
            if (parsedResult.status === 'success') {
                console.log('You have successfully logged out');
                showNotification("شما با موفقیت خارج شدید", "OK");
                sessionStorage.clear();
                window.location.href = '../index.html';
            } else {
                // Construct an error message from the JSON response
                let errorMessage = "خطا در هنگام خروج از سامانه:\n";
                for (let key in parsedResult) {
                    if (parsedResult.hasOwnProperty(key)) {
                        errorMessage += `${key}: ${parsedResult[key]}\n`;
                    }
                }
                showNotification(errorMessage, "Alarm");
                sessionStorage.clear();
                window.location.href = '../index.html';
            }
        } else {
            console.log('Error receiving logout response');
            showNotification("خطای دریافت نتیجه خروج از سامانه", "Alarm");
            sessionStorage.clear();
            window.location.href = '../index.html';
        }
    } catch (error) {
        console.log('Logout request failed:', error);
        showNotification("خطا در برقراری ارتباط با سرور ...", "Alarm");
    }
}

console.log('Add Device Page JavaScript loaded successfully');