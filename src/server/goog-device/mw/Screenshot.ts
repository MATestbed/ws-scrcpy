import { Mw } from '../../mw/Mw';
import { AdbUtils } from '../AdbUtils';
import Util from '../../../app/Util';
import Protocol from '@dead50f7/adbkit/lib/adb/protocol';
import { Multiplexer } from '../../../packages/multiplexer/Multiplexer';
import { ChannelCode } from '../../../common/ChannelCode';

export class Screenshot extends Mw {
    public static readonly TAG = 'Screenshot';
    protected name = 'Screenshot';

    public static processChannel(ws: Multiplexer, code: string, data: ArrayBuffer): Mw | undefined {
        if (code !== ChannelCode.SCST) {
            return;
        }
        const buffer = Buffer.from(data);
        const length = buffer.readInt32LE(0);
        const serial = Util.utf8ByteArrayToString(buffer.slice(4, 4 + length));
        console.log(this.TAG, length + " " + serial);
        return new Screenshot(ws, serial);
    }

    constructor(ws: Multiplexer, private readonly serial: string) {
        super(ws);
        ws.on('channel', (params) => {
            Screenshot.handleNewChannel(this.serial, params.channel, params.data);
        });
    }

    protected sendMessage = (): void => {
        throw Error('Do not use this method. You must send data over channels');
    };

    protected onSocketMessage(): void {
        // Nothing here. All communication are performed over the channels. See `handleNewChannel` below.
    }

    private static handleNewChannel(serial: string, channel: Multiplexer, arrayBuffer: ArrayBuffer): void {
        const data = Buffer.from(arrayBuffer);
        console.log(this.TAG, data.toString());
        let offset = 0;
        const cmd = Util.utf8ByteArrayToString(data.slice(offset, 4));
        offset += 4;
        switch (cmd) {
            case Protocol.RECV:
                Screenshot.handle(cmd, serial, channel).catch((error: Error) => {
                    console.error(`[${Screenshot.TAG}]`, error.message);
                });
                break;
            default:
                console.error(`[${Screenshot.TAG}]`, `Invalid message. Wrong command (${cmd})`);
                channel.close(4001, `Invalid message. Wrong command (${cmd})`);
                break;
        }
    }

    private static async handle(cmd: string, serial: string, channel: Multiplexer): Promise<void> {
        try {
            if (cmd === Protocol.RECV) {
                return AdbUtils.ScreencapToStream(serial, channel);
            }
        } catch (error: any) {
            Screenshot.sendError(error?.message, channel);
        }
    }

    private static sendError(message: string, channel: Multiplexer): void {
        if (channel.readyState === channel.OPEN) {
            const length = Buffer.byteLength(message, 'utf-8');
            const buf = Buffer.alloc(4 + 4 + length);
            let offset = buf.write(Protocol.FAIL, 'ascii');
            offset = buf.writeUInt32LE(length, offset);
            buf.write(message, offset, 'utf-8');
            channel.send(buf);
            channel.close();
        }
    }
}
