// Admin Panel JavaScript
class AdminPanel {
    constructor() {
        this.apiBase = 'https://api.giot.ir';
        this.currentUser = null;
        this.sessionToken = null;
        this.adminLevel = 0;
        this.init();
    }

    init() {
        this.checkExistingSession();
        this.setupEventListeners();
        this.setupDragAndDrop();
        this.hideLoadingScreen();
    }

    // Initialize event listeners
    setupEventListeners() {
        // Login form
        document.getElementById('login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });
        
        // Real-time validation for login form
        const useridInput = document.getElementById('userid');
        const passwordInput = document.getElementById('password');
        
        if (useridInput) {
            useridInput.addEventListener('input', (e) => {
                const value = e.target.value.trim();
                if (value.length > 0) {
                    this.validateInput(e.target, (val) => this.validateUserId(val), 'کد ملی باید 10 رقم باشد');
                } else {
                    e.target.classList.remove('valid', 'invalid');
                }
            });
        }
        
        if (passwordInput) {
            passwordInput.addEventListener('input', (e) => {
                const value = e.target.value;
                if (value.length > 0) {
                    if (value.length < 4) {
                        e.target.classList.remove('valid');
                        e.target.classList.add('invalid');
                    } else {
                        e.target.classList.remove('invalid');
                        e.target.classList.add('valid');
                    }
                } else {
                    e.target.classList.remove('valid', 'invalid');
                }
            });
        }

        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const section = item.dataset.section;
                this.showSection(section);
                this.setActiveNavItem(item);
                
                // Close mobile menu after navigation
                if (window.innerWidth <= 768) {
                    const sidebar = document.getElementById('sidebar');
                    if (sidebar.classList.contains('active')) {
                        sidebar.classList.remove('active');
                        document.removeEventListener('click', this.handleOutsideClick);
                    }
                }
            });
        });
        
        // Keyboard support for mobile menu
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const sidebar = document.getElementById('sidebar');
                if (sidebar.classList.contains('active')) {
                    sidebar.classList.remove('active');
                    document.removeEventListener('click', this.handleOutsideClick);
                }
            }
        });

        // SMS forms
        const bulkSmsForm = document.getElementById('bulk-sms-form');
        const singleSmsForm = document.getElementById('single-sms-form');
        
        if (bulkSmsForm) {
            bulkSmsForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.sendBulkSMS();
            });
        }

        if (singleSmsForm) {
            singleSmsForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.sendSingleSMS();
            });
        }

        // Admin management forms
        const addAdminForm = document.getElementById('add-admin-form');
        const removeAdminForm = document.getElementById('remove-admin-form');
        
        if (addAdminForm) {
            addAdminForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleAddAdmin();
            });
        }

        if (removeAdminForm) {
            removeAdminForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleRemoveAdmin();
            });
        }

        // Character counters
        const bulkMessageEl = document.getElementById('bulk-message');
        const singleMessageEl = document.getElementById('single-message');
        
        if (bulkMessageEl) {
            bulkMessageEl.addEventListener('input', (e) => {
                this.updateCharCounter('bulk-char-count', e.target.value.length);
            });
        }

        if (singleMessageEl) {
            singleMessageEl.addEventListener('input', (e) => {
                this.updateCharCounter('single-char-count', e.target.value.length);
            });
        }

        // User management event listeners
        const refreshUsersBtn = document.getElementById('refresh-users-btn');
        const searchByNationalIdBtn = document.getElementById('search-by-national-id-btn');
        const searchByPhoneBtn = document.getElementById('search-by-phone-btn');
        const disableAccountBtn = document.getElementById('disable-account-btn');
        const enableAccountBtn = document.getElementById('enable-account-btn');
        const chargeBillBtn = document.getElementById('charge-bill-btn');
        const getBillBtn = document.getElementById('get-bill-btn');
        const renewMqttBtn = document.getElementById('renew-mqtt-btn');
        const closeModal = document.querySelector('.close-modal');
        const filterUsers = document.getElementById('user-filter');
        
        if (refreshUsersBtn) {
            refreshUsersBtn.addEventListener('click', () => {
                this.getUserList();
            });
        }

        if (searchByNationalIdBtn) {
            searchByNationalIdBtn.addEventListener('click', () => {
                this.searchUserByNationalId();
            });
        }

        if (searchByPhoneBtn) {
            searchByPhoneBtn.addEventListener('click', () => {
                this.searchUserByPhone();
            });
        }

        if (disableAccountBtn) {
            disableAccountBtn.addEventListener('click', () => {
                this.disableUserAccount();
            });
        }

        if (enableAccountBtn) {
            enableAccountBtn.addEventListener('click', () => {
                this.enableUserAccount();
            });
        }

        if (chargeBillBtn) {
            chargeBillBtn.addEventListener('click', () => {
                this.chargeUserBill();
            });
        }

        if (getBillBtn) {
            getBillBtn.addEventListener('click', () => {
                this.getUserBill();
            });
        }

        if (renewMqttBtn) {
            renewMqttBtn.addEventListener('click', () => {
                this.renewMqttExpiration();
            });
        }

        // User details modal close
        if (closeModal) {
            closeModal.addEventListener('click', () => {
                const userDetailsModal = document.getElementById('user-details-modal');
                if (userDetailsModal) {
                    userDetailsModal.classList.remove('active');
                }
            });
        }

        // Filter users
        if (filterUsers) {
            filterUsers.addEventListener('input', (e) => {
                this.filterUsers(e.target.value);
            });
        }

        // Export users
        const exportUsersBtn = document.getElementById('export-users-btn');
        if (exportUsersBtn) {
            exportUsersBtn.addEventListener('click', () => {
                this.exportUsers();
            });
        }

        // Mobile menu toggle
        window.addEventListener('resize', () => {
            if (window.innerWidth > 768) {
                document.getElementById('sidebar').classList.remove('active');
            }
        });

        // Setup file upload event listener
        const fileInput = document.getElementById('reply-attachment');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                this.handleFileSelection(e);
            });
        }
    }

    // Check for existing session
    checkExistingSession() {
        const savedSession = this.getFromStorage('adminSession');
        if (savedSession && savedSession.token && savedSession.expiry > Date.now()) {
            this.sessionToken = savedSession.token;
            this.currentUser = savedSession.user;
            
            // Extract userid from JWT token if not available in saved user data
            if (!this.currentUser.userid && savedSession.token) {
                try {
                    const tokenPayload = JSON.parse(atob(savedSession.token.split('.')[1]));
                    this.currentUser.userid = tokenPayload.user_id;
                } catch (e) {
                    console.error('Error parsing JWT token in checkExistingSession:', e);
                }
            }
            
            this.adminLevel = savedSession.adminLevel;
            this.showDashboard();
            this.loadDashboardData();
        }
    }

    // Hide loading screen
    hideLoadingScreen() {
        setTimeout(() => {
            document.getElementById('loading-screen').classList.add('hidden');
        }, 1000);
    }

    // Handle login
    async handleLogin() {
        const userid = document.getElementById('userid').value.trim();
        const password = document.getElementById('password').value;
        const loginBtn = document.querySelector('button[type="submit"]');
        
        // Enhanced validation
        if (!userid) {
            this.showToast('کد ملی را وارد کنید', 'error');
            document.getElementById('userid').focus();
            return;
        }

        if (!this.validateUserId(userid)) {
            this.showToast('کد ملی باید 10 رقم باشد', 'error');
            document.getElementById('userid').focus();
            return;
        }

        if (!password) {
            this.showToast('رمز عبور را وارد کنید', 'error');
            document.getElementById('password').focus();
            return;
        }
        
        if (password.length < 4) {
            this.showToast('رمز عبور باید حداقل 4 کاراکتر باشد', 'error');
            document.getElementById('password').focus();
            return;
        }

        // Disable login button and show loading state
        const originalBtnText = loginBtn.innerHTML;
        loginBtn.disabled = true;
        loginBtn.innerHTML = '<i class="bi bi-arrow-clockwise spinning"></i> در حال ورود...';
        
        const loadingToast = this.showToast('در حال ورود به سیستم...', 'loading');

        try {
            // Hash password (SHA-256)
            const hashedPassword = await this.hashPassword(password);
            
            const response = await fetch(`${this.apiBase}/sysmodauthenticate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username: userid,
                    password: hashedPassword
                })
            });

            const data = await response.json();
            
            // Remove loading toast
            this.removeToast(loadingToast);

            if (data.status === 'success') {
                this.sessionToken = data.session;
                
                // Extract userid from JWT token if not provided directly
                let userid = data.userid;
                if (!userid && data.session) {
                    try {
                        const tokenPayload = JSON.parse(atob(data.session.split('.')[1]));
                        userid = tokenPayload.user_id;
                    } catch (e) {
                        console.error('Error parsing JWT token:', e);
                    }
                }
                
                this.currentUser = {
                    userid: userid,
                    mqtttopic: data.mqtttopic,
                    mqttuser: data.mqttuser,
                    mqttpass: data.mqttpass,
                    mqttenable: data.mqttenable
                };
                this.adminLevel = 255; // Admin level for successful login

                // Save session
                this.saveToStorage('adminSession', {
                    token: this.sessionToken,
                    user: this.currentUser,
                    adminLevel: this.adminLevel,
                    expiry: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
                });

                this.showToast('ورود موفقیت‌آمیز بود! خوش آمدید', 'success');
                
                // Add smooth transition to dashboard
                setTimeout(() => {
                    this.showDashboard();
                    this.loadDashboardData();
                }, 500);
            } else {
                this.showToast(this.getErrorMessage(data.reason), 'error');
                // Clear password field on failed login
                document.getElementById('password').value = '';
                document.getElementById('password').focus();
            }
        } catch (error) {
            console.error('Login error:', error);
            this.removeToast(loadingToast);
            this.showToast('خطا در اتصال به سرور. لطفاً اتصال اینترنت خود را بررسی کنید', 'error');
        } finally {
            // Restore login button
            loginBtn.disabled = false;
            loginBtn.innerHTML = originalBtnText;
        }
    }

    // Hash password using SHA-256
    async hashPassword(password) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hash = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(hash))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }

    // Show dashboard
    showDashboard() {
        document.getElementById('login-modal').classList.remove('active');
        document.getElementById('dashboard').classList.remove('hidden');
        
        // Update user info
        const userName = `${this.currentUser.firstname} ${this.currentUser.lastname}`;
        document.getElementById('user-name').textContent = userName;
        
        // Start auto-refresh for system health
        this.startHealthAutoRefresh();
    }

    // Load dashboard data
    async loadDashboardData() {
        await this.loadAdminList();
        await this.getUserList();
        this.updateStats();
        await this.loadSystemHealth();
    }

    // Load admin list
    async loadAdminList() {
        if (this.adminLevel < 255) {
            this.showToast('فقط مدیران سطح 255 می‌توانند لیست ادمین‌ها را مشاهده کنند', 'error');
            return;
        }

        try {
            const response = await fetch(`${this.apiBase}/sysmodgetadminlist`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userid: this.currentUser.userid,
                    session: this.sessionToken
                })
            });

            const data = await response.json();

            if (data.status === 'success') {
                this.saveToStorage('adminList', {
                    data: data.admin_list,
                    count: data.admin_count,
                    lastUpdate: Date.now()
                });
                this.displayAdminList(data.admin_list);
                this.updateAdminCount(data.admin_count);
            } else {
                this.showToast(this.getErrorMessage(data.reason), 'error');
            }
        } catch (error) {
            console.error('Admin list error:', error);
            this.showToast('خطا در دریافت لیست ادمین‌ها', 'error');
        }
    }

    // Display admin list in table
    displayAdminList(adminList) {
        const tbody = document.getElementById('admin-table-body');
        tbody.innerHTML = '';

        adminList.forEach(admin => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${admin.firstname}</td>
                <td>${admin.lastname}</td>
                <td>${admin.codemelli}</td>
                <td>${admin.number}</td>
                <td>${admin.emailaddr}</td>
                <td>
                    <span class="admin-level level-${admin.admin_level}">
                        ${this.getAdminLevelText(admin.admin_level)}
                    </span>
                </td>
                <td>
                    <button class="btn btn-outline btn-sm" onclick="adminPanel.viewAdminDetails('${admin.codemelli}')">
                        <i class="fas fa-eye"></i>
                        مشاهده
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    // Get admin level text
    getAdminLevelText(level) {
        // سطوح ادمین بر اساس بیت‌ها (1-255)
        if (level === 255) return 'مدیر کل (تمام دسترسی‌ها)';
        if (level >= 240) return 'مدیر ارشد';
        if (level >= 200) return 'مدیر میانی';
        if (level >= 100) return 'مدیر پایه';
        if (level >= 50) return 'ناظر';
        if (level >= 10) return 'کاربر ویژه';
        if (level >= 1) return 'کاربر عادی';
        return `سطح ${level}`;
    }

    // Send bulk SMS
    async sendBulkSMS() {
        if (this.adminLevel <= 128) {
            this.showToast('سطح دسترسی شما برای ارسال پیامک گروهی کافی نیست', 'error');
            return;
        }

        const message = document.getElementById('bulk-message').value.trim();
        
        if (!message) {
            this.showToast('متن پیام را وارد کنید', 'error');
            return;
        }

        if (message.length > 500) {
            this.showToast('متن پیام نباید بیش از 500 کاراکتر باشد', 'error');
            return;
        }

        try {
            this.showToast('در حال ارسال پیامک...', 'info');

            const response = await fetch(`${this.apiBase}/sysmodsendsmstoallusers`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userid: this.currentUser.userid,
                    session: this.sessionToken,
                    message: message
                })
            });

            const data = await response.json();

            if (data.status === 'success') {
                this.showToast(`پیامک با موفقیت به ${data.successful_sends} کاربر ارسال شد`, 'success');
                
                // Save SMS history
                this.saveSMSHistory({
                    type: 'bulk',
                    message: message,
                    recipients: data.total_recipients,
                    successful: data.successful_sends,
                    failed: data.failed_sends,
                    timestamp: Date.now()
                });

                // Clear form
                document.getElementById('bulk-message').value = '';
                this.updateCharCounter('bulk-char-count', 0);
                
                // Update stats
                this.updateSentSMSCount();
            } else {
                this.showToast(this.getErrorMessage(data.reason), 'error');
            }
        } catch (error) {
            console.error('Bulk SMS error:', error);
            this.showToast('خطا در ارسال پیامک', 'error');
        }
    }

    // Send single SMS
    async sendSingleSMS() {
        const targetUser = document.getElementById('target-user').value.trim();
        const targetPhone = document.getElementById('target-phone').value.trim();
        const message = document.getElementById('single-message').value.trim();

        if (!targetUser && !targetPhone) {
            this.showToast('کد ملی یا شماره تلفن کاربر را وارد کنید', 'error');
            return;
        }

        if (!message) {
            this.showToast('متن پیام را وارد کنید', 'error');
            return;
        }

        if (message.length > 500) {
            this.showToast('متن پیام نباید بیش از 500 کاراکتر باشد', 'error');
            return;
        }

        if (targetUser && !this.validateUserId(targetUser)) {
            this.showToast('کد ملی باید 10 رقم باشد', 'error');
            return;
        }

        if (targetPhone && !this.validatePhoneNumber(targetPhone)) {
            this.showToast('شماره تلفن نامعتبر است', 'error');
            return;
        }

        try {
            this.showToast('در حال ارسال پیامک...', 'info');

            const requestBody = {
                userid: this.currentUser.userid,
                session: this.sessionToken,
                message: message
            };

            if (targetPhone) {
                requestBody.targetphonenumber = targetPhone;
            } else {
                requestBody.targetuser = targetUser;
            }

            const response = await fetch(`${this.apiBase}/sysmodsendsmstouser`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            const data = await response.json();

            if (data.status === 'success') {
                this.showToast(`پیامک با موفقیت به ${data.target_phone} ارسال شد`, 'success');
                
                // Save SMS history
                this.saveSMSHistory({
                    type: 'single',
                    message: message,
                    target: targetPhone || targetUser,
                    targetPhone: data.target_phone,
                    timestamp: Date.now()
                });

                // Clear form
                document.getElementById('target-user').value = '';
                document.getElementById('target-phone').value = '';
                document.getElementById('single-message').value = '';
                this.updateCharCounter('single-char-count', 0);
                
                // Update stats
                this.updateSentSMSCount();
            } else {
                this.showToast(this.getErrorMessage(data.reason), 'error');
            }
        } catch (error) {
            console.error('Single SMS error:', error);
            this.showToast('خطا در ارسال پیامک', 'error');
        }
    }

    // User Management Methods
    async getUserList() {
        try {
            this.showToast('در حال دریافت لیست کاربران...', 'info');

            const response = await fetch(`${this.apiBase}/sysmodgetuserlist`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userid: this.currentUser.userid,
                    session: this.sessionToken
                })
            });

            const data = await response.json();

            if (data.status === 'success') {
                this.saveToStorage('userList', {
                    data: data.users,
                    count: data.user_count,
                    lastUpdate: Date.now()
                });
                this.displayUserList(data.users);
                this.updateUserCount(data.user_count);
                this.showToast(`${data.user_count} کاربر یافت شد`, 'success');
            } else {
                this.showToast(this.getErrorMessage(data.reason), 'error');
            }
        } catch (error) {
            console.error('User list error:', error);
            this.showToast('خطا در دریافت لیست کاربران', 'error');
        }
    }

    displayUserList(userList) {
        const tbody = document.getElementById('user-table-body');
        tbody.innerHTML = '';

        userList.forEach(user => {
            const row = document.createElement('tr');
            const banStatusText = user.banstatus ? 'مسدود' : 'آزاد';
            const banStatusClass = user.banstatus ? 'inactive' : 'active';
            const adminLevelText = user.admin_level > 0 ? `مدیر سطح ${user.admin_level}` : 'کاربر عادی';
            const mqttExpiry = user.mqttvaliduntil > 0 ? new Date(user.mqttvaliduntil * 1000).toLocaleDateString('fa-IR') : 'ندارد';
            
            row.innerHTML = `
                <td>${user.shortname}</td>
                <td>${user.familyname}</td>
                <td>${user.codemelli}</td>
                <td>${user.number}</td>
                <td>${user.emailaddr || 'ندارد'}</td>
                <td>
                    <span class="status-${banStatusClass}">
                        ${banStatusText}
                    </span>
                </td>
                <td>${adminLevelText}</td>
                <td>${user.billcharge.toLocaleString()} تومان</td>
                <td>${mqttExpiry}</td>
                <td>
                    <div class="user-actions">
                        <button class="btn btn-outline btn-sm" onclick="adminPanel.viewUserDetails('${user.codemelli}')" title="مشاهده جزئیات">
                            <i class="fas fa-eye"></i>
                            جزئیات
                        </button>
                        <button class="btn btn-sm btn-success" onclick="enableUserAccountFromList('${user.codemelli}')" title="فعال کردن حساب">
                            <i class="fas fa-user-check"></i>
                            فعال
                        </button>
                        <button class="btn btn-sm btn-warning" onclick="disableUserAccountFromList('${user.codemelli}')" title="غیرفعال کردن حساب">
                            <i class="fas fa-user-times"></i>
                            غیرفعال
                        </button>
                        <button class="btn btn-sm btn-primary" onclick="chargeUserBillFromList('${user.codemelli}')" title="شارژ حساب">
                            <i class="fas fa-credit-card"></i>
                            شارژ
                        </button>
                        <button class="btn btn-sm btn-secondary" onclick="renewMqttFromList('${user.codemelli}')" title="تمدید MQTT">
                            <i class="fas fa-wifi"></i>
                            MQTT
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    async searchUserByNationalId() {
        const nationalId = document.getElementById('search-user-id').value.trim();
        
        if (!nationalId) {
            this.showToast('کد ملی را وارد کنید', 'error');
            return;
        }

        if (!this.validateUserId(nationalId)) {
            this.showToast('کد ملی باید 10 رقم باشد', 'error');
            return;
        }

        try {

            const response = await fetch(`${this.apiBase}/sysmodgetuserinfo`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userid: this.currentUser.userid,
                    session: this.sessionToken,
                    targetuser: nationalId
                })
            });

            const data = await response.json();

            if (data.status === 'success') {
                this.showUserDetails(data.user_info);
            } else {
                this.showToast(this.getErrorMessage(data.reason), 'error');
            }
        } catch (error) {
            console.error('User search error:', error);
            this.showToast('خطا در جستجوی کاربر', 'error');
        }
    }

    async searchUserByPhone() {
        const phone = document.getElementById('search-user-phone').value.trim();
        
        if (!phone) {
            this.showToast('شماره تلفن را وارد کنید', 'error');
            return;
        }

        if (!this.validatePhoneNumber(phone)) {
            this.showToast('شماره تلفن نامعتبر است', 'error');
            return;
        }

        try {

            const response = await fetch(`${this.apiBase}/sysmodgetuserinfo`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userid: this.currentUser.userid,
                    session: this.sessionToken,
                    targetphonenumber: phone
                })
            });

            const data = await response.json();

            if (data.status === 'success') {
                this.showUserDetails(data.user_info);
            } else {
                this.showToast(this.getErrorMessage(data.reason), 'error');
            }
        } catch (error) {
            console.error('User search error:', error);
            this.showToast('خطا در جستجوی کاربر', 'error');
        }
    }

    async disableUserAccount() {
        const nationalId = document.getElementById('action-user-id').value.trim();
        
        if (!nationalId) {
            this.showToast('کد ملی کاربر را وارد کنید', 'error');
            return;
        }

        if (!this.validateUserId(nationalId)) {
            this.showToast('کد ملی باید 10 رقم باشد', 'error');
            return;
        }

        if (!confirm('آیا از غیرفعال کردن حساب این کاربر اطمینان دارید؟')) {
            return;
        }

        try {
            this.showToast('در حال غیرفعال کردن حساب...', 'info');

            const response = await fetch(`${this.apiBase}/sysmoddisableuseraccount`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userid: this.currentUser.userid,
                    session: this.sessionToken,
                    targetuser: nationalId
                })
            });

            const data = await response.json();

            if (data.status === 'success') {
                this.showToast('حساب کاربر با موفقیت غیرفعال شد', 'success');
                document.getElementById('action-user-id').value = '';
                // Refresh user list if visible
                if (document.getElementById('users').style.display !== 'none') {
                    this.getUserList();
                }
            } else {
                this.showToast(this.getErrorMessage(data.reason), 'error');
            }
        } catch (error) {
            console.error('Disable account error:', error);
            this.showToast('خطا در ارتباط با سرور هنگام غیرفعال کردن حساب', 'error');
        }
    }

    async enableUserAccount() {
        const nationalId = document.getElementById('action-user-id').value.trim();
        
        if (!nationalId) {
            this.showToast('کد ملی کاربر را وارد کنید', 'error');
            return;
        }

        if (!this.validateUserId(nationalId)) {
            this.showToast('کد ملی باید 10 رقم باشد', 'error');
            return;
        }

        try {
            this.showToast('در حال فعال کردن حساب...', 'info');

            const response = await fetch(`${this.apiBase}/sysmodenableuseraccount`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userid: this.currentUser.userid,
                    session: this.sessionToken,
                    targetuser: nationalId
                })
            });

            const data = await response.json();

            if (data.status === 'success') {
                const statusText = data.new_banstatus ? 'مسدود' : 'فعال';
                const previousStatusText = data.previous_banstatus ? 'مسدود' : 'فعال';
                const message = `وضعیت حساب کاربر ${data.target_user} تغییر کرد:\n` +
                              `وضعیت قبلی: ${previousStatusText}\n` +
                              `وضعیت جدید: ${statusText}\n` +
                              `تعداد مسدودی: ${data.bandcount}`;
                this.showToast(message, 'success');
                document.getElementById('action-user-id').value = '';
                // Refresh user list if visible
                if (document.getElementById('users').style.display !== 'none') {
                    this.getUserList();
                }
            } else {
                this.showToast(this.getErrorMessage(data.reason), 'error');
            }
        } catch (error) {
            console.error('Enable account error:', error);
            this.showToast('خطا در ارتباط با سرور هنگام فعال کردن حساب', 'error');
        }
    }

    // Financial Management Methods
    async chargeUserBill() {
        const nationalId = document.getElementById('financial-user-id').value.trim();
        const amount = document.getElementById('charge-amount').value.trim();
        
        if (!nationalId) {
            this.showToast('کد ملی کاربر را وارد کنید', 'error');
            return;
        }

        if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
            this.showToast('مبلغ معتبر وارد کنید', 'error');
            return;
        }

        if (!this.validateUserId(nationalId)) {
            this.showToast('کد ملی باید 10 رقم باشد', 'error');
            return;
        }

        try {
            this.showToast('در حال شارژ حساب...', 'info');

            const response = await fetch(`${this.apiBase}/sysmodchargeuserbill`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userid: this.currentUser.userid,
                    session: this.sessionToken,
                    targetuser: nationalId,
                    amount: parseFloat(amount)
                })
            });

            const data = await response.json();

            if (data.status === 'success') {
                this.showToast(`حساب کاربر با موفقیت ${amount} تومان شارژ شد`, 'success');
                document.getElementById('financial-user-id').value = '';
                document.getElementById('charge-amount').value = '';
            } else {
                this.showToast(this.getErrorMessage(data.reason), 'error');
            }
        } catch (error) {
            console.error('Charge bill error:', error);
            this.showToast('خطا در شارژ حساب', 'error');
        }
    }

    async getUserBill() {
        const nationalId = document.getElementById('financial-user-id').value.trim();
        
        if (!nationalId) {
            this.showToast('کد ملی کاربر را وارد کنید', 'error');
            return;
        }

        if (!this.validateUserId(nationalId)) {
            this.showToast('کد ملی باید 10 رقم باشد', 'error');
            return;
        }

        try {
            this.showToast('در حال دریافت اطلاعات مالی...', 'info');

            const response = await fetch(`${this.apiBase}/sysmodgetuserbill`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userid: this.currentUser.userid,
                    session: this.sessionToken,
                    targetuser: nationalId
                })
            });

            const data = await response.json();

            if (data.status === 'success') {
                this.showToast(`موجودی حساب: ${data.billcharge} تومان`, 'success');
                // You can display more detailed bill info here
            } else {
                this.showToast(this.getErrorMessage(data.reason), 'error');
            }
        } catch (error) {
            console.error('Get bill error:', error);
            this.showToast('خطا در دریافت اطلاعات مالی', 'error');
        }
    }

    // MQTT Management
    async renewMqttExpiration() {
        const nationalId = document.getElementById('mqtt-user-id').value.trim();
        const months = document.getElementById('mqtt-months').value.trim();
        
        if (!nationalId) {
            this.showToast('کد ملی کاربر را وارد کنید', 'error');
            return;
        }

        if (!this.validateUserId(nationalId)) {
            this.showToast('کد ملی باید 10 رقم باشد', 'error');
            return;
        }

        if (!months || isNaN(months) || parseInt(months) <= 0) {
            this.showToast('تعداد ماه باید عدد مثبت باشد', 'error');
            return;
        }

        try {
            this.showToast('در حال تمدید MQTT...', 'info');

            const response = await fetch(`${this.apiBase}/sysmodrenewmqttexpiration`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userid: this.currentUser.userid,
                    session: this.sessionToken,
                    targetuser: nationalId,
                    months: parseInt(months)
                })
            });

            const data = await response.json();

            if (data.status === 'success') {
                this.showToast(`MQTT کاربر با موفقیت برای ${months} ماه تمدید شد`, 'success');
                document.getElementById('mqtt-user-id').value = '';
                document.getElementById('mqtt-months').value = '';
            } else {
                this.showToast(this.getErrorMessage(data.reason), 'error');
            }
        } catch (error) {
            console.error('MQTT renewal error:', error);
            this.showToast('خطا در تمدید MQTT', 'error');
        }
    }

    // Get User Devices
    async getUserDevices(identifier, type) {
        try {

            const requestBody = {
                userid: this.currentUser.userid,
                session: this.sessionToken
            };

            if (type === 'nationalId') {
                requestBody.targetuser = identifier;
            } else {
                requestBody.targetphonenumber = identifier;
            }

            const response = await fetch(`${this.apiBase}/sysmodgetuserdevices`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            const data = await response.json();

            if (data.status === 'success') {
                this.showUserDevices(data, identifier);
            } else {
                this.showToast(this.getErrorMessage(data.reason), 'error');
            }
        } catch (error) {
            console.error('Get user devices error:', error);
            this.showToast('خطا در دریافت دستگاه‌های کاربر', 'error');
        }
    }

    // Get User Relationships
    async getUserRelationships(identifier, type) {
        try {

            const requestBody = {
                userid: this.currentUser.userid,
                session: this.sessionToken
            };

            if (type === 'nationalId') {
                requestBody.targetuser = identifier;
            } else {
                requestBody.targetphonenumber = identifier;
            }

            const response = await fetch(`${this.apiBase}/sysmodgetuserrelationship`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            const data = await response.json();

            if (data.status === 'success') {
                this.showUserRelationships(data, identifier);
            } else {
                this.showToast(this.getErrorMessage(data.reason), 'error');
            }
        } catch (error) {
            console.error('Get user relationships error:', error);
            this.showToast('خطا در دریافت روابط کاربر', 'error');
        }
    }

    // Show User Devices
    showUserDevices(data, identifier) {
        const modal = document.getElementById('user-devices-modal');
        const content = document.getElementById('user-devices-content');
        const devicesInfo = data.devices || [];
        
        if (devicesInfo.length === 0) {
            content.innerHTML = `
                <div class="no-data">
                    <i class="bi bi-router" style="font-size: 48px; color: #64748b; margin-bottom: 1rem;"></i>
                    <p>هیچ دستگاهی برای کاربر ${identifier} یافت نشد</p>
                </div>
            `;
        } else {
            let devicesHTML = '<div class="devices-grid">';
            devicesInfo.forEach((device, index) => {
                const statusClass = device.onlinestatus ? 'online' : 'offline';
                const statusText = device.onlinestatus ? 'آنلاین' : 'آفلاین';
                
                devicesHTML += `
                    <div class="device-card">
                        <div class="device-header">
                            <h4><i class="bi bi-router"></i> دستگاه ${index + 1}</h4>
                            <span class="status-badge ${statusClass}">${statusText}</span>
                        </div>
                        <div class="device-details">
                            <div class="detail-item">
                                <span class="detail-label">نام دستگاه:</span>
                                <span class="detail-value">${device.devicenickname || 'نامشخص'}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">نوع دستگاه:</span>
                                <span class="detail-value">${device.devicetype || 'نامشخص'}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">MAC Address:</span>
                                <span class="detail-value">${device.macaddress || 'نامشخص'}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">نوع مالکیت:</span>
                                <span class="detail-value">${device.ownership_type || 'نامشخص'}</span>
                            </div>
                        </div>
                    </div>
                `;
            });
            devicesHTML += '</div>';
            content.innerHTML = devicesHTML;
        }
        
        modal.classList.add('active');
        
        // Close modal when clicking outside
        modal.onclick = (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        };
    }

    // Show User Relationships
    showUserRelationships(data, identifier) {
        const modal = document.getElementById('user-relationships-modal');
        const content = document.getElementById('user-relationships-content');
        const relationships = data.relationships || [];
        
        if (relationships.length === 0) {
            content.innerHTML = `
                <div class="no-data">
                    <i class="bi bi-people" style="font-size: 48px; color: #64748b; margin-bottom: 1rem;"></i>
                    <p>هیچ رابطه‌ای برای کاربر ${identifier} یافت نشد</p>
                </div>
            `;
        } else {
            let relationshipsHTML = '<div class="relationships-grid">';
            relationships.forEach((relation, index) => {
                const statusClass = relation.isactive ? 'active' : 'inactive';
                const statusText = relation.isactive ? 'فعال' : 'غیرفعال';
                
                relationshipsHTML += `
                    <div class="relationship-card">
                        <div class="relationship-header">
                            <h4><i class="bi bi-people"></i> رابطه ${index + 1}</h4>
                            <span class="status-badge ${statusClass}">${statusText}</span>
                        </div>
                        <div class="relationship-details">
                            <div class="detail-item">
                                <span class="detail-label">کاربر مرتبط:</span>
                                <span class="detail-value">${relation.relateduser || 'نامشخص'}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">سطح دسترسی:</span>
                                <span class="detail-value">${relation.accesslevel || 'نامشخص'}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">وضعیت:</span>
                                <span class="detail-value">${relation.status || 'نامشخص'}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">MAC Address:</span>
                                <span class="detail-value">${relation.macaddress || 'نامشخص'}</span>
                            </div>
                            ${relation.notes ? `
                                <div class="detail-item">
                                    <span class="detail-label">یادداشت:</span>
                                    <span class="detail-value">${relation.notes}</span>
                                </div>
                            ` : ''}
                            ${relation.rulecreatetime ? `
                                <div class="detail-item">
                                    <span class="detail-label">تاریخ ایجاد:</span>
                                    <span class="detail-value">${new Date(relation.rulecreatetime * 1000).toLocaleDateString('fa-IR')}</span>
                                </div>
                            ` : ''}
                            ${relation.ruleexpiretime && relation.ruleexpiretime > 0 ? `
                                <div class="detail-item">
                                    <span class="detail-label">تاریخ انقضا:</span>
                                    <span class="detail-value">${new Date(relation.ruleexpiretime * 1000).toLocaleDateString('fa-IR')}</span>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                `;
            });
            relationshipsHTML += '</div>';
            content.innerHTML = relationshipsHTML;
        }
        
        modal.classList.add('active');
        
        // Close modal when clicking outside
        modal.onclick = (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        };
    }

    // User Details Modal
    async viewUserDetails(nationalId) {
        try {
            this.showToast('در حال دریافت جزئیات کاربر...', 'info');

            const response = await fetch(`${this.apiBase}/sysmodgetuserinfo`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userid: this.currentUser.userid,
                    session: this.sessionToken,
                    targetuser: nationalId
                })
            });

            const data = await response.json();

            if (data.status === 'success') {
                this.showUserDetails(data.user_info);
            } else {
                this.showToast(this.getErrorMessage(data.reason), 'error');
            }
        } catch (error) {
            console.error('User details error:', error);
            this.showToast('خطا در دریافت جزئیات کاربر', 'error');
        }
    }

    showUserDetails(userInfo) {
        const modal = document.getElementById('user-details-modal');
        const content = document.getElementById('user-details-content');
        
        content.innerHTML = `
            <div class="detail-section">
                <h4><i class="fas fa-user"></i> اطلاعات شخصی</h4>
                <div class="detail-item">
                    <span class="detail-label">نام:</span>
                    <span class="detail-value">${userInfo.name}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">نام خانوادگی:</span>
                    <span class="detail-value">${userInfo.family}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">کد ملی:</span>
                    <span class="detail-value">${userInfo.codemelli}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">شماره تلفن:</span>
                    <span class="detail-value">${userInfo.number}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">ایمیل:</span>
                    <span class="detail-value">${userInfo.email || 'ندارد'}</span>
                </div>
            </div>
            
            <div class="detail-section">
                <h4><i class="fas fa-cog"></i> وضعیت حساب</h4>
                <div class="detail-item">
                    <span class="detail-label">وضعیت:</span>
                    <span class="detail-value status-${userInfo.banstatus ? 'inactive' : 'active'}">
                        ${userInfo.banstatus ? 'مسدود' : 'فعال'}
                    </span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">سطح دسترسی:</span>
                    <span class="detail-value">${userInfo.admin_level > 0 ? `مدیر سطح ${userInfo.admin_level}` : 'کاربر عادی'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">تاریخ عضویت:</span>
                    <span class="detail-value">${userInfo.registrationtime ? new Date(userInfo.registrationtime * 1000).toLocaleDateString('fa-IR') : 'نامشخص'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">تعداد مسدودی:</span>
                    <span class="detail-value">${userInfo.bandcount || 0}</span>
                </div>
            </div>
            
            <div class="detail-section">
                <h4><i class="fas fa-wallet"></i> اطلاعات مالی</h4>
                <div class="detail-item">
                    <span class="detail-label">موجودی حساب:</span>
                    <span class="detail-value">${userInfo.billcharge ? userInfo.billcharge.toLocaleString() : 0} تومان</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">تاریخ آخرین مسدودی:</span>
                    <span class="detail-value">${userInfo.bandatetime > 0 ? new Date(userInfo.bandatetime * 1000).toLocaleDateString('fa-IR') : 'ندارد'}</span>
                </div>
            </div>
            
            <div class="detail-section">
                <h4><i class="fas fa-network-wired"></i> اطلاعات MQTT</h4>
                <div class="detail-item">
                    <span class="detail-label">وضعیت MQTT:</span>
                    <span class="detail-value status-${userInfo.mqttvaliduntil > Date.now() / 1000 ? 'active' : 'inactive'}">
                        ${userInfo.mqttvaliduntil > Date.now() / 1000 ? 'فعال' : 'منقضی شده'}
                    </span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">تاریخ انقضای MQTT:</span>
                    <span class="detail-value">${userInfo.mqttvaliduntil > 0 ? new Date(userInfo.mqttvaliduntil * 1000).toLocaleDateString('fa-IR') : 'ندارد'}</span>
                </div>
            </div>
        `;
        
        modal.classList.add('active');
    }

    updateUserCount(count) {
        const userCountElement = document.querySelector('.stats-grid .stat-card:nth-child(3) .stat-number');
        if (userCountElement) {
            userCountElement.textContent = count.toLocaleString('fa-IR');
        }
    }

    // Filter users in table
    filterUsers(searchTerm) {
        const tbody = document.getElementById('user-table-body');
        const rows = tbody.getElementsByTagName('tr');
        
        for (let row of rows) {
            const cells = row.getElementsByTagName('td');
            let found = false;
            
            for (let cell of cells) {
                if (cell.textContent.toLowerCase().includes(searchTerm.toLowerCase())) {
                    found = true;
                    break;
                }
            }
            
            row.style.display = found ? '' : 'none';
        }
    }

    // Export users to CSV
    exportUsers() {
        const userList = this.getFromStorage('userList');
        if (!userList || !userList.data) {
            this.showToast('ابتدا لیست کاربران را دریافت کنید', 'error');
            return;
        }

        const csvContent = this.generateUserCSV(userList.data);
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `users_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            this.showToast('فایل CSV با موفقیت دانلود شد', 'success');
        }
    }

    generateUserCSV(users) {
        const headers = ['نام', 'نام خانوادگی', 'کد ملی', 'شماره تلفن', 'ایمیل', 'وضعیت حساب'];
        const csvRows = [headers.join(',')];
        
        users.forEach(user => {
            const row = [
                user.firstname,
                user.lastname,
                user.codemelli,
                user.number,
                user.emailaddr || 'ندارد',
                user.account_status === 'active' ? 'فعال' : 'غیرفعال'
            ];
            csvRows.push(row.join(','));
        });
        
        return csvRows.join('\n');
    }

    // Save SMS history
    saveSMSHistory(smsData) {
        const history = this.getFromStorage('smsHistory') || [];
        history.unshift(smsData);
        
        // Keep only last 100 SMS records
        if (history.length > 100) {
            history.splice(100);
        }
        
        this.saveToStorage('smsHistory', history);
    }

    // Update character counter
    updateCharCounter(elementId, count) {
        document.getElementById(elementId).textContent = count;
    }

    // Update stats
    updateStats() {
        // Update admin count
        const adminData = this.getFromStorage('adminList');
        if (adminData) {
            this.updateAdminCount(adminData.count);
        }

        // Update SMS count
        this.updateSentSMSCount();

        // Update MQTT status (placeholder)
        document.getElementById('mqtt-status').textContent = 'آنلاین';
        
        // Update total users (placeholder)
        document.getElementById('total-users').textContent = '1,250';
    }

    // Update admin count
    updateAdminCount(count) {
        document.getElementById('total-admins').textContent = count || '0';
    }

    // Update sent SMS count
    updateSentSMSCount() {
        const history = this.getFromStorage('smsHistory') || [];
        let totalSent = 0;
        
        history.forEach(sms => {
            if (sms.type === 'bulk') {
                totalSent += sms.successful || 0;
            } else {
                totalSent += 1;
            }
        });
        
        document.getElementById('sent-sms').textContent = totalSent.toLocaleString('fa-IR');
    }

    // Load system health data
    async loadSystemHealth() {
        try {
            const adminSession = this.getFromStorage('adminSession');
            if (!adminSession) {
                console.error('No admin session found');
                return;
            }

            const response = await fetch('https://my.giot.ir/api/healthz', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    is_admin: true,
                    adminid: adminSession.user.userid,
                    session: adminSession.token
                })
            });

            const result = await response.json();
            
            if (result.status === 'OK') {
                this.updateSystemHealthUI(result);
            } else {
                this.showSystemHealthError('خطا در دریافت اطلاعات سلامت سیستم');
            }
        } catch (error) {
            console.error('Error loading system health:', error);
            this.showSystemHealthError('خطا در اتصال به سرور');
        }
    }

    // Update system health UI
    updateSystemHealthUI(healthData) {
        try {
            // Update CPU usage
            const cpuUsage = parseFloat(healthData.system.cpuUsage.replace('%', ''));
            this.updateProgressCircle('cpu', cpuUsage);
            document.getElementById('cpu-value').textContent = healthData.system.cpuUsage;
            document.getElementById('cpu-status').textContent = this.getCPUStatus(cpuUsage);

            // Update Memory usage - Parse from string format like "56%"
            const memoryData = healthData.system.memoryUsage;
            const memoryUsagePercent = parseFloat(memoryData.percentage.replace('%', ''));
            this.updateProgressCircle('memory', memoryUsagePercent);
            document.getElementById('memory-value').textContent = memoryData.percentage;
            document.getElementById('memory-used').textContent = memoryData.used;
            document.getElementById('memory-total').textContent = memoryData.total;
            document.getElementById('memory-status').textContent = this.getMemoryStatus(memoryUsagePercent);

            // Update Disk usage - Parse from string format like "66%"
            const diskData = healthData.system.diskUsage;
            const diskUsagePercent = parseFloat(diskData.percentage.replace('%', ''));
            this.updateProgressCircle('disk', diskUsagePercent);
            document.getElementById('disk-value').textContent = diskData.percentage;
            document.getElementById('disk-used').textContent = diskData.used;
            document.getElementById('disk-total').textContent = diskData.total;
            document.getElementById('disk-status').textContent = this.getDiskStatus(diskUsagePercent);

            // Update system info
            document.getElementById('system-status').textContent = 'سالم';
            document.getElementById('system-status').className = 'detail-value status-healthy';
            document.getElementById('server-time').textContent = healthData.time;
            document.getElementById('last-update').textContent = new Date().toLocaleString('fa-IR');

        } catch (error) {
            console.error('Error updating health UI:', error);
            this.showSystemHealthError('خطا در نمایش اطلاعات');
        }
    }

    // Update progress circle
    updateProgressCircle(type, percentage) {
        const circle = document.getElementById(`${type}-progress`);
        const circumference = 2 * Math.PI * 45; // radius = 45
        const offset = circumference - (percentage / 100) * circumference;
        
        // Create or update SVG circle
        let svg = circle.querySelector('svg');
        if (!svg) {
            svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('width', '100');
            svg.setAttribute('height', '100');
            svg.innerHTML = `
                <circle cx="50" cy="50" r="45" fill="none" stroke="#e0e0e0" stroke-width="8"/>
                <circle cx="50" cy="50" r="45" fill="none" stroke-width="8" 
                        stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
                        transform="rotate(-90 50 50)" class="progress-bar"/>
            `;
            circle.appendChild(svg);
        }
        
        const progressBar = svg.querySelector('.progress-bar');
        progressBar.setAttribute('stroke-dashoffset', offset);
        
        // Set color based on percentage
        let color = '#4CAF50'; // Green
        if (percentage > 80) color = '#f44336'; // Red
        else if (percentage > 60) color = '#ff9800'; // Orange
        
        progressBar.setAttribute('stroke', color);
    }

    // Get CPU status text
    getCPUStatus(usage) {
        if (usage < 30) return 'عملکرد عالی';
        if (usage < 60) return 'عملکرد خوب';
        if (usage < 80) return 'بار متوسط';
        return 'بار بالا';
    }

    // Get Memory status text
    getMemoryStatus(usage) {
        if (usage < 50) return 'استفاده کم';
        if (usage < 70) return 'استفاده متوسط';
        if (usage < 85) return 'استفاده بالا';
        return 'حافظه پر';
    }

    // Get Disk status text
    getDiskStatus(usage) {
        if (usage < 60) return 'فضای کافی';
        if (usage < 80) return 'فضای متوسط';
        if (usage < 90) return 'فضای کم';
        return 'فضای بحرانی';
    }

    // Format bytes to human readable
    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Show system health error
    showSystemHealthError(message) {
        document.getElementById('cpu-status').textContent = message;
        document.getElementById('memory-status').textContent = message;
        document.getElementById('disk-status').textContent = message;
        document.getElementById('system-status').textContent = 'خطا';
        document.getElementById('system-status').className = 'detail-value status-error';
    }

    // Start auto-refresh for system health
    startHealthAutoRefresh() {
        // Refresh every 30 seconds
        this.healthRefreshInterval = setInterval(() => {
            this.loadSystemHealth();
        }, 30000);
    }

    // Stop auto-refresh for system health
    stopHealthAutoRefresh() {
        if (this.healthRefreshInterval) {
            clearInterval(this.healthRefreshInterval);
            this.healthRefreshInterval = null;
        }
    }

    // Manual refresh system health
    async refreshSystemHealth() {
        const refreshBtn = document.querySelector('.refresh-btn');
        if (refreshBtn) {
            refreshBtn.classList.add('loading');
            refreshBtn.disabled = true;
        }

        await this.loadSystemHealth();

        if (refreshBtn) {
            setTimeout(() => {
                refreshBtn.classList.remove('loading');
                refreshBtn.disabled = false;
            }, 1000);
        }
    }

    // Show section
    showSection(sectionName) {
        // Hide all sections
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
        });

        // Show selected section
        const targetSection = document.getElementById(`${sectionName}-section`);
        if (targetSection) {
            targetSection.classList.add('active');
        }

        // Load section-specific data
        if (sectionName === 'admins') {
            this.loadAdminList();
        } else if (sectionName === 'crm') {
            this.getAllTickets(1, 'all');
        }
    }

    // Set active navigation item
    setActiveNavItem(activeItem) {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        activeItem.classList.add('active');
    }

    // Toggle sidebar (mobile)
    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        const isActive = sidebar.classList.contains('active');
        
        if (isActive) {
            sidebar.classList.remove('active');
            document.removeEventListener('click', this.handleOutsideClick);
        } else {
            sidebar.classList.add('active');
            // Add click outside handler for mobile
            setTimeout(() => {
                document.addEventListener('click', this.handleOutsideClick);
            }, 100);
        }
    }
    
    handleOutsideClick = (e) => {
        const sidebar = document.getElementById('sidebar');
        const menuToggle = document.querySelector('.menu-toggle');
        
        if (!sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
            sidebar.classList.remove('active');
            document.removeEventListener('click', this.handleOutsideClick);
        }
    }

    // Toggle password visibility
    togglePassword() {
        const passwordInput = document.getElementById('password');
        const toggleBtn = document.querySelector('.toggle-password i');
        
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            toggleBtn.classList.remove('fa-eye');
            toggleBtn.classList.add('fa-eye-slash');
        } else {
            passwordInput.type = 'password';
            toggleBtn.classList.remove('fa-eye-slash');
            toggleBtn.classList.add('fa-eye');
        }
    }

    // Refresh admin list
    async refreshAdminList() {
        await this.loadAdminList();
        this.showToast('لیست ادمین‌ها بروزرسانی شد', 'success');
    }

    // View admin details
    viewAdminDetails(codemelli) {
        const adminData = this.getFromStorage('adminList');
        if (adminData && adminData.data) {
            const admin = adminData.data.find(a => a.codemelli === codemelli);
            if (admin) {
                alert(`جزئیات ادمین:\n\nنام: ${admin.firstname} ${admin.lastname}\nکد ملی: ${admin.codemelli}\nتلفن: ${admin.number}\nایمیل: ${admin.emailaddr}\nسطح: ${this.getAdminLevelText(admin.admin_level)}`);
            }
        }
    }

    // Export data
    exportData() {
        const data = {
            adminList: this.getFromStorage('adminList'),
            smsHistory: this.getFromStorage('smsHistory'),
            exportDate: new Date().toISOString()
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `admin-panel-data-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showToast('داده‌ها با موفقیت دانلود شد', 'success');
    }

    // Clear local storage
    clearLocalStorage() {
        if (confirm('آیا مطمئن هستید که می‌خواهید تمام داده‌های محلی را پاک کنید؟')) {
            localStorage.clear();
            this.showToast('حافظه محلی پاک شد', 'success');
            setTimeout(() => {
                location.reload();
            }, 1000);
        }
    }

    // Logout
    async logout() {
        if (confirm('آیا مطمئن هستید که می‌خواهید خروج کنید؟')) {
            try {
                if (this.sessionToken && this.currentUser) {
                    await fetch(`${this.apiBase}/sysmodsignout`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            userid: this.currentUser.userid,
                            session: this.sessionToken
                        })
                    });
                }
            } catch (error) {
                console.error('Logout API error:', error);
            } finally {
                localStorage.removeItem('adminSession');
                location.reload();
            }
        }
    }

    // Validation functions
    validateUserId(userid) {
        return /^\d{10}$/.test(userid);
    }

    validatePhoneNumber(phone) {
        return /^09\d{9}$/.test(phone);
    }
    
    // Enhanced form validation with visual feedback
    validateInput(inputElement, validationFn, errorMessage) {
        const value = inputElement.value.trim();
        const isValid = validationFn(value);
        
        // Remove existing validation classes
        inputElement.classList.remove('valid', 'invalid');
        
        if (value && !isValid) {
            inputElement.classList.add('invalid');
            this.showToast(errorMessage, 'error');
            inputElement.focus();
            return false;
        } else if (value && isValid) {
            inputElement.classList.add('valid');
        }
        
        return isValid || !value;
    }
    
    // Add loading state to buttons
    setButtonLoading(button, loading = true) {
        if (loading) {
            button.dataset.originalText = button.innerHTML;
            button.disabled = true;
            button.innerHTML = '<i class="bi bi-arrow-clockwise spinning"></i> در حال پردازش...';
        } else {
            button.disabled = false;
            button.innerHTML = button.dataset.originalText || button.innerHTML;
        }
    }

    // Storage functions
    saveToStorage(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
        } catch (error) {
            console.error('Storage save error:', error);
        }
    }

    getFromStorage(key) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Storage get error:', error);
            return null;
        }
    }

    // Error message translation
    getErrorMessage(reason) {
        const errorMessages = {
            'error parsing json': 'خطا در پردازش داده‌ها',
            'Access denied': 'دسترسی مجاز نیست',
            'Invalid user id': 'کد ملی نامعتبر است',
            'User not found': 'کاربر یافت نشد',
            'Wrong password': 'رمز عبور اشتباه است',
            'User is banned': 'کاربر مسدود شده است',
            'JWT Session decode failed': 'نشست نامعتبر است',
            'No session found': 'نشست یافت نشد',
            'Database error': 'خطا در پایگاه داده',
            'Access denied. Only full admins (level 255) can view admin list': 'فقط مدیران سطح 255 می‌توانند لیست ادمین‌ها را مشاهده کنند',
            'Access denied. High-level admin privileges required (level > 128)': 'سطح دسترسی بالا مورد نیاز است (بیش از 128)'
        };
        
        return errorMessages[reason] || reason || 'خطای نامشخص';
    }

    // Handle add admin form
    async handleAddAdmin() {
        const userid = document.getElementById('new-admin-userid').value.trim();
        const phone = document.getElementById('new-admin-phone').value.trim();
        const level = parseInt(document.getElementById('new-admin-level').value);

        if (!userid && !phone) {
            this.showToast('کد ملی یا شماره تلفن را وارد کنید', 'error');
            return;
        }

        if (userid && !this.validateUserId(userid)) {
            this.showToast('کد ملی باید 10 رقم باشد', 'error');
            return;
        }

        if (phone && !this.validatePhoneNumber(phone)) {
            this.showToast('شماره تلفن نامعتبر است', 'error');
            return;
        }

        if (!level) {
            this.showToast('سطح دسترسی را انتخاب کنید', 'error');
            return;
        }

        const success = await this.defineNewAdmin(userid, phone, level);
        if (success) {
            document.getElementById('add-admin-form').reset();
        }
    }

    // Handle remove admin form
    async handleRemoveAdmin() {
        const userid = document.getElementById('remove-admin-userid').value.trim();
        const phone = document.getElementById('remove-admin-phone').value.trim();

        if (!userid && !phone) {
            this.showToast('کد ملی یا شماره تلفن را وارد کنید', 'error');
            return;
        }

        if (userid && !this.validateUserId(userid)) {
            this.showToast('کد ملی باید 10 رقم باشد', 'error');
            return;
        }

        if (phone && !this.validatePhoneNumber(phone)) {
            this.showToast('شماره تلفن نامعتبر است', 'error');
            return;
        }

        if (confirm('آیا مطمئن هستید که می‌خواهید دسترسی مدیریت این کاربر را حذف کنید؟')) {
            const success = await this.removeAdmin(userid, phone);
            if (success) {
                document.getElementById('remove-admin-form').reset();
            }
        }
    }

    // Admin Management Functions
    async defineNewAdmin(targetUser, targetPhoneNumber, adminLevel) {
        try {
            const requestBody = {
                userid: this.currentUser.userid,
                session: this.sessionToken,
                admin_level: adminLevel
            };

            if (targetUser) {
                requestBody.targetuser = targetUser;
            } else if (targetPhoneNumber) {
                requestBody.targetphonenumber = targetPhoneNumber;
            }

            const response = await fetch(`${this.apiBase}/sysmoddefinenewadmin`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            const data = await response.json();

            if (data.status === 'success') {
                this.showToast('مدیر جدید با موفقیت تعریف شد', 'success');
                this.loadAdminList(); // Refresh admin list
                return true;
            } else {
                this.showToast(this.getErrorMessage(data.reason), 'error');
                return false;
            }
        } catch (error) {
            console.error('Define new admin error:', error);
            this.showToast('خطا در اتصال به سرور', 'error');
            return false;
        }
    }

    async removeAdmin(targetUser, targetPhoneNumber) {
        try {
            const requestBody = {
                userid: this.currentUser.userid,
                session: this.sessionToken
            };

            if (targetUser) {
                requestBody.targetuser = targetUser;
            } else if (targetPhoneNumber) {
                requestBody.targetphonenumber = targetPhoneNumber;
            }

            const response = await fetch(`${this.apiBase}/sysmodremoveadmin`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            const data = await response.json();

            if (data.status === 'success') {
                this.showToast('دسترسی مدیریت با موفقیت حذف شد', 'success');
                this.loadAdminList(); // Refresh admin list
                return true;
            } else {
                this.showToast(this.getErrorMessage(data.reason), 'error');
                return false;
            }
        } catch (error) {
            console.error('Remove admin error:', error);
            this.showToast('خطا در اتصال به سرور', 'error');
            return false;
        }
    }

    // Toast notification with improved UX
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icon = {
            success: 'bi bi-check-circle-fill',
            error: 'bi bi-exclamation-triangle-fill',
            info: 'bi bi-info-circle-fill',
            warning: 'bi bi-exclamation-circle-fill',
            loading: 'bi bi-arrow-clockwise'
        }[type] || 'bi bi-info-circle-fill';
        
        toast.innerHTML = `
            <i class="${icon} ${type === 'loading' ? 'spinning' : ''}"></i>
            <span>${message}</span>
            <button class="toast-close" onclick="this.parentElement.remove()">
                <i class="bi bi-x"></i>
            </button>
        `;
        
        const container = document.getElementById('toast-container');
        container.appendChild(toast);
        
        // Add entrance animation
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });
        
        // Auto remove after duration based on type
        const duration = type === 'error' ? 8000 : type === 'loading' ? 0 : 5000;
        if (duration > 0) {
            setTimeout(() => {
                this.removeToast(toast);
            }, duration);
        }
        
        return toast; // Return toast element for manual removal
    }
    
    removeToast(toast) {
        if (toast && toast.parentNode) {
            toast.classList.remove('show');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }
    }

    // CRM Ticket Management Methods
    async getAllTickets(page = 1, status = 'all') {
        try {
            const response = await fetch(`${this.apiBase}/sysmodgetalltickets`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userid: this.currentUser.userid,
                    session: this.sessionToken,
                    page: page,
                    status: status
                })
            });

            const data = await response.json();
            
            if (data.success) {
                this.displayTickets(data.tickets, data.pagination);
                return data;
            } else {
                this.showToast(this.getErrorMessage(data.reason), 'error');
                return null;
            }
        } catch (error) {
            console.error('Error fetching tickets:', error);
            this.showToast('خطا در دریافت تیکت‌ها', 'error');
            return null;
        }
    }

    displayTickets(tickets, pagination) {
        const tbody = document.getElementById('tickets-table-body');
        const ticketsCount = document.getElementById('tickets-count');
        const currentPageEl = document.getElementById('current-page');
        const totalPagesEl = document.getElementById('total-pages');
        const prevBtn = document.getElementById('prev-page');
        const nextBtn = document.getElementById('next-page');

        if (!tbody) return;

        tbody.innerHTML = '';

        if (!tickets || tickets.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 40px; color: #666;">
                        <i class="fas fa-inbox" style="font-size: 48px; margin-bottom: 15px; opacity: 0.5;"></i>
                        <br>
                        هیچ تیکتی یافت نشد
                    </td>
                </tr>
            `;
            if (ticketsCount) ticketsCount.textContent = '0 تیکت';
            return;
        }

        tickets.forEach(ticket => {
            const row = document.createElement('tr');
            let statusClass, statusText;
            
            if (ticket.status === 'open') {
                statusClass = 'open';
                statusText = 'باز';
            } else if (ticket.status === 'waiting_admin') {
                statusClass = 'waiting';
                statusText = 'منتظر پاسخ ادمین';
            } else {
                statusClass = 'closed';
                statusText = 'بسته';
            }
            
            row.innerHTML = `
                <td>${ticket.id}</td>
                <td>
                    <div style="font-weight: 600; color: #1976d2;">${ticket.user_name || 'نامشخص'}</div>
                    <div style="font-size: 12px; color: #666;">${ticket.user_codemelli}</div>
                </td>
                <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${ticket.subject}">
                    ${ticket.subject}
                </td>
                <td>
                    <span class="status-badge ${statusClass}">${statusText}</span>
                </td>
                <td>${this.formatDate(ticket.created_at)}</td>
                <td>${this.formatDate(ticket.updated_at)}</td>
                <td>
                    <div class="ticket-actions">
                        <button class="btn btn-sm btn-info" onclick="viewTicketDetails(${ticket.id})" title="مشاهده جزئیات">
                            <i class="fas fa-eye"></i>
                            جزئیات
                        </button>
                        <button class="btn btn-sm btn-primary" onclick="replyToTicket(${ticket.id})" title="پاسخ به تیکت">
                            <i class="fas fa-reply"></i>
                            پاسخ
                        </button>
                        ${ticket.status !== 'closed' ? `<button class="btn btn-sm btn-danger" onclick="closeTicket(${ticket.id})" title="بستن تیکت">
                            <i class="fas fa-times-circle"></i>
                            بستن
                        </button>` : ''}
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });

        // Update pagination info
        if (ticketsCount) {
            ticketsCount.textContent = `${pagination.total_tickets} تیکت`;
        }
        if (currentPageEl) {
            currentPageEl.textContent = pagination.current_page;
        }
        if (totalPagesEl) {
            totalPagesEl.textContent = pagination.total_pages;
        }
        
        // Update pagination buttons
        if (prevBtn) {
            prevBtn.disabled = pagination.current_page <= 1;
        }
        if (nextBtn) {
            nextBtn.disabled = pagination.current_page >= pagination.total_pages;
        }

        // Store current pagination for navigation
        this.currentTicketPage = pagination.current_page;
        this.totalTicketPages = pagination.total_pages;
    }

    async getTicketDetails(ticketId) {
        try {
            const response = await fetch(`${this.apiBase}/sysmodgetticketreplies`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userid: this.currentUser.userid,
                    session: this.sessionToken,
                    ticket_id: String(ticketId)
                })
            });

            const data = await response.json();
            
            if (data.success) {
                this.showTicketDetailsModal(data.ticket, data.replies);
                return data;
            } else {
                this.showToast(this.getErrorMessage(data.reason), 'error');
                return null;
            }
        } catch (error) {
            console.error('Error fetching ticket details:', error);
            this.showToast('خطا در دریافت جزئیات تیکت', 'error');
            return null;
        }
    }

    showTicketDetailsModal(ticket, replies) {
        const modal = document.getElementById('ticket-details-modal');
        if (!modal) return;

        // Store current ticket data for later use
        this.currentTicketData = ticket;
        // Store user_id for API calls
        this.currentTicketUserId = ticket.user_id;

        // Populate ticket info
        document.getElementById('ticket-detail-id').textContent = ticket.id;
        document.getElementById('ticket-detail-user').textContent = `${ticket.user_name} (${ticket.user_codemelli})`;
        document.getElementById('ticket-detail-status').textContent = ticket.status === 'open' ? 'باز' : 'بسته';
        document.getElementById('ticket-detail-status').className = `status-badge ${ticket.status}`;
        document.getElementById('ticket-detail-created').textContent = this.formatDate(ticket.created_at);
        document.getElementById('ticket-detail-subject').textContent = ticket.subject;
        document.getElementById('ticket-detail-message').textContent = ticket.message;

        // Handle ticket attachments
        const ticketAttachmentsContainer = document.getElementById('ticket-detail-attachments');
        if (ticketAttachmentsContainer) {
            if (ticket.attachments && ticket.attachments.trim() !== '') {
                const attachmentId = ticket.attachments.trim();
                ticketAttachmentsContainer.innerHTML = `
                    <div class="attachment-item">
                        <span class="attachment-icon">📎</span>
                        <span class="attachment-name">پیوست تیکت</span>
                        <button class="btn-download" onclick="adminPanel.handleAttachmentDownload('${attachmentId}', '${ticket.user_codemelli}')">
                            <i class="fas fa-download"></i> دانلود
                        </button>
                    </div>
                `;
                ticketAttachmentsContainer.style.display = 'block';
            } else {
                ticketAttachmentsContainer.style.display = 'none';
            }
        }

        // Populate replies
        const repliesContainer = document.getElementById('ticket-replies-container');
        repliesContainer.innerHTML = '';

        if (replies && replies.length > 0) {
            replies.forEach(reply => {
                const replyDiv = document.createElement('div');
                replyDiv.className = `reply-item ${reply.is_admin_reply ? 'admin-reply' : 'user-reply'}`;
                
                let attachmentHtml = '';
                if (reply.attachments && reply.attachments.trim() !== '') {
                    const attachmentId = reply.attachments.trim();
                    attachmentHtml = `
                        <div class="reply-attachments">
                            <div class="attachment-item">
                                <span class="attachment-icon">📎</span>
                                <span class="attachment-name">پیوست پاسخ</span>
                                <button class="btn-download" onclick="adminPanel.handleAttachmentDownload('${attachmentId}', '${ticket.user_codemelli}')">
                                    <i class="fas fa-download"></i> دانلود
                                </button>
                            </div>
                        </div>
                    `;
                }

                replyDiv.innerHTML = `
                    <div class="reply-header">
                        <span class="reply-author">
                            <i class="fas ${reply.is_admin_reply ? 'fa-user-shield' : 'fa-user'}"></i>
                            ${reply.author_name}
                        </span>
                        <span class="reply-date">${this.formatDate(reply.created_at)}</span>
                    </div>
                    <div class="reply-content">${reply.message}</div>
                    ${attachmentHtml}
                `;
                
                repliesContainer.appendChild(replyDiv);
            });
        } else {
            repliesContainer.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">هنوز پاسخی ارسال نشده است</p>';
        }

        // Show/hide reply form and reopen button based on ticket status
        const replyForm = document.getElementById('reply-form-container');
        const reopenBtn = document.getElementById('reopen-ticket-btn');
        
        if (ticket.status === 'open') {
            replyForm.style.display = 'block';
            reopenBtn.style.display = 'none';
        } else {
            replyForm.style.display = 'none';
            reopenBtn.style.display = 'inline-flex';
        }

        // Store current ticket ID for reply/reopen actions
        this.currentTicketId = ticket.id;

        // Clear reply textarea and file input
        document.getElementById('reply-message').value = '';
        const fileInput = document.getElementById('reply-attachment');
        if (fileInput) {
            fileInput.value = '';
            this.hideSelectedFileInfo();
        }

        // Show modal
        modal.classList.add('active');
    }

    async sendTicketReply() {
        const replyMessage = document.getElementById('reply-message').value.trim();
        const fileInput = document.getElementById('reply-attachment');
        
        if (!replyMessage) {
            this.showToast('لطفاً پیام پاسخ را وارد کنید', 'warning');
            return;
        }

        if (!this.currentTicketId) {
            this.showToast('خطا در شناسایی تیکت', 'error');
            return;
        }

        let attachmentId = null;
        
        // Handle file upload if a file is selected
        if (fileInput && fileInput.files.length > 0) {
            const file = fileInput.files[0];
            
            try {
                this.showToast('در حال آپلود فایل...', 'info');
                const adminSession = this.getFromStorage('adminSession');
                const uploadResult = await this.uploadAttachment(file, adminSession.user.userid, adminSession.token, this.currentTicketUserId);
                
                if (uploadResult && uploadResult.file_id) {
                    attachmentId = uploadResult.file_id;
                    this.showToast('فایل با موفقیت آپلود شد', 'success');
                } else {
                    this.showToast('خطا در آپلود فایل', 'error');
                    return;
                }
            } catch (error) {
                console.error('Error uploading file:', error);
                this.showToast('خطا در آپلود فایل', 'error');
                return;
            }
        }

        try {
            const requestBody = {
                userid: this.currentUser.userid,
                session: this.sessionToken,
                ticket_id: String(this.currentTicketId),
                message: replyMessage
            };
            
            // Add attachment ID if file was uploaded
            if (attachmentId) {
                requestBody.file_id = attachmentId;
            }
            
            const response = await fetch(`${this.apiBase}/sysmodreplytoticket`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            });

            const data = await response.json();
            
            if (data.success) {
                this.showToast('پاسخ با موفقیت ارسال شد', 'success');
                // Clear reply message and file input
                document.getElementById('reply-message').value = '';
                if (fileInput) {
                    fileInput.value = '';
                    this.hideSelectedFileInfo();
                }
                // Refresh ticket details
                await this.getTicketDetails(this.currentTicketId);
                // Refresh tickets list
                await this.refreshTickets();
            } else {
                this.showToast(this.getErrorMessage(data.reason), 'error');
            }
        } catch (error) {
            console.error('Error sending reply:', error);
            this.showToast('خطا در ارسال پاسخ', 'error');
        }
    }

    async reopenTicket() {
        if (!this.currentTicketId) {
            this.showToast('خطا در شناسایی تیکت', 'error');
            return;
        }

        try {
            const response = await fetch(`${this.apiBase}/sysmodreopenTicket`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userid: this.currentUser.userid,
                    session: this.sessionToken,
                    ticket_id: String(this.currentTicketId)
                })
            });

            const data = await response.json();
            
            if (data.success) {
                this.showToast('تیکت با موفقیت بازگشایی شد', 'success');
                // Refresh ticket details
                await this.getTicketDetails(this.currentTicketId);
                // Refresh tickets list
                await this.refreshTickets();
            } else {
                this.showToast(this.getErrorMessage(data.reason), 'error');
            }
        } catch (error) {
            console.error('Error reopening ticket:', error);
            this.showToast('خطا در بازگشایی تیکت', 'error');
        }
    }

    async closeTicket(ticketId) {
        if (!confirm('آیا از بستن این تیکت اطمینان دارید؟')) {
            return;
        }

        try {
            const response = await fetch(`${this.apiBase}/sysmodcloseticket`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userid: this.currentUser.userid,
                    session: this.sessionToken,
                    ticket_id: String(ticketId)
                })
            });

            const data = await response.json();

            if (data.success) {
                this.showToast('تیکت با موفقیت بسته شد', 'success');
                this.refreshTickets();
            } else {
                this.showToast(this.getErrorMessage(data.reason), 'error');
            }
        } catch (error) {
            console.error('Close ticket error:', error);
            this.showToast('خطا در اتصال به سرور', 'error');
        }
    }

    replyToTicket(ticketId) {
        // Set current ticket ID and show reply modal directly
        this.currentTicketId = ticketId;
        this.showReplyModal(ticketId);
    }

    showReplyModal(ticketId) {
        console.log('showReplyModal called with ticketId:', ticketId);
        
        // Remove existing modal if any
        const existingModal = document.getElementById('reply-modal');
        if (existingModal) {
            console.log('Removing existing modal');
            existingModal.remove();
        }
        
        // Create and show a simple reply modal
        const modalHtml = `
            <div id="reply-modal" class="modal active">
                <div class="modal-content" style="max-width: 500px;">
                    <div class="modal-header">
                        <h3>پاسخ به تیکت #${ticketId}</h3>
                        <span class="close" onclick="closeReplyModal()">&times;</span>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label for="reply-text">پیام پاسخ:</label>
                            <textarea id="reply-text" rows="5" placeholder="پیام خود را وارد کنید..."></textarea>
                        </div>
                        <div class="form-group">
                            <div class="file-upload-section">
                                <input type="file" id="reply-attachment-modal" accept="image/*,.pdf" style="display: none;" onchange="handleModalFileSelection(event)">
                                <label for="reply-attachment-modal" class="file-upload-label">
                                    <i class="fas fa-paperclip"></i>
                                    <span>انتخاب فایل پیوست</span>
                                </label>
                                <div id="selected-file-info-modal" class="selected-file-info" style="display: none;">
                                    <div class="file-info">
                                        <span class="file-icon"></span>
                                        <span class="file-name"></span>
                                        <span class="file-size"></span>
                                        <button type="button" class="remove-file-btn" onclick="removeSelectedModalFile()">
                                            <i class="fas fa-times"></i>
                                        </button>
                                    </div>
                                </div>
                                <div class="file-upload-help">
                                    حداکثر حجم: 1MB | فرمت‌های مجاز: JPG, PNG, WebP, PDF
                                </div>
                            </div>
                        </div>
                        <div class="form-actions">
                            <button type="button" class="btn btn-primary" onclick="submitReply()">ارسال پاسخ</button>
                            <button type="button" class="btn btn-secondary" onclick="closeReplyModal()">انصراف</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Add modal to body
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        console.log('Modal HTML added to DOM');
        
        // Check if modal was actually added
        const addedModal = document.getElementById('reply-modal');
        if (addedModal) {
            console.log('Modal found in DOM:', addedModal);
            console.log('Modal classes:', addedModal.className);
            console.log('Modal style display:', getComputedStyle(addedModal).display);
            console.log('Modal style visibility:', getComputedStyle(addedModal).visibility);
            console.log('Modal style opacity:', getComputedStyle(addedModal).opacity);
        } else {
            console.error('Modal not found in DOM after adding!');
        }
        
        // Focus on textarea
        setTimeout(() => {
            const textarea = document.getElementById('reply-text');
            if (textarea) {
                textarea.focus();
                console.log('Textarea focused');
            } else {
                console.error('Textarea not found!');
            }
        }, 100);
    }

    async submitTicketReply() {
        const replyText = document.getElementById('reply-text')?.value.trim();
        
        if (!replyText) {
            this.showToast('لطفاً پیام پاسخ را وارد کنید', 'warning');
            return;
        }

        if (!this.currentTicketId) {
            this.showToast('خطا در شناسایی تیکت', 'error');
            return;
        }

        try {
            const response = await fetch(`${this.apiBase}/sysmodreplytoticket`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userid: this.currentUser.userid,
                    session: this.sessionToken,
                    ticket_id: String(this.currentTicketId),
                    message: replyText
                })
            });

            const data = await response.json();
            
            if (data.success) {
                this.showToast('پاسخ با موفقیت ارسال شد', 'success');
                this.closeReplyModal();
                this.refreshTickets();
            } else {
                this.showToast(this.getErrorMessage(data.reason), 'error');
            }
        } catch (error) {
            console.error('Error sending ticket reply:', error);
            this.showToast('خطا در ارسال پاسخ', 'error');
        }
    }

    closeReplyModal() {
        const modal = document.getElementById('reply-modal');
        if (modal) {
            modal.remove();
        }
        this.currentTicketId = null;
    }

    closeTicketDetailsModal() {
        const modal = document.getElementById('ticket-details-modal');
        if (modal) {
            modal.classList.remove('active');
            this.currentTicketId = null;
        }
    }

    async refreshTickets() {
        const statusFilter = document.getElementById('ticket-status-filter')?.value || 'all';
        const currentPage = this.currentTicketPage || 1;
        await this.getAllTickets(currentPage, statusFilter);
    }

    async filterTickets() {
        const statusFilter = document.getElementById('ticket-status-filter')?.value || 'all';
        this.currentTicketPage = 1; // Reset to first page when filtering
        await this.getAllTickets(1, statusFilter);
    }

    searchTickets() {
        const searchTerm = document.getElementById('ticket-search')?.value.toLowerCase().trim();
        const rows = document.querySelectorAll('#tickets-table-body tr');
        
        rows.forEach(row => {
            if (row.cells.length === 1) return; // Skip "no tickets" row
            
            const ticketId = row.cells[0].textContent.toLowerCase();
            const userName = row.cells[1].textContent.toLowerCase();
            const subject = row.cells[2].textContent.toLowerCase();
            
            const matches = !searchTerm || 
                           ticketId.includes(searchTerm) || 
                           userName.includes(searchTerm) || 
                           subject.includes(searchTerm);
            
            row.style.display = matches ? '' : 'none';
        });
    }

    async changeTicketPage(direction) {
        const newPage = (this.currentTicketPage || 1) + direction;
        if (newPage >= 1 && newPage <= (this.totalTicketPages || 1)) {
            const statusFilter = document.getElementById('ticket-status-filter')?.value || 'all';
            await this.getAllTickets(newPage, statusFilter);
        }
    }

    formatDate(dateString) {
        if (!dateString) return '-';
        
        try {
            const date = new Date(dateString);
            const options = {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            };
            return date.toLocaleDateString('fa-IR', options);
        } catch (error) {
            return dateString;
        }
    }

    showMqttRenewalModal(userCodemelli) {
        console.log('showMqttRenewalModal called with userCodemelli:', userCodemelli);
        
        // Remove existing modal if any
        const existingModal = document.getElementById('mqtt-renewal-modal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Create MQTT renewal modal
        const modalHtml = `
            <div id="mqtt-renewal-modal" class="modal active">
                <div class="modal-content" style="max-width: 400px;">
                    <div class="modal-header">
                        <h3>تمدید MQTT</h3>
                        <span class="close" onclick="closeMqttRenewalModal()">&times;</span>
                    </div>
                    <div class="modal-body">
                        <p>کاربر: <strong>${userCodemelli}</strong></p>
                        <div class="form-group">
                            <label for="mqtt-renewal-months">مدت زمان تمدید:</label>
                            <select id="mqtt-renewal-months" required>
                                <option value="">انتخاب کنید</option>
                                <option value="1">1 ماه</option>
                                <option value="3">3 ماه</option>
                                <option value="6">6 ماه</option>
                                <option value="12">12 ماه</option>
                            </select>
                        </div>
                        <div class="form-actions">
                            <button type="button" class="btn btn-primary" onclick="submitMqttRenewal('${userCodemelli}')">تمدید MQTT</button>
                            <button type="button" class="btn btn-secondary" onclick="closeMqttRenewalModal()">انصراف</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Add modal to body
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        console.log('MQTT renewal modal added to DOM');
        
        // Focus on select
        setTimeout(() => {
            const selectElement = document.getElementById('mqtt-renewal-months');
            if (selectElement) {
                selectElement.focus();
                console.log('Select element focused');
            }
        }, 100);
    }

    async renewMqttForUser(userCodemelli, months) {
        if (!userCodemelli) {
            this.showToast('کد ملی کاربر مشخص نیست', 'error');
            return;
        }

        if (!this.validateUserId(userCodemelli)) {
            this.showToast('کد ملی باید 10 رقم باشد', 'error');
            return;
        }

        if (!months || isNaN(months) || parseInt(months) <= 0) {
            this.showToast('تعداد ماه باید عدد مثبت باشد', 'error');
            return;
        }

        try {
            this.showToast('در حال تمدید MQTT...', 'info');

            const response = await fetch(`${this.apiBase}/sysmodrenewmqttexpiration`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userid: this.currentUser.userid,
                    session: this.sessionToken,
                    targetuser: userCodemelli,
                    months: parseInt(months)
                })
            });

            const data = await response.json();

            if (data.status === 'success') {
                this.showToast(`MQTT کاربر ${userCodemelli} با موفقیت برای ${months} ماه تمدید شد`, 'success');
                // Close modal
                const modal = document.getElementById('mqtt-renewal-modal');
                if (modal) {
                    modal.remove();
                }
                // Refresh user list if visible
                if (document.getElementById('user-management').style.display !== 'none') {
                    this.getUserList();
                }
            } else {
                this.showToast(this.getErrorMessage(data.reason), 'error');
            }
        } catch (error) {
            console.error('MQTT renewal error:', error);
            this.showToast('خطا در تمدید MQTT', 'error');
        }
    }

    // Attachment utility functions
    async uploadAttachment(file, adminId, sessionToken, targetUserId = null) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('adminid', adminId);
        formData.append('session', sessionToken);
        formData.append('is_admin', 'true');
        // Send userid only if targetUserId is available (user's national code)
        if (targetUserId) {
            formData.append('userid', String(targetUserId));
        }

        try {
            const response = await fetch('https://my.giot.ir/api/upload', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            
            if (result.status === 'success') {
                return {
                    success: true,
                    file_id: result.file_id,
                    downloadUrl: result.download_url
                };
            } else {
                return {
                    success: false,
                    error: result.reason || 'Upload failed'
                };
            }
        } catch (error) {
            console.error('Upload error:', error);
            return {
                success: false,
                error: 'Network error during upload'
            };
        }
    }

    async downloadAttachment(fileId, adminId, sessionToken, targetUserId = null) {
        try {
            const requestBody = {
                adminid: adminId,
                session: sessionToken,
                id: fileId,
                is_admin: true,
                // Always send userid, use adminId as fallback if targetUserId is not available
                userid: String(targetUserId || adminId)
            };
            
            const response = await fetch('https://my.giot.ir/api/download', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            if (response.headers.get('content-type')?.includes('application/json')) {
                const errorData = await response.json();
                throw new Error(errorData.reason || 'Download failed');
            }

            const blob = await response.blob();
            const contentDisposition = response.headers.get('Content-Disposition');
            let filename = fileId + '.bin';
            
            if (contentDisposition && contentDisposition.includes('filename=')) {
                filename = contentDisposition.split('filename=')[1].replace(/"/g, '');
            }

            // Create download link
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            return { success: true, filename };
        } catch (error) {
            console.error('Download error:', error);
            return {
                success: false,
                error: error.message || 'Download failed'
            };
        }
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    getFileIcon(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        switch (ext) {
            case 'pdf':
                return '📄';
            case 'jpg':
            case 'jpeg':
            case 'png':
            case 'webp':
                return '🖼️';
            default:
                return '📎';
        }
    }

    async handleAttachmentDownload(fileId, userNationalId = null) {
        const adminSession = this.getFromStorage('adminSession');
        if (!fileId || !adminSession || !adminSession.user || !adminSession.token) {
            this.showToast('خطا در دانلود فایل', 'error');
            return;
        }

        this.showToast('در حال دانلود فایل...', 'info');
        
        // Use admin ID as adminid and user ID as userid
        const result = await this.downloadAttachment(fileId, adminSession.user.userid, adminSession.token, this.currentTicketUserId);
        
        if (result.success) {
            this.showToast(`فایل ${result.filename} با موفقیت دانلود شد`, 'success');
        } else {
            this.showToast(`خطا در دانلود: ${result.error}`, 'error');
        }
    }

    handleFileSelection(event) {
        const file = event.target.files[0];
        if (!file) {
            this.hideSelectedFileInfo();
            return;
        }

        this.validateAndShowFile(file, event.target);
    }

    showSelectedFileInfo(file) {
        const fileInfo = document.getElementById('selected-file-info');
        const fileName = document.getElementById('selected-file-name');
        
        if (fileInfo && fileName) {
            fileName.textContent = `${file.name} (${this.formatFileSize(file.size)})`;
            fileInfo.style.display = 'flex';
        }
    }

    hideSelectedFileInfo() {
        const fileInfo = document.getElementById('selected-file-info');
        if (fileInfo) {
            fileInfo.style.display = 'none';
        }
    }

    validateAndShowFile(file, inputElement = null) {
        // Validate file size (1MB = 1048576 bytes)
        if (file.size > 1048576) {
            this.showToast('حجم فایل نباید بیشتر از 1MB باشد', 'error');
            if (inputElement) inputElement.value = '';
            this.hideSelectedFileInfo();
            return false;
        }

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
        if (!allowedTypes.includes(file.type)) {
            this.showToast('فرمت فایل مجاز نیست. فقط JPG, PNG, WebP و PDF پذیرفته می‌شود', 'error');
            if (inputElement) inputElement.value = '';
            this.hideSelectedFileInfo();
            return false;
        }

        this.showSelectedFileInfo(file);
        return true;
    }

    setupDragAndDrop() {
        const fileUploadSection = document.querySelector('.file-upload-section');
        const fileInput = document.getElementById('reply-attachment');
        
        if (!fileUploadSection || !fileInput) return;

        // Prevent default drag behaviors
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            fileUploadSection.addEventListener(eventName, this.preventDefaults, false);
            document.body.addEventListener(eventName, this.preventDefaults, false);
        });

        // Highlight drop area when item is dragged over it
        ['dragenter', 'dragover'].forEach(eventName => {
            fileUploadSection.addEventListener(eventName, () => {
                fileUploadSection.classList.add('drag-over');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            fileUploadSection.addEventListener(eventName, () => {
                fileUploadSection.classList.remove('drag-over');
            }, false);
        });

        // Handle dropped files
        fileUploadSection.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            
            if (files.length > 0) {
                const file = files[0];
                if (this.validateAndShowFile(file)) {
                    // Manually set the file to the input element
                    const dataTransfer = new DataTransfer();
                    dataTransfer.items.add(file);
                    fileInput.files = dataTransfer.files;
                }
            }
        }, false);
    }

    preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    handleModalFileSelection(event) {
        const file = event.target.files[0];
        if (!file) {
            this.hideSelectedModalFileInfo();
            return;
        }

        this.validateAndShowModalFile(file, event.target);
    }

    validateAndShowModalFile(file, inputElement = null) {
        // Validate file size (1MB = 1048576 bytes)
        if (file.size > 1048576) {
            this.showToast('حجم فایل نباید بیشتر از 1MB باشد', 'error');
            if (inputElement) inputElement.value = '';
            this.hideSelectedModalFileInfo();
            return false;
        }

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
        if (!allowedTypes.includes(file.type)) {
            this.showToast('فرمت فایل مجاز نیست. فقط JPG, PNG, WebP و PDF پذیرفته می‌شود', 'error');
            if (inputElement) inputElement.value = '';
            this.hideSelectedModalFileInfo();
            return false;
        }

        this.showSelectedModalFileInfo(file);
        return true;
    }

    showSelectedModalFileInfo(file) {
        const fileInfo = document.getElementById('selected-file-info-modal');
        if (!fileInfo) return;

        const fileName = fileInfo.querySelector('.file-name');
        const fileSize = fileInfo.querySelector('.file-size');
        const fileIcon = fileInfo.querySelector('.file-icon');

        if (fileName) fileName.textContent = file.name;
        if (fileSize) fileSize.textContent = this.formatFileSize(file.size);
        if (fileIcon) fileIcon.innerHTML = this.getFileIcon(file.name);

        fileInfo.style.display = 'block';
    }

    hideSelectedModalFileInfo() {
        const fileInfo = document.getElementById('selected-file-info-modal');
        if (fileInfo) {
            fileInfo.style.display = 'none';
        }
    }

    removeSelectedModalFile() {
        const fileInput = document.getElementById('reply-attachment-modal');
        if (fileInput) {
            fileInput.value = '';
        }
        this.hideSelectedModalFileInfo();
    }

    async submitTicketReplyFromModal() {
        const replyText = document.getElementById('reply-text')?.value.trim();
        const fileInput = document.getElementById('reply-attachment-modal');
        const file = fileInput?.files[0];
        
        if (!replyText && !file) {
            this.showToast('لطفاً پیام پاسخ را وارد کنید یا فایل پیوست کنید', 'warning');
            return;
        }

        // Get ticket ID from the modal header
        const modalHeader = document.querySelector('#reply-modal .modal-header h3');
        if (!modalHeader) {
            this.showToast('خطا در شناسایی تیکت', 'error');
            return;
        }
        
        const ticketIdMatch = modalHeader.textContent.match(/#(\d+)/);
        if (!ticketIdMatch) {
            this.showToast('خطا در شناسایی شماره تیکت', 'error');
            return;
        }
        
        const ticketId = ticketIdMatch[1];
        const submitButton = document.querySelector('#reply-modal .btn-primary');
        
        try {
            this.setButtonLoading(submitButton, true);
            
            let fileId = null;
            
            // Upload file if selected
            if (file) {
                const adminSession = this.getFromStorage('adminSession');
                if (!adminSession || !adminSession.user) {
                    this.showToast('خطا: اطلاعات کاربری یافت نشد', 'error');
                    return;
                }
                
                const targetUserId = this.currentTicketUserId || (this.currentTicketData ? this.currentTicketData.user_id : null);
                const uploadResult = await this.uploadAttachment(file, adminSession.user.userid, adminSession.token, targetUserId);
                if (uploadResult && uploadResult.file_id) {
                    fileId = uploadResult.file_id;
                } else {
                    this.showToast('خطا در آپلود فایل', 'error');
                    return;
                }
            }
            
            // Prepare request body
            const requestBody = {
                ticket_id: String(ticketId),
                reply_text: replyText || ''
            };
            
            // Add file_id if file was uploaded
            if (fileId) {
                requestBody.file_id = fileId;
            }
            
            const adminSession = this.getFromStorage('adminSession');
            
            // Prepare request body for sysmodreplytoticket API
            const apiRequestBody = {
                userid: adminSession.user.userid,
                session: adminSession.token,
                ticket_id: String(ticketId),
                message: replyText || ''
            };
            
            // Add file_id if file was uploaded
            if (fileId) {
                apiRequestBody.file_id = fileId;
            }
            
            const response = await fetch(`${this.apiBase}/sysmodreplytoticket`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(apiRequestBody)
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showToast('پاسخ با موفقیت ارسال شد', 'success');
                this.closeReplyModal();
                // Clear form
                document.getElementById('reply-text').value = '';
                if (fileInput) {
                    fileInput.value = '';
                }
                this.hideSelectedModalFileInfo();
                // Refresh tickets if we're on tickets page
                if (document.getElementById('tickets-section').style.display !== 'none') {
                    this.refreshTickets();
                }
            } else {
                this.showToast(this.getErrorMessage(result.reason), 'error');
            }
            
        } catch (error) {
            console.error('Error submitting reply:', error);
            this.showToast('خطا در ارسال پاسخ', 'error');
        } finally {
            this.setButtonLoading(submitButton, false);
        }
    }
}

// Global functions for HTML onclick events
function removeSelectedFile() {
    const fileInput = document.getElementById('reply-attachment');
    if (fileInput) {
        fileInput.value = '';
        adminPanel.hideSelectedFileInfo();
    }
}

function handleModalFileSelection(event) {
    if (window.adminPanel) {
        window.adminPanel.handleModalFileSelection(event);
    }
}

function removeSelectedModalFile() {
    if (window.adminPanel) {
        window.adminPanel.removeSelectedModalFile();
    }
}

function toggleSidebar() {
    adminPanel.toggleSidebar();
}

function togglePassword() {
    adminPanel.togglePassword();
}

function refreshAdminList() {
    adminPanel.refreshAdminList();
}

function exportData() {
    adminPanel.exportData();
}

function clearLocalStorage() {
    adminPanel.clearLocalStorage();
}

function logout() {
    adminPanel.logout();
}

// Missing global wrapper functions
function searchUserInfo() {
    const userId = document.getElementById('search-user-id').value.trim();
    const userPhone = document.getElementById('search-user-phone').value.trim();
    
    if (!userId && !userPhone) {
        adminPanel.showToast('لطفاً کد ملی یا شماره تلفن را وارد کنید', 'error');
        return;
    }
    
    if (userId) {
        adminPanel.searchUserByNationalId();
    } else if (userPhone) {
        adminPanel.searchUserByPhone();
    }
}

function searchUserDevices() {
    const userId = document.getElementById('search-user-id').value.trim();
    const userPhone = document.getElementById('search-user-phone').value.trim();
    
    if (!userId && !userPhone) {
        adminPanel.showToast('لطفاً کد ملی یا شماره تلفن را وارد کنید', 'error');
        return;
    }
    
    if (userId) {
        adminPanel.getUserDevices(userId, 'nationalId');
    } else if (userPhone) {
        adminPanel.getUserDevices(userPhone, 'phone');
    }
}

function searchUserRelationships() {
    const userId = document.getElementById('search-user-id').value.trim();
    const userPhone = document.getElementById('search-user-phone').value.trim();
    
    if (!userId && !userPhone) {
        adminPanel.showToast('لطفاً کد ملی یا شماره تلفن را وارد کنید', 'error');
        return;
    }
    
    if (userId) {
        adminPanel.getUserRelationships(userId, 'nationalId');
    } else if (userPhone) {
        adminPanel.getUserRelationships(userPhone, 'phone');
    }
}

function chargeUserBill() {
    adminPanel.chargeUserBill();
}

function getUserBill() {
    adminPanel.getUserBill();
}

function enableUserAccount() {
    adminPanel.enableUserAccount();
}

function disableUserAccount() {
    adminPanel.disableUserAccount();
}

function renewMqttExpiration() {
    adminPanel.renewMqttExpiration();
}

function exportUserList() {
    adminPanel.exportUsers();
}

function refreshUserList() {
    adminPanel.getUserList();
}

function closeUserDetailsModal() {
    const modal = document.getElementById('user-details-modal');
    if (modal) {
        modal.classList.remove('active');
    }
}

function closeUserDevicesModal() {
    const modal = document.getElementById('user-devices-modal');
    if (modal) {
        modal.classList.remove('active');
    }
}

function closeUserRelationshipsModal() {
    const modal = document.getElementById('user-relationships-modal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// CRM Global Functions
function refreshTickets() {
    if (window.adminPanel) {
        window.adminPanel.refreshTickets();
    }
}

function filterTickets() {
    if (window.adminPanel) {
        window.adminPanel.filterTickets();
    }
}

function searchTickets() {
    if (window.adminPanel) {
        window.adminPanel.searchTickets();
    }
}

function viewTicketDetails(ticketId) {
    if (window.adminPanel) {
        window.adminPanel.getTicketDetails(ticketId);
    }
}

function closeTicketModal() {
    if (window.adminPanel) {
        window.adminPanel.closeTicketDetailsModal();
    }
}

function closeTicketDetailsModal() {
    if (window.adminPanel) {
        window.adminPanel.closeTicketDetailsModal();
    }
}

function sendTicketReply() {
    if (window.adminPanel) {
        window.adminPanel.sendTicketReply();
    }
}

function sendReply() {
    if (window.adminPanel) {
        window.adminPanel.sendTicketReply();
    }
}

function reopenTicket() {
    if (window.adminPanel) {
        window.adminPanel.reopenTicket();
    }
}

function prevTicketPage() {
    if (window.adminPanel) {
        window.adminPanel.changeTicketPage(-1);
    }
}

function nextTicketPage() {
    if (window.adminPanel) {
        window.adminPanel.changeTicketPage(1);
    }
}

function closeTicket(ticketId) {
    if (window.adminPanel) {
        window.adminPanel.closeTicket(ticketId);
    }
}

function replyToTicket(ticketId) {
    console.log('replyToTicket called with ID:', ticketId);
    if (window.adminPanel) {
        console.log('adminPanel found, calling replyToTicket');
        window.adminPanel.replyToTicket(ticketId);
    } else {
        console.error('adminPanel not found!');
        alert('خطا: سیستم هنوز آماده نیست. لطفاً صفحه را رفرش کنید.');
    }
}

function submitReply() {
    console.log('submitReply called');
    if (window.adminPanel) {
        console.log('adminPanel found, calling submitTicketReplyFromModal');
        window.adminPanel.submitTicketReplyFromModal();
    } else {
        console.error('adminPanel not found!');
        alert('خطا: سیستم هنوز آماده نیست. لطفاً صفحه را رفرش کنید.');
    }
}

function closeReplyModal() {
    console.log('closeReplyModal called');
    if (window.adminPanel) {
        console.log('adminPanel found, calling closeReplyModal');
        window.adminPanel.closeReplyModal();
    } else {
        console.error('adminPanel not found!');
        // Fallback: try to close modal directly
        const modal = document.getElementById('reply-modal');
        if (modal) {
            modal.remove();
        }
    }
}

// CRM User Management Functions
function enableUserAccountFromTicket(userCodemelli) {
    if (window.adminPanel && userCodemelli) {
        // Set the user ID in the enable account form
        const enableUserIdInput = document.getElementById('enable-user-id');
        if (enableUserIdInput) {
            enableUserIdInput.value = userCodemelli;
        }
        window.adminPanel.enableUserAccount();
    }
}

function disableUserAccountFromTicket(userCodemelli) {
    if (window.adminPanel && userCodemelli) {
        // Set the user ID in the disable account form
        const disableUserIdInput = document.getElementById('disable-user-id');
        if (disableUserIdInput) {
            disableUserIdInput.value = userCodemelli;
        }
        window.adminPanel.disableUserAccount();
    }
}

function chargeUserBillFromTicket(userCodemelli) {
    if (window.adminPanel && userCodemelli) {
        // Set the user ID in the charge bill form
        const chargeUserIdInput = document.getElementById('charge-user-id');
        if (chargeUserIdInput) {
            chargeUserIdInput.value = userCodemelli;
        }
        window.adminPanel.chargeUserBill();
    }
}

function renewMqttFromTicket(userCodemelli) {
    if (window.adminPanel && userCodemelli) {
        // Set the user ID in the MQTT renewal form
        const mqttUserIdInput = document.getElementById('mqtt-user-id');
        if (mqttUserIdInput) {
            mqttUserIdInput.value = userCodemelli;
        }
        window.adminPanel.renewMqttExpiration();
    }
}

// User List Management Functions
function enableUserAccountFromList(userCodemelli) {
    if (adminPanel && userCodemelli) {
        // Set the user ID in the action form
        const actionUserIdInput = document.getElementById('action-user-id');
        if (actionUserIdInput) {
            actionUserIdInput.value = userCodemelli;
        }
        adminPanel.enableUserAccount();
    }
}

function disableUserAccountFromList(userCodemelli) {
    if (adminPanel && userCodemelli) {
        // Set the user ID in the action form
        const actionUserIdInput = document.getElementById('action-user-id');
        if (actionUserIdInput) {
            actionUserIdInput.value = userCodemelli;
        }
        adminPanel.disableUserAccount();
    }
}

function chargeUserBillFromList(userCodemelli) {
    if (adminPanel && userCodemelli) {
        // Ask user for charge amount
        const amount = prompt('مبلغ شارژ را به تومان وارد کنید:', '10000');
        if (amount && !isNaN(amount) && parseFloat(amount) > 0) {
            // Set the user ID and amount in the financial form
            const financialUserIdInput = document.getElementById('financial-user-id');
            const chargeAmountInput = document.getElementById('charge-amount');
            if (financialUserIdInput && chargeAmountInput) {
                financialUserIdInput.value = userCodemelli;
                chargeAmountInput.value = amount;
                adminPanel.chargeUserBill();
            }
        } else if (amount !== null) {
            adminPanel.showToast('مبلغ معتبر وارد کنید', 'error');
        }
    }
}

function renewMqttFromList(userCodemelli) {
    if (adminPanel && userCodemelli) {
        adminPanel.showMqttRenewalModal(userCodemelli);
    }
}

function closeMqttRenewalModal() {
    const modal = document.getElementById('mqtt-renewal-modal');
    if (modal) {
        modal.remove();
    }
}

function submitMqttRenewal(userCodemelli) {
    const monthsSelect = document.getElementById('mqtt-renewal-months');
    if (!monthsSelect || !monthsSelect.value) {
        adminPanel.showToast('لطفاً مدت زمان تمدید را انتخاب کنید', 'error');
        return;
    }
    
    const months = monthsSelect.value;
    adminPanel.renewMqttForUser(userCodemelli, months);
}

// Initialize admin panel when DOM is loaded
let adminPanel;
document.addEventListener('DOMContentLoaded', () => {
    adminPanel = new AdminPanel();
    window.adminPanel = adminPanel; // Make it globally accessible
});

// Handle online/offline status
window.addEventListener('online', () => {
    adminPanel.showToast('اتصال اینترنت برقرار شد', 'success');
});

window.addEventListener('offline', () => {
    adminPanel.showToast('اتصال اینترنت قطع شد', 'error');
});

// Handle page visibility change
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && adminPanel.sessionToken) {
        // Refresh data when page becomes visible
        adminPanel.updateStats();
    }
});

// Auto-save form data
setInterval(() => {
    if (adminPanel && adminPanel.sessionToken) {
        const bulkMessageEl = document.getElementById('bulk-message');
        const targetUserEl = document.getElementById('target-user');
        const targetPhoneEl = document.getElementById('target-phone');
        const singleMessageEl = document.getElementById('single-message');
        
        const formData = {
            bulkMessage: bulkMessageEl ? bulkMessageEl.value : '',
            targetUser: targetUserEl ? targetUserEl.value : '',
            targetPhone: targetPhoneEl ? targetPhoneEl.value : '',
            singleMessage: singleMessageEl ? singleMessageEl.value : ''
        };
        adminPanel.saveToStorage('formDraft', formData);
    }
}, 30000); // Save every 30 seconds

// Restore form data on load
window.addEventListener('load', () => {
    const formDraft = adminPanel?.getFromStorage('formDraft');
    if (formDraft) {
        const bulkMessageEl = document.getElementById('bulk-message');
        const targetUserEl = document.getElementById('target-user');
        const targetPhoneEl = document.getElementById('target-phone');
        const singleMessageEl = document.getElementById('single-message');
        
        if (formDraft.bulkMessage && bulkMessageEl) bulkMessageEl.value = formDraft.bulkMessage;
        if (formDraft.targetUser && targetUserEl) targetUserEl.value = formDraft.targetUser;
        if (formDraft.targetPhone && targetPhoneEl) targetPhoneEl.value = formDraft.targetPhone;
        if (formDraft.singleMessage && singleMessageEl) singleMessageEl.value = formDraft.singleMessage;
        
        // Update character counters
        adminPanel?.updateCharCounter('bulk-char-count', formDraft.bulkMessage?.length || 0);
        adminPanel?.updateCharCounter('single-char-count', formDraft.singleMessage?.length || 0);
    }
});