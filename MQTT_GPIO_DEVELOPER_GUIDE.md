# MQTT GPIO Developer Guide

This guide documents the changes made to the MQTT GPIO handling functions in `mqtt.cpp` to enhance security and functionality.

## Overview

Three MQTT message handlers have been modified to improve hardware security by ensuring only available GPIO pins can be accessed:

1. `handleGetGPIOStatus` (msg_id: 12)
2. `handleSetGPIOStatus` (msg_id: 13) 
3. `handleToggleGPIOStatus` (msg_id: 14)

## 1. handleGetGPIOStatus Function

### Changes Made:
- Modified to report status of all available GPIO pins instead of sending digitalio.json database
- Added support for both output pins and input pins (Bank 8 if detected)
- Enhanced response format to match `handle_get_gpio_status` functionality

### New Functionality:
- Reports all available output GPIO pins and their current states
- Reports Bank 8 input pins (528-543) if detected
- Provides comprehensive GPIO status information

### JSON Request Format:
```json
{
    "deviceid": "device_serial_number",
    "msg_id": 12
}
```

### JSON Response Format:
```json
{
    "deviceid": "device_serial_number",
    "timestamp": 1234567890,
    "msg_id": 12,
    "status": "success",
    "data": {
        "total_output_pins": 16,
        "total_input_pins": 16,
        "detected_banks": [8],
        "output_pins": [
            {"pin": 123, "value": 1},
            {"pin": 124, "value": 0}
        ],
        "input_pins": [
            {"pin": 528, "value": 1, "bank": 8},
            {"pin": 529, "value": 0, "bank": 8}
        ]
    }
}
```

## 2. handleSetGPIOStatus Function

### Changes Made:
- Added validation to ensure the requested pin exists in the list of available output GPIO pins
- Added verification after setting the value to confirm the operation was successful
- Enhanced error handling with more descriptive messages

### New Functionality:
- Checks if the pin number is in the available GPIO pins list before attempting to set its value
- Returns both the requested value and the actual value that was set
- Provides list of available pins in error responses for debugging

### JSON Request Format:
```json
{
    "deviceid": "device_serial_number",
    "msg_id": 13,
    "pin": 123,
    "value": 1
}
```

### JSON Response Format:
**Success Response:**
```json
{
    "deviceid": "device_serial_number",
    "timestamp": 1234567890,
    "msg_id": 13,
    "status": "success",
    "message": "وضعیت GPIO با موفقیت تنظیم شد",
    "pin": 123,
    "requested_value": 1,
    "actual_value": 1
}
```

**Error Response (Invalid Pin):**
```json
{
    "deviceid": "device_serial_number",
    "timestamp": 1234567890,
    "msg_id": 13,
    "status": "error",
    "message": "پین مورد نظر در لیست GPIO های موجود نیست",
    "available_pins": [123, 124, 125]
}
```

## 3. handleToggleGPIOStatus Function

### Changes Made:
- Added validation to ensure the requested pin exists in the list of available output GPIO pins
- Changed from `getGPIOValue` to `getGPIOOutputValue` for consistency
- Added verification after toggling the value to confirm the operation was successful
- Enhanced error handling with more descriptive messages

### New Functionality:
- Checks if the pin number is in the available GPIO pins list before attempting to toggle its value
- Returns the previous value, requested value, and actual value that was set
- Provides list of available pins in error responses for debugging

### JSON Request Format:
```json
{
    "deviceid": "device_serial_number",
    "msg_id": 14,
    "pin": 123
}
```

### JSON Response Format:
**Success Response:**
```json
{
    "deviceid": "device_serial_number",
    "timestamp": 1234567890,
    "msg_id": 14,
    "status": "success",
    "message": "وضعیت GPIO با موفقیت تغییر کرد",
    "pin": 123,
    "previous_value": 0,
    "requested_value": 1,
    "actual_value": 1
}
```

**Error Response (Invalid Pin):**
```json
{
    "deviceid": "device_serial_number",
    "timestamp": 1234567890,
    "msg_id": 14,
    "status": "error",
    "message": "پین مورد نظر در لیست GPIO های موجود نیست",
    "available_pins": [123, 124, 125]
}
```

## Security Enhancements

### Hardware Security:
- All functions now validate that requested pins exist in the available GPIO pins list
- Prevents unauthorized access to non-existent or restricted GPIO pins
- Provides clear error messages when invalid pins are requested

### Input Validation:
- Device ID verification ensures only authorized devices can control GPIOs
- Parameter validation prevents malformed requests
- Exception handling provides graceful error recovery

## Dependencies

The modified functions depend on the following functions from `extra.cpp`:
- `getAvailableGPIOPins()` - Returns list of available output GPIO pins
- `getAvailableInputGPIOPins()` - Returns list of available input GPIO pins
- `getGPIOOutputValue(int pin)` - Gets current value of output GPIO pin
- `getInputGPIOValue(int pin)` - Gets current value of input GPIO pin
- `setGPIOValue(int pin, bool value)` - Sets GPIO pin value
- `detected_banks` - Vector containing detected GPIO banks

## Testing Notes

1. **Test with valid pins**: Ensure functions work correctly with pins in the available list
2. **Test with invalid pins**: Verify proper error handling for non-existent pins
3. **Test device ID validation**: Confirm requests with wrong device IDs are ignored
4. **Test value verification**: Check that actual values match requested values
5. **Test Bank 8 detection**: Verify input pins are reported when Bank 8 is detected

## Compatibility

These changes maintain backward compatibility with existing MQTT message formats while adding enhanced security and functionality. Existing clients should continue to work, but will now receive more detailed responses and better error handling.