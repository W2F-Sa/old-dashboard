// Agriculture Device Manager - JavaScript Implementation

class AgricultureDeviceManager {
    constructor() {
        this.mqttClient = null;
        this.waterLevelChart = null;
        this.poolLevelChart = null;
        this.threejsScene = null;
        this.threejsRenderer = null;
        this.threejsCamera = null;
        this.poolThreejsScene = null;
        this.poolThreejsRenderer = null;
        this.poolThreejsCamera = null;
        this.waterLevelData = [];
        this.poolLevelData = [];
        this.currentDataCount = 5;
        this.currentViewMode = '3d';
        this.poolCurrentDataCount = 5;
        this.poolCurrentViewMode = '2d';
        this.motorStatus = {
            motor1: 'off',
            motor2: 'off'
        };
        
        // Session storage keys
        this.sessionKeys = {
            userid: 'userid',
            session: 'session',
            macaddress: 'macaddress',
            mqtttopic: 'mqtttopic',
            mqttchattopic: 'mqttchattopic',
            mqttuser: 'mqttuser',
            mqttpass: 'mqttpass'
        };
        
        this.initializeDevice();
    }
    
    loadSampleData() {
        // Generate sample water level data to keep UI functional
        const now = new Date();
        this.waterLevelData = [];
        
        for (let i = 0; i < this.currentDataCount; i++) {
            const timestamp = new Date(now.getTime() - (i * 30 * 60 * 1000)); // 30 minutes intervals
            const waterLevel = 2.0 + Math.sin(i * 0.5) * 0.5 + (Math.random() - 0.5) * 0.2; // Sample data around 2.0m
            
            this.waterLevelData.push({
                timestamp: timestamp.toISOString(),
                water_level: Math.max(0.5, Math.min(4.0, waterLevel)), // Keep within reasonable bounds
                id: `sample_${i}`,
                cpu_serial: 'sample_device'
            });
        }

        // Reverse to have newest first
        this.waterLevelData.reverse();
        
        // Update UI with sample data
        this.updateWaterLevelDisplay();
        this.updateChart();
        this.update3DVisualization();
        this.updateHistoryTable();
        
        console.log('Sample data loaded:', this.waterLevelData.length, 'records');
    }
        
    // Get session data and initialize
    initializeDevice() {
        this.deviceMac = sessionStorage.getItem('selectedDeviceMacAddress') || sessionStorage.getItem('agricultureserial');
        this.userid = sessionStorage.getItem('userid');
        this.session = sessionStorage.getItem('session');
        this.mqtttopic = sessionStorage.getItem('mqtttopic');
        this.mqttchattopic = sessionStorage.getItem('mqttchattopic');
        this.mqttuser = sessionStorage.getItem('mqttuser');
        this.mqttpass = sessionStorage.getItem('mqttpass');
        
        this.init();
    }
    
    init() {
        console.log('Initializing Agriculture Device Manager...');
        
        // Check if required libraries are loaded
        if (typeof THREE === 'undefined') {
            console.error('THREE.js is not loaded');
            this.showNotification('خطا: کتابخانه THREE.js بارگذاری نشده است - صفحه در 3 ثانیه مجدداً بارگذاری می‌شود', 'error');
            setTimeout(() => {
                window.location.reload();
            }, 3000);
            return;
        }
        
        // Store OrbitControls availability for later use
        this.orbitControlsAvailable = typeof OrbitControls !== 'undefined';
        
        if (!this.orbitControlsAvailable) {
            console.warn('OrbitControls is not loaded - 3D controls will be disabled');
            this.showNotification('هشدار: کنترل‌های سه‌بعدی غیرفعال هستند - کنترل موس کار نمی‌کند', 'warning');
        } else {
            console.log('All required libraries loaded successfully - THREE.js and OrbitControls are ready');
            this.showNotification('کتابخانه‌های سه‌بعدی با موفقیت بارگذاری شدند', 'success');
        }
        
        // Load device info from session storage
        this.loadDeviceInfo();
        
        // Load LoRaWAN device info (async)
        this.getLorawanDeviceInfo().catch(error => {
            console.error('Failed to load LoRaWAN device info:', error);
        });
        
        // Initialize UI event listeners
        this.initEventListeners();
        
        // Show default tab first (before loading data) - will be called after DOM ready
        
        // Initialize charts with empty data
        this.init2DChart();
        this.init3DVisualization();
        this.initPool2DChart();
        this.initPool3DVisualization();
        
        // Initialize MQTT connection
        this.initMQTT();
        
        // Load initial water level data (async, won't block UI)
        this.loadInitialWaterData().catch(error => {
            console.error('Failed to load initial water data:', error);
            // UI remains functional even if data loading fails
        });
        
        // Load initial pool data (async, won't block UI)
        this.loadInitialPoolData().catch(error => {
            console.error('Failed to load initial pool data:', error);
            // UI remains functional even if data loading fails
        });
    }
    
    loadDeviceInfo() {
        // Load device information from session storage
        const macAddress = sessionStorage.getItem(this.sessionKeys.macaddress) || '--';
        const userId = sessionStorage.getItem(this.sessionKeys.userid) || '--';
        
        // Only update elements if they exist (some were removed from general settings)
        const deviceMacElement = document.getElementById('deviceMacAddress');
        const deviceUserElement = document.getElementById('deviceUserId');
        
        if (deviceMacElement) {
            deviceMacElement.textContent = macAddress;
        }
        if (deviceUserElement) {
            deviceUserElement.textContent = userId;
        }
        
        console.log('Device info loaded:', { macAddress, userId });
    }
    
    initEventListeners() {
        // Data count buttons
        document.querySelectorAll('.data-count-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const count = parseInt(e.target.dataset.count);
                this.changeDataCount(count);
            });
        });
        
        // View mode buttons
        document.querySelectorAll('.view-mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const mode = e.target.dataset.mode;
                this.changeViewMode(mode);
            });
        });
        
        // Pool data count buttons
        document.querySelectorAll('.data-count-btn-pool').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const count = parseInt(e.target.dataset.count);
                this.changePoolDataCount(count);
            });
        });
        
        // Pool view mode buttons
        document.querySelectorAll('.pool-view-mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const mode = e.target.dataset.mode;
                this.changePoolViewMode(mode);
            });
        });
        
        // Pool Time range buttons
        const loadTimeRangeBtnPool = document.getElementById('loadTimeRangeBtnPool');
        if (loadTimeRangeBtnPool) {
            loadTimeRangeBtnPool.addEventListener('click', () => {
                this.loadPoolTimeRangeData();
            });
        }
        
        const loadTodayBtnPool = document.getElementById('loadTodayBtnPool');
        if (loadTodayBtnPool) {
            loadTodayBtnPool.addEventListener('click', () => {
                this.loadPoolTodayData();
            });
        }
        
        // Pool Quick time buttons
        document.querySelectorAll('.quick-time-btn-pool').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const days = parseInt(e.target.dataset.days);
                this.loadPoolLastDaysData(days);
            });
        });
        
        // Theme toggle
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.addEventListener('change', (e) => {
                this.toggleTheme(e.target.checked);
            });
        }
        
        // Time range buttons
        const loadTimeRangeBtn = document.getElementById('loadTimeRangeBtn');
        if (loadTimeRangeBtn) {
            loadTimeRangeBtn.addEventListener('click', () => {
                this.loadTimeRangeData();
            });
        }
        
        const loadTodayBtn = document.getElementById('loadTodayBtn');
        if (loadTodayBtn) {
            loadTodayBtn.addEventListener('click', () => {
                this.loadTodayData();
            });
        }
        
        // Quick time buttons
        document.querySelectorAll('.quick-time-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const days = parseInt(e.target.dataset.days);
                this.loadLastDaysData(days);
            });
        });
        
        // Set default date range to today
        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
        
        // Set default for well water inputs
        const startInput = document.getElementById('startDateTime');
        const endInput = document.getElementById('endDateTime');
        
        if (startInput) startInput.value = this.formatDateTimeLocal(startOfDay);
        if (endInput) endInput.value = this.formatDateTimeLocal(endOfDay);
        
        // Set default for pool water inputs
        const startInputPool = document.getElementById('startDateTimePool');
        const endInputPool = document.getElementById('endDateTimePool');
        
        if (startInputPool) startInputPool.value = this.formatDateTimeLocal(startOfDay);
        if (endInputPool) endInputPool.value = this.formatDateTimeLocal(endOfDay);
        
        // Category buttons are no longer needed as we use Bootstrap tabs directly
    }
    
    initMQTT() {
        try {
            // Check if MQTT credentials are available
            if (!this.mqttuser || !this.mqttpass || !this.mqtttopic || !this.mqttchattopic) {
                console.warn('MQTT credentials not found in session storage');
                this.showNotification('اطلاعات MQTT یافت نشد. برخی از قابلیت‌ها ممکن است کار نکنند.', 'warning');
                return;
            }
            
            // MQTT connection settings
            const options = {
                username: this.mqttuser,
                password: this.mqttpass,
                clientId: 'agriclient' + Math.random().toString(16).substr(2, 4),
                clean: true,
                reconnectPeriod: 1000,
                connectTimeout: 30 * 1000
            };
            
            this.mqttClient = mqtt.connect('wss://mqttws.giot.ir/', options);
            
            this.mqttClient.on('connect', () => {
                console.log('MQTT Connected');
                this.isConnected = true;
                
                // Subscribe to water level topic (mqtttopic/mqttchattopic)
                const topic = `${this.mqtttopic}/${this.mqttchattopic}`;
                this.mqttClient.subscribe(topic, (err) => {
                    if (err) {
                        console.error('MQTT Subscribe error:', err);
                        this.showNotification('خطا در اتصال به کانال MQTT', 'error');
                    } else {
                        console.log('Subscribed to:', topic);
                        this.showNotification('اتصال MQTT برقرار شد', 'success');
                    }
                });
            });
            
            this.mqttClient.on('message', (topic, message) => {
                const messageStr = message.toString().trim();
                console.log('🔥 Raw MQTT message received:', messageStr);
                console.log('📏 Message length:', messageStr.length);
                console.log('📝 Message content (length):', messageStr.length, 'chars');
                
                // Skip empty messages
                if (!messageStr || messageStr.length === 0) {
                    console.log('⚠️ Skipping empty message');
                    return;
                }
                
                // Skip obvious error messages but show them
                if (messageStr.startsWith('Error:') || messageStr.includes('Input is not a valid JSON string')) {
                    console.log('❌ Error message received:', messageStr);
                    return;
                }
                
                // Try to parse as JSON first
                try {
                    const data = JSON.parse(messageStr);
                    console.log('✅ MQTT JSON message parsed successfully:', data);
                    
                    // Check for LoRaWAN acknowledgment messages
                    if (data.message_type === 'acknolagement' && data.message_route === 'LoRaWAN Stack') {
                        console.log('📡 LoRaWAN acknowledgment received:', data);
                        this.showNotification('پیام شما در شبکه وایرلس LoRaWAN ارسال و تایید اول دریافت شد. تا 30 ثانیه دیگر تایید نهایی اعلام می‌گردد.', 'info');
                        return; // Don't process further as this is just an acknowledgment
                    }
                    
                    // Check if this is a wrapped message with payload field
                    let actualData = data;
                    if (data.payload && typeof data.payload === 'string') {
                        try {
                            actualData = JSON.parse(data.payload);
                            console.log('📦 Extracted payload data:', actualData);
                        } catch (payloadError) {
                            console.log('❌ Failed to parse payload as JSON:', data.payload);
                            actualData = data; // Use original data if payload parsing fails
                        }
                    }
                    
                    // Use actualData for all subsequent processing
                    const processedData = actualData;
                    
                    // Show O1 and O2 status clearly
                    if (processedData.O1 !== undefined) {
                        const motor1Status = processedData.O1 === '1' ? 'روشن (ON)' : 'خاموش (OFF)';
                        console.log('🔧 موتور 1 (O1):', processedData.O1, '=', motor1Status);
                    }
                    if (processedData.O2 !== undefined) {
                        const motor2Status = processedData.O2 === '1' ? 'روشن (ON)' : 'خاموش (OFF)';
                        console.log('🔧 موتور 2 (O2):', processedData.O2, '=', motor2Status);
                    }
                    
                    // Show rcmd field clearly
                    if (processedData.rcmd !== undefined) {
                        console.log('📡 دستور rcmd دریافت شد:', processedData.rcmd);
                    }
                    
                    // Handle new JSON format with I1 (well water) and I2 (pool water)
                    if (processedData['I1'] !== undefined) {
                        console.log('💧 سطح آب چاه (I1):', processedData['I1']);
                        const wellData = {
                            water_level: processedData['I1'],
                            device_id: processedData.id || processedData.DeviceMACAddress,
                            cpu_serial: processedData.mac || processedData.DeviceMACAddress,
                            timestamp: processedData.timestamp
                        };
                        this.handleWaterLevelUpdate(wellData);
                    }
                    
                    if (processedData['I2'] !== undefined) {
                        console.log('🏊 سطح آب استخر (I2):', processedData['I2']);
                        const poolData = {
                            pool_level: processedData['I2'],
                            device_id: processedData.id || processedData.DeviceMACAddress,
                            cpu_serial: processedData.mac || processedData.DeviceMACAddress,
                            timestamp: processedData.timestamp
                        };
                        this.handlePoolLevelUpdate(poolData);
                    }
                    
                    // Handle motor status updates from MQTT (O1 and O2) - Immediate update without waiting
                    if (processedData.O1 !== undefined || processedData.O2 !== undefined) {
                        console.log('⚙️ بروزرسانی فوری وضعیت موتور از O1/O2');
                        this.handleMotorStatusUpdateImmediate(processedData);
                    }
                    
                    // Handle new motor control confirmations with rcmd field (legacy support)
                    if (processedData.rcmd !== undefined) {
                        console.log('🎯 پردازش تایید موتور از rcmd:', processedData.rcmd);
                        this.handleMotorRcmdConfirmation(processedData);
                    }
                    
                    // Legacy motor control confirmations are no longer supported
                    // Motor status is updated only via O1/O2 values
                } catch (error) {
                    // If JSON parsing fails, show the message anyway
                    console.log('❌ JSON parsing failed for message:', messageStr);
                    console.log('🔍 Error details:', error.message);
                    console.log('📄 Trying to process as plain text...');
                    
                    // Legacy motor confirmations are no longer supported
                    console.log('⚠️ Unknown message format, displaying raw content:', messageStr);
                }
            });
            
            this.mqttClient.on('error', (error) => {
                console.error('MQTT Error:', error);
                this.isConnected = false;
                this.showNotification('خطا در اتصال MQTT', 'error');
            });
            
            this.mqttClient.on('close', () => {
                console.log('MQTT Disconnected');
                this.isConnected = false;
            });
            
        } catch (error) {
            console.error('MQTT initialization error:', error);
            this.showNotification('خطا در راه‌اندازی MQTT', 'error');
        }
    }
    
    handleWaterLevelUpdate(data) {
        // Handle the new JSON format: {"cpu_serial":"60c5a8fffe7896b2","device_id":"I1","msg_id":"5","water_level":"1.000"}
        if (data.water_level !== undefined && data.water_level !== null && data.water_level !== '') {
            const waterLevelValue = parseFloat(data.water_level);
            
            // Validate water level value
            if (isNaN(waterLevelValue)) {
                console.warn('Invalid water level value received:', data.water_level);
                return;
            }
            
            const newDataPoint = {
                timestamp: new Date().toISOString(),
                water_level: waterLevelValue,
                id: data.msg_id || Date.now().toString(),
                cpu_serial: data.cpu_serial || ''
            };
            
            // Add new data point at the beginning
            this.waterLevelData.unshift(newDataPoint);
            
            // Keep maximum 20 records for history
            if (this.waterLevelData.length > 20) {
                this.waterLevelData = this.waterLevelData.slice(0, 20);
            }
            
            // For chart display, use only the required number of data points
            const chartData = this.waterLevelData.slice(0, this.currentDataCount);
            
            this.updateWaterLevelDisplay();
            this.updateChart();
            this.update3DVisualization();
            this.updateHistoryTable();
            
            // Show notification for critical levels
            const minLevel = 0.5; // Default minimum level
            if (waterLevelValue < minLevel) {
                this.showNotification('هشدار: سطح آب بسیار پایین است!', 'warning');
            }
            
            console.log('Water level updated:', newDataPoint.water_level, 'from device:', data.cpu_serial || data.device_id || 'unknown');
        } else {
            console.warn('Invalid or missing water level data:', data);
        }
    }
    
    handlePoolLevelUpdate(data) {
        // Handle pool water level updates from field 1004
        if (data.pool_level !== undefined && data.pool_level !== null && data.pool_level !== '') {
            const poolLevelValue = parseFloat(data.pool_level);
            
            // Validate pool level value
            if (isNaN(poolLevelValue)) {
                console.warn('Invalid pool level value received:', data.pool_level);
                return;
            }
            
            const newDataPoint = {
                timestamp: new Date().toISOString(),
                pool_level: poolLevelValue,
                id: data.device_id || Date.now().toString(),
                cpu_serial: data.cpu_serial || ''
            };
            
            // Add new data point at the beginning
            this.poolLevelData.unshift(newDataPoint);
            
            // Keep maximum 20 records for history
            if (this.poolLevelData.length > 20) {
                this.poolLevelData = this.poolLevelData.slice(0, 20);
            }
            
            // Update pool UI components
            this.updatePoolLevelDisplay();
            this.updatePoolChart();
            this.updatePool3DVisualization();
            this.updatePoolHistoryTable();
            
            // Show notification for critical levels
            const minLevel = parseFloat(document.getElementById('minWaterLevel')?.value || 0.5);
            if (poolLevelValue < minLevel) {
                this.showNotification('هشدار: سطح آب استخر بسیار پایین است!', 'warning');
            }
            
            console.log('Pool level updated:', newDataPoint.pool_level, 'from device:', data.cpu_serial || data.device_id || 'unknown');
        } else {
            console.warn('Invalid or missing pool level data:', data);
        }
    }
    
    handleMotorStatusUpdate(data) {
        // Handle real-time motor status updates from MQTT
        // Expected format: { "O1": "0", "O2": "1", "DeviceMACAddress": "60c5a8fffe7896b2", ... }
        try {
            console.log('Processing motor status update:', data);
            
            // Update motor 1 status (O1)
            if (data.O1 !== undefined) {
                const motor1Status = data.O1 === '1' ? 'on' : 'off';
                if (this.motorStatus.motor1 !== motor1Status) {
                    this.motorStatus.motor1 = motor1Status;
                    this.updateMotorStatus('motor1');
                    console.log(`Motor 1 status updated to: ${motor1Status}`);
                }
            }
            
            // Update motor 2 status (O2)
            if (data.O2 !== undefined) {
                const motor2Status = data.O2 === '1' ? 'on' : 'off';
                if (this.motorStatus.motor2 !== motor2Status) {
                    this.motorStatus.motor2 = motor2Status;
                    this.updateMotorStatus('motor2');
                    console.log(`Motor 2 status updated to: ${motor2Status}`);
                }
            }
            
        } catch (error) {
            console.error('Error processing motor status update:', error);
        }
    }

    handleMotorStatusUpdateImmediate(data) {
        // Handle immediate motor status updates from MQTT without waiting for confirmation
        // This function processes the JSON payload and immediately updates motor status
        // Expected format: { "O1": "0", "O2": "1", "payload": "{\"id\":\"6\",\"I1\":\"222\",\"I2\":\"244\",\"O1\":\"0\",\"O2\":\"1\"}", ... }
        try {
            console.log('🚀 Processing immediate motor status update:', data);
            
            // Update motor 1 status (O1) - Immediate update
            if (data.O1 !== undefined) {
                const motor1Status = data.O1 === '1' ? 'on' : 'off';
                const persianStatus = motor1Status === 'on' ? 'روشن' : 'خاموش';
                
                // Always update immediately, no waiting
                this.motorStatus.motor1 = motor1Status;
                this.updateMotorStatus('motor1');
                
                console.log(`🔧 موتور آب چاه (O1) فوراً به ${persianStatus} تغییر کرد`);
                this.showNotification(`موتور آب چاه ${persianStatus} شد`, 'success');
            }
            
            // Update motor 2 status (O2) - Immediate update
            if (data.O2 !== undefined) {
                const motor2Status = data.O2 === '1' ? 'on' : 'off';
                const persianStatus = motor2Status === 'on' ? 'روشن' : 'خاموش';
                
                // Always update immediately, no waiting
                this.motorStatus.motor2 = motor2Status;
                this.updateMotorStatus('motor2');
                
                console.log(`🔧 موتور آب استخر (O2) فوراً به ${persianStatus} تغییر کرد`);
                this.showNotification(`موتور آب استخر ${persianStatus} شد`, 'success');
            }
            
        } catch (error) {
            console.error('❌ Error processing immediate motor status update:', error);
        }
    }
    
    // handleMotorConfirmation removed - motor status is now updated only via MQTT messages with O1/O2 values

    handleMotorRcmdConfirmation(data) {
        // Handle new motor control confirmation messages with rcmd field
        // Expected format: {"mac":"AC1F09FFFE0F9C11","id":"5","I1":"245","I2":"228","O1":"0","O2":"1","rcmd":"o1_OFF,o2_ON"}
        try {
            console.log('🎯 Processing motor rcmd confirmation:', data);
            
            // Handle O1 and O2 fields - these are the main status indicators
            // O1 = "0" means OFF, O1 = "1" means ON
            // O2 = "0" means OFF, O2 = "1" means ON
            if (data.O1 !== undefined) {
                const motor1Status = (data.O1 === '1' || data.O1 === 1) ? 'on' : 'off';
                const persianStatus = motor1Status === 'on' ? 'روشن' : 'خاموش';
                
                console.log(`🔧 موتور آب چاه (O1): ${data.O1} = ${persianStatus}`);
                
                // Always update motor status regardless of pending state
                const previousStatus = this.motorStatus.motor1;
                this.motorStatus.motor1 = motor1Status;
                this.updateMotorStatus('motor1');
                
                // Show notification if status changed
                if (previousStatus !== motor1Status) {
                    this.showNotification(`موتور آب چاه ${persianStatus} شد`, 'success');
                }
            }
            
            if (data.O2 !== undefined) {
                const motor2Status = (data.O2 === '1' || data.O2 === 1) ? 'on' : 'off';
                const persianStatus = motor2Status === 'on' ? 'روشن' : 'خاموش';
                
                console.log(`🔧 موتور آب استخر (O2): ${data.O2} = ${persianStatus}`);
                
                // Always update motor status regardless of pending state
                const previousStatus = this.motorStatus.motor2;
                this.motorStatus.motor2 = motor2Status;
                this.updateMotorStatus('motor2');
                
                // Show notification if status changed
                if (previousStatus !== motor2Status) {
                    this.showNotification(`موتور آب استخر ${persianStatus} شد`, 'success');
                }
            }
            
            // Also handle rcmd field if present (additional confirmation)
            // New format: "o1_OFF&o2_ON" (using & instead of comma)
            if (data.rcmd) {
                console.log('📡 Processing rcmd field:', data.rcmd);
                
                // Split by both comma and ampersand for backward compatibility
                const commands = data.rcmd.split(/[,&]/);
                
                for (const command of commands) {
                    const trimmedCommand = command.trim();
                    
                    // Parse o1_OFF, o1_ON, o2_OFF, o2_ON format
                    if (trimmedCommand.startsWith('o1_')) {
                        const action = trimmedCommand.split('_')[1].toLowerCase(); // OFF -> off, ON -> on
                        const actionText = action === 'on' ? 'روشن' : 'خاموش';
                        console.log(`✅ تایید rcmd برای موتور آب چاه: ${actionText}`);
                    } else if (trimmedCommand.startsWith('o2_')) {
                        const action = trimmedCommand.split('_')[1].toLowerCase(); // OFF -> off, ON -> on
                        const actionText = action === 'on' ? 'روشن' : 'خاموش';
                        console.log(`✅ تایید rcmd برای موتور آب استخر: ${actionText}`);
                    }
                }
            }
            
        } catch (error) {
            console.error('❌ Error parsing motor rcmd confirmation:', error);
        }
    }

    async loadInitialWaterData() {
        const userid = this.userid || sessionStorage.getItem('userid');
        const session = this.session || sessionStorage.getItem('session');
        const macaddress = this.deviceMac || sessionStorage.getItem('selectedDeviceMacAddress') || sessionStorage.getItem('agricultureserial');
        
        console.log('Loading initial water data with:', { userid, session, macaddress });
        
        if (!userid || !session || !macaddress) {
            console.error('Required session data not found:', { userid, session, macaddress });
            this.showNotification('اطلاعات جلسه یافت نشد. لطفاً از طریق لیست دستگاه‌ها وارد شوید.', 'error');
            return;
        }
        
        // Prepare POST data
        const postData = {
            userid: userid,
            session: session,
            macaddress: macaddress,
            lastrecoredcount: this.currentDataCount
        };
        
        try {
            const response = await fetch('https://api.giot.ir/getsensordata', {
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
            console.log('Raw API response:', responseText);
            
            let result;
            try {
                result = JSON.parse(responseText);
            } catch (parseError) {
                console.error('JSON parse error:', parseError);
                console.error('Response text:', responseText);
                throw new Error('پاسخ API قابل تجزیه نیست');
            }
            
            if (result.status === 'success' && result.data && Array.isArray(result.data) && result.data.length > 0) {
                // Process both well water (1003) and pool water (1004) data
                this.waterLevelData = [];
                this.poolLevelData = [];
                
                result.data.forEach(item => {
                    // Parse the nested JSON data
                    let parsedData = {};
                    try {
                        if (typeof item.data === 'string') {
                            parsedData = JSON.parse(item.data);
                        } else if (typeof item.data === 'object') {
                            parsedData = item.data;
                        } else {
                            console.warn('Unexpected data type:', typeof item.data, item.data);
                            parsedData = {};
                        }
                    } catch (e) {
                        console.error('Error parsing item data:', e);
                        console.error('Raw data:', item.data);
                        console.error('Data type:', typeof item.data);
                        parsedData = {};
                    }
                    
                    // Process well water data (I1)
                    if (parsedData['I1'] !== undefined) {
                        this.waterLevelData.push({
                            timestamp: item.time,
                            water_level: parseFloat(parsedData['I1'] || 0),
                            device_mac: parsedData.mac,
                            device_id: parsedData.id,
                            msg_id: parsedData.id
                        });
                    }
                    
                    // Process pool water data (I2)
                    if (parsedData['I2'] !== undefined) {
                        this.poolLevelData.push({
                            timestamp: item.time,
                            pool_level: parseFloat(parsedData['I2'] || 0),
                            device_mac: parsedData.mac,
                            device_id: parsedData.id,
                            msg_id: parsedData.id
                        });
                    }
                });
                
                // Update well water UI
                this.updateWaterLevelDisplay();
                this.updateChart();
                this.update3DVisualization();
                this.updateHistoryTable();
                
                // Update pool water UI
                this.updatePoolLevelDisplay();
                this.updatePoolChart();
                this.updatePool3DVisualization();
                this.updatePoolHistoryTable();
                
                console.log('Initial water data loaded - Well:', this.waterLevelData.length, 'Pool:', this.poolLevelData.length);
            } else {
                console.error('API error:', result.reason || 'Unknown error');
                this.showNotification(`خطا در دریافت داده‌ها: ${result.reason || 'خطای نامشخص'}`, 'error');
                this.loadSampleData(); // Load sample data to keep UI functional
            }
        } catch (error) {
            console.error('Error loading initial water data:', error);
            this.showNotification('خطا در دریافت داده‌های اولیه - نمایش داده‌های نمونه', 'warning');
            this.loadSampleData(); // Load sample data to keep UI functional
        }  
    }

    async loadMotorStatus() {
        const userid = this.userid || sessionStorage.getItem('userid');
        const session = this.session || sessionStorage.getItem('session');
        const macaddress = this.deviceMac || sessionStorage.getItem('selectedDeviceMacAddress') || sessionStorage.getItem('agricultureserial');
        
        console.log('Loading motor status with:', { userid, session, macaddress });
        
        if (!userid || !session || !macaddress) {
            console.error('Required session data not found for motor status:', { userid, session, macaddress });
            return;
        }
        
        // Prepare POST data - get only the latest record
        const postData = {
            userid: userid,
            session: session,
            macaddress: macaddress,
            lastrecoredcount: 1 // Only get the latest record
        };
        
        try {
            const response = await fetch('https://api.giot.ir/getsensordata', {
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
            console.log('Raw API response for motor status:', responseText);
            
            let result;
            try {
                result = JSON.parse(responseText);
            } catch (parseError) {
                console.error('JSON parse error for motor status:', parseError);
                console.error('Response text:', responseText);
                return;
            }
            
            if (result.status === 'success' && result.data && Array.isArray(result.data) && result.data.length > 0) {
                // Get the latest record (index 0)
                const latestRecord = result.data[0];
                
                // Parse the nested JSON data
                let parsedData = {};
                try {
                    if (typeof latestRecord.data === 'string') {
                        parsedData = JSON.parse(latestRecord.data);
                    } else if (typeof latestRecord.data === 'object') {
                        parsedData = latestRecord.data;
                    }
                } catch (e) {
                    console.error('Error parsing motor status data:', e);
                    return;
                }
                
                // Extract O1 and O2 values
                const motor1Status = parsedData['O1'] || parsedData['o1'] || '0';
                const motor2Status = parsedData['O2'] || parsedData['o2'] || '0';
                
                console.log('Motor status from API - Motor1 (O1):', motor1Status, 'Motor2 (O2):', motor2Status);
                
                // Update motor status based on API response
                this.motorStatus['motor1'] = motor1Status === '1' ? 'on' : 'off';
                this.motorStatus['motor2'] = motor2Status === '1' ? 'on' : 'off';
                
                // Update UI
                this.updateMotorStatus('motor1');
                this.updateMotorStatus('motor2');
                
                console.log('Motor status updated from API:', this.motorStatus);
            } else {
                console.error('Motor status API error:', result.reason || 'Unknown error');
            }
        } catch (error) {
            console.error('Error loading motor status:', error);
        }
    }

    async loadInitialPoolData() {
        const userid = this.userid || sessionStorage.getItem('userid');
        const session = this.session || sessionStorage.getItem('session');
        const macaddress = this.deviceMac || sessionStorage.getItem('selectedDeviceMacAddress') || sessionStorage.getItem('agricultureserial');
        
        console.log('Loading initial pool data with:', { userid, session, macaddress });
        
        if (!userid || !session || !macaddress) {
            console.error('Required session data not found:', { userid, session, macaddress });
            this.showNotification('اطلاعات جلسه یافت نشد. لطفاً از طریق لیست دستگاه‌ها وارد شوید.', 'error');
            return;
        }
        
        // Prepare POST data
        const postData = {
            userid: userid,
            session: session,
            macaddress: macaddress,
            lastrecoredcount: this.poolCurrentDataCount
        };
        
        try {
            const response = await fetch('https://api.giot.ir/getsensordata', {
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
            console.log('Raw API response for pool:', responseText);
            
            let result;
            try {
                result = JSON.parse(responseText);
            } catch (parseError) {
                console.error('JSON parse error:', parseError);
                console.error('Response text:', responseText);
                throw new Error('پاسخ API قابل تجزیه نیست');
            }
            
            if (result.status === 'success' && result.data && Array.isArray(result.data) && result.data.length > 0) {
                // Process only pool water (1004) data
                this.poolLevelData = [];
                
                result.data.forEach(item => {
                    // Parse the nested JSON data
                    let parsedData = {};
                    try {
                        if (typeof item.data === 'string') {
                            parsedData = JSON.parse(item.data);
                        } else if (typeof item.data === 'object') {
                            parsedData = item.data;
                        } else {
                            console.warn('Unexpected data type:', typeof item.data, item.data);
                            parsedData = {};
                        }
                    } catch (e) {
                        console.error('Error parsing item data:', e);
                        console.error('Raw data:', item.data);
                        console.error('Data type:', typeof item.data);
                        parsedData = {};
                    }
                    
                    // Process pool water data (I2)
                    if (parsedData['I2'] !== undefined) {
                        this.poolLevelData.push({
                            timestamp: item.time,
                            pool_level: parseFloat(parsedData['I2'] || 0),
                            device_mac: parsedData.mac,
                            device_id: parsedData.id,
                            msg_id: parsedData.id
                        });
                    }
                });
                
                // Update pool water UI
                this.updatePoolLevelDisplay();
                this.updatePoolChart();
                this.updatePool3DVisualization();
                this.updatePoolHistoryTable();
                
                console.log('Initial pool data loaded:', this.poolLevelData.length);
            } else {
                console.error('API error:', result.reason || 'Unknown error');
                this.showNotification(`خطا در دریافت داده‌های استخر: ${result.reason || 'خطای نامشخص'}`, 'error');
            }
        } catch (error) {
            console.error('Error loading initial pool data:', error);
            this.showNotification('خطا در دریافت داده‌های اولیه استخر', 'warning');
        }
    }

    async getSensorDataInTime(startTime, endTime) {
        const userid = this.userid || sessionStorage.getItem('userid');
        const session = this.session || sessionStorage.getItem('session');
        const macaddress = this.deviceMac || sessionStorage.getItem('selectedDeviceMacAddress') || sessionStorage.getItem('agricultureserial');
        
        console.log('Getting sensor data in time range:', { userid, session, macaddress, startTime, endTime });
        
        if (!userid || !session || !macaddress) {
            console.error('Required session data not found:', { userid, session, macaddress });
            this.showNotification('اطلاعات جلسه یافت نشد. لطفاً از طریق لیست دستگاه‌ها وارد شوید.', 'error');
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
            
            if (result.status === 'success' && result.data && Array.isArray(result.data) && result.data.length > 0) {
                console.log('Successfully loaded sensor data in time range:', result);
                return result;
            } else {
                console.error('API returned error or no data:', result);
                this.showNotification('خطا در دریافت داده‌ها از سرور', 'error');
                return null;
            }
            
        } catch (error) {
            console.error('Error loading sensor data in time:', error);
            this.showNotification(`خطا در بارگذاری داده‌ها: ${error.message}`, 'error');
            return null;
        }
    }

    async getLorawanDeviceInfo() {
        const userid = this.userid || sessionStorage.getItem('userid');
        const session = this.session || sessionStorage.getItem('session');
        const devEui = this.deviceMac || sessionStorage.getItem('selectedDeviceMacAddress') || sessionStorage.getItem('agricultureserial');
        
        console.log('Getting LoRaWAN device info:', { userid, session, devEui });
        
        if (!userid || !session || !devEui) {
            console.error('Required session data not found:', { userid, session, devEui });
            this.showNotification('اطلاعات جلسه یافت نشد. لطفاً از طریق لیست دستگاه‌ها وارد شوید.', 'error');
            return null;
        }
        
        // Prepare POST data
        const postData = {
            userid: userid,
            session: session,
            devEui: devEui
        };
        
        try {
            const response = await fetch('https://api.giot.ir/getlorawandeviceinfo', {
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
            console.log('Raw API response (getLorawanDeviceInfo):', responseText);
            
            let result;
            try {
                result = JSON.parse(responseText);
            } catch (parseError) {
                console.error('Error parsing API response:', parseError);
                throw new Error('پاسخ API قابل تجزیه نیست');
            }
            
            if (result && result.status === 'success' && result.data) {
                console.log('Successfully loaded LoRaWAN device info:', result);
                
                const data = result.data;
                
                // Extract and save applicationId for /sendloradownlink API
                if (data.device && data.device.applicationId) {
                    sessionStorage.setItem('applicationId', data.device.applicationId);
                    console.log('ApplicationId saved to session storage:', data.device.applicationId);
                }
                
                // Parse device status from nested deviceStatus object
                let deviceStatusText = 'نامشخص';
                if (data.deviceStatus) {
                    const batteryLevel = data.deviceStatus.batteryLevel;
                    const externalPower = data.deviceStatus.externalPowerSource;
                    const margin = data.deviceStatus.margin;
                    
                    if (externalPower) {
                        deviceStatusText = 'متصل به برق خارجی';
                    } else if (batteryLevel > 0) {
                        deviceStatusText = `باتری: ${batteryLevel}%`;
                    } else if (margin !== undefined) {
                        deviceStatusText = `حاشیه سیگنال: ${margin} dB`;
                    } else {
                        deviceStatusText = 'آنلاین';
                    }
                } else {
                    deviceStatusText = 'آنلاین';
                }
                
                this.updateDeviceStatusDisplay(data.lastSeenAt, deviceStatusText);
                
                // Update battery and power source display
                this.updateBatteryAndPowerDisplay(data.deviceStatus);
                return result;
            } else {
                console.error('API returned error or no device data:', result);
                this.showNotification('خطا در دریافت اطلاعات دستگاه از سرور', 'error');
                return null;
            }
            
        } catch (error) {
            console.error('Error loading LoRaWAN device info:', error);
            this.showNotification(`خطا در بارگذاری اطلاعات دستگاه: ${error.message}`, 'error');
            return null;
        }
    }

    updateDeviceStatusDisplay(lastSeenAt, deviceStatus) {
        const lastSeenDateElement = document.getElementById('deviceLastSeenDate');
        const lastSeenTimeElement = document.getElementById('deviceLastSeenTime');
        const statusElement = document.getElementById('deviceStatus');
        
        if (lastSeenAt && lastSeenAt !== 'نامشخص') {
            try {
                // Parse ISO date string (e.g., "2025-08-27T16:19:07.586404Z")
                const date = new Date(lastSeenAt);
                
                // Format date in Persian
                const persianDate = date.toLocaleDateString('fa-IR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    weekday: 'long'
                });
                
                // Format time in Persian
                const persianTime = date.toLocaleTimeString('fa-IR', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                });
                
                if (lastSeenDateElement) {
                    lastSeenDateElement.textContent = persianDate;
                    lastSeenDateElement.className = 'badge bg-primary fs-6';
                }
                
                if (lastSeenTimeElement) {
                    lastSeenTimeElement.textContent = persianTime;
                    lastSeenTimeElement.className = 'badge bg-success fs-6';
                }
            } catch (error) {
                console.error('Error parsing date:', error);
                if (lastSeenDateElement) {
                    lastSeenDateElement.textContent = 'خطا در تاریخ';
                    lastSeenDateElement.className = 'badge bg-danger fs-6';
                }
                if (lastSeenTimeElement) {
                    lastSeenTimeElement.textContent = 'خطا در ساعت';
                    lastSeenTimeElement.className = 'badge bg-danger fs-6';
                }
            }
        } else {
            if (lastSeenDateElement) {
                lastSeenDateElement.textContent = 'نامشخص';
                lastSeenDateElement.className = 'badge bg-secondary fs-6';
            }
            if (lastSeenTimeElement) {
                lastSeenTimeElement.textContent = 'نامشخص';
                lastSeenTimeElement.className = 'badge bg-secondary fs-6';
            }
        }
        
        if (statusElement) {
            statusElement.textContent = deviceStatus || 'نامشخص';
            
            // Set appropriate badge color based on status
            if (deviceStatus && deviceStatus.includes('متصل به برق')) {
                statusElement.className = 'badge bg-success fs-6';
            } else if (deviceStatus && deviceStatus.includes('باتری')) {
                statusElement.className = 'badge bg-info fs-6';
            } else if (deviceStatus && deviceStatus.includes('آنلاین')) {
                statusElement.className = 'badge bg-success fs-6';
            } else {
                statusElement.className = 'badge bg-secondary fs-6';
            }
        }
        
        console.log('Device status display updated:', { lastSeenAt, deviceStatus });
    }
    
    updateBatteryAndPowerDisplay(deviceStatus) {
        const batteryLevelElement = document.getElementById('batteryLevel');
        const batteryFillElement = document.getElementById('batteryFill');
        const externalPowerElement = document.getElementById('externalPowerSource');
        
        if (!deviceStatus) {
            // No device status data available
            if (batteryLevelElement) {
                batteryLevelElement.textContent = 'اطلاعات در دسترس نیست';
                batteryLevelElement.className = 'badge bg-secondary fs-6';
            }
            if (batteryFillElement) {
                batteryFillElement.style.width = '0%';
                batteryFillElement.className = 'battery-fill';
            }
            if (externalPowerElement) {
                externalPowerElement.textContent = 'اطلاعات در دسترس نیست';
                externalPowerElement.className = 'badge bg-secondary fs-6';
            }
            return;
        }
        
        const batteryLevel = deviceStatus.batteryLevel;
        const externalPower = deviceStatus.externalPowerSource;
        
        // Handle battery level display
        if (batteryLevelElement && batteryFillElement) {
            if (batteryLevel === -1 || batteryLevel < 0 || batteryLevel > 100) {
                // Invalid battery level
                batteryLevelElement.textContent = 'باتری در دسترس نیست';
                batteryLevelElement.className = 'badge bg-secondary fs-6';
                batteryFillElement.style.width = '0%';
                batteryFillElement.className = 'battery-fill';
            } else {
                // Valid battery level (0-100)
                batteryLevelElement.textContent = `${batteryLevel}%`;
                batteryFillElement.style.width = `${batteryLevel}%`;
                
                // Set battery color and badge based on level
                if (batteryLevel <= 20) {
                    batteryLevelElement.className = 'badge bg-danger fs-6';
                    batteryFillElement.className = 'battery-fill low';
                } else if (batteryLevel <= 50) {
                    batteryLevelElement.className = 'badge bg-warning fs-6';
                    batteryFillElement.className = 'battery-fill medium';
                } else {
                    batteryLevelElement.className = 'badge bg-success fs-6';
                    batteryFillElement.className = 'battery-fill high';
                }
            }
        }
        
        // Handle external power source display
        if (externalPowerElement) {
            if (externalPower === true) {
                externalPowerElement.textContent = 'متصل به برق خارجی';
                externalPowerElement.className = 'badge bg-success fs-6';
            } else if (externalPower === false) {
                externalPowerElement.textContent = 'باتری داخلی';
                externalPowerElement.className = 'badge bg-info fs-6';
            } else {
                externalPowerElement.textContent = 'نامشخص';
                externalPowerElement.className = 'badge bg-secondary fs-6';
            }
        }
        
        console.log('Battery and power display updated:', { batteryLevel, externalPower });
    }

    updateWaterLevelDisplay() {
        if (this.waterLevelData.length > 0) {
            const currentLevel = this.waterLevelData[0].water_level;
            this.currentWaterLevel = currentLevel; // Store for cross-sectional view
            
            const currentLevelElement = document.getElementById('currentWaterLevel');
            if (currentLevelElement && currentLevel !== undefined && currentLevel !== null) {
                currentLevelElement.textContent = `${currentLevel.toFixed(3)} متر`;
            } else {
                if (currentLevelElement) {
                    currentLevelElement.textContent = 'داده موجود نیست';
                }
            }
            
            // Update status text based on level (use default values since settings were removed)
            const minLevel = 0.5; // Default minimum level
            const maxLevel = 5.0; // Default maximum level
            
            let statusText = 'نرمال';
            let statusClass = 'text-success';
            
            if (currentLevel !== undefined && currentLevel !== null) {
                if (currentLevel < minLevel) {
                    statusText = 'سطح پایین - نیاز به توجه';
                    statusClass = 'text-danger';
                } else if (currentLevel > maxLevel) {
                    statusText = 'سطح بالا - بررسی کنید';
                    statusClass = 'text-warning';
                }
            } else {
                statusText = 'داده موجود نیست';
                statusClass = 'text-muted';
            }
            
            const statusElement = document.getElementById('waterStatusText');
            if (statusElement) {
                statusElement.textContent = statusText;
                statusElement.className = statusClass;
            }
            
            // Update cross-sectional view if visible
            this.updateWellCrossSection();
        } else {
            this.currentWaterLevel = 0; // Default value
            
            const currentLevelElement = document.getElementById('currentWaterLevel');
            const statusElement = document.getElementById('waterStatusText');
            
            if (currentLevelElement) {
                currentLevelElement.textContent = 'داده موجود نیست';
            }
            if (statusElement) {
                statusElement.textContent = 'داده موجود نیست';
                statusElement.className = 'text-muted';
            }
            
            // Update cross-sectional view with default value
            this.updateWellCrossSection();
        }
    }
    
    updatePoolLevelDisplay() {
        if (this.poolLevelData.length > 0) {
            const currentLevel = this.poolLevelData[0].pool_level;
            this.currentPoolLevel = currentLevel; // Store for cross-sectional view
            
            const currentLevelElement = document.getElementById('currentPoolLevel');
            if (currentLevelElement && currentLevel !== undefined && currentLevel !== null) {
                currentLevelElement.textContent = `${currentLevel.toFixed(3)} متر`;
            } else {
                if (currentLevelElement) {
                    currentLevelElement.textContent = 'داده موجود نیست';
                }
            }
            
            // Update status text based on level
            const minLevel = 0.5; // Default minimum pool level
            const maxLevel = 5.0; // Default maximum pool level
            
            let statusText = 'نرمال';
            let statusClass = 'text-success';
            
            if (currentLevel !== undefined && currentLevel !== null) {
                if (currentLevel < minLevel) {
                    statusText = 'سطح پایین - نیاز به توجه';
                    statusClass = 'text-danger';
                } else if (currentLevel > maxLevel) {
                    statusText = 'سطح بالا - بررسی کنید';
                    statusClass = 'text-warning';
                }
            } else {
                statusText = 'داده موجود نیست';
                statusClass = 'text-muted';
            }
            
            const statusElement = document.getElementById('poolStatusText');
            if (statusElement) {
                statusElement.textContent = statusText;
                statusElement.className = statusClass;
            }
            
            // Update cross-sectional view if visible
            this.updatePoolCrossSection();
        } else {
            this.currentPoolLevel = 0; // Default value
            
            const currentLevelElement = document.getElementById('currentPoolLevel');
            const statusElement = document.getElementById('poolStatusText');
            
            if (currentLevelElement) {
                currentLevelElement.textContent = 'داده موجود نیست';
            }
            if (statusElement) {
                statusElement.textContent = 'داده موجود نیست';
                statusElement.className = 'text-muted';
            }
            
            // Update cross-sectional view with default value
            this.updatePoolCrossSection();
        }
    }
    
    init2DChart() {
        const ctx = document.getElementById('waterLevelChart');
        if (!ctx) return;
        
        // Destroy existing chart before creating new one
        if (this.waterLevelChart) {
            this.waterLevelChart.destroy();
            this.waterLevelChart = null;
        }
        
        try {
            // Enhanced 2D chart with separate box styling
            this.waterLevelChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'سطح آب (متر)',
                    data: [],
                    borderColor: 'rgb(54, 162, 235)',
                    backgroundColor: 'rgba(54, 162, 235, 0.1)',
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: 'rgb(54, 162, 235)',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 3,
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    borderWidth: 3
                }, {
                    label: 'حد بحرانی',
                    data: [],
                    borderColor: 'rgb(255, 99, 132)',
                    backgroundColor: 'rgba(255, 99, 132, 0.1)',
                    borderDash: [5, 5],
                    fill: false,
                    pointRadius: 0,
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'نمودار تحلیلی سطح آب چاه - نمایش 2D',
                        font: {
                            size: 18,
                            family: 'IRANSans',
                            weight: 'bold'
                        },
                        padding: 20
                    },
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            font: {
                                family: 'IRANSans',
                                size: 14
                            },
                            padding: 15,
                            usePointStyle: true
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleFont: {
                            family: 'IRANSans',
                            size: 14
                        },
                        bodyFont: {
                            family: 'IRANSans',
                            size: 12
                        },
                        cornerRadius: 8,
                        displayColors: true
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'سطح آب (متر)',
                            font: {
                                family: 'IRANSans',
                                size: 14,
                                weight: 'bold'
                            }
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)',
                            lineWidth: 1
                        },
                        ticks: {
                            font: {
                                family: 'IRANSans',
                                size: 12
                            },
                            padding: 8
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'زمان ثبت داده',
                            font: {
                                family: 'IRANSans',
                                size: 14,
                                weight: 'bold'
                            }
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)',
                            lineWidth: 1
                        },
                        ticks: {
                            font: {
                                family: 'IRANSans',
                                size: 12
                            },
                            maxRotation: 45,
                            padding: 8
                        }
                    }
                },
                animation: {
                    duration: 1500,
                    easing: 'easeInOutCubic'
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                }
            }
        });
        } catch (error) {
            console.error('Error initializing water level chart:', error);
            this.showNotification('خطا در بارگذاری نمودار سطح آب', 'error');
        }
    }
    
    initPool2DChart() {
        const ctx = document.getElementById('poolLevelChart');
        if (!ctx) return;
        
        // Destroy existing chart before creating new one
        if (this.poolLevelChart) {
            this.poolLevelChart.destroy();
            this.poolLevelChart = null;
        }
        
        try {
            // Enhanced 2D chart with separate box styling
            this.poolLevelChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'سطح آب (متر)',
                    data: [],
                    borderColor: 'rgb(54, 162, 235)',
                    backgroundColor: 'rgba(54, 162, 235, 0.1)',
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: 'rgb(54, 162, 235)',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 3,
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    borderWidth: 3
                }, {
                    label: 'حد بحرانی',
                    data: [],
                    borderColor: 'rgb(255, 99, 132)',
                    backgroundColor: 'rgba(255, 99, 132, 0.1)',
                    borderDash: [5, 5],
                    fill: false,
                    pointRadius: 0,
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'نمودار تحلیلی سطح آب استخر - نمایش 2D',
                        font: {
                            size: 18,
                            family: 'IRANSans',
                            weight: 'bold'
                        },
                        padding: 20
                    },
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            font: {
                                family: 'IRANSans',
                                size: 14
                            },
                            padding: 15,
                            usePointStyle: true
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleFont: {
                            family: 'IRANSans',
                            size: 14
                        },
                        bodyFont: {
                            family: 'IRANSans',
                            size: 12
                        },
                        cornerRadius: 8,
                        displayColors: true
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'سطح آب (متر)',
                            font: {
                                family: 'IRANSans',
                                size: 14,
                                weight: 'bold'
                            }
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)',
                            lineWidth: 1
                        },
                        ticks: {
                            font: {
                                family: 'IRANSans',
                                size: 12
                            },
                            padding: 8
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'زمان ثبت داده',
                            font: {
                                family: 'IRANSans',
                                size: 14,
                                weight: 'bold'
                            }
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)',
                            lineWidth: 1
                        },
                        ticks: {
                            font: {
                                family: 'IRANSans',
                                size: 12
                            },
                            maxRotation: 45,
                            padding: 8
                        }
                    }
                },
                animation: {
                    duration: 1500,
                    easing: 'easeInOutCubic'
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                }
            }
        });
        } catch (error) {
            console.error('Error initializing pool level chart:', error);
            this.showNotification('خطا در بارگذاری نمودار سطح استخر', 'error');
        }
    }
    
    init3DVisualization() {
        // Use the stageWrap container and stage canvas from well3d.html
        const stageWrap = document.getElementById('stageWrap');
        const stageCanvas = document.getElementById('stage');
        
        if (!stageWrap || !stageCanvas) {
            console.error('❌ stageWrap or stage canvas not found');
            return;
        }

        try {
            // Initialize the enhanced 3D well visualization
            if (typeof Enhanced3DWellVisualization !== 'undefined') {
                this.enhanced3DWell = new Enhanced3DWellVisualization();
                console.log('✅ Enhanced 3D Well Visualization initialized successfully');
                
                // Set initial water level after a short delay to ensure initialization is complete
                setTimeout(() => {
                    console.log('🔄 Initializing 3D well with default water level...');
                    this.update3DVisualization();
                    console.log('✅ 3D well initialization complete');
                }, 500);
            } else {
                console.warn('Enhanced3DWellVisualization not available, falling back to original implementation');
                this.initOriginal3DVisualization();
            }
        } catch (error) {
            console.error('❌ Error initializing enhanced 3D visualization:', error);
            this.initOriginal3DVisualization();
        }
    }

    initOriginal3DVisualization() {
        const container = document.getElementById('threejs-container');
        if (!container) return;

        try {
            // Enhanced Scene setup with better lighting
            this.threejsScene = new THREE.Scene();
            this.threejsScene.background = new THREE.Color(0x87CEEB);
            this.threejsScene.fog = new THREE.Fog(0x87CEEB, 10, 50);
        
        // Enhanced Camera with better positioning
        this.threejsCamera = new THREE.PerspectiveCamera(
            60,
            container.clientWidth / 850,
            0.1,
            1000
        );
        this.threejsCamera.position.set(8, 6, 8);
        this.threejsCamera.lookAt(0, 2, 0);
        
        // Enhanced Renderer with better quality
        this.threejsRenderer = new THREE.WebGLRenderer({ 
            antialias: true,
            alpha: true,
            powerPreference: "high-performance"
        });
        this.threejsRenderer.setSize(container.clientWidth, 1200);
        this.threejsRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.threejsRenderer.shadowMap.enabled = true;
        this.threejsRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.threejsRenderer.outputEncoding = THREE.sRGBEncoding;
        this.threejsRenderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.threejsRenderer.toneMappingExposure = 1.2;
        container.appendChild(this.threejsRenderer.domElement);
        
        // Enhanced Controls with better mouse interaction
        if (this.orbitControlsAvailable) {
            try {
                this.controls = new OrbitControls(this.threejsCamera, this.threejsRenderer.domElement);
                this.controls.enableDamping = true;
                this.controls.dampingFactor = 0.08;
                this.controls.enableZoom = true;
                this.controls.enablePan = true;
                this.controls.enableRotate = true;
                this.controls.autoRotate = false;
                this.controls.autoRotateSpeed = 0.5;
                this.controls.minDistance = 3;
                this.controls.maxDistance = 20;
                this.controls.minPolarAngle = 0;
                this.controls.maxPolarAngle = Math.PI / 2;
                this.controls.target.set(0, 2, 0);
            } catch (controlsError) {
                console.error('Failed to initialize OrbitControls for well:', controlsError);
                this.showNotification('خطا در بارگذاری کنترل‌های سه‌بعدی چاه', 'error');
                this.controls = null;
            }
        } else {
            console.warn('OrbitControls not available for well 3D visualization');
            this.controls = null;
        }
        
        // Enhanced Lighting system
        const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
        this.threejsScene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
        directionalLight.position.set(15, 15, 10);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 50;
        directionalLight.shadow.camera.left = -10;
        directionalLight.shadow.camera.right = 10;
        directionalLight.shadow.camera.top = 10;
        directionalLight.shadow.camera.bottom = -10;
        this.threejsScene.add(directionalLight);
        
        // Additional point light for better illumination
        const pointLight = new THREE.PointLight(0xffffff, 0.6, 30);
        pointLight.position.set(5, 8, 5);
        pointLight.castShadow = true;
        this.threejsScene.add(pointLight);
        
        // Hemisphere light for natural lighting
        const hemisphereLight = new THREE.HemisphereLight(0x87CEEB, 0x90EE90, 0.3);
        this.threejsScene.add(hemisphereLight);
        
        // Enhanced Well structure
        this.create3DWell();
        
        // Enhanced Animation loop with performance monitoring
        const animate = () => {
            requestAnimationFrame(animate);
            if (this.controls) {
                this.controls.update();
            }
            
            // Add subtle water animation if water exists
            if (this.waterMesh) {
                this.waterMesh.material.opacity = 0.7 + Math.sin(Date.now() * 0.001) * 0.1;
            }
            
            this.threejsRenderer.render(this.threejsScene, this.threejsCamera);
        };
        animate();
        
        // Enhanced window resize handling with fixed height
        const handleResize = () => {
            if (this.currentViewMode === '3d' && container.clientWidth > 0) {
                this.threejsCamera.aspect = container.clientWidth / 1200;
                this.threejsCamera.updateProjectionMatrix();
                this.threejsRenderer.setSize(container.clientWidth, 1200);
                this.threejsRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            }
        };
        
        window.addEventListener('resize', handleResize);
        
        // Add mouse interaction feedback
        if (this.controls) {
            this.threejsRenderer.domElement.addEventListener('mousedown', () => {
                this.controls.autoRotate = false;
            });
            
            this.threejsRenderer.domElement.addEventListener('mouseup', () => {
                setTimeout(() => {
                    if (this.controls && !this.controls.autoRotate) {
                        // Optional: Enable auto-rotate after inactivity
                    }
                }, 3000);
            });
        }
        } catch (error) {
            console.error('Error initializing 3D visualization:', error);
            this.showNotification('خطا در بارگذاری نمایش سه‌بعدی', 'error');
        }
    }
    
    initPool3DVisualization() {
        const container = document.getElementById('threejs-container-pool');
        if (!container) return;
        
        try {
            // ——— ابعاد و موقعیت استخر (متر) ———
            this.POOL_LENGTH = 10;
            this.POOL_WIDTH = 5;
            this.POOL_DEPTH = 2.5;
            this.POOL_ELEVATION = 0.01;

            // ——— صحنه، دوربین و رندرکننده ———
            this.poolThreejsScene = new THREE.Scene();
            this.poolThreejsScene.background = new THREE.Color(0xeef2ff);

            this.poolThreejsCamera = new THREE.PerspectiveCamera(55, container.clientWidth / container.clientHeight, 0.1, 1500);
            this.poolThreejsCamera.position.set(9, 9, 11);
            
            this.poolThreejsRenderer = new THREE.WebGLRenderer({ 
                canvas: container.querySelector('canvas') || undefined,
                antialias: true 
            });
            this.poolThreejsRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            this.poolThreejsRenderer.setSize(container.clientWidth, container.clientHeight, false);
            
            // Clear container and add canvas
            container.innerHTML = '';
            container.appendChild(this.poolThreejsRenderer.domElement);

            // Enhanced Controls
            if (this.orbitControlsAvailable) {
                try {
                    this.poolControls = new OrbitControls(this.poolThreejsCamera, this.poolThreejsRenderer.domElement);
                    this.poolControls.enableDamping = true; 
                    this.poolControls.target.set(0, -this.POOL_DEPTH/2 + this.POOL_ELEVATION, 0);
                } catch (controlsError) {
                    console.error('Failed to initialize OrbitControls for pool:', controlsError);
                    this.poolControls = null;
                }
            } else {
                this.poolControls = null;
            }

            // ——— نورپردازی صحنه ———
            this.poolThreejsScene.add(new THREE.AmbientLight(0xffffff, 0.6));
            const dir = new THREE.DirectionalLight(0xffffff, 0.9); 
            dir.position.set(8, 14, 6); 
            this.poolThreejsScene.add(dir);

            // ——— توابع ساخت بافت (Texture) ———
            this.makeCanvas = (w=512, h=512) => { const c = document.createElement('canvas'); c.width=w; c.height=h; return c; };
            this.texFromCanvas = (c) => { const t = new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.anisotropy=8; t.needsUpdate = true; return t; };

            // بافت کاشی استخر
            this.makePoolTileTexture = (tileCm=15) => {
                const c = this.makeCanvas(512,512), ctx = c.getContext('2d');
                ctx.fillStyle = '#93c5fd'; ctx.fillRect(0,0,c.width,c.height);
                ctx.strokeStyle = '#e6efc'; ctx.lineWidth = 2;
                const pxPerTile = (tileCm/100) * 100;
                for (let x=0; x<=c.width; x+=pxPerTile) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,c.height); ctx.stroke(); }
                for (let y=0; y<=c.height; y+=pxPerTile) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(c.width,y); ctx.stroke(); }
                return this.texFromCanvas(c);
            };

            // بافت چمن طبیعی
            this.makeGrassTexture = () => {
                const c = this.makeCanvas(512, 512), ctx = c.getContext('2d');
                ctx.fillStyle = '#4a752e';
                ctx.fillRect(0, 0, 512, 512);
                const grassColors = ['#559e48', '#6cae54', '#7baf5f', '#a1c47b', '#b3d092', '#c1a555'];
                for (let i = 0; i < 50000; i++) {
                    const x = Math.random() * 512, y = Math.random() * 512;
                    const length = Math.random() * 15 + 5, angle = (Math.random() - 0.5) * Math.PI * 0.25;
                    const width = Math.random() * 1.5 + 0.5;
                    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
                    ctx.fillStyle = grassColors[Math.floor(Math.random() * grassColors.length)];
                    ctx.globalAlpha = Math.random() * 0.5 + 0.3;
                    ctx.fillRect(-width / 2, 0, width, length); ctx.restore();
                }
                ctx.globalAlpha = 1; const tex = this.texFromCanvas(c); tex.repeat.set(12, 12); return tex;
            };

            // بافت لایه‌های خاک
            this.makeSoilLayerTexture = () => {
                const c = this.makeCanvas(256, 512), ctx = c.getContext('2d');
                const gradient = ctx.createLinearGradient(0, 0, 0, 512);
                gradient.addColorStop(0, '#854d0e'); gradient.addColorStop(0.3, '#a16207');
                gradient.addColorStop(0.6, '#ca8a04'); gradient.addColorStop(0.85, '#a3a3a3');
                ctx.fillStyle = gradient; ctx.fillRect(0, 0, 256, 512);
                ctx.globalAlpha = 0.08; ctx.fillStyle = '#000';
                for (let i = 0; i < 4000; i++) {
                    const x = Math.random() * 256, y = Math.random() * 512, r = Math.random() * 1.2;
                    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
                }
                ctx.globalAlpha = 1; const tex = this.texFromCanvas(c); tex.repeat.set(1, 1); return tex;
            };

            // ——— ساخت زمین اطراف استخر ———
            const groundDepth = this.POOL_DEPTH + 1.5;
            const groundShape = new THREE.Shape();
            const outerW = 20, outerH = 14;
            groundShape.moveTo(-outerW/2, -outerH/2); groundShape.lineTo(outerW/2, -outerH/2); groundShape.lineTo(outerW/2, outerH/2); groundShape.lineTo(-outerW/2, outerH/2); groundShape.closePath();
            
            const holePath = new THREE.Path();
            const holeW = this.POOL_LENGTH + 0.6, holeH = this.POOL_WIDTH + 0.6;
            holePath.moveTo(-holeW/2, -holeH/2); holePath.lineTo(holeW/2, -holeH/2); holePath.lineTo(holeW/2, holeH/2); holePath.lineTo(-holeW/2, holeH/2); holePath.closePath();
            groundShape.holes.push(holePath);

            const groundGeom = new THREE.ExtrudeGeometry(groundShape, { depth: groundDepth, bevelEnabled: false });
            groundGeom.translate(0, 0, -groundDepth / 2);

            const grassMat = new THREE.MeshStandardMaterial({ map: this.makeGrassTexture(), roughness: 1 });
            const soilMat = new THREE.MeshStandardMaterial({ map: this.makeSoilLayerTexture(), roughness: 1 });
            
            const ground = new THREE.Mesh(groundGeom, [grassMat, soilMat]);
            ground.rotation.x = -Math.PI/2;
            ground.position.y = 0;
            this.poolThreejsScene.add(ground);

            // ——— ساخت مجموعه استخر (دیواره، لبه، آب و ...) ———
            this.poolGroup = new THREE.Group();
            this.poolGroup.position.y = this.POOL_ELEVATION;
            this.poolThreejsScene.add(this.poolGroup);
            
            // دیواره‌ها و کف
            this.wallMatShared = new THREE.MeshStandardMaterial({ map: this.makePoolTileTexture(15), side: THREE.DoubleSide });
            const floor = new THREE.Mesh(new THREE.PlaneGeometry(this.POOL_LENGTH, this.POOL_WIDTH), this.wallMatShared);
            floor.rotation.x = -Math.PI/2; floor.position.y = -this.POOL_DEPTH; this.poolGroup.add(floor);

            const north = new THREE.Mesh(new THREE.PlaneGeometry(this.POOL_LENGTH, this.POOL_DEPTH), this.wallMatShared);
            north.position.set(0, -this.POOL_DEPTH/2, -this.POOL_WIDTH/2); north.rotation.y = Math.PI; this.poolGroup.add(north);
            const south = new THREE.Mesh(new THREE.PlaneGeometry(this.POOL_LENGTH, this.POOL_DEPTH), this.wallMatShared);
            south.position.set(0, -this.POOL_DEPTH/2, this.POOL_WIDTH/2); this.poolGroup.add(south);
            const east = new THREE.Mesh(new THREE.PlaneGeometry(this.POOL_WIDTH, this.POOL_DEPTH), this.wallMatShared);
            east.position.set(this.POOL_LENGTH/2, -this.POOL_DEPTH/2, 0); east.rotation.y = -Math.PI/2; this.poolGroup.add(east);
            const west = new THREE.Mesh(new THREE.PlaneGeometry(this.POOL_WIDTH, this.POOL_DEPTH), this.wallMatShared);
            west.position.set(-this.POOL_LENGTH/2, -this.POOL_DEPTH/2, 0); west.rotation.y = Math.PI/2; this.poolGroup.add(west);
            
            // لبهٔ بالایی (Coping)
            const copingDepth = 0.2;
            const copShape = new THREE.Shape();
            const copOuterL = holeW + 0.4, copOuterW = holeH + 0.4;
            copShape.moveTo(-copOuterL/2, -copOuterW/2); copShape.lineTo(copOuterL/2, -copOuterW/2); copShape.lineTo(copOuterL/2, copOuterW/2); copShape.lineTo(-copOuterL/2, copOuterW/2); copShape.closePath();
            const copHole = new THREE.Path();
            copHole.moveTo(-holeW/2, -holeH/2); copHole.lineTo(holeW/2, -holeH/2); copHole.lineTo(holeW/2, holeH/2); copHole.lineTo(-holeW/2, holeH/2); copHole.closePath();
            copShape.holes.push(copHole);

            const copGeom = new THREE.ExtrudeGeometry(copShape, { depth: copingDepth, bevelEnabled: false });
            copGeom.translate(0, 0, -copingDepth / 2);

            const copMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, roughness: 1, side: THREE.DoubleSide });
            const coping = new THREE.Mesh(copGeom, copMat);
            coping.rotation.x = -Math.PI/2;
            coping.position.y = 0.0;
            this.poolGroup.add(coping);

            // آب
            this.waterMat = new THREE.MeshStandardMaterial({ color: 0x4aa3ff, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false });
            this.waterPlaneMat = new THREE.MeshBasicMaterial({ color: 0x60a5fa, transparent: true, opacity: 0.28, side: THREE.DoubleSide });
            this.waterPlane = new THREE.Mesh(new THREE.PlaneGeometry(this.POOL_LENGTH*0.99, this.POOL_WIDTH*0.99), this.waterPlaneMat);
            this.waterPlane.rotation.x = -Math.PI/2; this.poolGroup.add(this.waterPlane);
            this.waterMesh = null;

            // ——— حلقه رندر ———
            const animate = () => { 
                requestAnimationFrame(animate);
                const { clientWidth, clientHeight } = container;
                const needResize = this.poolThreejsRenderer.domElement.width !== clientWidth || this.poolThreejsRenderer.domElement.height !== clientHeight;
                if (needResize) { 
                    this.poolThreejsRenderer.setSize(clientWidth, clientHeight, false); 
                    this.poolThreejsCamera.aspect = clientWidth / clientHeight; 
                    this.poolThreejsCamera.updateProjectionMatrix(); 
                }
                if (this.poolControls) this.poolControls.update(); 
                this.poolThreejsRenderer.render(this.poolThreejsScene, this.poolThreejsCamera); 
            };
            animate();

            this.poolThreejsCamera.lookAt(0, -this.POOL_DEPTH/2, 0);

        } catch (error) {
            console.error('Error initializing pool 3D visualization:', error);
            this.showNotification('خطا در بارگذاری نمایش سه‌بعدی استخر', 'error');
        }
    }
    
    createOrUpdateWater(height) {
        if (!this.poolGroup) return;
        
        if (this.waterMesh) { 
            this.poolGroup.remove(this.waterMesh); 
            this.waterMesh.geometry.dispose(); 
        }
        const h = Math.max(0.01, height);
        const geom = new THREE.BoxGeometry(this.POOL_LENGTH*0.98, h, this.POOL_WIDTH*0.98);
        this.waterMesh = new THREE.Mesh(geom, this.waterMat);
        this.waterMesh.position.set(0, -this.POOL_DEPTH + h/2, 0);
        this.poolGroup.add(this.waterMesh);
        this.waterPlane.position.set(0, -this.POOL_DEPTH + h, 0);
    }

    create3DPool() {
        // Create beautiful pool structure using the new approach
        this.poolGroup = new THREE.Group();
        
        // Pool dimensions
        const POOL_WIDTH = 8;
        const POOL_LENGTH = 6;
        this.POOL_DEPTH = 3;
        const WALL_THICKNESS = 0.3;
        
        // Create pool walls with beautiful blue tiles texture
        const wallMaterial = new THREE.MeshPhongMaterial({
            color: 0x4A90E2,
            shininess: 100,
            specular: 0x222222
        });
        
        // Bottom of pool
        const bottomGeometry = new THREE.BoxGeometry(POOL_WIDTH, 0.2, POOL_LENGTH);
        const bottomMaterial = new THREE.MeshPhongMaterial({
            color: 0x87CEEB,
            shininess: 50
        });
        const bottom = new THREE.Mesh(bottomGeometry, bottomMaterial);
        bottom.position.set(0, -this.POOL_DEPTH - 0.1, 0);
        bottom.receiveShadow = true;
        this.poolGroup.add(bottom);
        
        // Pool walls
        // Front wall
        const frontWall = new THREE.Mesh(
            new THREE.BoxGeometry(POOL_WIDTH + WALL_THICKNESS * 2, this.POOL_DEPTH, WALL_THICKNESS),
            wallMaterial
        );
        frontWall.position.set(0, -this.POOL_DEPTH/2, POOL_LENGTH/2 + WALL_THICKNESS/2);
        frontWall.castShadow = true;
        frontWall.receiveShadow = true;
        this.poolGroup.add(frontWall);
        
        // Back wall
        const backWall = new THREE.Mesh(
            new THREE.BoxGeometry(POOL_WIDTH + WALL_THICKNESS * 2, this.POOL_DEPTH, WALL_THICKNESS),
            wallMaterial
        );
        backWall.position.set(0, -this.POOL_DEPTH/2, -POOL_LENGTH/2 - WALL_THICKNESS/2);
        backWall.castShadow = true;
        backWall.receiveShadow = true;
        this.poolGroup.add(backWall);
        
        // Left wall
        const leftWall = new THREE.Mesh(
            new THREE.BoxGeometry(WALL_THICKNESS, this.POOL_DEPTH, POOL_LENGTH),
            wallMaterial
        );
        leftWall.position.set(-POOL_WIDTH/2 - WALL_THICKNESS/2, -this.POOL_DEPTH/2, 0);
        leftWall.castShadow = true;
        leftWall.receiveShadow = true;
        this.poolGroup.add(leftWall);
        
        // Right wall
        const rightWall = new THREE.Mesh(
            new THREE.BoxGeometry(WALL_THICKNESS, this.POOL_DEPTH, POOL_LENGTH),
            wallMaterial
        );
        rightWall.position.set(POOL_WIDTH/2 + WALL_THICKNESS/2, -this.POOL_DEPTH/2, 0);
        rightWall.castShadow = true;
        rightWall.receiveShadow = true;
        this.poolGroup.add(rightWall);
        
        // Create water plane for clipping
        this.waterPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), this.POOL_DEPTH);
        
        // Add pool group to scene
        this.poolThreejsScene.add(this.poolGroup);
        
        // Add pool decorations
        this.addPoolDecorations();
        
        // Ground plane
        const groundGeometry = new THREE.PlaneGeometry(20, 20);
        const groundMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x90EE90,
            transparent: true,
            opacity: 0.8
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.1;
        ground.receiveShadow = true;
        this.poolThreejsScene.add(ground);
    }
    
    addPoolDecorations() {
        // Pool ladder
        const ladderMaterial = new THREE.MeshPhongMaterial({ color: 0xC0C0C0 });
        
        // Ladder rails
        const railGeometry = new THREE.CylinderGeometry(0.05, 0.05, 2.5);
        const leftRail = new THREE.Mesh(railGeometry, ladderMaterial);
        leftRail.position.set(-2.8, 1.25, 2.2);
        leftRail.castShadow = true;
        this.poolThreejsScene.add(leftRail);
        
        const rightRail = new THREE.Mesh(railGeometry, ladderMaterial);
        rightRail.position.set(-2.5, 1.25, 2.2);
        rightRail.castShadow = true;
        this.poolThreejsScene.add(rightRail);
        
        // Ladder steps
        const stepGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.3);
        for (let i = 0; i < 4; i++) {
            const step = new THREE.Mesh(stepGeometry, ladderMaterial);
            step.position.set(-2.65, 0.3 + i * 0.4, 2.2);
            step.rotation.z = Math.PI / 2;
            step.castShadow = true;
            this.poolThreejsScene.add(step);
        }
        
        // Pool tiles around the edge
        const tileGeometry = new THREE.BoxGeometry(0.5, 0.05, 0.5);
        const tileMaterial = new THREE.MeshPhongMaterial({ 
            color: 0xF0F8FF,
            shininess: 80
        });
        
        // Add tiles around pool perimeter
        for (let x = -3.5; x <= 3.5; x += 0.5) {
            for (let z = -2.5; z <= 2.5; z += 0.5) {
                if (Math.abs(x) > 3.2 || Math.abs(z) > 2.2) {
                    const tile = new THREE.Mesh(tileGeometry, tileMaterial);
                    tile.position.set(x, 0.125, z);
                    tile.castShadow = true;
                    tile.receiveShadow = true;
                    this.poolThreejsScene.add(tile);
                }
            }
        }
    }
    
    create3DWell() {
        // Only proceed if original 3D scene is available
        if (!this.threejsScene) {
            console.warn('Original 3D scene not available, skipping well creation');
            return;
        }
        
        // Enhanced Well cylinder with better materials - Made much larger
        const wellGeometry = new THREE.CylinderGeometry(3.0, 3.0, 8, 64);
        const wellMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x8B4513,
            transparent: true,
            opacity: 0.9,
            shininess: 30,
            specular: 0x222222
        });
        const well = new THREE.Mesh(wellGeometry, wellMaterial);
        well.position.y = 4;
        well.castShadow = true;
        well.receiveShadow = true;
        this.threejsScene.add(well);
        
        // Well inner cylinder (hollow effect) - Made much larger
        const innerWellGeometry = new THREE.CylinderGeometry(2.8, 2.8, 8.1, 64);
        const innerWellMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x654321,
            transparent: true,
            opacity: 0.7,
            side: THREE.BackSide
        });
        const innerWell = new THREE.Mesh(innerWellGeometry, innerWellMaterial);
        innerWell.position.y = 4;
        this.threejsScene.add(innerWell);
        
        // Well rim/top - Made much larger
        const rimGeometry = new THREE.TorusGeometry(3.2, 0.2, 16, 100);
        const rimMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x696969,
            shininess: 100,
            specular: 0x444444
        });
        const rim = new THREE.Mesh(rimGeometry, rimMaterial);
        rim.position.y = 8;
        rim.castShadow = true;
        this.threejsScene.add(rim);
        
        // Store well dimensions for water calculation
        this.wellRadius = 2.8;
        this.wellBottom = 0;
        this.wellTop = 8;
        
        // Water (will be updated based on level)
        this.waterMesh = null;
        this.updateWater3D(0);
        
        // Enhanced Ground with texture-like appearance
        const groundGeometry = new THREE.PlaneGeometry(20, 20, 32, 32);
        const groundMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x90EE90,
            transparent: true,
            opacity: 0.9
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.threejsScene.add(ground);
        
        // Add some decorative elements around the well
        this.addWellDecorations();
    }
    
    addWellDecorations() {
        // Only proceed if original 3D scene is available
        if (!this.threejsScene) {
            console.warn('Original 3D scene not available, skipping well decorations');
            return;
        }
        
        // Add some rocks around the well
        for (let i = 0; i < 8; i++) {
            const rockGeometry = new THREE.SphereGeometry(0.1 + Math.random() * 0.2, 8, 6);
            const rockMaterial = new THREE.MeshLambertMaterial({ 
                color: 0x696969 + Math.random() * 0x222222
            });
            const rock = new THREE.Mesh(rockGeometry, rockMaterial);
            
            const angle = (i / 8) * Math.PI * 2;
            const radius = 2 + Math.random() * 1;
            rock.position.x = Math.cos(angle) * radius;
            rock.position.z = Math.sin(angle) * radius;
            rock.position.y = 0.1;
            rock.castShadow = true;
            this.threejsScene.add(rock);
        }
        
        // Add measurement markers on the well
        for (let i = 1; i <= 5; i++) {
            const markerGeometry = new THREE.RingGeometry(1.15, 1.25, 32);
            const markerMaterial = new THREE.MeshBasicMaterial({ 
                color: 0xFFFFFF,
                transparent: true,
                opacity: 0.8,
                side: THREE.DoubleSide
            });
            const marker = new THREE.Mesh(markerGeometry, markerMaterial);
            marker.position.y = i;
            marker.rotation.x = Math.PI / 2;
            this.threejsScene.add(marker);
        }
    }
    
    updateWater3D(waterLevel) {
        // Only proceed if original 3D scene is available
        if (!this.threejsScene) {
            console.warn('Original 3D scene not available, skipping water update');
            return;
        }
        
        // Remove existing water and surface
        if (this.waterMesh) {
            this.threejsScene.remove(this.waterMesh);
        }
        if (this.waterSurface) {
            this.threejsScene.remove(this.waterSurface);
        }
        if (this.waterLevelText) {
            this.threejsScene.remove(this.waterLevelText);
        }
        if (this.waterLevelIndicator) {
            this.threejsScene.remove(this.waterLevelIndicator);
        }
        
        if (waterLevel > 0) {
            // Calculate water height with proper scaling to match 2D chart
            const maxWellHeight = this.wellTop || 8;
            const maxWaterLevel = 10; // Maximum expected water level in meters
            // Scale water level proportionally to well height
            const waterHeight = Math.min((waterLevel / maxWaterLevel) * maxWellHeight, maxWellHeight);
            const waterRadius = this.wellRadius || 2.8;
            
            // Create beautiful water cylinder with clearer blue color
            const waterGeometry = new THREE.CylinderGeometry(waterRadius - 0.05, waterRadius - 0.05, waterHeight, 64);
            const waterMaterial = new THREE.MeshPhongMaterial({ 
                color: 0x0077BE,  // Clearer, more vibrant blue
                transparent: true,
                opacity: 0.85,     // Slightly more transparent to see the surface better
                shininess: 200,
                specular: 0x87CEEB,
                reflectivity: 0.6
            });
            this.waterMesh = new THREE.Mesh(waterGeometry, waterMaterial);
            this.waterMesh.position.y = waterHeight / 2;
            this.waterMesh.castShadow = false;
            this.waterMesh.receiveShadow = true;
            this.threejsScene.add(this.waterMesh);
            
            // Add highly visible water surface with animated ripple effect
            const surfaceGeometry = new THREE.CircleGeometry(waterRadius - 0.05, 64);
            const surfaceMaterial = new THREE.MeshPhongMaterial({ 
                color: 0x00BFFF,  // Bright cyan for better visibility
                transparent: true,
                opacity: 0.95,    // More opaque surface
                shininess: 500,
                specular: 0xFFFFFF,
                side: THREE.DoubleSide,
                emissive: 0x001122  // Slight glow effect
            });
            this.waterSurface = new THREE.Mesh(surfaceGeometry, surfaceMaterial);
            this.waterSurface.position.y = waterHeight + 0.02;
            this.waterSurface.rotation.x = -Math.PI / 2;
            this.threejsScene.add(this.waterSurface);
            
            // Add water level indicator ring around the surface
            const ringGeometry = new THREE.RingGeometry(waterRadius - 0.05, waterRadius + 0.1, 32);
            const ringMaterial = new THREE.MeshBasicMaterial({ 
                color: 0xFFFF00,  // Bright yellow ring
                transparent: true,
                opacity: 0.8,
                side: THREE.DoubleSide
            });
            this.waterLevelIndicator = new THREE.Mesh(ringGeometry, ringMaterial);
            this.waterLevelIndicator.position.y = waterHeight + 0.03;
            this.waterLevelIndicator.rotation.x = -Math.PI / 2;
            this.threejsScene.add(this.waterLevelIndicator);
            
            // Add water level text display
            this.addWaterLevelText(waterLevel, waterHeight, waterRadius);
        }
    }
    
    addWaterLevelText(waterLevel, waterHeight, waterRadius) {
        // Only proceed if original 3D scene is available
        if (!this.threejsScene) {
            console.warn('Original 3D scene not available, skipping water level text');
            return;
        }
        
        // Create text geometry for water level display
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 320;
        canvas.height = 160;
        
        // Set text style
        context.fillStyle = '#ffffff';
        context.font = 'bold 28px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        
        // Add background with rounded corners
        context.fillStyle = 'rgba(0, 0, 0, 0.8)';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        // Add border
        context.strokeStyle = '#00BFFF';
        context.lineWidth = 3;
        context.strokeRect(3, 3, canvas.width - 6, canvas.height - 6);
        
        // Add main text
        context.fillStyle = '#00BFFF';
        context.fillText(`سطح آب: ${waterLevel.toFixed(2)} متر`, canvas.width / 2, canvas.height / 2 - 15);
        
        // Add secondary info
        context.font = 'bold 18px Arial';
        context.fillStyle = '#FFFFFF';
        context.fillText(`Water Level: ${waterLevel.toFixed(2)}m`, canvas.width / 2, canvas.height / 2 + 15);
        
        // Create texture and material
        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
        this.waterLevelText = new THREE.Sprite(spriteMaterial);
        
        // Position the text next to the well
        this.waterLevelText.position.set(waterRadius + 2.5, waterHeight + 1.5, 0);
        this.waterLevelText.scale.set(3, 1.5, 1);
        
        this.threejsScene.add(this.waterLevelText);
    }
    
    updateChart() {
        if (!this.waterLevelChart || this.waterLevelData.length === 0) return;
        
        // Use only the required number of data points for chart display
        const chartData = this.waterLevelData.slice(0, this.currentDataCount);
        
        const labels = chartData.slice().reverse().map(item => {
            const date = new Date(item.timestamp);
            return date.toLocaleTimeString('fa-IR', { 
                hour: '2-digit', 
                minute: '2-digit',
                day: '2-digit',
                month: '2-digit'
            });
        });
        
        const data = chartData.slice().reverse().map(item => item.water_level);
        const criticalLevel = new Array(data.length).fill(1.5); // Critical level at 1.5 meters
        
        this.waterLevelChart.data.labels = labels;
        this.waterLevelChart.data.datasets[0].data = data;
        this.waterLevelChart.data.datasets[1].data = criticalLevel;
        
        // Update colors based on theme
        const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-color').trim();
        const borderColor = getComputedStyle(document.documentElement).getPropertyValue('--border-color').trim();
        
        this.waterLevelChart.options.plugins.title.color = textColor;
        this.waterLevelChart.options.plugins.legend.labels.color = textColor;
        this.waterLevelChart.options.scales.y.title.color = textColor;
        this.waterLevelChart.options.scales.y.ticks.color = textColor;
        this.waterLevelChart.options.scales.y.grid.color = borderColor;
        this.waterLevelChart.options.scales.x.title.color = textColor;
        this.waterLevelChart.options.scales.x.ticks.color = textColor;
        this.waterLevelChart.options.scales.x.grid.color = borderColor;
        
        this.waterLevelChart.update('active');
    }
    
    update3DVisualization() {
        let currentLevel = 2.0; // Default water level
        
        if (this.waterLevelData.length > 0) {
            currentLevel = this.waterLevelData[0].water_level;
        }
        
        console.log('🔄 Updating 3D visualization with water level:', currentLevel);
        
        // Always update 3D visualization with current level (default or real data)
        if (this.enhanced3DWell && typeof this.enhanced3DWell.updateWaterLevel === 'function') {
            console.log('🎯 Using enhanced 3D well with level:', currentLevel);
            this.enhanced3DWell.updateWaterLevel(currentLevel);
        } else {
            // Fallback to original 3D visualization
            console.log('🎯 Using fallback 3D visualization with level:', currentLevel);
            this.updateWater3D(currentLevel);
        }
    }
    
    updateHistoryTable() {
        const tbody = document.getElementById('waterHistoryBody');
        if (!tbody) return;
        
        if (this.waterLevelData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center">داده‌ای یافت نشد</td></tr>';
            return;
        }
        
        const minLevel = 0.5; // Default minimum level
            const maxLevel = 5.0; // Default maximum level
        
        // Show all data for history table
        const tableData = this.waterLevelData;
        
        tbody.innerHTML = tableData.map((item, index) => {
            const date = new Date(item.timestamp);
            const timeStr = date.toLocaleString('fa-IR');
            
            let status = 'نرمال';
            let statusClass = 'text-success';
            
            if (item.water_level < minLevel) {
                status = 'پایین';
                statusClass = 'text-danger';
            } else if (item.water_level > maxLevel) {
                status = 'بالا';
                statusClass = 'text-warning';
            }
            
            return `
                <tr>
                    <td>${index + 1}</td>
                    <td>${timeStr}</td>
                    <td>${item.water_level.toFixed(3)}</td>
                    <td><span class="${statusClass}">${status}</span></td>
                </tr>
            `;
        }).join('');
    }
    
    updatePoolChart() {
        if (!this.poolLevelChart || this.poolLevelData.length === 0) return;
        
        // Use only the required number of data points for chart display
        const chartData = this.poolLevelData.slice(0, this.poolCurrentDataCount);
        
        const labels = chartData.slice().reverse().map(item => {
            const date = new Date(item.timestamp);
            return date.toLocaleTimeString('fa-IR', { 
                hour: '2-digit', 
                minute: '2-digit',
                day: '2-digit',
                month: '2-digit'
            });
        });
        
        const data = chartData.slice().reverse().map(item => item.pool_level);
        const criticalLevel = new Array(data.length).fill(1.5); // Critical level at 1.5 meters
        
        this.poolLevelChart.data.labels = labels;
        this.poolLevelChart.data.datasets[0].data = data;
        this.poolLevelChart.data.datasets[1].data = criticalLevel;
        
        // Update colors based on theme
        const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-color').trim();
        const borderColor = getComputedStyle(document.documentElement).getPropertyValue('--border-color').trim();
        
        this.poolLevelChart.options.plugins.title.color = textColor;
        this.poolLevelChart.options.plugins.legend.labels.color = textColor;
        this.poolLevelChart.options.scales.y.title.color = textColor;
        this.poolLevelChart.options.scales.y.ticks.color = textColor;
        this.poolLevelChart.options.scales.y.grid.color = borderColor;
        this.poolLevelChart.options.scales.x.title.color = textColor;
        this.poolLevelChart.options.scales.x.ticks.color = textColor;
        this.poolLevelChart.options.scales.x.grid.color = borderColor;
        
        this.poolLevelChart.update('active');
    }
    
    updatePool3DVisualization() {
        if (this.poolLevelData.length > 0) {
            const currentLevel = this.poolLevelData[0].pool_level;
            this.updatePoolWater3D(currentLevel);
        }
    }
    
    updatePoolHistoryTable() {
        const tbody = document.getElementById('poolHistoryBody');
        if (!tbody) return;
        
        if (this.poolLevelData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center">داده‌ای یافت نشد</td></tr>';
            return;
        }
        
        const minLevel = 0.5; // Default minimum pool level
            const maxLevel = 5.0; // Default maximum pool level
        
        // Show all data for pool history table
        const tableData = this.poolLevelData;
        
        tbody.innerHTML = tableData.map((item, index) => {
            const date = new Date(item.timestamp);
            const timeStr = date.toLocaleString('fa-IR');
            
            let status = 'نرمال';
            let statusClass = 'text-success';
            
            if (item.pool_level < minLevel) {
                status = 'پایین';
                statusClass = 'text-danger';
            } else if (item.pool_level > maxLevel) {
                status = 'بالا';
                statusClass = 'text-warning';
            }
            
            return `
                <tr>
                    <td>${index + 1}</td>
                    <td>${timeStr}</td>
                    <td>${item.pool_level.toFixed(3)}</td>
                    <td><span class="${statusClass}">${status}</span></td>
                </tr>
            `;
        }).join('');
    }
    
    updatePoolWater3D(poolLevel) {
        if (!this.poolGroup) return;
        
        try {
            // Convert pool level to height in meters (assuming poolLevel is in meters)
            const waterHeight = Math.min(poolLevel, this.POOL_DEPTH); // Cap at pool depth
            
            if (waterHeight > 0) {
                this.createOrUpdateWater(waterHeight);
            } else {
                // Remove water if level is 0 or negative
                if (this.waterMesh) {
                    this.poolGroup.remove(this.waterMesh);
                    this.waterMesh.geometry.dispose();
                    this.waterMesh = null;
                }
                this.waterPlane.position.set(0, -this.POOL_DEPTH, 0);
            }
        } catch (error) {
            console.error('Error updating pool water 3D:', error);
        }
    }
    
    addPoolLevelText(poolLevel, waterHeight, poolRadius) {
        // Create text geometry for pool level display
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 360;
        canvas.height = 180;
        
        // Set text style
        context.fillStyle = '#ffffff';
        context.font = 'bold 30px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        
        // Add background with rounded corners
        context.fillStyle = 'rgba(0, 0, 0, 0.85)';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        // Add border
        context.strokeStyle = '#00BFFF';
        context.lineWidth = 4;
        context.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);
        
        // Add main text
        context.fillStyle = '#00BFFF';
        context.fillText(`سطح آب استخر: ${poolLevel.toFixed(2)} متر`, canvas.width / 2, canvas.height / 2 - 20);
        
        // Add secondary info
        context.font = 'bold 20px Arial';
        context.fillStyle = '#FFFFFF';
        context.fillText(`Pool Water Level: ${poolLevel.toFixed(2)}m`, canvas.width / 2, canvas.height / 2 + 20);
        
        // Add status indicator
        context.font = 'bold 16px Arial';
        let statusText = 'وضعیت: نرمال';
        let statusColor = '#00FF00';
        if (poolLevel < 1.0) {
            statusText = 'وضعیت: پایین - خطر';
            statusColor = '#FF0000';
        } else if (poolLevel < 2.0) {
            statusText = 'وضعیت: متوسط - هشدار';
            statusColor = '#FFA500';
        }
        context.fillStyle = statusColor;
        context.fillText(statusText, canvas.width / 2, canvas.height / 2 + 50);
        
        // Create texture and material
        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
        this.poolLevelText = new THREE.Sprite(spriteMaterial);
        
        // Position the text next to the pool
        this.poolLevelText.position.set(poolRadius + 3, waterHeight + 2, 0);
        this.poolLevelText.scale.set(3.5, 2, 1);
        
        this.poolThreejsScene.add(this.poolLevelText);
    }
    
    changeDataCount(count) {
        this.currentDataCount = count;
        
        // Update button states
        document.querySelectorAll('.data-count-btn').forEach(btn => {
            btn.classList.remove('active');
            if (parseInt(btn.dataset.count) === count) {
                btn.classList.add('active');
            }
        });
        
        // Reload data with new count
        this.loadInitialWaterData();
    }
    
    changePoolDataCount(count) {
        this.poolCurrentDataCount = count;
        
        // Update button states
        document.querySelectorAll('.data-count-btn-pool').forEach(btn => {
            btn.classList.remove('active');
            if (parseInt(btn.dataset.count) === count) {
                btn.classList.add('active');
            }
        });
        
        // Reload pool data with new count
        this.loadInitialPoolData();
    }
    
    changeViewMode(mode) {
        this.currentViewMode = mode;
        
        // Update button states
        document.querySelectorAll('.view-mode-btn').forEach(btn => {
            btn.classList.remove('active');
            btn.classList.add('btn-outline-primary');
            btn.classList.remove('btn-primary');
            
            if (btn.dataset.mode === mode) {
                btn.classList.add('active', 'btn-primary');
                btn.classList.remove('btn-outline-primary');
            }
        });
        
        // Show/hide containers
        const chart2d = document.getElementById('chart2d-container');
        const chart3d = document.getElementById('chart3d-container');
        const crossSection = document.getElementById('cross-section-container');
        
        // Hide all containers first
        chart2d.style.display = 'none';
        chart3d.style.display = 'none';
        crossSection.style.display = 'none';
        
        // حذف کلاس‌های حالت قبلی از بادی
        document.body.classList.remove('view-mode-2d', 'view-mode-3d', 'view-mode-cross-section');
        
        if (mode === '2d') {
            chart2d.style.display = 'block';
            document.body.classList.add('view-mode-2d');
        } else if (mode === 'cross-section') {
            crossSection.style.display = 'block';
            document.body.classList.add('view-mode-cross-section');
            // Update cross-sectional view with current data
            this.updateWellCrossSection();
        } else if (mode === '3d') {
            chart3d.style.display = 'block';
            document.body.classList.add('view-mode-3d');
            
            // Use the new Enhanced3DWellVisualization if available
            if (typeof Enhanced3DWellVisualization !== 'undefined') {
                // The new 3D visualization is already initialized in index.html
                // Just ensure it's visible and properly sized
                const container = document.getElementById('chart3d-container');
                if (container) {
                    container.style.display = 'block';
                }
            } else {
                // Fallback to original 3D visualization
                if (this.threejsRenderer) {
                    const container = document.getElementById('threejs-container');
                    this.threejsCamera.aspect = container.clientWidth / 1200;
            this.threejsCamera.updateProjectionMatrix();
            this.threejsRenderer.setSize(container.clientWidth, 1200);
                }
            }
        }
    }
    
    changePoolViewMode(mode) {
        this.poolCurrentViewMode = mode;
        
        // Update button states
        document.querySelectorAll('.pool-view-mode-btn').forEach(btn => {
            btn.classList.remove('active');
            btn.classList.add('btn-outline-primary');
            btn.classList.remove('btn-primary');
            
            if (btn.dataset.mode === mode) {
                btn.classList.add('active', 'btn-primary');
                btn.classList.remove('btn-outline-primary');
            }
        });
        
        // Show/hide containers
        const poolChart2d = document.getElementById('chart2d-container-pool');
        const poolChart3d = document.getElementById('chart3d-container-pool');
        const poolCrossSection = document.getElementById('cross-section-container-pool');
        
        // Hide all containers first
        poolChart2d.style.display = 'none';
        poolChart3d.style.display = 'none';
        poolCrossSection.style.display = 'none';
        
        if (mode === '2d') {
            poolChart2d.style.display = 'block';
        } else if (mode === 'cross-section') {
            poolCrossSection.style.display = 'block';
            // Update cross-sectional view with current data
            this.updatePoolCrossSection();
        } else if (mode === '3d') {
            poolChart3d.style.display = 'block';
            
            // Resize 3D renderer with fixed height
            if (this.poolThreejsRenderer) {
                const container = document.getElementById('threejs-container-pool');
                this.poolThreejsCamera.aspect = container.clientWidth / 1200;
            this.poolThreejsCamera.updateProjectionMatrix();
            this.poolThreejsRenderer.setSize(container.clientWidth, 1200);
            }
        }
    }
    
    
    async controlMotor(motorId, action) {
        const userid = this.userid || sessionStorage.getItem('userid');
        const session = this.session || sessionStorage.getItem('session');
        const macaddress = this.deviceMac || sessionStorage.getItem('selectedDeviceMacAddress') || sessionStorage.getItem('agricultureserial');
        
        if (!userid || !session || !macaddress) {
            this.showNotification('اطلاعات جلسه یافت نشد. لطفاً از طریق لیست دستگاه‌ها وارد شوید.', 'error');
            return;
        }
        
        // Update the target motor status
        const newMotorStatus = { ...this.motorStatus };
        newMotorStatus[motorId] = action;
        
        // Create combined payload with both motor states
        const motor1State = newMotorStatus.motor1 === 'on' ? 'ON' : 'OFF';
        const motor2State = newMotorStatus.motor2 === 'on' ? 'ON' : 'OFF';
        const payload = `o1_${motor1State}&o2_${motor2State}`;
        
        // Don't change motor status here - it will be updated immediately when next MQTT message arrives
        // Motor status will be updated instantly when MQTT message with O1/O2 is received
        
        // Disable buttons during request
        const onBtn = document.getElementById(`${motorId}OnBtn`);
        const offBtn = document.getElementById(`${motorId}OffBtn`);
        if (onBtn) onBtn.disabled = true;
        if (offBtn) offBtn.disabled = true;
        
        try {
            // Get applicationId from session storage (saved by getLorawanDeviceInfo)
            const applicationId = sessionStorage.getItem('applicationId');
            
            if (!applicationId) {
                this.showNotification('شناسه اپلیکیشن یافت نشد. لطفاً صفحه را بازخوانی کنید.', 'error');
                return;
            }
            
            // Prepare POST data for sendloradownlink API
            const postData = {
                userid: userid,
                session: session,
                macaddress: macaddress,
                cmdpayload: payload,
                applicationId: applicationId
            };
            
            console.log('Sending motor control request:', postData);
            
            const response = await fetch('https://api.giot.ir/sendloradownlink', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(postData)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            console.log('Motor control response:', result);
            
            if (result.status === 'success') {
                this.showNotification(`دستور ${action === 'on' ? 'روشن کردن' : 'خاموش کردن'} ${motorId === 'motor1' ? 'موتور اول' : 'موتور دوم'} ارسال شد. وضعیت با دریافت پیام بعدی بروزرسانی می‌شود.`, 'info');
                // Status will be updated immediately when next MQTT message with O1/O2 is received
            } else {
                // Don't change motor status on API failure - keep current status
                // Motor status will only be updated via incoming MQTT messages with O1/O2 values
                
                // Handle different error reasons
                let errorMessage = 'خطای نامشخص';
                if (result.reason) {
                    switch (result.reason) {
                        case 'Session is invalid':
                            errorMessage = 'جلسه نامعتبر است. لطفاً دوباره وارد شوید.';
                            break;
                        case 'Device access not found':
                            errorMessage = 'دسترسی به دستگاه یافت نشد.';
                            break;
                        case 'Payload exceeds maximum size of 220 bytes':
                            errorMessage = 'اندازه داده ارسالی بیش از حد مجاز است.';
                            break;
                        case 'Failed to send LoRaWAN downlink':
                            errorMessage = 'خطا در ارسال دستور به دستگاه.';
                            break;
                        default:
                            errorMessage = result.reason;
                    }
                }
                
                this.showNotification(`خطا در ارسال دستور ${motorId === 'motor1' ? 'موتور اول' : 'موتور دوم'}: ${errorMessage}`, 'error');
            }
        } catch (error) {
            console.error('Motor control error:', error);
            // Don't change motor status on error - keep current status
            // Motor status will only be updated via incoming MQTT messages with O1/O2 values
            this.showNotification('خطا در ارتباط با سرور', 'error');
        } finally {
            // Re-enable buttons
            if (onBtn) onBtn.disabled = false;
            if (offBtn) offBtn.disabled = false;
        }
    }
    
    updateMotorStatus(motorId) {
        const statusText = document.getElementById(`${motorId}StatusText`);
        const motorIcon = document.getElementById(`${motorId}Icon`);
        
        if (statusText && motorIcon) {
            if (this.motorStatus[motorId] === 'on') {
                statusText.textContent = 'روشن';
                statusText.className = 'motor-status-text running';
                motorIcon.classList.add('running');
            } else {
                statusText.textContent = 'خاموش';
                statusText.className = 'motor-status-text';
                motorIcon.classList.remove('running');
            }
        }
    }
    
    addCommandHistory(motorId, command, status, message) {
        const tbody = document.getElementById('commandHistoryBody');
        if (!tbody) return;
        
        const now = new Date();
        const timeStr = now.toLocaleString('fa-IR');
        const motorName = motorId === 'motor1' ? 'موتور اول' : 'موتور دوم';
        const commandText = command === 'on' ? `روشن کردن ${motorName}` : `خاموش کردن ${motorName}`;
        const statusClass = status === 'موفق' ? 'text-success' : 'text-danger';
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${timeStr}</td>
            <td>${commandText}</td>
            <td><span class="${statusClass}">${status}</span></td>
            <td>${message}</td>
        `;
        
        tbody.insertBefore(row, tbody.firstChild);
        
        // Keep only last 10 commands
        while (tbody.children.length > 10) {
            tbody.removeChild(tbody.lastChild);
        }
    }
    
    saveGeneralSettings() {
        // Refresh device info from API
        this.getLorawanDeviceInfo().then(() => {
            this.showNotification('اطلاعات دستگاه به‌روزرسانی شد', 'success');
        }).catch(error => {
            console.error('Failed to refresh device info:', error);
            this.showNotification('خطا در به‌روزرسانی اطلاعات دستگاه', 'error');
        });
    }
    
    resetSettings() {
        // Only reset elements that exist (some were removed from general settings)
        const deviceNameEl = document.getElementById('deviceName');
        const deviceLocationEl = document.getElementById('deviceLocation');
        const lowWaterAlertEl = document.getElementById('lowWaterAlert');
        const motorStatusAlertEl = document.getElementById('motorStatusAlert');
        const minWaterLevelEl = document.getElementById('minWaterLevel');
        const maxWaterLevelEl = document.getElementById('maxWaterLevel');
        
        if (deviceNameEl) deviceNameEl.value = '';
        if (deviceLocationEl) deviceLocationEl.value = '';
        if (lowWaterAlertEl) lowWaterAlertEl.checked = true;
        if (motorStatusAlertEl) motorStatusAlertEl.checked = true;
        if (minWaterLevelEl) minWaterLevelEl.value = '0.5';
        if (maxWaterLevelEl) maxWaterLevelEl.value = '5.0';
        
        localStorage.removeItem('agricultureSettings');
        
        this.showNotification('تنظیمات بازنشانی شد', 'info');
    }
    
    loadSettings() {
        const savedSettings = localStorage.getItem('agricultureSettings');
        if (savedSettings) {
            try {
                const settings = JSON.parse(savedSettings);
                
                // Only load settings for elements that exist (some were removed from general settings)
                const deviceNameEl = document.getElementById('deviceName');
                const deviceLocationEl = document.getElementById('deviceLocation');
                const lowWaterAlertEl = document.getElementById('lowWaterAlert');
                const motorStatusAlertEl = document.getElementById('motorStatusAlert');
                const minWaterLevelEl = document.getElementById('minWaterLevel');
                const maxWaterLevelEl = document.getElementById('maxWaterLevel');
                
                if (deviceNameEl) deviceNameEl.value = settings.deviceName || '';
                if (deviceLocationEl) deviceLocationEl.value = settings.deviceLocation || '';
                if (lowWaterAlertEl) lowWaterAlertEl.checked = settings.lowWaterAlert !== false;
                if (motorStatusAlertEl) motorStatusAlertEl.checked = settings.motorStatusAlert !== false;
                if (minWaterLevelEl) minWaterLevelEl.value = settings.minWaterLevel || 0.5;
                if (maxWaterLevelEl) maxWaterLevelEl.value = settings.maxWaterLevel || 5.0;
            } catch (error) {
                console.error('Error loading settings:', error);
            }
        }
    }
    
    toggleTheme(isDark) {
        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
    }
    
    showNotification(message, type = 'info') {
        const notification = document.getElementById('notification');
        if (!notification) return;
        
        notification.textContent = message;
        notification.className = `${type}`;
        notification.style.display = 'block';
        
        // Play sound (muted to avoid autoplay issues)
        const sound = type === 'error' ? document.getElementById('AlarmnotificationSound') : document.getElementById('OKnotificationSound');
        if (sound) {
            // Enable sound only after user interaction
            sound.muted = false;
            sound.play().catch(e => {
                console.log('Could not play sound (autoplay blocked):', e.message);
                // Fallback: try to play muted
                sound.muted = true;
                sound.play().catch(err => console.log('Sound completely blocked:', err.message));
            });
        }
        
        // Auto hide after 5 seconds
        setTimeout(() => {
            notification.style.display = 'none';
        }, 5000);
    }

    formatTimestamp(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleString('fa-IR');
    }

    // Helper function to get data for specific date range
    async getDataForDateRange(startDate, endDate) {
        // Format dates to required format: "YYYY-MM-DD HH:mm:ss"
        const formatDate = (date) => {
            const d = new Date(date);
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const hours = String(d.getHours()).padStart(2, '0');
            const minutes = String(d.getMinutes()).padStart(2, '0');
            const seconds = String(d.getSeconds()).padStart(2, '0');
            return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
        };
        
        const startTime = formatDate(startDate);
        const endTime = formatDate(endDate);
        
        return await this.getSensorDataInTime(startTime, endTime);
    }
    
    // Helper function to get data for last N days
    async getDataForLastDays(days) {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        
        return await this.getDataForDateRange(startDate, endDate);
    }
    
    // Helper function to get data for today
    async getDataForToday() {
        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
        
        return await this.getDataForDateRange(startOfDay, endOfDay);
    }
    
    // Load data for custom time range from UI inputs
    async loadTimeRangeData() {
        const startInput = document.getElementById('startDateTime');
        const endInput = document.getElementById('endDateTime');
        
        if (!startInput.value || !endInput.value) {
            this.showNotification('لطفاً تاریخ و ساعت شروع و پایان را انتخاب کنید', 'warning');
            return;
        }
        
        const startDate = new Date(startInput.value);
        const endDate = new Date(endInput.value);
        
        if (startDate >= endDate) {
            this.showNotification('تاریخ شروع باید قبل از تاریخ پایان باشد', 'error');
            return;
        }
        
        try {
            this.showNotification('در حال بارگذاری داده‌ها...', 'info');
            const result = await this.getDataForDateRange(startDate, endDate);
            
            if (result && result.status === 'success' && result.data) {
                this.waterLevelData = result.data.map(item => {
                    let parsedData = {};
                    try {
                        if (typeof item.data === 'string') {
                            parsedData = JSON.parse(item.data);
                        } else if (typeof item.data === 'object') {
                            parsedData = item.data;
                        } else {
                            console.warn('Unexpected data type:', typeof item.data, item.data);
                            parsedData = {};
                        }
                    } catch (e) {
                        console.error('Error parsing item data:', e);
                        console.error('Raw data:', item.data);
                        console.error('Data type:', typeof item.data);
                        parsedData = {};
                    }
                    
                    return {
                        timestamp: item.time,
                        water_level: parseFloat(parsedData['I1'] || 0),
                        device_mac: parsedData.mac,
                        device_id: parsedData.id,
                        msg_id: parsedData.msg_id
                    };
                });
                
                this.updateWaterLevelDisplay();
                this.updateChart();
                this.update3DVisualization();
                this.updateHistoryTable();
                
                this.showNotification(`${result.data.length} رکورد داده بارگذاری شد`, 'success');
            } else {
                this.showNotification('داده‌ای در بازه زمانی انتخابی یافت نشد', 'warning');
            }
        } catch (error) {
            console.error('Error loading time range data:', error);
            this.showNotification('خطا در بارگذاری داده‌ها: ' + error.message, 'error');
        }
    }
    
    // Load today's data
    async loadTodayData() {
        try {
            this.showNotification('در حال بارگذاری داده‌های امروز...', 'info');
            const result = await this.getDataForToday();
            
            if (result && result.status === 'success' && result.data) {
                this.waterLevelData = result.data.map(item => {
                    let parsedData = {};
                    try {
                        if (typeof item.data === 'string') {
                            parsedData = JSON.parse(item.data);
                        } else if (typeof item.data === 'object') {
                            parsedData = item.data;
                        } else {
                            console.warn('Unexpected data type:', typeof item.data, item.data);
                            parsedData = {};
                        }
                    } catch (e) {
                        console.error('Error parsing item data:', e);
                        console.error('Raw data:', item.data);
                        console.error('Data type:', typeof item.data);
                        parsedData = {};
                    }
                    
                    return {
                        timestamp: item.time,
                        water_level: parseFloat(parsedData['I1'] || 0),
                        device_mac: parsedData.mac,
                        device_id: parsedData.id,
                        msg_id: parsedData.msg_id
                    };
                });
                
                this.updateWaterLevelDisplay();
                this.updateChart();
                this.update3DVisualization();
                this.updateHistoryTable();
                
                this.showNotification(`${result.data.length} رکورد داده امروز بارگذاری شد`, 'success');
                
                // Set today's date range in inputs
                const today = new Date();
                const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
                const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
                
                const startInput = document.getElementById('startDateTime');
                const endInput = document.getElementById('endDateTime');
                
                if (startInput) startInput.value = this.formatDateTimeLocal(startOfDay);
                if (endInput) endInput.value = this.formatDateTimeLocal(endOfDay);
            } else {
                this.showNotification('داده‌ای برای امروز یافت نشد', 'warning');
            }
        } catch (error) {
            console.error('Error loading today data:', error);
            this.showNotification('خطا در بارگذاری داده‌های امروز: ' + error.message, 'error');
        }
    }
    
    // Load data for last N days
    async loadLastDaysData(days) {
        try {
            this.showNotification(`در حال بارگذاری داده‌های ${days} روز گذشته...`, 'info');
            const result = await this.getDataForLastDays(days);
            
            if (result && result.status === 'success' && result.data) {
                this.waterLevelData = result.data.map(item => {
                    let parsedData = {};
                    try {
                        if (typeof item.data === 'string') {
                            parsedData = JSON.parse(item.data);
                        } else if (typeof item.data === 'object') {
                            parsedData = item.data;
                        } else {
                            console.warn('Unexpected data type:', typeof item.data, item.data);
                            parsedData = {};
                        }
                    } catch (e) {
                        console.error('Error parsing item data:', e);
                        console.error('Raw data:', item.data);
                        console.error('Data type:', typeof item.data);
                        parsedData = {};
                    }
                    
                    return {
                        timestamp: item.time,
                        water_level: parseFloat(parsedData['I1'] || 0),
                        device_mac: parsedData.mac,
                        device_id: parsedData.id,
                        msg_id: parsedData.msg_id
                    };
                });
                
                this.updateWaterLevelDisplay();
                this.updateChart();
                this.update3DVisualization();
                this.updateHistoryTable();
                
                this.showNotification(`${result.data.length} رکورد داده ${days} روز گذشته بارگذاری شد`, 'success');
                
                // Set date range in inputs
                const endDate = new Date();
                const startDate = new Date();
                startDate.setDate(startDate.getDate() - days);
                
                const startInput = document.getElementById('startDateTime');
                const endInput = document.getElementById('endDateTime');
                
                if (startInput) startInput.value = this.formatDateTimeLocal(startDate);
                if (endInput) endInput.value = this.formatDateTimeLocal(endDate);
            } else {
                this.showNotification(`داده‌ای برای ${days} روز گذشته یافت نشد`, 'warning');
            }
        } catch (error) {
            console.error('Error loading last days data:', error);
            this.showNotification(`خطا در بارگذاری داده‌های ${days} روز گذشته: ` + error.message, 'error');
        }
    }
    
    // Load pool data for custom time range from UI inputs
    async loadPoolTimeRangeData() {
        const startInput = document.getElementById('startDateTimePool');
        const endInput = document.getElementById('endDateTimePool');
        
        if (!startInput.value || !endInput.value) {
            this.showNotification('لطفاً تاریخ و ساعت شروع و پایان را انتخاب کنید', 'warning');
            return;
        }
        
        const startDate = new Date(startInput.value);
        const endDate = new Date(endInput.value);
        
        if (startDate >= endDate) {
            this.showNotification('تاریخ شروع باید قبل از تاریخ پایان باشد', 'error');
            return;
        }
        
        try {
            this.showNotification('در حال بارگذاری داده‌های استخر...', 'info');
            const result = await this.getDataForDateRange(startDate, endDate);
            
            if (result && result.status === 'success' && result.data) {
                this.poolLevelData = result.data.map(item => {
                    let parsedData = {};
                    try {
                        if (typeof item.data === 'string') {
                            parsedData = JSON.parse(item.data);
                        } else if (typeof item.data === 'object') {
                            parsedData = item.data;
                        } else {
                            console.warn('Unexpected data type:', typeof item.data, item.data);
                            parsedData = {};
                        }
                    } catch (e) {
                        console.error('Error parsing item data:', e);
                        console.error('Raw data:', item.data);
                        console.error('Data type:', typeof item.data);
                        parsedData = {};
                    }
                    
                    return {
                        timestamp: item.time,
                        pool_level: parseFloat(parsedData['I2'] || 0),
                        device_mac: parsedData.mac,
                        device_id: parsedData.id,
                        msg_id: parsedData.msg_id
                    };
                });
                
                this.updatePoolLevelDisplay();
                this.updatePoolChart();
                this.updatePool3DVisualization();
                this.updatePoolHistoryTable();
                
                this.showNotification(`${result.data.length} رکورد داده استخر بارگذاری شد`, 'success');
            } else {
                this.showNotification('داده‌ای برای بازه زمانی انتخابی یافت نشد', 'warning');
            }
        } catch (error) {
            console.error('Error loading pool time range data:', error);
            this.showNotification('خطا در بارگذاری داده‌های استخر: ' + error.message, 'error');
        }
    }
    
    // Load pool data for today
    async loadPoolTodayData() {
        try {
            this.showNotification('در حال بارگذاری داده‌های امروز استخر...', 'info');
            const result = await this.getDataForToday();
            
            if (result && result.status === 'success' && result.data) {
                this.poolLevelData = result.data.map(item => {
                    let parsedData = {};
                    try {
                        if (typeof item.data === 'string') {
                            parsedData = JSON.parse(item.data);
                        } else if (typeof item.data === 'object') {
                            parsedData = item.data;
                        } else {
                            console.warn('Unexpected data type:', typeof item.data, item.data);
                            parsedData = {};
                        }
                    } catch (e) {
                        console.error('Error parsing item data:', e);
                        console.error('Raw data:', item.data);
                        console.error('Data type:', typeof item.data);
                        parsedData = {};
                    }
                    
                    return {
                        timestamp: item.time,
                        pool_level: parseFloat(parsedData['I2'] || 0),
                        device_mac: parsedData.mac,
                        device_id: parsedData.id,
                        msg_id: parsedData.msg_id
                    };
                });
                
                this.updatePoolLevelDisplay();
                this.updatePoolChart();
                this.updatePool3DVisualization();
                this.updatePoolHistoryTable();
                
                this.showNotification(`${result.data.length} رکورد داده امروز استخر بارگذاری شد`, 'success');
                
                // Set today's date range in pool inputs
                const today = new Date();
                const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
                const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
                
                const startInput = document.getElementById('startDateTimePool');
                const endInput = document.getElementById('endDateTimePool');
                
                if (startInput) startInput.value = this.formatDateTimeLocal(startOfDay);
                if (endInput) endInput.value = this.formatDateTimeLocal(endOfDay);
            } else {
                this.showNotification('داده‌ای برای امروز یافت نشد', 'warning');
            }
        } catch (error) {
            console.error('Error loading pool today data:', error);
            this.showNotification('خطا در بارگذاری داده‌های امروز استخر: ' + error.message, 'error');
        }
    }
    
    // Load pool data for last N days
    async loadPoolLastDaysData(days) {
        try {
            this.showNotification(`در حال بارگذاری داده‌های ${days} روز گذشته استخر...`, 'info');
            const result = await this.getDataForLastDays(days);
            
            if (result && result.status === 'success' && result.data) {
                this.poolLevelData = result.data.map(item => {
                    let parsedData = {};
                    try {
                        if (typeof item.data === 'string') {
                            parsedData = JSON.parse(item.data);
                        } else if (typeof item.data === 'object') {
                            parsedData = item.data;
                        } else {
                            console.warn('Unexpected data type:', typeof item.data, item.data);
                            parsedData = {};
                        }
                    } catch (e) {
                        console.error('Error parsing item data:', e);
                        console.error('Raw data:', item.data);
                        console.error('Data type:', typeof item.data);
                        parsedData = {};
                    }
                    
                    return {
                        timestamp: item.time,
                        pool_level: parseFloat(parsedData['I2'] || 0),
                        device_mac: parsedData.mac,
                        device_id: parsedData.id,
                        msg_id: parsedData.msg_id
                    };
                });
                
                this.updatePoolLevelDisplay();
                this.updatePoolChart();
                this.updatePool3DVisualization();
                this.updatePoolHistoryTable();
                
                this.showNotification(`${result.data.length} رکورد داده ${days} روز گذشته استخر بارگذاری شد`, 'success');
                
                // Set date range in pool inputs
                const endDate = new Date();
                const startDate = new Date();
                startDate.setDate(startDate.getDate() - days);
                
                const startInput = document.getElementById('startDateTimePool');
                const endInput = document.getElementById('endDateTimePool');
                
                if (startInput) startInput.value = this.formatDateTimeLocal(startDate);
                if (endInput) endInput.value = this.formatDateTimeLocal(endDate);
            } else {
                this.showNotification(`داده‌ای برای ${days} روز گذشته یافت نشد`, 'warning');
            }
        } catch (error) {
            console.error('Error loading pool last days data:', error);
            this.showNotification(`خطا در بارگذاری داده‌های ${days} روز گذشته استخر: ` + error.message, 'error');
        }
    }

    // Helper function to format date for datetime-local input
    formatDateTimeLocal(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    }

    // Update well cross-sectional view
    updateWellCrossSection() {
        const currentLevel = this.currentWaterLevel || 0;
        const maxDepth = 10; // Maximum well depth in meters
        
        // Update water element
        const waterElement = document.getElementById('wellWater');
        const waterSurface = document.getElementById('wellWaterSurface');
        const bucket = document.getElementById('wellBucket');
        const levelIndicator = document.getElementById('wellWaterLevelIndicator');
        const statusIndicator = document.getElementById('wellStatusIndicator');
        
        if (waterElement && waterSurface && bucket) {
            // Calculate water height as percentage of well interior (350px height)
            const waterHeightPercent = Math.min((currentLevel / maxDepth) * 100, 100);
            const waterHeight = (waterHeightPercent / 100) * 350; // 350px is well interior height
            
            // Update water level
            waterElement.style.height = `${waterHeight}px`;
            
            // Position water surface animation at the top of water
            const surfaceTop = 350 - waterHeight;
            waterSurface.style.top = `${surfaceTop}px`;
            waterSurface.style.display = waterHeight > 0 ? 'block' : 'none';
            
            // Position bucket based on water level (bucket floats on water or sits at bottom)
            const bucketTop = waterHeight > 0 ? surfaceTop - 15 : 335; // 15px is bucket height
            bucket.style.top = `${bucketTop}px`;
        }
        
        // Update level indicator
        if (levelIndicator) {
            levelIndicator.textContent = `سطح آب: ${currentLevel.toFixed(2)} متر`;
        }
        
        // Update status indicator
        if (statusIndicator) {
            let status = 'نرمال';
            let statusClass = 'normal';
            
            if (currentLevel < 2) {
                status = 'کم آب';
                statusClass = 'low';
            } else if (currentLevel > 8) {
                status = 'پر آب';
                statusClass = 'high';
            }
            
            statusIndicator.textContent = `وضعیت: ${status}`;
            statusIndicator.className = `well-status ${statusClass}`;
        }
    }
    
    // Update pool cross-sectional view
    updatePoolCrossSection() {
        const currentLevel = this.currentPoolLevel || 0;
        const maxDepth = 2.5; // Maximum pool depth in meters
        
        // Update water element
        const waterElement = document.getElementById('poolWater');
        const waterSurface = document.getElementById('poolWaterSurface');
        const levelIndicator = document.getElementById('poolWaterLevelIndicator');
        const statusIndicator = document.getElementById('poolStatusIndicator');
        
        if (waterElement && waterSurface) {
            // Calculate water height as percentage of pool interior (280px height)
            const waterHeightPercent = Math.min((currentLevel / maxDepth) * 100, 100);
            const waterHeight = (waterHeightPercent / 100) * 280; // 280px is pool interior height
            
            // Update water level
            waterElement.style.height = `${waterHeight}px`;
            
            // Position water surface animation at the top of water
            const surfaceTop = 280 - waterHeight;
            waterSurface.style.top = `${surfaceTop}px`;
            waterSurface.style.display = waterHeight > 0 ? 'block' : 'none';
            
            // Change water color based on level
            if (currentLevel < 0.5) {
                waterElement.style.background = 'linear-gradient(to bottom, #E74C3C, #C0392B, #A93226)'; // Red for low
            } else if (currentLevel < 1.5) {
                waterElement.style.background = 'linear-gradient(to bottom, #F39C12, #E67E22, #D35400)'; // Orange for medium
            } else {
                waterElement.style.background = 'linear-gradient(to bottom, #5DADE2, #3498DB, #2E86C1)'; // Blue for normal
            }
        }
        
        // Update level indicator
        if (levelIndicator) {
            levelIndicator.textContent = `سطح آب: ${currentLevel.toFixed(2)} متر`;
        }
        
        // Update status indicator
        if (statusIndicator) {
            let status = 'نرمال';
            let statusClass = 'normal';
            
            if (currentLevel < 0.5) {
                status = 'کم آب';
                statusClass = 'low';
            } else if (currentLevel > 2.0) {
                status = 'پر آب';
                statusClass = 'high';
            }
            
            statusIndicator.textContent = `وضعیت: ${status}`;
            statusIndicator.className = `pool-status ${statusClass}`;
        }
    }

    destroy() {
        if (this.mqttClient) {
            this.mqttClient.end();
        }
        if (this.waterLevelChart) {
            this.waterLevelChart.destroy();
        }
    }
}

// Global functions for HTML onclick events
// Bootstrap tabs handle tab switching automatically
// Add event listener for chart reinitialization when water status tab is shown
document.addEventListener('shown.bs.tab', function (event) {
    if (event.target.id === 'water-status-tab') {
        setTimeout(() => {
            if (window.agricultureManager) {
                // Reload data from API when returning to water status tab
                window.agricultureManager.loadInitialWaterData();
                
                // Destroy existing chart before creating new one
                if (window.agricultureManager.waterLevelChart) {
                    window.agricultureManager.waterLevelChart.destroy();
                    window.agricultureManager.waterLevelChart = null;
                }
                window.agricultureManager.init2DChart();
                if (window.agricultureManager.currentViewMode === '3d') {
                    // Use the new Enhanced3DWellVisualization if available
                    if (typeof Enhanced3DWellVisualization !== 'undefined') {
                        // The new 3D visualization is already initialized in index.html
                        // No need to call init3DVisualization
                        console.log('Using new Enhanced3DWellVisualization');
                    } else {
                        // Fallback to original 3D visualization
                        window.agricultureManager.initOriginal3DVisualization();
                    }
                }
            }
        }, 100);
    }
    
    if (event.target.id === 'pool-status-tab') {
        setTimeout(() => {
            if (window.agricultureManager) {
                // Reload data from API when returning to pool status tab
                window.agricultureManager.loadInitialWaterData();
                
                // Destroy existing chart before creating new one
                if (window.agricultureManager.poolLevelChart) {
                    window.agricultureManager.poolLevelChart.destroy();
                    window.agricultureManager.poolLevelChart = null;
                }
                window.agricultureManager.initPool2DChart();
                if (window.agricultureManager.poolCurrentViewMode === '3d') {
                    window.agricultureManager.initPool3DVisualization();
                }
            }
        }, 100);
    }
    
    if (event.target.id === 'motor-settings-tab') {
        setTimeout(() => {
            if (window.agricultureManager) {
                // Load motor status when entering motor settings tab
                window.agricultureManager.loadMotorStatus();
            }
        }, 100);
    }
});

function controlMotor(motorId, action) {
    if (window.agricultureManager) {
        window.agricultureManager.controlMotor(motorId, action);
    }
}

function saveGeneralSettings() {
    if (window.agricultureManager) {
        window.agricultureManager.saveGeneralSettings();
    }
}

function resetSettings() {
    if (window.agricultureManager) {
        window.agricultureManager.resetSettings();
    }
}

// Global function to get sensor data in time range
function getSensorDataInTime(startTime, endTime) {
    if (window.agricultureManager) {
        return window.agricultureManager.getSensorDataInTime(startTime, endTime);
    }
    return null;
}

// Global function to get data for date range
function getDataForDateRange(startDate, endDate) {
    if (window.agricultureManager) {
        return window.agricultureManager.getDataForDateRange(startDate, endDate);
    }
    return null;
}

// Global function to get data for last N days
function getDataForLastDays(days) {
    if (window.agricultureManager) {
        return window.agricultureManager.getDataForLastDays(days);
    }
    return null;
}

// Global function to get data for today
function getDataForToday() {
    if (window.agricultureManager) {
        return window.agricultureManager.getDataForToday();
    }
    return null;
}

/*
 * Usage Examples:
 * 
 * 1. Get data for specific time range:
 *    getSensorDataInTime("2024-01-01 00:00:00", "2024-01-31 23:59:59")
 * 
 * 2. Get data for specific date range:
 *    getDataForDateRange(new Date('2024-01-01'), new Date('2024-01-31'))
 * 
 * 3. Get data for last 7 days:
 *    getDataForLastDays(7)
 * 
 * 4. Get data for today:
 *    getDataForToday()
 * 
 * All functions return a Promise that resolves to:
 * {
 *   "status": "success",
 *   "data": [
 *     {
 *       "time": "2024-01-15 10:30:25",
 *       "data": "{sensor_data_json}",
 *       "datadirection": "R"
 *     }
 *   ],
 *   "count": 1,
 *   "start_time": "2024-01-01 00:00:00",
 *   "end_time": "2024-01-31 23:59:59",
 *   "device_mac": "AA:BB:CC:DD:EE:FF"
 * }
 */

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('Agriculture page loaded');
    
    // Load device info from session storage
    const deviceMac = sessionStorage.getItem('selectedDeviceMacAddress') || sessionStorage.getItem('agricultureserial') || 'default-mac';
    const deviceType = sessionStorage.getItem('selectedDeviceType') || 'I1';
    const userid = sessionStorage.getItem('userid');
    const session = sessionStorage.getItem('session');
    const mqtttopic = sessionStorage.getItem('mqtttopic');
    const mqttchattopic = sessionStorage.getItem('mqttchattopic');
    const mqttuser = sessionStorage.getItem('mqttuser');
    const mqttpass = sessionStorage.getItem('mqttpass');
    
    // Set device info in UI
    const deviceMacElement = document.getElementById('deviceMacAddress');
    const deviceTypeElement = document.getElementById('deviceType');
    if (deviceMacElement) deviceMacElement.textContent = deviceMac;
    if (deviceTypeElement) deviceTypeElement.textContent = deviceType;
    
    // Debug session storage
    console.log('Session data check:', {
        userid: userid,
        session: session,
        deviceMac: deviceMac,
        deviceType: deviceType
    });
    
    // Validate required session data
    if (!userid || !session) {
        console.error('Missing session data - userid:', userid, 'session:', session);
        alert('خطا: اطلاعات جلسه یافت نشد. لطفاً دوباره وارد شوید.');
        setTimeout(() => {
            window.location.href = '../dashboard/devices-list.html';
        }, 3000);
        return;
    }
    
    // Initialize the agriculture manager
    window.agricultureManager = new AgricultureDeviceManager();
    
    // Switch to 3D view mode by default for water status
    setTimeout(() => {
        window.agricultureManager.changeViewMode('3d');
        console.log('✅ Switched to 3D view mode by default');
    }, 1000);
    
    // Initialize Bootstrap tab functionality - let Bootstrap handle it automatically
    // No additional JavaScript needed for basic tab functionality
    
    // Load saved settings
    window.agricultureManager.loadSettings();
    
    // Load saved theme
    const savedTheme = localStorage.getItem('theme');
    const themeToggleElement = document.getElementById('theme-toggle');
    if (savedTheme === 'dark' && themeToggleElement) {
        themeToggleElement.checked = true;
        document.documentElement.setAttribute('data-theme', 'dark');
    }
    
    // Set user display name (if element exists)
    const userDisplayElement = document.getElementById('userDisplayName');
    if (userid && userDisplayElement) {
        userDisplayElement.textContent = userid;
    }
    
    // Activate the first tab (water-status) by default
    setTimeout(() => {
        const firstTab = document.querySelector('#water-status-tab');
        if (firstTab) {
            const tab = new bootstrap.Tab(firstTab);
            tab.show();
        }
    }, 500);
    
    // Mobile sign out event listener
    const mobileSignOutBtn = document.getElementById('mobileSignOut');
    if (mobileSignOutBtn) {
        mobileSignOutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Mobile sign out link clicked');
            SignOut();
        });
    }
    
    // Desktop sign out event listener
    const desktopSignOutBtn = document.getElementById('signOut');
    if (desktopSignOutBtn) {
        desktopSignOutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Desktop sign out link clicked');
            SignOut();
        });
    }
    
    // Initialize sidebar auto-hide functionality
    handleSidebarAutohide();
});

// Sign out function
async function SignOut() {
    var _userid = sessionStorage.getItem('userid');
    var _session = sessionStorage.getItem('session');
    if (!_userid || !_session) {
        showNotification("شما نشست فعالی ندارید و باید ابتدا لاگین کنید.", "error");
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
                showNotification("خطا در پردازش پاسخ سرور", "error");
                return;
            }
        }
        
        // Check if the result contains the status key
        if (parsedResult && parsedResult.status) {
            if (parsedResult.status === 'success') {
                console.log('You have successfully logged out');
                showNotification("شما با موفقیت خارج شدید", "success");
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
                showNotification(errorMessage, "error");
                sessionStorage.clear();
                window.location.href = '../index.html';
            }
        } else {
            console.log('Error receiving logout response');
            showNotification("خطای دریافت نتیجه خروج از سامانه", "error");
            sessionStorage.clear();
            window.location.href = '../index.html';
        }
    } catch (error) {
        console.log('Logout request failed:', error);
        showNotification("خطا در برقراری ارتباط با سرور ...", "error");
    }
}

// Sidebar auto-hide functionality
function handleSidebarAutohide() {
    const sidebar = document.getElementById('sidebarMenu');
    const mainContent = document.querySelector('main');
    const hamburgerBtn = document.querySelector('.mobile-menu-toggle');
    
    if (sidebar && mainContent && hamburgerBtn) {
        // Handle hamburger button click
        hamburgerBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            sidebar.classList.toggle('show');
        });
        
        // Hide sidebar when clicking on main content (mobile only)
        mainContent.addEventListener('click', function() {
            if (window.innerWidth <= 991) {
                sidebar.classList.remove('show');
            }
        });
        
        // Hide sidebar when clicking on sidebar links (mobile only)
        const sidebarLinks = sidebar.querySelectorAll('a');
        sidebarLinks.forEach(link => {
            link.addEventListener('click', function() {
                if (window.innerWidth <= 991) {
                    sidebar.classList.remove('show');
                }
            });
        });
        
        // Handle window resize
        window.addEventListener('resize', function() {
            if (window.innerWidth > 991) {
                sidebar.classList.remove('show');
            }
        });        
        // Handle touch events for mobile devices
        let touchStartX = 0;
        
        // Initialize device configuration section
        try {
            console.log('Initializing device configuration section...');
            initializeDeviceConfigSection();
            console.log('Device configuration section initialized successfully');
        } catch (error) {
            console.error('Error initializing device configuration section:', error);
            showNotification('خطا در راه‌اندازی بخش پیکربندی دستگاه', 'error');
        }
        let touchEndX = 0;
        
        document.addEventListener('touchstart', function(e) {
            touchStartX = e.changedTouches[0].screenX;
        });
        
        document.addEventListener('touchend', function(e) {
            touchEndX = e.changedTouches[0].screenX;
            handleSwipe();
        });
        
        function handleSwipe() {
            if (touchEndX < touchStartX - 50) {
                // Swipe left - hide sidebar
                if (window.innerWidth <= 991) {
                    sidebar.classList.remove('show');
                }
            }
        }
    }
}

// Show notification function (if not already defined)
function showNotification(message, type = 'info') {
    // Check if AgricultureDeviceManager instance exists and has showNotification method
    if (window.agricultureManager && typeof window.agricultureManager.showNotification === 'function') {
        window.agricultureManager.showNotification(message, type);
    } else {
        // Fallback notification
        console.log(`Notification [${type}]: ${message}`);
        alert(message);
    }
}

// Device Configuration Management Functions
// این توابع برای مدیریت پیکربندی دستگاه در بخش تنظیمات کلی اضافه شده‌اند

/**
 * دریافت پیکربندی دستگاه از سرور
 */
async function getDeviceConfig() {
    try {
        // بررسی وجود API
        if (!window.deviceConfigAPI) {
            console.error('Device Config API not found. Check if device-config-api.js is loaded.');
            showNotification('ماژول API پیکربندی بارگذاری نشده است. لطفاً صفحه را مجدداً بارگذاری کنید.', 'error');
            return;
        }
        
        console.log('Device Config API found, proceeding with getDeviceConfig');

        // نمایش وضعیت بارگذاری
        updateConfigStatus('loading', 'در حال دریافت پیکربندی...');
        
        // دریافت اطلاعات دستگاه از sessionStorage
        const deviceInfo = window.deviceConfigAPI.getDeviceInfo();
        
        console.log('Device info from sessionStorage:', deviceInfo);
        
        if (!deviceInfo.codemelli || !deviceInfo.macaddress) {
            const errorMsg = `اطلاعات دستگاه ناقص است - کد ملی: ${deviceInfo.codemelli || 'خالی'}, MAC Address: ${deviceInfo.macaddress || 'خالی'}`;
            console.error(errorMsg);
            throw new Error(errorMsg);
        }

        console.log('Calling API with:', deviceInfo.codemelli, deviceInfo.macaddress);

        // فراخوانی API
        const result = await window.deviceConfigAPI.getDeviceConfig(
            deviceInfo.codemelli,
            deviceInfo.macaddress
        );

        console.log('API result:', result);

        // بررسی نتیجه API - result حالا مستقیماً deviceconfig string است
        if (result === null || result === undefined) {
            throw new Error('پیکربندی خالی یا نامعتبر است - احتمالاً دستگاه هنوز پیکربندی نشده است');
        }

        // بررسی اینکه result خالی نباشد
        if (typeof result === 'string' && result.trim() === '') {
            throw new Error('پیکربندی دستگاه خالی است - احتمالاً هنوز تنظیم نشده است');
        }

        // نمایش پیکربندی در ویرایشگر
        const configEditor = document.getElementById('deviceConfigEditor');
        const configPreview = document.getElementById('configPreview');
        
        if (configEditor) {
            // اگر result یک string است، مستقیماً نمایش دهیم
            if (typeof result === 'string') {
                configEditor.value = result;
            } else {
                configEditor.value = JSON.stringify(result, null, 2);
            }
        }
        
        if (configPreview) {
            // اگر result یک string است، مستقیماً نمایش دهیم
            if (typeof result === 'string') {
                configPreview.innerHTML = `<pre>${result}</pre>`;
            } else {
                configPreview.innerHTML = `<pre>${JSON.stringify(result, null, 2)}</pre>`;
            }
        }
        
        updateConfigStatus('success', 'پیکربندی با موفقیت دریافت شد');
        showNotification('پیکربندی دستگاه با موفقیت دریافت شد', 'success');

    } catch (error) {
        console.error('Error getting device config:', error);
        updateConfigStatus('error', 'خطا در دریافت پیکربندی');
        showNotification(`خطا در دریافت پیکربندی: ${error.message}`, 'error');
    }
}

/**
 * ذخیره پیکربندی دستگاه در سرور
 */
async function setDeviceConfig() {
    try {
        // بررسی وجود API
        if (!window.deviceConfigAPI) {
            showNotification('ماژول API پیکربندی بارگذاری نشده است', 'error');
            return;
        }

        // دریافت محتوای ویرایشگر
        const configEditor = document.getElementById('deviceConfigEditor');
        if (!configEditor || !configEditor.value.trim()) {
            showNotification('لطفاً ابتدا پیکربندی را وارد کنید', 'warning');
            return;
        }

        // نمایش وضعیت بارگذاری
        updateConfigStatus('loading', 'در حال ذخیره پیکربندی...');
        
        // تلاش برای تجزیه JSON
        let deviceConfig;
        try {
            deviceConfig = JSON.parse(configEditor.value);
        } catch (jsonError) {
            // اگر JSON معتبر نبود، به عنوان رشته متنی ذخیره می‌کنیم
            deviceConfig = configEditor.value;
        }

        // دریافت اطلاعات دستگاه از sessionStorage
        const deviceInfo = window.deviceConfigAPI.getDeviceInfo();
        
        if (!deviceInfo.codemelli || !deviceInfo.macaddress) {
            throw new Error('اطلاعات دستگاه در sessionStorage یافت نشد');
        }

        // فراخوانی API
        const result = await window.deviceConfigAPI.setDeviceConfig(
            deviceInfo.codemelli,
            deviceInfo.macaddress,
            deviceConfig
        );

        if (result === true) {
            updateConfigStatus('success', 'پیکربندی با موفقیت ذخیره شد');
            showNotification('پیکربندی دستگاه با موفقیت ذخیره شد', 'success');
        } else {
            throw new Error('ذخیره پیکربندی ناموفق بود');
        }

    } catch (error) {
        console.error('Error setting device config:', error);
        updateConfigStatus('error', 'خطا در ذخیره پیکربندی');
        showNotification(`خطا در ذخیره پیکربندی: ${error.message}`, 'error');
    }
}

/**
 * ارسال پیکربندی دستگاه از طریق MQTT
 */
async function uploadDeviceConfig() {
    try {
        // بررسی وجود API
        if (!window.deviceConfigAPI) {
            showNotification('ماژول API پیکربندی بارگذاری نشده است', 'error');
            return;
        }

        // نمایش وضعیت بارگذاری
        updateConfigStatus('loading', 'در حال ارسال پیکربندی...');
        
        // دریافت اطلاعات دستگاه از sessionStorage
        const deviceInfo = window.deviceConfigAPI.getDeviceInfo();
        
        if (!deviceInfo.codemelli || !deviceInfo.macaddress) {
            throw new Error('اطلاعات دستگاه در sessionStorage یافت نشد');
        }

        // دریافت پیکربندی از ویرایشگر
        const configEditor = document.getElementById('deviceConfigEditor');
        if (!configEditor || !configEditor.value.trim()) {
            throw new Error('لطفاً ابتدا پیکربندی را در ویرایشگر وارد کنید');
        }

        let deviceConfig = configEditor.value.trim();
        
        // اطمینان از اینکه deviceconfig همیشه به صورت رشته ارسال شود
        // اگر کاربر JSON آبجکت وارد کرده، آن را به رشته تبدیل می‌کنیم
        try {
            // بررسی اینکه آیا متن وارد شده یک JSON معتبر است
            const parsedConfig = JSON.parse(deviceConfig);
            // اگر JSON معتبر بود، آن را دوباره به رشته تبدیل می‌کنیم
            deviceConfig = JSON.stringify(parsedConfig);
        } catch (e) {
            // اگر JSON نبود، همان رشته اصلی را نگه می‌داریم
            // هیچ کاری نمی‌کنیم، deviceConfig همان رشته اصلی باقی می‌ماند
        }

        // فراخوانی API
        const result = await window.deviceConfigAPI.uploadDeviceConfig(
            deviceInfo.codemelli,
            deviceInfo.macaddress,
            deviceConfig
        );

        if (result === true) {
            updateConfigStatus('success', 'پیکربندی با موفقیت ارسال شد');
            showNotification('پیکربندی دستگاه با موفقیت از طریق MQTT ارسال شد', 'success');
        } else {
            throw new Error('ارسال پیکربندی ناموفق بود');
        }

    } catch (error) {
        console.error('Error uploading device config:', error);
        updateConfigStatus('error', 'خطا در ارسال پیکربندی');
        showNotification(`خطا در ارسال پیکربندی: ${error.message}`, 'error');
    }
}

/**
 * به‌روزرسانی وضعیت پیکربندی در UI
 * @param {string} status - وضعیت (loading, success, error, pending)
 * @param {string} message - پیام وضعیت
 */
function updateConfigStatus(status, message) {
    const statusElement = document.getElementById('configStatus');
    const lastUpdateElement = document.getElementById('configLastUpdate');
    
    if (statusElement) {
        // حذق کلاس‌های قبلی
        statusElement.classList.remove('bg-secondary', 'bg-success', 'bg-danger', 'bg-warning', 'bg-info');
        
        // اضافه کردن کلاس جدید بر اساس وضعیت
        switch (status) {
            case 'loading':
                statusElement.classList.add('bg-info');
                break;
            case 'success':
                statusElement.classList.add('bg-success');
                break;
            case 'error':
                statusElement.classList.add('bg-danger');
                break;
            case 'pending':
            default:
                statusElement.classList.add('bg-secondary');
                break;
        }
        
        statusElement.textContent = message;
        statusElement.classList.add('config-status-update');
        
        // حذف کلاس انیمیشن بعد از اتمام
        setTimeout(() => {
            statusElement.classList.remove('config-status-update');
        }, 300);
    }
    
    if (lastUpdateElement) {
        const now = new Date();
        const timeString = now.toLocaleTimeString('fa-IR');
        const dateString = now.toLocaleDateString('fa-IR');
        lastUpdateElement.textContent = `${dateString} ${timeString}`;
    }
}

/**
 * فرمت‌بندی محتوای ویرایشگر
 */
function formatConfig() {
    const configEditor = document.getElementById('deviceConfigEditor');
    if (!configEditor) return;
    
    try {
        const content = configEditor.value.trim();
        if (!content) {
            showNotification('محتوایی برای فرمت‌بندی وجود ندارد', 'warning');
            return;
        }
        
        // تلاش برای تجزیه JSON
        let parsed;
        try {
            parsed = JSON.parse(content);
            configEditor.value = JSON.stringify(parsed, null, 2);
            showNotification('پیکربندی با موفقیت فرمت‌بندی شد', 'success');
        } catch (jsonError) {
            // اگر JSON معتبر نبود، فقط فاصله‌های اضافی را حذف می‌کنیم
            configEditor.value = content.replace(/\s+/g, ' ').trim();
            showNotification('فرمت‌بندی ساده انجام شد (محتوا JSON معتبر نیست)', 'info');
        }
    } catch (error) {
        showNotification('خطا در فرمت‌بندی: ' + error.message, 'error');
    }
}

/**
 * پاک کردن محتوای ویرایشگر
 */
function clearConfig() {
    const configEditor = document.getElementById('deviceConfigEditor');
    const configPreview = document.getElementById('configPreview');
    
    if (configEditor) {
        configEditor.value = '';
    }
    
    if (configPreview) {
        configPreview.innerHTML = `
            <div class="text-muted text-center">
                <i class="fas fa-info-circle me-2"></i>
                پیکربندی برای نمایش وجود ندارد
            </div>
        `;
    }
    
    updateConfigStatus('pending', 'منتظر بارگذاری...');
    showNotification('ویرایشگر پاک شد', 'info');
}

/**
 * اعتبارسنجی محتوای ویرایشگر
 */
function validateConfig() {
    const configEditor = document.getElementById('deviceConfigEditor');
    if (!configEditor) return;
    
    try {
        const content = configEditor.value.trim();
        if (!content) {
            showNotification('محتوایی برای اعتبارسنجی وجود ندارد', 'warning');
            return;
        }
        
        // تلاش برای تجزیه JSON
        try {
            JSON.parse(content);
            showNotification('✅ محتوا JSON معتبر است', 'success');
            configEditor.classList.add('config-success');
            configEditor.classList.remove('config-error');
            
            setTimeout(() => {
                configEditor.classList.remove('config-success');
            }, 2000);
        } catch (jsonError) {
            showNotification('❌ محتوا JSON معتبر نیست: ' + jsonError.message, 'error');
            configEditor.classList.add('config-error');
            configEditor.classList.remove('config-success');
            
            setTimeout(() => {
                configEditor.classList.remove('config-error');
            }, 3000);
        }
    } catch (error) {
        showNotification('خطا در اعتبارسنجی: ' + error.message, 'error');
    }
}

/**
 * به‌روزرسانی خودکار پیش‌نمایش پیکربندی
 */
function updateConfigPreview() {
    const configEditor = document.getElementById('deviceConfigEditor');
    const configPreview = document.getElementById('configPreview');
    
    if (!configEditor || !configPreview) return;
    
    try {
        const content = configEditor.value.trim();
        if (!content) {
            configPreview.innerHTML = `
                <div class="text-muted text-center">
                    <i class="fas fa-info-circle me-2"></i>
                    پیکربندی برای نمایش وجود ندارد
                </div>
            `;
            return;
        }
        
        // تلاش برای فرمت‌بندی JSON
        let formatted;
        try {
            const parsed = JSON.parse(content);
            formatted = JSON.stringify(parsed, null, 2);
        } catch {
            // اگر JSON معتبر نبود، محتوا را همانطور نمایش می‌دهیم
            formatted = content;
        }
        
        configPreview.innerHTML = `<pre>${formatted}</pre>`;
    } catch (error) {
        configPreview.innerHTML = `
            <div class="text-danger">
                <i class="fas fa-exclamation-triangle me-2"></i>
                خطا در نمایش پیش‌نمایش: ${error.message}
            </div>
        `;
    }
}

/**
 * مقداردهی اولیه بخش پیکربندی دستگاه
 */
function initializeDeviceConfigSection() {
    console.log('Initializing device configuration section...');
    
    // بررسی وجود API
    if (!window.deviceConfigAPI) {
        console.warn('Device Config API not loaded');
        return;
    }
    
    // بررسی دسترسی به API
    if (window.deviceConfigAPI.hasApiAccess()) {
        updateConfigStatus('pending', 'آماده برای دریافت پیکربندی');
    } else {
        updateConfigStatus('error', 'دسترسی به API وجود ندارد - لطفاً وارد شوید');
    }
    
    // افزودن Event Listener برای به‌روزرسانی خودکار پیش‌نمایش
    const configEditor = document.getElementById('deviceConfigEditor');
    if (configEditor) {
        configEditor.addEventListener('input', updateConfigPreview);
        configEditor.addEventListener('change', updateConfigPreview);
    }
    
    console.log('Device configuration section initialized successfully');
}
