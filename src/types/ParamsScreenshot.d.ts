import { ACTION } from '../common/Action';
import { ParamsBase } from './ParamsBase';

export interface ParamsScreenshot extends ParamsBase {
    action: ACTION.SCREENSHOT;
    udid: string;
    screenshotDiv?: HTMLElement;
}
