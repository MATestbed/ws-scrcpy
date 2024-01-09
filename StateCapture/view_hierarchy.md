# View Hierarchy Capture Using Droidbot API

## Introduction

This guide provides instructions on using the Droidbot API within a Python project to capture the view hierarchy from an Android device. It explains how to set up the project, establish a connection to the device, and use the Droidbot API to dump the view hierarchy into structured JSON files.

## Getting Started

### Prerequisites

- Ensure that the `droidbotApp.apk` is placed in the `resources` directory.
- Install all Python dependencies listed in `requirements.txt`.

## Workflow

1. Connect to the device using the serial number.
2. Confirm the installation of the DroidBot app and enable the required accessibility service.
3. Initiate the data capture loop to collect view hierarchy and screenshot data.
4. Process and store the captured data in a structured JSON format.
5. Prompt user interaction to control the timing of data captures.

## Module Descriptions

The project is structured into key modules, each with specific roles:

- `device.py`: Manages device setup and data capture.
- `adb.py`: Interfaces with Android Debug Bridge (ADB) commands.
- `droidbot_app.py`: Establishes communication with the DroidBot app.
- `start.py`: Orchestrates the view hierarchy capturing process.

### `device.py` - Device Management

The `Device` class is the central point of interaction with the Android device. It initializes the connections to the ADB interface, the DroidBot app, and Minicap.

- **`connect`**: Establishes connections and sets up the DroidBot app and Minicap.
- **`disconnect`**: Closes all connections and cleans up resources.
- **`get_views`**: Retrieves the current view hierarchy from the DroidBot app.
- **`take_screenshot`**: Captures the device's screen using Minicap.

**Device Initialization**: Establishes the initial setup required for communication with the device.
**DroidBot and Minicap Integration**: Interfaces with the `DroidBotAppConn` and `Minicap` to utilize their functionalities for capturing the view hierarchy and screenshots.
**Display Information Retrieval**: Gathers display metrics such as resolution and density, essential for accurately capturing the device's state.
**View Hierarchy Capture**: Retrieves the current view hierarchy from the DroidBot app.
**Screenshot Capture**: Utilizes Minicap to take screenshots of the device's current state.

### `adb.py` - ADB Interface

This module serves as a wrapper around ADB commands, facilitating the execution of shell commands and retrieval of device properties.

- **`run_cmd` and `shell`**: Execute ADB and shell commands, respectively.
- **`get_display_info`**: Fetches display metrics such as resolution and density.
- **`enable_accessibility_service`**: Enables the required accessibility service for the DroidBot app to function.

### `droidbot_app.py` - DroidBot App Connection

Manages the connection to the DroidBot app installed on the device and listens for messages related to the view hierarchy.

- **`set_up`**: Installs (if necessary) and configures the DroidBot app on the device.
- **`connect`**: Establishes a socket connection to the DroidBot app.
- **`listen_messages`**: Listens for and processes messages from the DroidBot app.
- **`get_views`**: Retrieves the serialized view hierarchy data from the DroidBot app.

**Accessibility Service Management**: Handles the enabling of accessibility services, which are crucial for the DroidBot app to observe UI states and events.
**View Hierarchy Processing**: Converts the view hierarchy tree received from the DroidBot app into a list format for easier processing and analysis.

### `start.py` - Entry Point

The entry point of the project which sets up the device connection and starts the view hierarchy capture loop.

- **`capture_view_hierarchy_loop`**: Continuously captures the view hierarchy and screenshots at defined intervals.

---

## Capturing the View Hierarchy

### Step 1: Establish Device Connection

Using `device.py`, create a `Device` object and call `connect` to initiate the connection and configuration:

```python
device = Device(device_serial='DEVICE_SERIAL')
device.connect()
```

### Step 2: Interact with DroidBot App

`droidbot_app.py` manages the socket connection to the DroidBot app, enabling message exchange and data retrieval:

```python
droidbot_app_conn = DroidBotAppConn(device=device)
droidbot_app_conn.set_up()
droidbot_app_conn.connect()
```

### Step 3: Start Data Capture

`start.py` is the script that triggers the data capturing loop, which saves the view hierarchy and screenshots at predefined intervals:

```python
capture_view_hierarchy_loop(device)
```

### Step 4: Retrieve View Hierarchy

Within the data capture loop, `get_views()` from `device.py` is called to fetch the current view hierarchy data:

```python
view_hierarchy = device.get_views()
```

## Conclusion

This documentation provides a comprehensive guide to capturing the view hierarchy using the Droidbot API. It outlines the necessary steps and modules involved in the process, ensuring a seamless and efficient experience for developers.
