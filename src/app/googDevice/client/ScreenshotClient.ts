import '../../../style/filelisting.css';
import { ParamsScreenshot } from '../../../types/ParamsScreenshot';
import { ManagerClient } from '../../client/ManagerClient';
import { ACTION } from '../../../common/Action';
import Util from '../../Util';
import Protocol from '@dead50f7/adbkit/lib/adb/protocol';
import { ChannelCode } from '../../../common/ChannelCode';
import { Multiplexer } from '../../../packages/multiplexer/Multiplexer';

const TAG = '[Screenshot]';

type ScreenshotInfo = {
    receivedBytes: number;
    chunks: Uint8Array[];
    name: string;
};

export class ScreenshotClient extends ManagerClient<ParamsScreenshot, never> {
    public static readonly ACTION = ACTION.SCREENSHOT;

    public static start(params: ParamsScreenshot): ScreenshotClient {
        console.log(TAG, "started");
        return new ScreenshotClient(params);
    }

    private readonly serial: string;
    private readonly name: string;
    private infoMap: Map<Multiplexer, ScreenshotInfo> = new Map();
    private channels: Set<Multiplexer> = new Set();

    private screenshotDiv: HTMLElement = document.createElement('div'); ;
    private currentImageURLs: string[] = []; // 存储当前图片的URL
    private deleteButtons: HTMLButtonElement[] = []; // 存储删除按钮

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

    public ableToUse(): void {
        console.log(TAG, "ableToUse");
    }

    public getScreenshotToStream(): void {
        if (!this.ws || this.ws.readyState !== this.ws.OPEN || !(this.ws instanceof Multiplexer)) {
            return;
        }
        let name = `${this.serial} ${new Date().toLocaleString()}.png`;
        let cmd: string = Protocol.RECV;
        const payload = Buffer.alloc(cmd.length);
        payload.write(cmd, 0);
        const channel = this.ws.createChannel(payload);
        this.channels.add(channel);
        const info: ScreenshotInfo = {
            receivedBytes: 0,
            chunks: [],
            name: name,
        }
        this.infoMap.set(channel, info);
        const onMessage = (event: MessageEvent): void => {
            this.handleReply(channel, event);
        };
        const onClose = (): void => {
            this.channels.delete(channel);
            this.infoMap.delete(channel);
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
            case Protocol.DONE:
                this.finishScreenshot(channel);
                return;
            case Protocol.FAIL:
                const length = data.readUInt32LE(4);
                const message = Util.utf8ByteArrayToString(data.slice(8, 8 + length));
                console.error(TAG, `FAIL: ${message}`);
                return;
            case Protocol.DATA:
                const info = this.infoMap.get(channel);
                if (!info) {
                    return;
                }
                info.chunks.push(data.slice(4));
                info.receivedBytes += data.length - 4;
                return;
            default:
                console.error(`Unexpected "${reply}"`);
        }
    }

    protected finishScreenshot(channel: Multiplexer): void {
        const info = this.infoMap.get(channel);
        if (!info) {
            return;
        }
        this.infoMap.delete(channel);
        const blob = new Blob(info.chunks, { type: 'image/png' }); // 修改此处的 MIME 类型为实际图像类型
        const url = URL.createObjectURL(blob);
        console.log(TAG,url);
        // 创建一个图片元素并将 Blob URL 分配给其 src 属性
        const img = document.createElement('img');
        img.src = url;
        let name: string = info.name;// 创建一个新的<a>元素并设置其href为截图的URL
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
        deleteButton.addEventListener('click', () => {
            // 找到当前点击按钮所在的索引
            const index = this.deleteButtons.indexOf(deleteButton);
            if (index !== -1) {
                // 从数组中删除对应的图片 URL 和按钮
                this.currentImageURLs.splice(index, 1);
                this.deleteButtons.splice(index, 1);

                // 重新渲染 screenshotDiv
                this.renderScreenshots(this.screenshotDiv, this.currentImageURLs, this.deleteButtons);
            }
        });

        // 将图片链接追加到 screenshotDiv 中
        this.screenshotDiv.appendChild(imageLink);

        // 将删除按钮追加到 screenshotDiv 中，并将其存储到 deleteButtons 数组中
        this.screenshotDiv.appendChild(deleteButton);
        this.deleteButtons.push(deleteButton);

        // 保存当前图片的 URL，以便稍后删除图片时使用
        this.currentImageURLs.push(url);

        // 重新渲染 screenshotDiv
        this.renderScreenshots(this.screenshotDiv, this.currentImageURLs, this.deleteButtons);
    }

    // 函数：重新渲染 screenshotDiv 中的图片
    private renderScreenshots(
        screenshotDiv: HTMLElement,
        currentImageURLs: string[],
        deleteButtons: HTMLButtonElement[]) {
        screenshotDiv.innerHTML = '';
        screenshotDiv.style.display = 'flex';
        screenshotDiv.style.flexWrap = 'wrap';
        screenshotDiv.style.justifyContent = 'flex-start';
        screenshotDiv.style.gap = '5px'; // 设置图片之间的间隔
        screenshotDiv.style.overflowY = 'scroll';
        screenshotDiv.style.maxHeight = `${window.innerHeight}px`; // 设置一个最大高度，以便当内容超过此高度时显示滚动条

        // 将每个图片 URL 渲染为缩略图，并为每张图片创建一个删除按钮
        currentImageURLs.forEach((url, index) => {
            const thumbnailContainer = document.createElement('div');
            thumbnailContainer.classList.add('thumbnail-container');
            thumbnailContainer.style.display = 'inline-block';
            thumbnailContainer.style.width = 'calc(33.33% - 5px)'; // 设置容器宽度，减去间隔

            thumbnailContainer.style.marginBottom = '5px'; // 设置底部间距

            const thumbnailLink = document.createElement('a');
            thumbnailLink.href = url;
            thumbnailLink.download = `screenshot_${index + 1}`;
            thumbnailLink.style.display = 'block'; // 设置为块级元素以便设置高度

            const thumbnailImage = document.createElement('img');
            thumbnailImage.src = url;
            thumbnailImage.alt = `Screenshot ${index + 1}`;
            thumbnailImage.style.width = '100%'; // 设置图片宽度为100%
            thumbnailImage.style.height = 'auto'; // 设置图片高度自适应

            thumbnailLink.appendChild(thumbnailImage);

            const thumbnailDeleteButton = document.createElement('button');
            thumbnailDeleteButton.textContent = 'Delete';
            thumbnailDeleteButton.addEventListener('click', () => {
                currentImageURLs.splice(index, 1);
                deleteButtons.splice(index, 1);
                this.renderScreenshots(screenshotDiv, currentImageURLs, deleteButtons);
            });

            thumbnailContainer.appendChild(thumbnailLink);
            thumbnailContainer.appendChild(thumbnailDeleteButton);

            screenshotDiv.appendChild(thumbnailContainer);
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
}
