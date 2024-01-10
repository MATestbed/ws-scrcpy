# Workflow
1. Clone this project with submodules:
```
git clone --recursive https://github.com/dxxhjk/ws-scrcpy.git
```
2. Install all Python dependencies
```
cd StateCapture
pip3 install -e droidbot/
pip3 install flask
```
3. Install all NPM dependencies
```
npm install
```
4. Start all service 
```
npm start
```

# view hierarchy server prepare
After starting scrcpy, click the button (hierarchy server) above the keyboard to turn on the view hierarchy service. It takes about 40 seconds to setup the initialization process. 

When you see 
```
[python stderr]  * Debugger is active!

[python stderr]  * Debugger PIN: 143-460-819
```
in the server console, it means that the service has been started. At this time, the picture obtained by clicking the screenshot button will include the view hierarchy attribute, which can be downloaded together when downloading.

Click the button again to close the view hierarchy server.
