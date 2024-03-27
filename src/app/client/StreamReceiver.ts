import { ManagerClient } from './ManagerClient';
import { ControlMessage } from '../controlMessage/ControlMessage';
import DeviceMessage from '../googDevice/DeviceMessage';
import VideoSettings from '../VideoSettings';
import ScreenInfo from '../ScreenInfo';
import Util from '../Util';
import { DisplayInfo } from '../DisplayInfo';
import { ParamsStream } from '../../types/ParamsStream';

import { KeyCodeControlMessage } from '../controlMessage/KeyCodeControlMessage';
import { TouchControlMessage } from '../controlMessage/TouchControlMessage';
import Position from '../Position';
import Point from '../Point';
import Size from '../Size';
import KeyEvent from '../googDevice/android/KeyEvent';
import { KeyEventToChar, KeyEventToCharUnderShift } from '../googDevice/KeyEventToChar';

const DEVICE_NAME_FIELD_LENGTH = 64;
const MAGIC_BYTES_INITIAL = Util.stringToUtf8ByteArray('scrcpy_initial');

export type ClientsStats = {
    deviceName: string;
    clientId: number;
};

export type DisplayCombinedInfo = {
    displayInfo: DisplayInfo;
    videoSettings?: VideoSettings;
    screenInfo?: ScreenInfo;
    connectionCount: number;
};

type EventStruct = {
    text: string;
    deleteButton: HTMLButtonElement;
}

interface StreamReceiverEvents {
    video: ArrayBuffer;
    deviceMessage: DeviceMessage;
    displayInfo: DisplayCombinedInfo[];
    clientsStats: ClientsStats;
    encoders: string[];
    connected: void;
    disconnected: CloseEvent;
}

// const TAG = '[StreamReceiver]';

export class StreamReceiver<P extends ParamsStream> extends ManagerClient<ParamsStream, StreamReceiverEvents> {
    private events: ControlMessage[] = [];
    private encodersSet: Set<string> = new Set<string>();
    private clientId = -1;
    private deviceName = '';
    private readonly displayInfoMap: Map<number, DisplayInfo> = new Map();
    private readonly connectionCountMap: Map<number, number> = new Map();
    private readonly screenInfoMap: Map<number, ScreenInfo> = new Map();
    private readonly videoSettingsMap: Map<number, VideoSettings> = new Map();
    private hasInitialInfo = false;
    private eventDiv: HTMLElement = document.createElement('div');
    private eventStructs: EventStruct[] = [];

    constructor(params: P) {
        super(params);
        this.openNewConnection();
        if (this.ws) {
            this.ws.binaryType = 'arraybuffer';
        }
    }

    private handleInitialInfo(data: ArrayBuffer): void {
        let offset = MAGIC_BYTES_INITIAL.length;
        let nameBytes = new Uint8Array(data, offset, DEVICE_NAME_FIELD_LENGTH);
        offset += DEVICE_NAME_FIELD_LENGTH;
        let rest: Buffer = Buffer.from(new Uint8Array(data, offset));
        const displaysCount = rest.readInt32BE(0);
        this.displayInfoMap.clear();
        this.connectionCountMap.clear();
        this.screenInfoMap.clear();
        this.videoSettingsMap.clear();
        rest = rest.slice(4);
        for (let i = 0; i < displaysCount; i++) {
            const displayInfoBuffer = rest.slice(0, DisplayInfo.BUFFER_LENGTH);
            const displayInfo = DisplayInfo.fromBuffer(displayInfoBuffer);
            const { displayId } = displayInfo;
            this.displayInfoMap.set(displayId, displayInfo);
            rest = rest.slice(DisplayInfo.BUFFER_LENGTH);
            this.connectionCountMap.set(displayId, rest.readInt32BE(0));
            rest = rest.slice(4);
            const screenInfoBytesCount = rest.readInt32BE(0);
            rest = rest.slice(4);
            if (screenInfoBytesCount) {
                this.screenInfoMap.set(displayId, ScreenInfo.fromBuffer(rest.slice(0, screenInfoBytesCount)));
                rest = rest.slice(screenInfoBytesCount);
            }
            const videoSettingsBytesCount = rest.readInt32BE(0);
            rest = rest.slice(4);
            if (videoSettingsBytesCount) {
                this.videoSettingsMap.set(displayId, VideoSettings.fromBuffer(rest.slice(0, videoSettingsBytesCount)));
                rest = rest.slice(videoSettingsBytesCount);
            }
        }
        this.encodersSet.clear();
        const encodersCount = rest.readInt32BE(0);
        rest = rest.slice(4);
        for (let i = 0; i < encodersCount; i++) {
            const nameLength = rest.readInt32BE(0);
            rest = rest.slice(4);
            const nameBytes = rest.slice(0, nameLength);
            rest = rest.slice(nameLength);
            const name = Util.utf8ByteArrayToString(nameBytes);
            this.encodersSet.add(name);
        }
        this.clientId = rest.readInt32BE(0);
        nameBytes = Util.filterTrailingZeroes(nameBytes);
        this.deviceName = Util.utf8ByteArrayToString(nameBytes);
        this.hasInitialInfo = true;
        this.triggerInitialInfoEvents();
    }

    private static EqualArrays(a: ArrayLike<number>, b: ArrayLike<number>): boolean {
        if (a.length !== b.length) {
            return false;
        }
        for (let i = 0, l = a.length; i < l; i++) {
            if (a[i] !== b[i]) {
                return false;
            }
        }
        return true;
    }

    protected buildDirectWebSocketUrl(): URL {
        const localUrl = super.buildDirectWebSocketUrl();
        if (this.supportMultiplexing()) {
            return localUrl;
        }
        localUrl.searchParams.set('udid', this.params.udid);
        return localUrl;
    }

    protected onSocketClose(ev: CloseEvent): void {
        this.emit('disconnected', ev);
    }

    protected onSocketMessage(event: MessageEvent): void {
        if (event.data instanceof ArrayBuffer) {
            // works only because MAGIC_BYTES_INITIAL and MAGIC_BYTES_MESSAGE have same length
            if (event.data.byteLength > MAGIC_BYTES_INITIAL.length) {
                const magicBytes = new Uint8Array(event.data, 0, MAGIC_BYTES_INITIAL.length);
                if (StreamReceiver.EqualArrays(magicBytes, MAGIC_BYTES_INITIAL)) {
                    this.handleInitialInfo(event.data);
                    return;
                }
                if (StreamReceiver.EqualArrays(magicBytes, DeviceMessage.MAGIC_BYTES_MESSAGE)) {
                    const message = DeviceMessage.fromBuffer(event.data);
                    this.emit('deviceMessage', message);
                    return;
                }
            }
            this.emit('video', new Uint8Array(event.data));
        }
    }

    protected onSocketOpen(): void {
        this.emit('connected', void 0);
        let e = this.events.shift();
        while (e) {
            this.sendEvent(e);
            e = this.events.shift();
        }
    }

    public sendEvent(event: ControlMessage): void {
        if (this.ws && this.ws.readyState === this.ws.OPEN) {
            // action0: down
            // action1: move
            // action2: up
            // 如何确定一个操作
            console.log(event.toString());
            this.appendEvent(event);
            this.ws.send(event.toBuffer());
        } else {
            this.events.push(event);
        }
    }

    public setEventDiv(eventDiv: HTMLElement) {
        this.eventDiv = eventDiv;
    }

    private underShift = false;
    private tmpInputString: string[] = [];
    private tmpCursorPos = 0;
    private touchMoveNum = 0;
    private lastTouchDown = new TouchControlMessage(0, 0, new Position(new Point(0, 0), new Size(0, 0)), 0, 0);
    private appendEvent(event: ControlMessage): void {
        const [ableToShow, text] = this.getTextByEvent(event);
        if (!ableToShow) return;
        this.appendRecordWithDelButton(text);
    }

    private appendRecordWithDelButton(text: string) {
        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete';
        const struct: EventStruct = { text: text, deleteButton: deleteButton }
        deleteButton.addEventListener('click', () => {
            const index = this.eventStructs.indexOf(struct);
            if (index !== -1) {
                this.eventStructs.splice(index, 1);
                this.renderEvents();
            }
        });
        this.eventStructs.push(struct);
        this.renderEvents();
    }

    private getTextByEvent(event: ControlMessage): [boolean, string] {
        let text = '';
        if (event instanceof KeyCodeControlMessage) {
            text = this.getTextByKeyCodeMsg(event);
        } else if (event instanceof TouchControlMessage) {
            text = this.getTextByTouchMsg(event);
        }
        return [text !== '', text];
    }

    private getTextByKeyCodeMsg(event: KeyCodeControlMessage): string {
        let text = '';
        if (event.action == 1) {
            switch (event.keycode) {
                case KeyEvent.KEYCODE_BACK:
                    text = '[Back]';
                    break;
                case KeyEvent.KEYCODE_HOME:
                    text = '[Home]';
                    break;
                case KeyEvent.KEYCODE_APP_SWITCH:
                    text = '[App Switch]';
                    break;
                case KeyEvent.KEYCODE_SHIFT_LEFT:
                case KeyEvent.KEYCODE_SHIFT_RIGHT:
                    this.underShift = false;
                    break;
                case KeyEvent.KEYCODE_DPAD_UP:
                    this.tmpCursorPos = 0;
                    break;
                case KeyEvent.KEYCODE_DPAD_DOWN:
                    this.tmpCursorPos = this.tmpInputString.length;
                    break;
                case KeyEvent.KEYCODE_DPAD_LEFT:
                    if (this.tmpCursorPos > 0) {
                        this.tmpCursorPos--;
                    }
                    break;
                case KeyEvent.KEYCODE_DPAD_RIGHT:
                    if (this.tmpCursorPos < this.tmpInputString.length) {
                        this.tmpCursorPos++;
                    }
                    break;
                case KeyEvent.KEYCODE_DEL:
                    if (this.tmpCursorPos > 0) {
                        this.tmpInputString.splice(this.tmpCursorPos - 1, 1);
                        this.tmpCursorPos--;
                    }
                    break;
                default:
                    let newInput = '';
                    if (!this.underShift) {
                        const tryGet = KeyEventToChar.get(event.keycode);
                        if (tryGet) newInput = tryGet;
                    } else {
                        const tryGet = KeyEventToCharUnderShift.get(event.keycode);
                        if (tryGet) newInput = tryGet;
                    }
                    if (newInput != '') {
                        this.tmpInputString.splice(this.tmpCursorPos, 0, newInput);
                        this.tmpCursorPos++;
                    }
            }
        } else if (event.keycode == KeyEvent.KEYCODE_SHIFT_LEFT || event.keycode == KeyEvent.KEYCODE_SHIFT_RIGHT) {
            this.underShift = true;
        }
        return text;
    }
    private touchStartTime: number = 0;
    private getTextByTouchMsg(event: TouchControlMessage): string {
        this.tmpCursorPos = 0;
        this.tmpInputString = [];
        let text = '';
        if (event.action == 0) {
            this.lastTouchDown = event;
            this.touchStartTime = performance.now();
        } else if (event.action == 1) {
            // console.log(this.touchMoveNum);
            const touchEndTime = performance.now();
            const touchDuration = (touchEndTime - this.touchStartTime) / 1000;
            this.touchStartTime = 0;
            if (this.touchMoveNum < 3) {
                if (touchDuration < 0.5) {
                    text = `[Click] Screen Resolution (${event.position.screenSize.width}, ${event.position.screenSize.height}), Click Position (${event.position.point.x}, ${event.position.point.y})`;
                } else {
                    text = `[Long Click] Screen Resolution (${event.position.screenSize.width}, ${event.position.screenSize.height}), Long Click Position (${event.position.point.x}, ${event.position.point.y})`;
                }
            } else {
                console.log(touchDuration);
                if (touchDuration < 0.5) {
                    text = `[Swipe] Screen Resolution (${event.position.screenSize.width}, ${event.position.screenSize.height}), Start Position (${this.lastTouchDown.position.point.x}, ${this.lastTouchDown.position.point.y}), End Position (${event.position.point.x}, ${event.position.point.y})`;
                } else {
                    text = `[Drag] Screen Resolution (${event.position.screenSize.width}, ${event.position.screenSize.height}), Start Position (${this.lastTouchDown.position.point.x}, ${this.lastTouchDown.position.point.y}), End Position (${event.position.point.x}, ${event.position.point.y})`;
                }
                // text = `[Swipe] Screen Resolution (${event.position.screenSize.width}, ${event.position.screenSize.height}), Start Position (${this.lastTouchDown.position.point.x}, ${this.lastTouchDown.position.point.y}), End Position (${event.position.point.x}, ${event.position.point.y})`;
            }
            // todo: add long click event and double click event
            this.touchMoveNum = 0;
        } else if (event.action == 2) {
            this.touchMoveNum++;
        }
        return text;
    }

    private renderEvents(): void {
        this.eventDiv.innerHTML = '';
        const buttonsContainer = document.createElement('div');
        buttonsContainer.style.display = 'flex';
        buttonsContainer.style.flexDirection = 'row';
        const downloadButton = this.createDownloadButton();
        const textButton = this.createTextButton();
        buttonsContainer.appendChild(downloadButton);
        buttonsContainer.appendChild(textButton);
        this.eventDiv.appendChild(buttonsContainer);

        this.eventStructs.forEach((struct) => {
            const eventRow = document.createElement('div');
            eventRow.style.display = 'flex';
            eventRow.style.alignItems = 'center';

            const deleteButtonContainer = document.createElement('div');
            deleteButtonContainer.appendChild(struct.deleteButton);
            eventRow.appendChild(deleteButtonContainer);

            const textContainer = document.createElement('div');
            textContainer.textContent = struct.text;
            eventRow.appendChild(textContainer);

            this.eventDiv.appendChild(eventRow);
        });
    }

    public stop(): void {
        if (this.ws && this.ws.readyState === this.ws.OPEN) {
            this.ws.close();
        }
        this.events.length = 0;
    }

    public getEncoders(): string[] {
        return Array.from(this.encodersSet.values());
    }

    public getDeviceName(): string {
        return this.deviceName;
    }

    public triggerInitialInfoEvents(): void {
        if (this.hasInitialInfo) {
            const encoders = this.getEncoders();
            this.emit('encoders', encoders);
            const { clientId, deviceName } = this;
            this.emit('clientsStats', { clientId, deviceName });
            const infoArray: DisplayCombinedInfo[] = [];
            this.displayInfoMap.forEach((displayInfo: DisplayInfo, displayId: number) => {
                const connectionCount = this.connectionCountMap.get(displayId) || 0;
                infoArray.push({
                    displayInfo,
                    videoSettings: this.videoSettingsMap.get(displayId),
                    screenInfo: this.screenInfoMap.get(displayId),
                    connectionCount,
                });
            });
            this.emit('displayInfo', infoArray);
        }
    }

    public getDisplayInfo(displayId: number): DisplayInfo | undefined {
        return this.displayInfoMap.get(displayId);
    }

    private createDownloadButton(): HTMLButtonElement {
        const downloadButton = document.createElement('button');
        downloadButton.innerText = 'Download';
        downloadButton.id = 'downloadButton';

        downloadButton.style.position = 'relative';
        downloadButton.style.display = 'block';
        downloadButton.style.margin = '0 auto';

        downloadButton.addEventListener('click', () => {
            const content = this.eventStructs.map((struct) => struct.text).join('\n');
            const blob = new Blob([content], { type: 'text/plain' });

            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'eventStructs.txt';
            link.click();
            URL.revokeObjectURL(url);
        });
        return downloadButton;
    }

    private createTextButton(): HTMLButtonElement {
        const textButton = document.createElement('button');
        textButton.innerText = 'Record Keyboard Input';
        textButton.id = 'textButton';
        textButton.style.position = 'relative';
        textButton.style.display = 'block';
        textButton.style.margin = '0 auto';
        textButton.addEventListener('click', () => {
            this.appendRecordWithDelButton('[Input] ' + this.tmpInputString.join(''));
        });

        return textButton;
    }
}
