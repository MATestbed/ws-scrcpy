import time
import json
import os
import csv
from device import Device
from datetime import datetime
import subprocess

DEVICE_SERIAL = None
FREQUENCY = 0.5
LOCAL_VH_SAVE_PATH = "./captured_data/view_hierarchy" 
LOCAL_SCREENSHOT_SAVE_PATH = "./captured_data/screenshot"
CSV_FILE_PATH = "./captured_data/captured_states.csv"

def get_available_devices():
    """
    Get a list of device serials connected via adb
    :return: list of str, each str is a device serial number
    """
    r = subprocess.check_output(["adb", "devices"])
    if not isinstance(r, str):
        r = r.decode()
    devices = []
    for line in r.splitlines():
        segs = line.strip().split()
        if len(segs) == 2 and segs[1] == "device":
            devices.append(segs[0])
    return devices

def append_to_csv(data_row, file_path):
    with open(file_path, 'a', newline='') as file:
        writer = csv.writer(file)
        writer.writerow(data_row)

def capture_view_hierarchy_loop(device):
    interval = 1.0 / FREQUENCY
    data_capture_allowed = False

    if not os.path.exists(LOCAL_VH_SAVE_PATH):
        os.makedirs(LOCAL_VH_SAVE_PATH)
    if not os.path.exists(LOCAL_SCREENSHOT_SAVE_PATH):
        os.makedirs(LOCAL_SCREENSHOT_SAVE_PATH)
    if not os.path.exists(CSV_FILE_PATH):
        append_to_csv(["Timestamp", "Activity Name", "View Hierarchy File", "Screenshot File"], CSV_FILE_PATH)

    print("Monitoring started. Waiting for valid data...")

    while True:
        tag = datetime.now().strftime("%Y-%m-%d_%H:%M:%S.%f")[:-3]
        
        if not data_capture_allowed:
            view_hierarchy = device.get_views()
            if view_hierarchy is not None:
                input("Valid data detected. Press enter when you are ready to capture...")
                data_capture_allowed = True
                current_time = time.time()
                next_capture_time = current_time + interval
            else:
                time.sleep(interval)
                continue
        
        if data_capture_allowed:
            view_hierarchy = device.get_views()
            screenshot_path = device.take_screenshot(tag)
            top_activity_name = device.get_top_activity_name()
            vh_file_name = f"view_hierarchy_{tag}.json"
            vh_file_path = os.path.join(LOCAL_VH_SAVE_PATH, vh_file_name)
            ss_file_name = f"screenshot_{tag}.jpg"
            ss_file_path = os.path.join(LOCAL_SCREENSHOT_SAVE_PATH, ss_file_name)

            with open(vh_file_path, "w") as file:
                json.dump(view_hierarchy, file)
                
            os.rename(screenshot_path, ss_file_path)

            append_to_csv([tag, top_activity_name, vh_file_name, ss_file_name], CSV_FILE_PATH)
            # print(f"Screenshot saved to: {ss_file_path}")
            # print(f"View hierarchy saved to: {vh_file_path}")
            # print(f"Captured at {tag} with top activity: {top_activity_name}")
            # print(f"Data appended to CSV file: {CSV_FILE_PATH}")

            time_to_next_capture = next_capture_time - time.time()
            time.sleep(max(time_to_next_capture, 0))
            next_capture_time += interval

if __name__ == '__main__':
    if DEVICE_SERIAL is None:
        devices = get_available_devices()
        if len(devices) == 0:
            print("No device connected.")
            exit(1)
        DEVICE_SERIAL = devices[0]
        print("Using device: %s" % DEVICE_SERIAL)

    device = Device(device_serial=DEVICE_SERIAL)
    device.connect()
    print("Device connected successfully.")

    try:
        capture_view_hierarchy_loop(device)
    except KeyboardInterrupt:
        print("Monitoring stopped.")
        device.disconnect()

    finally:
        device.disconnect()
