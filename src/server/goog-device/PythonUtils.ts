import { ScreenshotProtocol } from '../../types/ScreenshotProtocol';
import { Multiplexer } from '../../packages/multiplexer/Multiplexer';
import { spawn } from 'child_process';

export class PythonUtils {
    public static async prepareServer(serial: string, stream: Multiplexer): Promise<void> {
        const pythonProcess = spawn('python', ['script.py']);

        pythonProcess.stdout.on('data', (data) => {
            stream.send(Buffer.concat([Buffer.from(ScreenshotProtocol.ASER, 'utf-8'), data]));
        });

        return new Promise((resolve, reject) => {
            pythonProcess.on('close', (code) => {
                if (code === 0) {
                    stream.send(Buffer.from(ScreenshotProtocol.FSER, 'utf-8'));
                    stream.close();
                    resolve();
                } else {
                    reject(new Error(`Python script exited with code ${code}`));
                }
            });
    
            pythonProcess.on('error', (error) => {
                reject(error);
            });
        });
    }

    public static async getHierarchy(serial: string, stream: Multiplexer): Promise<void> {
        const pythonProcess = spawn('python', ['script.py']);

        pythonProcess.stdout.on('data', (data) => {
            stream.send(Buffer.concat([Buffer.from(ScreenshotProtocol.AHIE, 'utf-8'), data]));
        });

        return new Promise((resolve, reject) => {
            pythonProcess.on('close', (code) => {
                if (code === 0) {
                    stream.send(Buffer.from(ScreenshotProtocol.FHIE, 'utf-8'));
                    stream.close();
                    resolve();
                } else {
                    reject(new Error(`Python script exited with code ${code}`));
                }
            });
    
            pythonProcess.on('error', (error) => {
                reject(error);
            });
        });
    }
}
