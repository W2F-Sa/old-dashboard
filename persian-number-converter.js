/**
 * Persian to English Number Converter
 * Automatically converts Persian/Farsi numbers to English numbers in form inputs
 * Author: Mahan Electronic Pernia
 * Version: 1.0.0
 */

// Persian to English number mapping
const persianNumbers = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
const englishNumbers = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

/**
 * Convert Persian numbers to English numbers
 * @param {string} input - Input string containing Persian numbers
 * @returns {string} - String with English numbers
 */
function convertPersianToEnglish(input) {
    if (!input || typeof input !== 'string') {
        return input;
    }
    
    let result = input;
    
    // Replace each Persian number with its English equivalent
    for (let i = 0; i < persianNumbers.length; i++) {
        const persianRegex = new RegExp(persianNumbers[i], 'g');
        result = result.replace(persianRegex, englishNumbers[i]);
    }
    
    return result;
}

/**
 * Apply Persian to English conversion to a specific input field
 * @param {HTMLInputElement} inputElement - The input element to apply conversion to
 */
function applyPersianConversion(inputElement) {
    if (!inputElement) return;
    
    // Convert on input event (real-time conversion)
    inputElement.addEventListener('input', function(e) {
        const cursorPosition = e.target.selectionStart;
        const originalValue = e.target.value;
        const convertedValue = convertPersianToEnglish(originalValue);
        
        if (originalValue !== convertedValue) {
            e.target.value = convertedValue;
            // Restore cursor position
            e.target.setSelectionRange(cursorPosition, cursorPosition);
        }
    });
    
    // Convert on paste event
    inputElement.addEventListener('paste', function(e) {
        setTimeout(() => {
            const convertedValue = convertPersianToEnglish(e.target.value);
            e.target.value = convertedValue;
        }, 10);
    });
    
    // Convert on blur event (when user leaves the field)
    inputElement.addEventListener('blur', function(e) {
        const convertedValue = convertPersianToEnglish(e.target.value);
        e.target.value = convertedValue;
    });
}

/**
 * Initialize Persian number conversion for all numeric input fields
 */
function initializePersianNumberConversion() {
    // List of input field IDs that should have Persian number conversion
    const numericInputIds = [
        // Recovery form
        'codemelli_recovery',
        'phonenumber_recovery',
        
        // Register form
        'phonenumber_register',
        'otpcode',
        'codemelli_register',
        'codeposti_register',
        
        // Login form
        'username_login'
    ];
    
    // Apply conversion to each numeric input field
    numericInputIds.forEach(inputId => {
        const inputElement = document.getElementById(inputId);
        if (inputElement) {
            applyPersianConversion(inputElement);
            
            // Add a visual indicator that Persian numbers will be converted
            inputElement.setAttribute('data-persian-convert', 'true');
            inputElement.setAttribute('title', 'اعداد فارسی به طور خودکار به انگلیسی تبدیل می‌شوند');
        }
    });
    
    console.log('Persian number conversion initialized for form inputs');
}

/**
 * Convert all Persian numbers in form data before submission
 * @param {FormData|Object} formData - Form data to convert
 * @returns {FormData|Object} - Form data with converted numbers
 */
function convertFormDataNumbers(formData) {
    if (formData instanceof FormData) {
        const convertedFormData = new FormData();
        for (let [key, value] of formData.entries()) {
            if (typeof value === 'string') {
                convertedFormData.append(key, convertPersianToEnglish(value));
            } else {
                convertedFormData.append(key, value);
            }
        }
        return convertedFormData;
    } else if (typeof formData === 'object' && formData !== null) {
        const convertedData = {};
        for (let key in formData) {
            if (formData.hasOwnProperty(key)) {
                if (typeof formData[key] === 'string') {
                    convertedData[key] = convertPersianToEnglish(formData[key]);
                } else {
                    convertedData[key] = formData[key];
                }
            }
        }
        return convertedData;
    }
    
    return formData;
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializePersianNumberConversion();
});

// Also initialize if jQuery is available
if (typeof $ !== 'undefined') {
    $(document).ready(function() {
        initializePersianNumberConversion();
    });
}

// Export functions for use in other scripts
window.PersianNumberConverter = {
    convert: convertPersianToEnglish,
    applyToInput: applyPersianConversion,
    convertFormData: convertFormDataNumbers,
    initialize: initializePersianNumberConversion
};