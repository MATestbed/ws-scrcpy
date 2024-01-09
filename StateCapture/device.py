import logging
import subprocess
import re
import os
from adb import ADB
from droidbot_app import DroidBotAppConn
from minicap import Minicap

class Device(object):

    def __init__(self, device_serial):
        """
        Initialize a device connection with the bare minimum requirements.
        """
        self.logger = logging.getLogger(self.__class__.__name__)
        self.serial = device_serial
        self.adb = ADB(device=self)
        self.display_info = None

        self.droidbot_app = DroidBotAppConn(device=self)
        self.minicap = Minicap(device=self)

        self.sdk_version = None
        self.release_version = None

    def connect(self):
        """
        Connect to the device. Set up the DroidBot app and Minicap.
        """
        self.adb.connect()
        print("ADB connected successfully.")
        self.droidbot_app.set_up()
        print("DroidBotAppConn set up successfully.")
        self.droidbot_app.connect()
        print("DroidBotAppConn connected successfully.")
        self.minicap.set_up()
        print("Minicap set up successfully.")
        self.minicap.connect()
        print("Minicap connected successfully.")


    def disconnect(self):
        """
        Disconnect from the device.
        """
        self.droidbot_app.disconnect()
        self.minicap.disconnect()
        self.adb.disconnect()

    # def take_screenshot(self,tag=None):
    #     """
    #     Takes a screenshot of the device and saves it to the device's storage.
    #     Returns the path to the screenshot file on the device.
    #     """
    #     filename = f"screenshot_{tag}.png"
    #     remote_path = f"/sdcard/{filename}"

    #     # Use adb to take the screenshot and save it to the device
    #     self.adb.shell(f"screencap -p {remote_path}")

    #     # Return the path where the screenshot is saved on the device
    #     return remote_path
    
    def take_screenshot(self, tag=None):
        if not self.minicap.connected:
            print("Minicap is not connected.")
            return None

        image_data = self.minicap.last_screen
        if image_data is None:
            self.logger.error("No screenshot data available.")
            return None
        
        local_dir_path = os.path.join(os.getcwd(), 'captured_data/screenshot')
        os.makedirs(local_dir_path, exist_ok=True)
        filename = f"screenshot_{tag}.jpg"
        local_image_path = os.path.join(local_dir_path, filename)

        # Save the screenshot data to a file.
        with open(local_image_path, "wb") as image_file:
            image_file.write(image_data)
        
        return local_image_path

    
    # def dump_ui_xml(self):
    #     """
    #     Dump the UI hierarchy into an XML file and return the local file path.
    #     """
    #     return self.adb.dump_ui_xml()

    # def get_current_state(self):
    #     """
    #     Capture and return the current state of the device, including UI hierarchy and screenshots.
    #     """
    #     self.logger.debug("Getting current device state...")
    #     screenshot_path = self.take_screenshot()
    #     ui_xml_path = self.dump_ui_xml()
    #     return {
    #         'screenshot_path': screenshot_path,
    #         'ui_xml_path': ui_xml_path
    #     }

    def get_views(self):
        """
        Retrieve the current views from the DroidBot app.
        """
        if not hasattr(self, 'droidbot_app'):
            self.logger.error("DroidBotAppConn is not set up properly.")
            return None

        try:
            views = self.droidbot_app.get_views()
            if views:
                # print(views)
                return views
            else:
                self.logger.warning("Failed to get views from DroidBotAppConn.")
                return None
        except AttributeError as e:
            self.logger.error(f"An error occurred: {str(e)}")
            return None
        
    def get_service_names(self):
        """
        get current running services
        :return: list of services
        """
        services = []
        dat = self.adb.shell('dumpsys activity services')
        lines = dat.splitlines()
        service_re = re.compile('^.+ServiceRecord{.+ ([A-Za-z0-9_.]+)/([A-Za-z0-9_.]+)')

        for line in lines:
            m = service_re.search(line)
            if m:
                package = m.group(1)
                service = m.group(2)
                services.append("%s/%s" % (package, service))
        return services
    
    def push_file(self, local_file, remote_dir="/sdcard/"):
        """
        push file/directory to target_dir
        :param local_file: path to file/directory in host machine
        :param remote_dir: path to target directory in device
        :return:
        """
        if not os.path.exists(local_file):
            self.logger.warning("push_file file does not exist: %s" % local_file)
        self.adb.run_cmd(["push", local_file, remote_dir])

    def pull_file(self, remote_file, local_file):
        self.adb.run_cmd(["pull", remote_file, local_file])

    def get_sdk_version(self):
        """
        Get version of current SDK
        """
        if self.sdk_version is None:
            self.sdk_version = self.adb.get_sdk_version()
        return self.sdk_version

    def get_release_version(self):
        """
        Get version of current SDK
        """
        if self.release_version is None:
            self.release_version = self.adb.get_release_version()
        return self.release_version

    def get_display_info(self, refresh=True):
        """
        get device display information, including width, height, and density
        :param refresh: if set to True, refresh the display info instead of using the old values
        :return: dict, display_info
        """
        if self.display_info is None or refresh:
            self.display_info = self.adb.get_display_info()
        return self.display_info

    def get_width(self, refresh=False):
        display_info = self.get_display_info(refresh=refresh)
        width = 0
        if "width" in display_info:
            width = display_info["width"]
        elif not refresh:
            width = self.get_width(refresh=True)
        else:
            self.logger.warning("get_width: width not in display_info")
        return width

    def get_height(self, refresh=False):
        display_info = self.get_display_info(refresh=refresh)
        height = 0
        if "height" in display_info:
            height = display_info["height"]
        elif not refresh:
            height = self.get_width(refresh=True)
        else:
            self.logger.warning("get_height: height not in display_info")
        return height

    def get_top_activity_name(self):
        """
        Get current activity
        """
        r = self.adb.shell("dumpsys activity activities")
        activity_line_re = re.compile(r'\*\s*Hist\s*#\d+:\s*ActivityRecord\{[^ ]+\s*[^ ]+\s*([^ ]+)\s*t(\d+)}')
        m = activity_line_re.search(r)
        if m:
            return m.group(1)
        self.logger.warning("Unable to get top activity name.")
        return None