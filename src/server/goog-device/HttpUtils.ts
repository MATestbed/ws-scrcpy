import { ScreenshotProtocol } from "../../types/ScreenshotProtocol";
import { Multiplexer } from "../../packages/multiplexer/Multiplexer";

export class HttpUtils {
    static get(url: string, stream: Multiplexer): Promise<void> {
        return new Promise((resolve, reject) => {
            const fetch = require("node-fetch");
            fetch(url)
                .then((response: any) => {
                    if (!response.ok) {
                        throw new Error(`HTTP error! Status: ${response.status}`);
                    }
                    return response.text();
                })
                .then((data: string) => {
                    stream.send(Buffer.concat([Buffer.from(ScreenshotProtocol.AHIE, 'utf-8'), Buffer.from(data, 'utf-8')]));
                    stream.send(Buffer.from(ScreenshotProtocol.FHIE, 'utf-8'));
                    stream.close();
                    resolve();
                })
                .catch((error: any) => {
                    reject(error);
                });
        });
    }
}