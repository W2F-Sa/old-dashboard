/**
 * CRM Ticketing System JavaScript
 * Based on dashboard functionality with CRM-specific features
 */

// Global variables
let currentPage = 1;
let totalPages = 1;
let isLoading = false;
let currentTickets = []; // Store current loaded tickets

$(document).ready(function() {
    // Initialize CRM system
    initializeCRM();
    
    // Check user session
    checkUserSession();
    
    // Initialize theme toggle
    initializeThemeToggle();
    
    // Load tickets statistics
    loadTicketsStats();
    
    // Load user tickets
    loadUserTickets();
    
    // Bind event handlers
    bindEventHandlers();
    
    // Auto-hide mobile menu on outside click
    $(document).on('click', function(e) {
        if (!$(e.target).closest('.navbar-collapse, .navbar-toggler').length) {
            $('.navbar-collapse').removeClass('show');
        }
    });
    
    // Initialize mobile menu toggle functionality
    initializeMobileMenu();
    
    // Initialize desktop dropdown menu functionality
    initializeDesktopMenu();
});

/**
 * Initialize CRM system
 */
function initializeCRM() {
    console.log('CRM Ticketing System initialized');
}    
    // Add fade-in animation to main content
    $('main').addClass('fade-in-up');
    
    // Initialize tooltips if Bootstrap is available
    if (typeof bootstrap !== 'undefined') {
        var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
        var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
            return new bootstrap.Tooltip(tooltipTriggerEl);
        });
    }


/**
 * Initialize mobile menu functionality
 */
function initializeMobileMenu() {
    const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
    const mobileNavMenu = document.getElementById('mobileNavMenu');
    
    if (mobileMenuToggle && mobileNavMenu) {
        // Handle mobile menu toggle
        mobileMenuToggle.addEventListener('click', function(e) {
            e.preventDefault();
            mobileNavMenu.classList.toggle('show');
        });
        
        // Close mobile menu when clicking on menu items
        const mobileMenuItems = mobileNavMenu.querySelectorAll('.mobile-menu-item');
        mobileMenuItems.forEach(item => {
            item.addEventListener('click', function() {
                // Close mobile menu after a short delay to allow navigation
                setTimeout(() => {
                    mobileNavMenu.classList.remove('show');
                }, 100);
            });
        });
        
        // Close mobile menu when clicking outside
        document.addEventListener('click', function(e) {
            if (!mobileNavMenu.contains(e.target) && 
                !mobileMenuToggle.contains(e.target) && 
                mobileNavMenu.classList.contains('show')) {
                mobileNavMenu.classList.remove('show');
            }
        });
        
        // Handle window resize
        window.addEventListener('resize', function() {
            if (window.innerWidth >= 992) {
                mobileNavMenu.classList.remove('show');
            }
        });
    }
}

/**
 * Initialize desktop dropdown menu functionality
 */
function initializeDesktopMenu() {
    const dropdownToggle = document.getElementById('mainMenuDropdown');
    const dropdownMenu = document.querySelector('.glass-dropdown');
    
    if (dropdownToggle && dropdownMenu) {
        // Handle dropdown toggle
        dropdownToggle.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            // Toggle dropdown visibility
            const isVisible = dropdownMenu.classList.contains('show');
            
            // Close all other dropdowns first
            document.querySelectorAll('.dropdown-menu.show').forEach(menu => {
                menu.classList.remove('show');
            });
            
            // Toggle current dropdown
            if (!isVisible) {
                dropdownMenu.classList.add('show');
                dropdownToggle.setAttribute('aria-expanded', 'true');
            } else {
                dropdownMenu.classList.remove('show');
                dropdownToggle.setAttribute('aria-expanded', 'false');
            }
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', function(e) {
            if (!dropdownToggle.contains(e.target) && 
                !dropdownMenu.contains(e.target)) {
                dropdownMenu.classList.remove('show');
                dropdownToggle.setAttribute('aria-expanded', 'false');
            }
        });
        
        // Close dropdown when clicking on menu items
        const dropdownItems = dropdownMenu.querySelectorAll('.dropdown-item');
        dropdownItems.forEach(item => {
            item.addEventListener('click', function() {
                dropdownMenu.classList.remove('show');
                dropdownToggle.setAttribute('aria-expanded', 'false');
            });
        });
        
        // Handle escape key
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && dropdownMenu.classList.contains('show')) {
                dropdownMenu.classList.remove('show');
                dropdownToggle.setAttribute('aria-expanded', 'false');
                dropdownToggle.focus();
            }
        });
    }
}

/**
 * Bind all event handlers
 */
function bindEventHandlers() {
    // Desktop logout button
    const signOutBtn = document.getElementById('signOut');
    const mobileSignOutBtn = document.getElementById('mobileSignOut');
    
    if (signOutBtn) {
        signOutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            signOut();
        });
    }
    
    if (mobileSignOutBtn) {
        mobileSignOutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            signOut();
        });
    }
    
    // New ticket buttons
    $('#newTicketBtn, #mobileNewTicketBtn, #showNewTicketBtn').on('click', function(e) {
        e.preventDefault();
        showNewTicketForm();
    });
    
    // My tickets buttons
    $('#myTicketsBtn, #mobileMyTicketsBtn').on('click', function(e) {
        e.preventDefault();
        showMyTickets();
    });
    
    // Cancel new ticket
    $('#cancelNewTicket').on('click', function(e) {
        e.preventDefault();
        hideNewTicketForm();
    });
    
    // Refresh tickets
    $('#refreshTicketsBtn').on('click', function(e) {
        e.preventDefault();
        loadUserTickets();
        loadTicketsStats();
    });
    
    // New ticket form submission
    $('#newTicketForm').on('submit', function(e) {
        e.preventDefault();
        submitNewTicket();
    });
    
    // File attachment handling
    $('#ticketAttachment').on('change', function(e) {
        handleFileSelection(e.target.files[0]);
    });
    
    // Remove attachment
    $(document).on('click', '#removeAttachment', function() {
        removeAttachment();
    });
    
    // Drag and drop functionality
    const fileUploadArea = document.getElementById('fileUploadArea');
    if (fileUploadArea) {
        // Prevent default drag behaviors
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            fileUploadArea.addEventListener(eventName, preventDefaults, false);
            document.body.addEventListener(eventName, preventDefaults, false);
        });
        
        // Highlight drop area when item is dragged over it
        ['dragenter', 'dragover'].forEach(eventName => {
            fileUploadArea.addEventListener(eventName, highlight, false);
        });
        
        ['dragleave', 'drop'].forEach(eventName => {
            fileUploadArea.addEventListener(eventName, unhighlight, false);
        });
        
        // Handle dropped files
        fileUploadArea.addEventListener('drop', handleDrop, false);
        
        // Click to select file
        fileUploadArea.addEventListener('click', function() {
            document.getElementById('ticketAttachment').click();
        });
    }
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    function highlight(e) {
        fileUploadArea.classList.add('dragover');
    }
    
    function unhighlight(e) {
        fileUploadArea.classList.remove('dragover');
    }
    
    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        
        if (files.length > 0) {
            const fileInput = document.getElementById('ticketAttachment');
            fileInput.files = files;
            handleFileSelection(files[0]);
        }
    }
}

/**
 * Initialize theme toggle functionality
 */
function initializeThemeToggle() {
    const themeToggle = document.getElementById('theme-toggle');
    const currentTheme = localStorage.getItem('theme') || 'light';
    
    // Set initial theme
    document.documentElement.setAttribute('data-theme', currentTheme);
    if (currentTheme === 'dark') {
        themeToggle.checked = true;
    }
    
    // Theme toggle event listener
    themeToggle.addEventListener('change', function() {
        const theme = this.checked ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        
        // Add transition effect
        document.body.style.transition = 'all 0.3s ease';
        setTimeout(() => {
            document.body.style.transition = '';
        }, 300);
    });
    
    // Mobile menu toggle functionality
    const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
    const mobileNavMenu = document.getElementById('mobileNavMenu');
    
    if (mobileMenuToggle && mobileNavMenu) {
        mobileMenuToggle.addEventListener('click', function() {
            mobileNavMenu.classList.toggle('show');
        });
    }

    // Desktop dropdown menu functionality
    const mainMenuDropdown = document.getElementById('mainMenuDropdown');
    if (mainMenuDropdown) {
        mainMenuDropdown.addEventListener('click', function(e) {
            e.preventDefault();
            const dropdownMenu = this.nextElementSibling;
            dropdownMenu.classList.toggle('show');
        });
    }

    // Close dropdown when clicking outside
    document.addEventListener('click', function(e) {
        const dropdowns = document.querySelectorAll('.dropdown-menu');
        dropdowns.forEach(dropdown => {
            if (!dropdown.parentElement.contains(e.target)) {
                dropdown.classList.remove('show');
            }
        });
    });
}



/**
 * Sign out user
 */
function signOut() {
    const userid = sessionStorage.getItem('userid');
    const session = sessionStorage.getItem('session');
    
    if (!userid || !session) {
        sessionStorage.clear();
        window.location.href = '../login.html';
        return;
    }
    
    // Show loading state
    showNotification('در حال خروج از حساب کاربری...', 'info');
    
    // Send sign out request
    postData({
        userid: userid,
        session: session
    }, '/signout')
    .then(response => {
        if (response.success) {
            showNotification('با موفقیت از حساب کاربری خارج شدید', 'success');
            sessionStorage.clear();
            setTimeout(() => {
                window.location.href = 'https://my.giot.ir';
            }, 1500);
        } else {
            throw new Error(response.message || 'خطا در خروج از حساب کاربری');
        }
    })
    .catch(error => {
        console.error('Sign out error:', error);
        showNotification('خطا در خروج از حساب کاربری: ' + error.message, 'error');
        // Clear session anyway and redirect
        sessionStorage.clear();
        setTimeout(() => {
            window.location.href = 'https://my.giot.ir';
        }, 2000);
    });
}

/**
 * Load tickets statistics
 */
function loadTicketsStats() {
    const userid = sessionStorage.getItem('userid');
    const session = sessionStorage.getItem('session');
    
    if (!userid || !session) {
        return;
    }
    
    postData({
         userid: userid,
         session: session
     }, '/crmgetusertickets')
    .then(response => {
        if (response.success && response.tickets) {
            const tickets = response.tickets;
            const openCount = tickets.filter(t => t.status === 'open').length;
            const closedCount = tickets.filter(t => t.status === 'closed').length;
            const pendingCount = tickets.filter(t => t.status === 'pending').length;
            
            $('#openTicketsCount').text(openCount);
            $('#closedTicketsCount').text(closedCount);
            $('#pendingTicketsCount').text(pendingCount);
            $('#totalTicketsCount').text(response.total_tickets || 0);
            
            // Add animation to stat cards
            $('.stat-card').addClass('fade-in-up');
        } else {
            console.error('Failed to load stats:', response.message);
        }
    })
    .catch(error => {
        console.error('Error loading stats:', error);
        // Set default values
        $('#openTicketsCount').text('0');
        $('#closedTicketsCount').text('0');
        $('#pendingTicketsCount').text('0');
        $('#totalTicketsCount').text('0');
    });
}

/**
 * Load user tickets
 */
function loadUserTickets(page = 1) {
    const userid = sessionStorage.getItem('userid');
    const session = sessionStorage.getItem('session');
    
    if (!userid || !session) {
        return;
    }
    
    // Show loading
    $('#ticketsLoading').show();
    $('#ticketsList').empty();
    $('#ticketsPagination').hide();
    
    postData({
        userid: userid,
        session: session,
        page: page,
        limit: 10
    }, '/crmgetusertickets')
    .then(response => {
        $('#ticketsLoading').hide();
        
        if (response.success && response.tickets) {
            const tickets = response.tickets || [];
            const pagination = {
                currentPage: response.page || 1,
                totalPages: response.total_pages || 1,
                totalTickets: response.total_tickets || 0
            };
            
            if (tickets.length === 0) {
                $('#ticketsList').html(`
                    <div class="text-center py-5">
                        <i class="fas fa-ticket-alt fa-3x text-muted mb-3"></i>
                        <h5 class="text-muted">هیچ تیکتی یافت نشد</h5>
                        <p class="text-muted">برای شروع، تیکت جدیدی ایجاد کنید</p>
                        <button class="btn btn-primary" id="createFirstTicket">
                            <i class="fas fa-plus me-2"></i>
                            ایجاد اولین تیکت
                        </button>
                    </div>
                `);
                
                // Bind create first ticket button
                $('#createFirstTicket').on('click', function() {
                    showNewTicketForm();
                });
            } else {
                displayTickets(tickets);
                
                // Show pagination if needed
                if (pagination.totalPages > 1) {
                    displayPagination(pagination);
                    $('#ticketsPagination').show();
                }
            }
        } else {
            throw new Error(response.message || 'خطا در بارگذاری تیکت‌ها');
        }
    })
    .catch(error => {
        $('#ticketsLoading').hide();
        console.error('Error loading tickets:', error);
        $('#ticketsList').html(`
            <div class="text-center py-5">
                <i class="fas fa-exclamation-triangle fa-3x text-warning mb-3"></i>
                <h5 class="text-warning">خطا در بارگذاری تیکت‌ها</h5>
                <p class="text-muted">${error.message}</p>
                <button class="btn btn-primary" onclick="loadUserTickets()">
                    <i class="fas fa-sync-alt me-2"></i>
                    تلاش مجدد
                </button>
            </div>
        `);
    });
}

/**
 * Display tickets list
 */
function displayTickets(tickets) {
    // Store tickets globally for other functions to use
    currentTickets = tickets || [];
    
    let ticketsHtml = '';
    
    tickets.forEach(ticket => {
        const statusClass = getStatusClass(ticket.status);
        const priorityClass = getPriorityClass(ticket.priority);
        const createdDate = new Date(ticket.created_at).toLocaleDateString('fa-IR');
        const updatedDate = new Date(ticket.updated_at).toLocaleDateString('fa-IR');
        
        ticketsHtml += `
            <div class="ticket-item" data-ticket-id="${ticket.id}">
                <div class="ticket-header">
                    <div>
                        <div class="ticket-title">${escapeHtml(ticket.title)}</div>
                        <div class="ticket-id">${ticket.ticket_number || '#' + ticket.id}</div>
                    </div>
                    <div class="d-flex gap-2 align-items-center">
                        <span class="priority-badge priority-${ticket.priority}">${getPriorityText(ticket.priority)}</span>
                        <span class="ticket-status ${statusClass}">${getStatusText(ticket.status)}</span>
                    </div>
                </div>
                <div class="ticket-description">
                    ${escapeHtml(ticket.description.substring(0, 200))}${ticket.description.length > 200 ? '...' : ''}
                </div>
                <div class="ticket-meta">
                    <span><i class="fas fa-user"></i> ${escapeHtml(ticket.customer_name || 'نامشخص')}</span>
                    <span><i class="fas fa-tag"></i> ${getCategoryText(ticket.category)}</span>
                    <span><i class="fas fa-calendar"></i> ${createdDate}</span>
                    <span><i class="fas fa-clock"></i> ${updatedDate}</span>
                    ${ticket.reply_count > 0 ? `<span><i class="fas fa-comments"></i> ${ticket.reply_count} پاسخ</span>` : ''}
                    ${ticket.tags ? `<span><i class="fas fa-tags"></i> ${escapeHtml(ticket.tags)}</span>` : ''}
                </div>
                <div class="ticket-actions">
                    <button class="btn btn-info btn-action-modern" onclick="viewTicketDetails(${ticket.id}); event.stopPropagation();">
                        <i class="fas fa-eye"></i>
                        <span>مشاهده جزئیات</span>
                    </button>
                    ${ticket.status === 'open' ? `
                        <button class="btn btn-success btn-action-modern" onclick="showReplyModal(${ticket.id}); event.stopPropagation();">
                            <i class="fas fa-reply"></i>
                            <span>پاسخ دادن</span>
                        </button>
                        <button class="btn btn-danger btn-action-modern" onclick="closeTicketConfirm(${ticket.id}); event.stopPropagation();" title="بستن تیکت">
                            <i class="fas fa-times-circle"></i>
                            <span>بستن تیکت</span>
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    });
    
    $('#ticketsList').html(ticketsHtml);
    
    // Bind click events for ticket items
    $('.ticket-item').on('click', function() {
        const ticketId = $(this).data('ticket-id');
        viewTicketDetails(ticketId);
    });
}

/**
 * Display pagination
 */
function displayPagination(pagination) {
    let paginationHtml = '';
    
    // Previous button
    if (pagination.currentPage > 1) {
        paginationHtml += `
            <li class="page-item">
                <a class="page-link" href="#" data-page="${pagination.currentPage - 1}">
                    <i class="fas fa-chevron-right"></i>
                </a>
            </li>
        `;
    }
    
    // Page numbers
    for (let i = 1; i <= pagination.totalPages; i++) {
        if (i === pagination.currentPage) {
            paginationHtml += `<li class="page-item active"><span class="page-link">${i}</span></li>`;
        } else {
            paginationHtml += `<li class="page-item"><a class="page-link" href="#" data-page="${i}">${i}</a></li>`;
        }
    }
    
    // Next button
    if (pagination.currentPage < pagination.totalPages) {
        paginationHtml += `
            <li class="page-item">
                <a class="page-link" href="#" data-page="${pagination.currentPage + 1}">
                    <i class="fas fa-chevron-left"></i>
                </a>
            </li>
        `;
    }
    
    $('#ticketsPagination .pagination').html(paginationHtml);
    
    // Bind pagination click events
    $('#ticketsPagination .page-link').on('click', function(e) {
        e.preventDefault();
        const page = $(this).data('page');
        if (page) {
            loadUserTickets(page);
        }
    });
}

/**
 * Check user session - Simple version like dashboard
 */
async function checkUserSession() {
    var userid = sessionStorage.getItem('userid');
    var session = sessionStorage.getItem('session');
    
    if (!userid || !session) {
        showNotification('شما نشست فعالی ندارید و باید ابتدا لاگین کنید.', 'error');
        sessionStorage.clear();
        window.location.href = 'https://my.giot.ir/';
        return false;
    }
    
    try {
        const result = await new Promise((resolve, reject) => {
            $.ajax({
                url: 'https://api.giot.ir/sessionvalidate',
                type: 'POST',
                contentType: 'application/json',
                dataType: 'json',
                data: JSON.stringify({
                    userid: userid,
                    session: session
                }),
                timeout: 10000,
                success: function(response) {
                    resolve(response);
                },
                error: function(xhr, status, error) {
                    reject(new Error(`Session validation failed: ${error}`));
                }
            });
        });
        
        if (result && result.status) {
            if (result.status === 'success') {
                console.log('Session validated successfully');
                return true;
            } else {
                showNotification('نشست شما معتبر شناسائی نشد لطفا لاگین کنید.', 'error');
                sessionStorage.clear();
                window.location.href = 'https://my.giot.ir/';
                return false;
            }
        }
    } catch (error) {
        console.error('Session validation error:', error);
        showNotification('خطا در برقراری ارتباط با سرور', 'error');
        return false;
    }
    
    return false;
}

/**
 * Show new ticket form
 */
function showNewTicketForm() {
    $('#myTicketsSection').hide();
    $('#newTicketSection').show();
    $('#ticketTitle').focus();
    
    // Clear form
    $('#newTicketForm')[0].reset();
    $('#ticketPriority').val('normal');
    $('#ticketCategory').val('general');
}

/**
 * Hide new ticket form
 */
function hideNewTicketForm() {
    $('#newTicketSection').hide();
    $('#myTicketsSection').show();
}

/**
 * Show my tickets section
 */
function showMyTickets() {
    $('#newTicketSection').hide();
    $('#myTicketsSection').show();
    loadUserTickets();
}

/**
 * Submit new ticket
 */
function submitNewTicket() {
    const userid = sessionStorage.getItem('userid');
    const session = sessionStorage.getItem('session');
    
    if (!userid || !session) {
        showNotification('لطفاً ابتدا وارد حساب کاربری خود شوید', 'error');
        return;
    }
    
    // Get form data
    const title = $('#ticketTitle').val().trim();
    const description = $('#ticketDescription').val().trim();
    const category = $('#ticketCategory').val();
    const priority = $('#ticketPriority').val();
    const tags = $('#ticketTags').val().trim();
    const attachmentFile = $('#ticketAttachment')[0].files[0];
    
    // Validate form
    if (!title || !description) {
        showNotification('لطفاً تمام فیلدهای الزامی را پر کنید', 'error');
        return;
    }
    
    if (title.length > 500) {
        showNotification('عنوان تیکت نباید بیش از 500 کاراکتر باشد', 'error');
        return;
    }
    
    if (description.length > 10000) {
        showNotification('توضیحات تیکت نباید بیش از 10000 کاراکتر باشد', 'error');
        return;
    }
    
    // Disable submit button
    const submitBtn = $('#newTicketForm button[type="submit"]');
    const originalText = submitBtn.html();
    submitBtn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin me-2"></i>در حال ارسال...');
    
    // Function to submit ticket data
    const submitTicketData = (fileId = null) => {
        const ticketData = {
            userid: userid,
            session: session,
            title: title,
            description: description,
            category: category,
            priority: priority,
            tags: tags
        };
        
        // Add file_id if attachment was uploaded
        if (fileId) {
            ticketData.file_id = fileId;
        }
        
        return postData(ticketData, '/crmsavenewticket')
        .then(response => {
            if (response.success) {
                showNotification('تیکت با موفقیت ایجاد شد', 'success');
                $('#newTicketForm')[0].reset();
                removeAttachment(); // Clear attachment preview
                hideNewTicketForm();
                loadUserTickets();
                loadTicketsStats();
            } else {
                throw new Error(response.message || 'خطا در ایجاد تیکت');
            }
        });
    };
    
    // If there's an attachment, upload it first
    if (attachmentFile) {
        submitBtn.html('<i class="fas fa-spinner fa-spin me-2"></i>در حال آپلود فایل...');
        
        uploadFile(attachmentFile)
        .then(uploadResponse => {
            submitBtn.html('<i class="fas fa-spinner fa-spin me-2"></i>در حال ایجاد تیکت...');
            return submitTicketData(uploadResponse.file_id);
        })
        .catch(error => {
            console.error('Error uploading file or creating ticket:', error);
            showNotification('خطا در آپلود فایل یا ایجاد تیکت: ' + error.message, 'error');
        })
        .finally(() => {
            // Re-enable submit button
            submitBtn.prop('disabled', false).html(originalText);
        });
    } else {
        // No attachment, submit ticket directly
        submitTicketData()
        .catch(error => {
            console.error('Error creating ticket:', error);
            showNotification('خطا در ایجاد تیکت: ' + error.message, 'error');
        })
        .finally(() => {
            // Re-enable submit button
            submitBtn.prop('disabled', false).html(originalText);
        });
    }
}

/**
 * View ticket details
 */
function viewTicketDetails(ticketId) {
    const userid = sessionStorage.getItem('userid');
    const session = sessionStorage.getItem('session');
    
    if (!userid || !session) {
        showNotification('لطفاً ابتدا وارد حساب کاربری خود شوید', 'error');
        return;
    }
    
    // Find ticket in current loaded tickets first
    const ticket = currentTickets.find(t => t.id == ticketId);
    if (ticket) {
        showTicketDetailsModal(ticket);
        return;
    }

    // If not found in current tickets, reload all tickets and find it
    postData({
        userid: userid,
        session: session,
        page: 1,
        limit: 1000 // Get all tickets to find the specific one
    }, '/crmgetusertickets')
    .then(response => {
        if (response.success && response.tickets) {
            const foundTicket = response.tickets.find(t => t.id == ticketId);
            if (foundTicket) {
                showTicketDetailsModal(foundTicket);
            } else {
                showNotification('تیکت مورد نظر یافت نشد', 'error');
            }
        } else {
            throw new Error(response.message || 'خطا در دریافت جزئیات تیکت');
        }
    })
    .catch(error => {
        console.error('Error loading ticket details:', error);
        showNotification('خطا در بارگذاری جزئیات تیکت: ' + error.message, 'error');
    });
}

/**
 * Show ticket details modal
 */
function showTicketDetailsModal(ticket) {
    const modalHtml = `
        <div class="modal fade" id="ticketDetailsModal" tabindex="-1">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="fas fa-ticket-alt"></i>
                            جزئیات تیکت ${ticket.ticket_number || '#' + ticket.id}
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="ticket-detail-header mb-3">
                            <div class="row">
                                <div class="col-md-8">
                                    <h6 class="ticket-detail-title">${escapeHtml(ticket.title)}</h6>
                                    <div class="ticket-detail-meta">
                                        <span class="badge bg-primary me-2">
                                            <i class="fas fa-user"></i> ${escapeHtml(ticket.customer_name || 'نامشخص')}
                                        </span>
                                        <span class="badge bg-info me-2">
                                            <i class="fas fa-tag"></i> ${getCategoryText(ticket.category)}
                                        </span>
                                        <span class="priority-badge priority-${ticket.priority} me-2">
                                            ${getPriorityText(ticket.priority)}
                                        </span>
                                        <span class="ticket-status ${getStatusClass(ticket.status)}">
                                            ${getStatusText(ticket.status)}
                                        </span>
                                    </div>
                                </div>
                                <div class="col-md-4 text-end">
                                    <small class="text-muted">
                                        <div><i class="fas fa-calendar"></i> ایجاد: ${new Date(ticket.created_at).toLocaleDateString('fa-IR')}</div>
                                        <div><i class="fas fa-clock"></i> بروزرسانی: ${new Date(ticket.updated_at).toLocaleDateString('fa-IR')}</div>
                                    </small>
                                </div>
                            </div>
                        </div>
                        <div class="ticket-detail-description">
                            <h6><i class="fas fa-align-left"></i> توضیحات:</h6>
                            <div class="p-3 bg-light rounded">
                                ${escapeHtml(ticket.description).replace(/\n/g, '<br>')}
                            </div>
                        </div>
                        ${ticket.tags ? `
                            <div class="ticket-detail-tags mt-3">
                                <h6><i class="fas fa-tags"></i> برچسب‌ها:</h6>
                                <span class="badge bg-secondary">${escapeHtml(ticket.tags)}</span>
                            </div>
                        ` : ''}
                        ${ticket.attachments && ticket.attachments.trim() !== '' ? `
                            <div class="ticket-detail-attachment mt-3">
                                <h6><i class="fas fa-paperclip"></i> فایل ضمیمه:</h6>
                                <div class="attachment-item p-2 border rounded">
                                    <div class="d-flex align-items-center gap-2">
                                        <i class="fas fa-file text-primary"></i>
                                        <span class="attachment-name">فایل ضمیمه</span>
                                        <button class="btn btn-sm btn-outline-primary ms-auto" onclick="downloadFile('${ticket.attachments}', 'attachment')">
                                            <i class="fas fa-download"></i> دانلود
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ` : `
                            <div class="ticket-detail-attachment mt-3">
                                <h6><i class="fas fa-paperclip"></i> فایل ضمیمه:</h6>
                                <div class="alert alert-info">
                                    <i class="fas fa-info-circle"></i> هیچ فایل ضمیمه‌ای برای این تیکت وجود ندارد.
                                </div>
                            </div>
                        `}
                        ${ticket.replies && ticket.replies.length > 0 ? `
                            <div class="ticket-replies mt-3">
                                <h6><i class="fas fa-comments"></i> پاسخ‌ها (${ticket.replies.length}):</h6>
                                <div class="replies-container">
                                    ${ticket.replies.map(reply => `
                                        <div class="reply-item mb-3 p-3 border rounded ${reply.is_admin_reply ? 'admin-reply' : 'customer-reply'}">
                                            <div class="reply-header d-flex justify-content-between align-items-center mb-2">
                                                <div class="d-flex align-items-center gap-2">
                                                    <strong>${escapeHtml(reply.author_name || 'نامشخص')}</strong>
                                                    ${reply.is_admin_reply ? '<span class="badge bg-success"><i class="fas fa-user-shield"></i> ادمین</span>' : '<span class="badge bg-primary"><i class="fas fa-user"></i> مشتری</span>'}
                                                </div>
                                                <small class="text-muted">${new Date(reply.created_at).toLocaleDateString('fa-IR')}</small>
                                            </div>
                                            <div class="reply-content">
                                                ${escapeHtml(reply.reply_text || reply.message || '').replace(/\n/g, '<br>')}
                                            </div>
                                            ${reply.attachments && reply.attachments.trim() !== '' ? `
                                                <div class="reply-attachment mt-2">
                                                    <div class="attachment-item p-2 border rounded bg-light">
                                                        <div class="d-flex align-items-center gap-2">
                                                            <i class="fas fa-paperclip text-primary"></i>
                                                            <span class="attachment-name">فایل ضمیمه پاسخ</span>
                                                            <button class="btn btn-sm btn-outline-primary ms-auto" onclick="downloadFile('${reply.attachments}', 'reply-attachment')">
                                                                <i class="fas fa-download"></i> دانلود
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ` : ''}
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                    <div class="modal-footer">
                        ${ticket.status === 'open' ? `
                            <button type="button" class="btn btn-primary" onclick="showReplyModal(${ticket.id})">
                                <i class="fas fa-reply"></i> پاسخ دادن
                            </button>
                            <button type="button" class="btn btn-warning" onclick="closeTicketConfirm(${ticket.id})" title="بستن تیکت">
                                 <i class="fas fa-times"></i>
                             </button>
                        ` : ''}
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                            <i class="fas fa-times"></i> بستن
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Remove existing modal if any
    const existingModal = document.getElementById('ticketDetailsModal');
    if (existingModal) {
        existingModal.remove();
    }

    // Add modal to page and show it
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = new bootstrap.Modal(document.getElementById('ticketDetailsModal'));
    modal.show();

    // Clean up modal after hiding
    document.getElementById('ticketDetailsModal').addEventListener('hidden.bs.modal', function() {
        this.remove();
    });
}

/**
 * Show reply modal
 */
function showReplyModal(ticketId) {
    const modalHtml = `
        <div class="modal fade" id="replyModal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="fas fa-reply"></i>
                            پاسخ به تیکت #${ticketId}
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="replyForm">
                            <div class="mb-3">
                                <label for="replyMessage" class="form-label">پیام پاسخ:</label>
                                <textarea class="form-control" id="replyMessage" rows="5" required 
                                    placeholder="پیام خود را اینجا بنویسید..."></textarea>
                            </div>
                            <div class="mb-3">
                                <label for="replyAttachment" class="form-label">فایل ضمیمه (اختیاری):</label>
                                <input type="file" class="form-control" id="replyAttachment" 
                                    accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx,.txt,.zip,.rar"
                                    onchange="handleReplyFileSelection(this.files[0])">
                                <div class="form-text">حداکثر حجم: 10MB - فرمت‌های مجاز: JPG, PNG, PDF, DOC, TXT, ZIP</div>
                                <div id="replyAttachmentPreview" class="mt-2" style="display: none;">
                                    <div class="attachment-preview p-2 border rounded bg-light">
                                        <div class="d-flex align-items-center gap-2">
                                            <i class="fas fa-file text-primary"></i>
                                            <span id="replyAttachmentName"></span>
                                            <button type="button" class="btn btn-sm btn-outline-danger ms-auto" onclick="removeReplyAttachment()">
                                                <i class="fas fa-times"></i>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                            <i class="fas fa-times"></i> انصراف
                        </button>
                        <button type="button" class="btn btn-primary" onclick="submitReply(${ticketId})">
                            <i class="fas fa-paper-plane"></i> ارسال پاسخ
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Remove existing modal if any
    const existingModal = document.getElementById('replyModal');
    if (existingModal) {
        existingModal.remove();
    }

    // Add modal to page and show it
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = new bootstrap.Modal(document.getElementById('replyModal'));
    modal.show();

    // Focus on textarea
    setTimeout(() => {
        document.getElementById('replyMessage').focus();
    }, 500);

    // Clean up modal after hiding
    document.getElementById('replyModal').addEventListener('hidden.bs.modal', function() {
        this.remove();
    });
}

/**
 * Submit reply
 */
function submitReply(ticketId) {
    const message = document.getElementById('replyMessage').value.trim();
    const attachmentFile = document.getElementById('replyAttachment').files[0];
    
    if (!message) {
        showNotification('لطفاً پیام پاسخ را وارد کنید', 'error');
        return;
    }
    
    if (message.length > 5000) {
        showNotification('پیام پاسخ نباید بیش از 5000 کاراکتر باشد', 'error');
        return;
    }
    
    // Get user session
    const userid = sessionStorage.getItem('userid');
    const session = sessionStorage.getItem('session');
    
    if (!userid || !session) {
        showNotification('لطفاً ابتدا وارد شوید', 'error');
        return;
    }
    
    // Disable submit button
    const submitBtn = document.querySelector('#replyModal .btn-primary');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>در حال ارسال...';
    
    // Function to submit reply data
    const submitReplyData = (fileId = null) => {
        const replyData = {
            userid: userid,
            session: session,
            ticket_id: ticketId,
            reply_message: message
        };
        
        // Add file_id if attachment was uploaded
        if (fileId) {
            replyData.file_id = fileId;
        }
        
        return new Promise((resolve, reject) => {
            $.ajax({
                url: 'https://api.giot.ir/crmreplyticket',
                type: 'POST',
                contentType: 'application/json',
                dataType: 'json',
                data: JSON.stringify(replyData),
                timeout: 30000,
                success: function(response) {
                    resolve(response);
                },
                error: function(xhr, status, error) {
                    reject(new Error(`Reply submission failed: ${error}`));
                }
            });
        })
        .then(response => {
            if (response.success) {
                showNotification('پاسخ با موفقیت ارسال شد', 'success');
                // Close modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('replyModal'));
                modal.hide();
                // Reload tickets
                loadUserTickets();
                loadTicketsStats();
            } else {
                throw new Error(response.message || 'خطا در ارسال پاسخ');
            }
        });
    };
    
    // If there's an attachment, upload it first
    if (attachmentFile) {
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>در حال آپلود فایل...';
        
        uploadFile(attachmentFile)
        .then(uploadResponse => {
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>در حال ارسال پاسخ...';
            return submitReplyData(uploadResponse.file_id);
        })
        .catch(error => {
            console.error('Error uploading file or sending reply:', error);
            showNotification('خطا در آپلود فایل یا ارسال پاسخ: ' + error.message, 'error');
        })
        .finally(() => {
            // Re-enable submit button
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        });
    } else {
        // No attachment, submit reply directly
        submitReplyData()
        .catch(error => {
            console.error('Error sending reply:', error);
            showNotification('خطا در ارسال پاسخ: ' + error.message, 'error');
        })
        .finally(() => {
            // Re-enable submit button
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        });
    }
}

/**
 * Close ticket confirmation
 */
function closeTicketConfirm(ticketId) {
    const modalHtml = `
        <div class="modal fade" id="closeTicketModal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="fas fa-exclamation-triangle text-warning"></i>
                            تأیید بستن تیکت
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <p>آیا از بستن این تیکت اطمینان دارید؟</p>
                        <div class="alert alert-warning">
                            <i class="fas fa-info-circle"></i>
                            پس از بستن تیکت، امکان ارسال پاسخ جدید وجود نخواهد داشت.
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                            <i class="fas fa-times"></i> انصراف
                        </button>
                        <button type="button" class="btn btn-warning" onclick="confirmCloseTicket(${ticketId})">
                            <i class="fas fa-check"></i> بله، تیکت را ببند
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Remove existing modal if any
    const existingModal = document.getElementById('closeTicketModal');
    if (existingModal) {
        existingModal.remove();
    }

    // Add modal to page and show it
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = new bootstrap.Modal(document.getElementById('closeTicketModal'));
    modal.show();

    // Clean up modal after hiding
    document.getElementById('closeTicketModal').addEventListener('hidden.bs.modal', function() {
        this.remove();
    });
}

/**
 * Confirm close ticket
 */
function confirmCloseTicket(ticketId) {
    // Disable confirm button
    const confirmBtn = document.querySelector('#closeTicketModal .btn-warning');
    const originalText = confirmBtn.innerHTML;
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>در حال بستن...';
    
    closeTicket(ticketId)
        .then(() => {
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('closeTicketModal'));
            modal.hide();
            
            // Close ticket details modal if open
            const detailsModal = document.getElementById('ticketDetailsModal');
            if (detailsModal) {
                const detailsModalInstance = bootstrap.Modal.getInstance(detailsModal);
                if (detailsModalInstance) {
                    detailsModalInstance.hide();
                }
            }
        })
        .finally(() => {
            // Re-enable confirm button
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = originalText;
        });
}

/**
 * Utility functions
 */
function getStatusClass(status) {
    switch (status) {
        case 'open': return 'open';
        case 'closed': return 'closed';
        case 'pending': return 'pending';
        default: return 'open';
    }
}

function getStatusText(status) {
    switch (status) {
        case 'open': return '📋 وضعیت تیکت: باز';
        case 'closed': return '✅ وضعیت تیکت: بسته';
        case 'pending': return '⏳ وضعیت تیکت: در انتظار';
        default: return '📋 وضعیت تیکت: باز';
    }
}

function getStatusClass(status) {
    const statusClassMap = {
        'open': 'status-open',
        'pending': 'status-pending', 
        'resolved': 'status-resolved',
        'closed': 'status-closed'
    };
    return statusClassMap[status] || 'status-open';
}

function getPriorityClass(priority) {
    switch (priority) {
        case 'low': return 'priority-low';
        case 'normal': return 'priority-normal';
        case 'high': return 'priority-high';
        case 'urgent': return 'priority-urgent';
        default: return 'priority-normal';
    }
}

function getPriorityText(priority) {
    switch (priority) {
        case 'low': return '🟢 کم اهمیت';
        case 'normal': return '🔵 اولویت عادی';
        case 'medium': return '🟡 اولویت متوسط';
        case 'high': return '🟠 اولویت بالا';
        case 'urgent': return '🔴 فوری و مهم';
        default: return '🔵 اولویت عادی';
    }
}

function getCategoryText(category) {
    switch (category) {
        case 'general': return 'عمومی';
        case 'technical': return 'فنی';
        case 'billing': return 'مالی';
        case 'account': return 'حساب کاربری';
        case 'feature_request': return 'درخواست ویژگی';
        case 'bug_report': return 'گزارش باگ';
        default: return 'عمومی';
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Show notification
 */
function showNotification(message, type = 'info', duration = 5000) {
    const notification = $('#notification');
    
    // Remove existing classes
    notification.removeClass('success error info warning');
    
    // Add new class and content
    notification.addClass(type).text(message).fadeIn(300);
    
    // Play notification sound
    if (type === 'success' || type === 'info') {
        const sound = document.getElementById('OKnotificationSound');
        if (sound) {
            sound.currentTime = 0;
            sound.play().catch(e => console.log('Could not play notification sound'));
        }
    } else if (type === 'error' || type === 'warning') {
        const sound = document.getElementById('AlarmnotificationSound');
        if (sound) {
            sound.currentTime = 0;
            sound.play().catch(e => console.log('Could not play alarm sound'));
        }
    }
    
    // Auto hide after duration
    setTimeout(() => {
        notification.fadeOut(300);
    }, duration);
}

/**
 * Global error handler
 */
window.addEventListener('error', function(e) {
    console.error('Global error:', e.error);
    showNotification('خطای غیرمنتظره‌ای رخ داد', 'error');
});

/**
 * Handle unhandled promise rejections
 */
window.addEventListener('unhandledrejection', function(e) {
    console.error('Unhandled promise rejection:', e.reason);
    showNotification('خطا در ارتباط با سرور', 'error');
});



/**
 * Close ticket function
 */
function closeTicket(ticketId) {
    const userid = sessionStorage.getItem('userid');
    const session = sessionStorage.getItem('session');
    
    if (!userid || !session) {
        showNotification('لطفاً ابتدا وارد شوید', 'error');
        return Promise.reject(new Error('User not logged in'));
    }
    
    return postData({
        userid: userid,
        session: session,
        ticket_id: String(ticketId),
        close_reason: 'تیکت توسط کاربر بسته شد'
    }, '/crmcloseticket')
    .then(response => {
        console.log('Close ticket response:', response);
        
        // Check for success status in response
        if (response.status === 'success' || response.success) {
            const message = response.message || 'تیکت با موفقیت بسته شد';
            const ticketId = response.ticket_id || ticketId;
            
            showNotification(`✅ ${message} (شماره تیکت: ${ticketId})`, 'success');
            loadUserTickets(); // Reload tickets
            loadTicketsStats(); // Update stats
            return response;
        } else {
            const errorMessage = response.message || response.error || 'خطا در بستن تیکت';
            throw new Error(errorMessage);
        }
    })
    .catch(error => {
        console.error('Error closing ticket:', error);
        const errorMsg = error.message || 'خطای ناشناخته در بستن تیکت';
        showNotification(`❌ خطا در بستن تیکت: ${errorMsg}`, 'error');
        throw error;
    });
}

/**
 * Handle file selection for attachment
 */
function handleFileSelection(file) {
    if (!file) {
        return;
    }
    
    // Validate file size (max 1MB)
    const maxSize = 1024 * 1024; // 1MB in bytes
    if (file.size > maxSize) {
        showNotification('حجم فایل نباید بیش از 1 مگابایت باشد', 'error');
        $('#ticketAttachment').val('');
        return;
    }
    
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
        showNotification('فقط فایل‌های JPG، PNG، WebP و PDF مجاز هستند', 'error');
        $('#ticketAttachment').val('');
        return;
    }
    
    // Show file preview with enhanced UI
    const fileSize = file.size > 1024 * 1024 ? 
        (file.size / (1024 * 1024)).toFixed(1) + ' MB' : 
        (file.size / 1024).toFixed(1) + ' KB';
    
    // Set appropriate icon based on file type
    const attachmentIcon = document.getElementById('attachmentIcon');
    if (attachmentIcon) {
        if (file.type.startsWith('image/')) {
            attachmentIcon.className = 'fas fa-file-image';
        } else if (file.type === 'application/pdf') {
            attachmentIcon.className = 'fas fa-file-pdf';
        } else {
            attachmentIcon.className = 'fas fa-file';
        }
    }
    
    $('#attachmentName').text(file.name);
    $('#attachmentSize').text(fileSize);
    $('#attachmentPreview').show();
    
    // Add success animation
    const preview = document.getElementById('attachmentPreview');
    if (preview) {
        preview.style.animation = 'none';
        setTimeout(() => {
            preview.style.animation = 'slideInUp 0.4s ease-out';
        }, 10);
    }
}

/**
 * Remove selected attachment
 */
function removeAttachment() {
    $('#ticketAttachment').val('');
    $('#attachmentPreview').hide();
}

/**
 * Upload file to server
 */
function uploadFile(file) {
    const userid = sessionStorage.getItem('userid');
    const session = sessionStorage.getItem('session');
    
    if (!userid || !session) {
        return Promise.reject(new Error('کاربر وارد نشده است'));
    }
    
    return new Promise((resolve, reject) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('userid', userid);
        formData.append('session', session);
        
        // Show upload progress
        const uploadProgress = document.getElementById('uploadProgress');
        const progressBar = uploadProgress ? uploadProgress.querySelector('.progress-bar') : null;
        const progressText = uploadProgress ? uploadProgress.querySelector('.progress-text') : null;
        
        if (uploadProgress) {
            uploadProgress.style.display = 'block';
            if (progressBar) progressBar.style.width = '0%';
            if (progressText) progressText.textContent = 'در حال آپلود...';
        }
        
        $.ajax({
            url: 'https://my.giot.ir/api/upload',
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            xhr: function() {
                const xhr = new window.XMLHttpRequest();
                xhr.upload.addEventListener('progress', function(evt) {
                    if (evt.lengthComputable && progressBar && progressText) {
                        const percentComplete = Math.round((evt.loaded / evt.total) * 100);
                        progressBar.style.width = percentComplete + '%';
                        progressText.textContent = `آپلود: ${percentComplete}%`;
                    }
                }, false);
                return xhr;
            },
            success: function(response) {
                if (progressText) progressText.textContent = 'آپلود کامل شد!';
                setTimeout(() => {
                    if (uploadProgress) uploadProgress.style.display = 'none';
                }, 1000);
                
                if (response.status === 'success') {
                    resolve(response);
                } else {
                    reject(new Error(response.reason || 'خطا در آپلود فایل'));
                }
            },
            error: function(xhr, status, error) {
                if (uploadProgress) uploadProgress.style.display = 'none';
                
                let errorMessage = 'خطا در آپلود فایل';
                
                if (xhr.status === 401) {
                    errorMessage = 'جلسه کاری منقضی شده است';
                } else if (xhr.status === 413) {
                    errorMessage = 'حجم فایل بیش از حد مجاز است';
                } else if (xhr.status === 415) {
                    errorMessage = 'نوع فایل مجاز نیست';
                } else if (xhr.responseJSON && xhr.responseJSON.reason) {
                    errorMessage = xhr.responseJSON.reason;
                }
                
                reject(new Error(errorMessage));
            }
        });
    });
}

/**
 * Download file from server
 */
/**
 * Handle file selection for reply attachment
 */
function handleReplyFileSelection(file) {
    if (!file) return;
    
    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB in bytes
    if (file.size > maxSize) {
        showNotification('حجم فایل نباید بیش از 10 مگابایت باشد', 'error');
        document.getElementById('replyAttachment').value = '';
        return;
    }
    
    // Show file preview
    document.getElementById('replyAttachmentName').textContent = file.name;
    document.getElementById('replyAttachmentPreview').style.display = 'block';
}

/**
 * Remove reply attachment
 */
function removeReplyAttachment() {
    document.getElementById('replyAttachment').value = '';
    document.getElementById('replyAttachmentPreview').style.display = 'none';
}

function downloadFile(fileId, filename) {
    const userid = sessionStorage.getItem('userid');
    const session = sessionStorage.getItem('session');
    
    if (!userid || !session) {
        showNotification('لطفاً ابتدا وارد شوید', 'error');
        return;
    }
    
    // Show loading notification
    showNotification('در حال دانلود فایل...', 'info');
    
    const requestData = {
        userid: userid,
        session: session,
        id: fileId
    };
    
    $.ajax({
        url: 'https://my.giot.ir/api/download',
        type: 'POST',
        data: JSON.stringify(requestData),
        contentType: 'application/json',
        xhrFields: {
            responseType: 'blob'
        },
        success: function(data, status, xhr) {
            // Check if response is JSON (error)
            const contentType = xhr.getResponseHeader('Content-Type');
            if (contentType && contentType.includes('application/json')) {
                const reader = new FileReader();
                reader.onload = function() {
                    const errorResponse = JSON.parse(reader.result);
                    showNotification('خطا در دانلود: ' + (errorResponse.reason || 'خطای ناشناخته'), 'error');
                };
                reader.readAsText(data);
                return;
            }
            
            // Create download link
            const blob = new Blob([data]);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            
            // Get filename from Content-Disposition header or use provided filename
            const contentDisposition = xhr.getResponseHeader('Content-Disposition');
            let downloadFilename = filename || fileId + '.bin';
            if (contentDisposition && contentDisposition.includes('filename=')) {
                const matches = contentDisposition.match(/filename="?([^"]+)"?/);
                if (matches && matches[1]) {
                    downloadFilename = matches[1];
                }
            }
            
            a.download = downloadFilename;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            showNotification('فایل با موفقیت دانلود شد: ' + downloadFilename, 'success');
        },
        error: function(xhr, status, error) {
            let errorMessage = 'خطا در دانلود فایل';
            
            if (xhr.status === 401) {
                errorMessage = 'جلسه کاری منقضی شده است';
            } else if (xhr.status === 404) {
                errorMessage = 'فایل یافت نشد';
            } else if (xhr.responseJSON && xhr.responseJSON.reason) {
                errorMessage = xhr.responseJSON.reason;
            }
            
            showNotification(errorMessage, 'error');
        }
    });
}