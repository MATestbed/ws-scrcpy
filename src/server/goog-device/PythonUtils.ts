// import { ScreenshotProtocol } from '../../types/ScreenshotProtocol';
// import { Multiplexer } from '../../packages/multiplexer/Multiplexer';
import { spawn, ChildProcess } from 'child_process';

export class PythonServer {
    private static pythonServer: ChildProcess | null = null;

    public static startServer(): void {
        if (!PythonServer.pythonServer) {
            PythonServer.pythonServer = spawn('python3', ['../StateCapture/start.py']);
            if (PythonServer.pythonServer ) {
                if (PythonServer.pythonServer.stdout) {
                    PythonServer.pythonServer.stdout.on('data', (data) => {
                        console.log('[python stdout]', data.toString());
                    });
                }
                if (PythonServer.pythonServer.stderr) {
                    PythonServer.pythonServer.stderr.on('data', (data) => {
                        console.log('[python stderr]', data.toString());
                    });
                }
            }
        }
    }

    public static closeServer(): void {
        if (PythonServer.pythonServer) {
            // 关闭 Python 服务器进程
            PythonServer.pythonServer.kill('SIGINT');
            PythonServer.pythonServer = null;
        }
    }
}
