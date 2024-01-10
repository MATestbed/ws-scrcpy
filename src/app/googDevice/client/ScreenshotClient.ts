import '../../../style/filelisting.css';
import { ParamsScreenshot } from '../../../types/ParamsScreenshot';
import { ManagerClient } from '../../client/ManagerClient';
import { ACTION } from '../../../common/Action';
import Util from '../../Util';
import Protocol from '@dead50f7/adbkit/lib/adb/protocol';
import  {ScreenshotProtocol}  from '../../../types/ScreenshotProtocol';
import { ChannelCode } from '../../../common/ChannelCode';
import { Multiplexer } from '../../../packages/multiplexer/Multiplexer';

const TAG = '[Screenshot]';

type Request = {
    streamdBytes: number;
    chunks: Uint8Array[];
    name: string;
};

type ScreenshotInfo = {
    url?: string;
    deleteButton?: HTMLButtonElement;
    activityName?: string;
    xml?: string;
    hierarchy?: string;
}

export class ScreenshotClient extends ManagerClient<ParamsScreenshot, never> {
    public static readonly ACTION = ACTION.SCREENSHOT;

    public static start(params: ParamsScreenshot): ScreenshotClient {
        console.log(TAG, "started");
        return new ScreenshotClient(params);
    }

    private readonly serial: string;
    private readonly name: string;
    private reqMap: Map<Multiplexer, Request> = new Map();
    private channels: Set<Multiplexer> = new Set();

    private screenshotDiv: HTMLElement = document.createElement('div');
    private screenshotInfoMap: Map<string, ScreenshotInfo> = new Map(); // 存储当前图片名->图片的map

    private hierarchyServerAbleToUse: boolean = false;

    constructor(params: ParamsScreenshot) {
        super(params);
        this.serial = this.params.udid;
        this.openNewConnection();
        this.name = `${TAG} [${this.serial}]`;
        if (!params.screenshotDiv) {
            console.error(TAG, "no screenshot div");
            return;
        }
        this.screenshotDiv = params.screenshotDiv;
    }
    
    public onError(error: string | Error): void {
        console.error(this.name, 'FIXME: implement', error);
    }

    protected buildDirectWebSocketUrl(): URL {
        const localUrl = super.buildDirectWebSocketUrl();
        localUrl.searchParams.set('action', ACTION.MULTIPLEX);
        return localUrl;
    }

    protected onSocketClose(event: CloseEvent): void {
        console.error(this.name, 'socket closed', event.reason);
    }

    protected onSocketMessage(_e: MessageEvent): void {
        // We create separate channel for each request
        // Don't expect any messages on this level
    }

    protected onSocketOpen(): void {
        
    }

    public setHierarchyServerAbleToUse(ableToUse: boolean): void {
        if (!this.hierarchyServerAbleToUse && ableToUse) {
            this.createReqChannel(ScreenshotProtocol.RSER, '');
        } else if (this.hierarchyServerAbleToUse && !ableToUse) {
            this.createReqChannel(ScreenshotProtocol.RCSE, '');
        }
        this.hierarchyServerAbleToUse = ableToUse;
    }

    public getScreenshot(): void {
        let name = `${this.serial} ${new Date().toLocaleString()}.png`;
        this.createReqChannel(ScreenshotProtocol.RPIC, name);
        this.createReqChannel(ScreenshotProtocol.RACT, name);
        this.createReqChannel(ScreenshotProtocol.RXML, name);
        this.createReqChannel(ScreenshotProtocol.RHIE, name);
    }

    private createReqChannel(reqType: string, name: string): void {
        if (!this.ws || this.ws.readyState !== this.ws.OPEN || !(this.ws instanceof Multiplexer)) {
            return;
        }
        let cmd: string = reqType;
        const payload = Buffer.alloc(cmd.length);
        payload.write(cmd, 0);
        const channel = this.ws.createChannel(payload);
        this.channels.add(channel);
        const req: Request = {
            streamdBytes: 0,
            chunks: [],
            name: name,
        }
        this.reqMap.set(channel, req);
        const onMessage = (event: MessageEvent): void => {
            this.handleReply(channel, event);
        };
        const onClose = (): void => {
            this.channels.delete(channel);
            this.reqMap.delete(channel);
            channel.removeEventListener('message', onMessage);
            channel.removeEventListener('close', onClose);
        };
        channel.addEventListener('message', onMessage);
        channel.addEventListener('close', onClose);
    }

    protected handleReply(channel: Multiplexer, e: MessageEvent): void {
        const data = Buffer.from(e.data);
        const reply = data.slice(0, 4).toString('ascii');
        switch (reply) {
            case Protocol.FAIL:
                const length = data.readUInt32LE(4);
                const message = Util.utf8ByteArrayToString(data.slice(8, 8 + length));
                console.error(TAG, `FAIL: ${message}`);
                return;
            case ScreenshotProtocol.FPIC:
                this.finishScreenshotPic(channel);
                return;
            case ScreenshotProtocol.FACT:
                this.finishScreenshotAct(channel);
                return;
            case ScreenshotProtocol.FXML:
                this.finishScreenshotXML(channel);
                return;
            case ScreenshotProtocol.FHIE:
                this.finishScreenshotHierarchy(channel);
                return;
            case ScreenshotProtocol.APIC:
            case ScreenshotProtocol.AACT:
            case ScreenshotProtocol.AXML:
            case ScreenshotProtocol.AHIE:
                const req = this.reqMap.get(channel);
                if (!req) {
                    return;
                }
                req.chunks.push(data.slice(4));
                req.streamdBytes += data.length - 4;
                return;
            default:
                console.error(`Unexpected "${reply}"`);
        }
    }

    protected finishScreenshotPic(channel: Multiplexer): void {
        const req = this.reqMap.get(channel);
        if (!req) {
            return;
        }
        this.reqMap.delete(channel);
        const blob = new Blob(req.chunks, { type: 'image/png' }); // 修改此处的 MIME 类型为实际图像类型
        const url = URL.createObjectURL(blob);
        console.log(TAG,url);
        // 创建一个图片元素并将 Blob URL 分配给其 src 属性
        const img = document.createElement('img');
        img.src = url;
        let name: string = req.name; // 创建一个新的<a>元素并设置其href为截图的URL
        const imageLink = document.createElement('a');
        imageLink.href = url;
        imageLink.download = name; // 下载属性设置为截图的名称

        // 创建一个新的img元素用于显示截图
        const image = document.createElement('img');
        image.src = url;
        image.alt = name;

        // 将图片追加到 imageLink 中
        imageLink.appendChild(image);

        // 创建一个新的 button 元素用于删除当前图片
        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete Image';

        if (this.screenshotInfoMap.has(req.name)) {
            let info = this.screenshotInfoMap.get(req.name); // 使用get方法获取Map中的值
            if (info) {
                info.url = url;
                info.deleteButton = deleteButton;
                if (info.activityName && info.xml && info.url && info.hierarchy) {
                    this.renderScreenshots();
                }
                this.screenshotInfoMap.set(req.name, info);
            }
        } else {
            const info: ScreenshotInfo = {url: url, deleteButton: deleteButton};
            deleteButton.addEventListener('click', () => {
                const screenshotName = Array.from(this.screenshotInfoMap.entries()).find(([_, value]) => value === info)?.[0];
                if (screenshotName) {
                    this.screenshotInfoMap.delete(screenshotName);
                    this.renderScreenshots();
                }
            });
            this.screenshotInfoMap.set(req.name, info);
        }
    }

    protected finishScreenshotAct(channel: Multiplexer): void {
        const req = this.reqMap.get(channel);
        if (!req) {
            return;
        }
        const decoder = new TextDecoder('utf-8'); // 指定字符编码，这里使用 UTF-8
        const stringArray = req.chunks.map(uint8Array => decoder.decode(uint8Array));
        // 合并字符串数组为一个字符串
        const mergedString = stringArray.join('');
        console.log(TAG, mergedString);
        this.reqMap.delete(channel);
        if (this.screenshotInfoMap.has(req.name)) {
            let info = this.screenshotInfoMap.get(req.name); // 使用get方法获取Map中的值
            if (info) {
                info.activityName = mergedString;
                if (info.activityName && info.xml && info.url && info.hierarchy) {
                    this.renderScreenshots();
                }
                this.screenshotInfoMap.set(req.name, info);
            }
        } else {
            this.screenshotInfoMap.set(req.name, {
                activityName: mergedString
            });
        }
    }

    protected finishScreenshotXML(channel: Multiplexer): void {
        const req = this.reqMap.get(channel);
        if (!req) {
            return;
        }
        const decoder = new TextDecoder('utf-8'); // 指定字符编码，这里使用 UTF-8
        const stringArray = req.chunks.map(uint8Array => decoder.decode(uint8Array));
        // 合并字符串数组为一个字符串
        const mergedString = stringArray.join('');
        console.log(TAG, 'xml');
        this.reqMap.delete(channel);
        if (this.screenshotInfoMap.has(req.name)) {
            let info = this.screenshotInfoMap.get(req.name); // 使用get方法获取Map中的值
            if (info) {
                info.xml = mergedString;
                if (info.activityName && info.xml && info.url && info.hierarchy) {
                    this.renderScreenshots();
                }
                this.screenshotInfoMap.set(req.name, info);
            }
        } else {
            this.screenshotInfoMap.set(req.name, {
                xml: mergedString
            });
        }
    }

    protected finishScreenshotHierarchy(channel: Multiplexer): void {
        const req = this.reqMap.get(channel);
        if (!req) {
            return;
        }
        const decoder = new TextDecoder('utf-8'); // 指定字符编码，这里使用 UTF-8
        const stringArray = req.chunks.map(uint8Array => decoder.decode(uint8Array));
        // 合并字符串数组为一个字符串
        const mergedString = stringArray.join('');
        console.log(TAG, 'hierarchy');
        this.reqMap.delete(channel);
        if (this.screenshotInfoMap.has(req.name)) {
            let info = this.screenshotInfoMap.get(req.name); // 使用get方法获取Map中的值
            if (info) {
                info.hierarchy = mergedString;
                if (info.activityName && info.xml && info.url && info.hierarchy) {
                    this.renderScreenshots();
                }
                this.screenshotInfoMap.set(req.name, info);
            }
        } else {
            this.screenshotInfoMap.set(req.name, {
                hierarchy: mergedString
            });
        }
    }

    // 函数：重新渲染 screenshotDiv 中的图片
    private renderScreenshots() {
        this.screenshotDiv.innerHTML = '';
        const downloadButton = this.createDownloadButton();
        this.screenshotDiv.appendChild(downloadButton);
        const picDiv = document.createElement('div');
        this.screenshotDiv.appendChild(picDiv);

        picDiv.innerHTML = '';
        picDiv.style.display = 'flex';
        picDiv.style.flexWrap = 'wrap';
        picDiv.style.justifyContent = 'flex-start';
        picDiv.style.gap = '5px'; // 设置图片之间的间隔
        picDiv.style.overflowY = 'scroll';
        picDiv.style.maxHeight = `${this.screenshotDiv.clientHeight - downloadButton.clientHeight - 5}px`;; // 设置一个最大高度，以便当内容超过此高度时显示滚动条

        // 将每个图片 URL 渲染为缩略图，并为每张图片创建一个删除按钮
        this.screenshotInfoMap.forEach((info, name) => {
            const thumbnailContainer = document.createElement('div');
            thumbnailContainer.classList.add('thumbnail-container');
            thumbnailContainer.style.display = 'inline-block';
            thumbnailContainer.style.width = 'calc(33.33% - 5px)'; // 设置容器宽度，减去间隔

            thumbnailContainer.style.marginBottom = '5px'; // 设置底部间距

            if (info.url) {
                const thumbnailLink = document.createElement('a');
                thumbnailLink.href = info.url;
                // thumbnailLink.download = name;
                thumbnailLink.style.display = 'block'; // 设置为块级元素以便设置高度

                const thumbnailImage = document.createElement('img');
                thumbnailImage.src = info.url;
                thumbnailImage.alt = name;
                thumbnailImage.style.width = '100%'; // 设置图片宽度为100%
                thumbnailImage.style.height = 'auto'; // 设置图片高度自适应

                thumbnailLink.appendChild(thumbnailImage);

                const thumbnailDeleteButton = document.createElement('button');
                thumbnailDeleteButton.textContent = 'Delete';
                thumbnailDeleteButton.addEventListener('click', () => {
                    this.screenshotInfoMap.delete(name);
                    this.renderScreenshots();
                });

                const thumbnailDownloadButton = document.createElement('button');
                thumbnailDownloadButton.textContent = 'Download';
                thumbnailDownloadButton.addEventListener('click', () => {
                    const tmpInfo = this.screenshotInfoMap.get(name);
                    if (tmpInfo) {
                        this.download(name, tmpInfo);
                    }
                });

                thumbnailContainer.appendChild(thumbnailLink);
                thumbnailContainer.appendChild(thumbnailDeleteButton);
                thumbnailContainer.appendChild(thumbnailDownloadButton);
            }

            picDiv.appendChild(thumbnailContainer);
        });
    }

    protected supportMultiplexing(): boolean {
        return true;
    }

    protected getChannelInitData(): Buffer {
        const serial = Util.stringToUtf8ByteArray(this.serial);
        const buffer = Buffer.alloc(4 + 4 + serial.byteLength);
        buffer.write(ChannelCode.SCST, 'ascii');
        buffer.writeUInt32LE(serial.length, 4);
        buffer.set(serial, 8);
        return buffer;
    }

    private createDownloadButton(): HTMLButtonElement {
        // 创建下载按钮元素
        const downloadButton = document.createElement('button');
        downloadButton.innerText = '下载';
        downloadButton.id = 'downloadButton'; // 为按钮添加一个ID，方便后续引用
        // 将按钮放置在顶部中央位置
        downloadButton.style.position = 'relative';
        downloadButton.style.display = 'block';
        downloadButton.style.margin = '0 auto';
        downloadButton.addEventListener('click', () => {
            // 遍历 screenshotInfoMap
            this.screenshotInfoMap.forEach((info, key) => {
                this.download(key, info);
            });
        });
        return downloadButton;
    }
    private download(name: string, info: ScreenshotInfo): void {
        // 创建并下载图片文件
        if (info.url) {
            const imageLink = document.createElement('a');
            imageLink.href = info.url;
            imageLink.download = `${name}_image.png`;
            imageLink.click();
        }

        // 创建并下载 activityName 的文本文件
        if (info.activityName) {
            const activityNameFile = new Blob([info.activityName], { type: 'text/plain' });
            const activityNameUrl = URL.createObjectURL(activityNameFile);
            const activityNameLink = document.createElement('a');
            activityNameLink.href = activityNameUrl;
            activityNameLink.download = `${name}_activityName.txt`;
            activityNameLink.click();
        }

        // 创建并下载 xml 的文本文件
        if (info.xml) {
            const xmlFile = new Blob([info.xml], { type: 'text/plain' });
            const xmlUrl = URL.createObjectURL(xmlFile);
            const xmlLink = document.createElement('a');
            xmlLink.href = xmlUrl;
            xmlLink.download = `${name}_xml.txt`;
            xmlLink.click();
        }

        // 创建并下载 hierarchy 的文本文件
        if (info.hierarchy) {
            const hierarchyFile = new Blob([info.hierarchy], { type: 'text/plain' });
            const hierarchyUrl = URL.createObjectURL(hierarchyFile);
            const hierarchyLink = document.createElement('a');
            hierarchyLink.href = hierarchyUrl;
            hierarchyLink.download = `${name}_hierarchy.txt`;
            hierarchyLink.click();
        }
    }
}
