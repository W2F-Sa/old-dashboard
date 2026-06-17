$(document).ready(async function() {	 
	await CheckSesssion() ; 
	updateGreeting() ; 
	
	// Initialize theme toggle
	initializeThemeToggle();
	
	$.ajax({ 
        url: window.GIoTapiBaseUrl, 
        type: 'GET', 
		headers: { 
			'Content-Type': 'application/json; charset=UTF-8', 
            'Accept': 'application/json', 
			'X-Requested-With': 'XMLHttpRequest' 
        }, 
        dataType: 'json', 
        success: function(data) { 
            // Construct the HTML string with the API data 
            var displayHtml = '<div class="api-data">' + 
							  '<p><span class="api-data-label">جهت حفظ امنیت سامانه کلیه فعالیت های شما بر روی سامانه ثبت می گردد</span></p>' + 
							  '<p><span class="api-data-label">آی پی اتصال شما به سرور:</span> ' + data.ClientIP + '</p>' + 
							  '<p><span class="api-data-label">مبدا درخواست:</span> ' + data.ClientCountry + '</p>' + 
							  '<p><span class="api-data-label">زمان بین المللی گرینویچ:</span> ' + data.GMTime + '</p>' + 
							'</div>'; 
 
 
            // Append the information to the specified container 
            $('#apiDataDisplay').html(displayHtml); 
        }, 
        error: function(xhr, status, error) { 
            console.error('An error occurred: ' + error); 
            // Optionally, display an error message in the specified container 
            $('#apiDataDisplay').html('<p>Unable to retrieve data.</p>'); 
        } 
    }); 
	 
	//document.getElementById('changePasswordForm').addEventListener('submit', async function(event) { 
	$('#change-submit').click(async function(event) { 
		event.preventDefault(); // Prevent the form from submitting the traditional way 
	 
		// Check if new passwords match 
		var _currentPassword = document.getElementById('currentPassword').value.trim() ; 
		var _newPassword = document.getElementById('newPassword').value.trim() ; 
		var _confirmNewPassword = document.getElementById('confirmNewPassword').value.trim() ; 
		if (!_currentPassword) { 
			showNotification("پسورد قدیمی نمی تواند خالی باشد", "Alarm"); 
			return; 
		} 
		if (!_newPassword) { 
			showNotification("پسورد جدید نمی تواند خالی باشد", "Alarm"); 
			return; 
		} 
		if (_newPassword !== _confirmNewPassword) { 
			showNotification("پسورد ها همخوانی ندارند", "Alarm"); 
			return; 
		} 
		 
		// Optional: Additional validation (e.g., password strength) can be done here		 
		// Assuming you have a function to handle the AJAX request 
		var _currentPasswordSHA256 = await sha256(_currentPassword) ; 
		var _newPasswordSHA256 = await sha256(_newPassword) ; 
		await changePassword( _currentPasswordSHA256, _newPasswordSHA256 ); 
	}); 
	 
	$('#cancel-submit').click(async function(event) { 
		event.preventDefault(); // Prevent the form from submitting the traditional way 
		window.location.href = 'https://my.giot.ir/dashboard/index.html'; 
	}); 
});

async function changePassword(currentPassword, newPassword)	{
	var _userid = sessionStorage.getItem('userid');
	var _session = sessionStorage.getItem('session');
	console.log('Got Userid: ' + _userid);
	console.log('Got Session: ' + _session);
	console.log('Curent password : ' + currentPassword,);
	console.log('New password: ' + newPassword);
	if( !_userid || !_session )	{
		showNotification("شما نشست فعالی ندارید و باید ابتدا لاگین کنید.", "Alarm");
		sessionStorage.clear();
		window.location.href = '../index.html';
	}
	var data = {
    	userid: _userid,
    	session: _session,
		currentpassword: currentPassword,
		newpassword: newPassword
    };
	console.log('total data: ' + JSON.stringify(data) );
	// Assuming postData returns a promise and '/authenticate' is the correct endpoint
	try{
		var result = await postData(data, '/changepassword');
    	// Assuming result is the JSON object directly (not a string)
    	// If result is a string, use JSON.parse(result) to convert it to an object
        // Check if result is a string and try to parse it
        if (typeof result === 'string') {
            try {
                result = JSON.parse(result);
            } catch (e) {
                console.error('Parsing error:', e.message );
                showNotification("خطا در پردازش پاسخ سرور", "Alarm");
                return;
            }
        }
    	// Check if the result contains the session key
    	if (result && result.status) {
			if(result.status === 'success')	{			
				console.log('You have successfully logged out');
				showNotification("رمز عبور شما با موفقیت تغییر یافت", "OK") ;
				sessionStorage.clear();
				window.location.href = '../index.html';
			}else {
				// Construct an error message from the JSON response
				let errorMessage = "خطا در هنگام تغییر رمز عبور:\n";
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
    		showNotification("خطا در پاسخ دریافتی از سرور", "Alarm") ;
			sessionStorage.clear();
			window.location.href = '../index.html';
    	}
    }catch(error) {
    	// Improved error handling
		if (error && error.status) {
			console.error("AJAX Error - " + error.status + ': ' + error.statusText);
		} else {
			// For non-AJAX errors
			console.error("Error - ", error);
		}
    	showNotification("خطا در برقراری ارتباط با سرور ...", "Alarm") ;
    };
}

// Theme Toggle Functionality
function initializeThemeToggle() {
    const themeToggle = document.getElementById('theme-toggle');
    const body = document.body;
    
    // Check for saved theme preference or default to light mode
    const savedTheme = localStorage.getItem('theme') || 'light';
    
    // Apply saved theme
    if (savedTheme === 'dark') {
        body.setAttribute('data-theme', 'dark');
        if (themeToggle) themeToggle.checked = true;
    } else {
        body.setAttribute('data-theme', 'light');
        if (themeToggle) themeToggle.checked = false;
    }
    
    // Theme toggle event listener
    if (themeToggle) {
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
    }
    
    // Add smooth transition class after initial load
    setTimeout(() => {
        body.classList.add('theme-transition');
    }, 100);
}

function togglePasswordVisibility(inputId) {
    var input = document.getElementById(inputId);
    var icon = input.nextElementSibling;
    if (input.type === "password") {
        input.type = "text";
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        input.type = "password";
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
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
	try{
		const result = await postData(data, '/signout');
    	// Assuming result is the JSON object directly (not a string)
    	// If result is a string, use JSON.parse(result) to convert it to an object
        // Check if result is a string and try to parse it
        if (typeof result === 'string') {
            try {
                result = JSON.parse(result);
            } catch (e) {
                console.error('Parsing error:', e.message);
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
    }catch(error) {    	
        // Improved error handling
		if (error && error.status) {
			console.error("AJAX Error - " + error.status + ': ' + error.statusText);
		} else {
			// For non-AJAX errors
			console.error("Error - ", error);
		}
    	showNotification("خطا در برقراری ارتباط با سرور ...", "Alarm") ;
    };
};

// Function to update the greeting text
function updateGreeting() {
    // Retrieve the stored name
    var shortname = sessionStorage.getItem('shortname');
	var familyname = sessionStorage.getItem('familyname');
	var userid = sessionStorage.getItem('userid');
    
    // Check if the name exists in sessionStorage
    if (shortname | familyname | userid) {
        // Update the content of the h3 element
        document.getElementById('greeting').innerHTML = `<p><span>${shortname} ${familyname} عزیز هشدار! شما در حال تغییر رمز عبور پنل خود هستید</span></p>` + 
														`<p><span>نام کاربری شما: ${userid}</span></p>` ;
    } else {
        // Default text if no name is found
        document.getElementById('greeting').innerHTML = ' نام شما یافت نشد. آیا پروفایل خود را تکمیل نموده اید ؟';
    }
}