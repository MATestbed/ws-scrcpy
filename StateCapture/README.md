# StateCapture

This repository contains the source code for the State-Capture project, which is based on the [droidbot](https://github.com/honeynet/droidbot) and designed to capture and record the UI state of Android devices connected via ADB. This tool is useful for developers and testers who need to track UI changes and activity information for their Android applications.

## Features

- Captures UI hierarchy as JSON.
- Takes screenshots of the current state.
- Records the top activity name.
- Saves captured data with timestamped filenames for synchronization.
- Generates a CSV log with timestamps, activity names, and file references.

## Getting Started

### Prerequisites

Before you can use this tool, ensure you have the following installed:

- Python 3.x
- ADB (Android Debug Bridge)
- An Android device connected to your machine via USB with USB debugging enabled.

### Installation

1. Clone the repository to your local machine:

   ```sh
   git clone https://github.com/gaolongxi/StateCapture.git
   ```

2. Navigate to the cloned repository:

   ```sh
   cd state-capture
   ```

3. Install the required dependencies:

   ```sh
   pip install -r requirements.txt
   ```

### Usage

1. Connect to your device by usb or adb.

2. Run the start.py script to begin capturing the UI state and screenshots:

   ```sh
   python start.py
   ```

3. It takes a few seconds to build the connection, so please wait until you see this sentence printed in the terminal:

   ```sh
   Valid data detected. Press enter when you are ready to capture...
   ```

   Please prepare your to-be-detected app and press the 'enter', the states will be saved to the directory then.

4. Stop the process (Ctrl + C) whenever you need.

## Output

```sh
captured_data/view_hierarchy: Contains JSON files of the captured UI hierarchy.
captured_data/screenshot: Contains screenshot images of the device state.
captured_data/captured_states.csv: A CSV file logging the timestamp, activity name, and file names of captured data.
```
