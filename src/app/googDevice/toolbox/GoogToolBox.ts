import { ToolBox } from '../../toolbox/ToolBox';
import KeyEvent from '../android/KeyEvent';
import SvgImage from '../../ui/SvgImage';
import { KeyCodeControlMessage } from '../../controlMessage/KeyCodeControlMessage';
import { ToolBoxButton } from '../../toolbox/ToolBoxButton';
import { ToolBoxElement } from '../../toolbox/ToolBoxElement';
import { ToolBoxCheckbox } from '../../toolbox/ToolBoxCheckbox';
import { StreamClientScrcpy } from '../client/StreamClientScrcpy';
import { BasePlayer } from '../../player/BasePlayer';
import { ScreenshotClient } from '../client/ScreenshotClient';
import { ParamsScreenshot } from '../../../types/ParamsScreenshot';
import { ACTION } from '../../../common/Action';

const BUTTONS = [
    {
        title: 'Power',
        code: KeyEvent.KEYCODE_POWER,
        icon: SvgImage.Icon.POWER,
    },
    {
        title: 'Volume up',
        code: KeyEvent.KEYCODE_VOLUME_UP,
        icon: SvgImage.Icon.VOLUME_UP,
    },
    {
        title: 'Volume down',
        code: KeyEvent.KEYCODE_VOLUME_DOWN,
        icon: SvgImage.Icon.VOLUME_DOWN,
    },
    {
        title: 'Back',
        code: KeyEvent.KEYCODE_BACK,
        icon: SvgImage.Icon.BACK,
    },
    {
        title: 'Home',
        code: KeyEvent.KEYCODE_HOME,
        icon: SvgImage.Icon.HOME,
    },
    {
        title: 'Overview',
        code: KeyEvent.KEYCODE_APP_SWITCH,
        icon: SvgImage.Icon.OVERVIEW,
    },
];

export class GoogToolBox extends ToolBox {
    protected constructor(list: ToolBoxElement<any>[]) {
        super(list);
    }

    public static createToolBox(
        udid: string,
        player: BasePlayer,
        client: StreamClientScrcpy,
        moreBox?: HTMLElement,
        screenshotDiv?: HTMLElement,
    ): GoogToolBox {
        const playerName = player.getName();
        const list = BUTTONS.slice();
        const handler = <K extends keyof HTMLElementEventMap, T extends HTMLElement>(
            type: K,
            element: ToolBoxElement<T>,
        ) => {
            if (!element.optional?.code) {
                return;
            }
            const { code } = element.optional;
            const action = type === 'mousedown' ? KeyEvent.ACTION_DOWN : KeyEvent.ACTION_UP;
            const event = new KeyCodeControlMessage(action, code, 0, 0);
            client.sendMessage(event);
        };
        const elements: ToolBoxElement<any>[] = list.map((item) => {
            const button = new ToolBoxButton(item.title, item.icon, {
                code: item.code,
            });
            button.addEventListener('mousedown', handler);
            button.addEventListener('mouseup', handler);
            return button;
        });

        const params: ParamsScreenshot = {action: ACTION.SCREENSHOT, udid: udid, screenshotDiv: screenshotDiv};
        const screenshotClient = ScreenshotClient.start(params);
        screenshotClient.ableToUse();

        if (player.supportsScreenshot) {
            const screenshotToSave = new ToolBoxButton('Take screenshot and save', SvgImage.Icon.CAMERA);
            screenshotToSave.addEventListener('click', () => {
                player.saveScreenshot(client.getDeviceName());
            });
            elements.push(screenshotToSave);
        }
        
        if (screenshotDiv) {
            // let currentImageURLs: string[] = []; // 存储当前图片的URL
            // let deleteButtons: HTMLButtonElement[] = []; // 存储删除按钮

            let screenshot = new ToolBoxButton('Take screenshot and show', SvgImage.Icon.SCREENSHOT);
            screenshot.addEventListener('click', () => {
                const screenInfo = player.getScreenInfo();
                if (screenInfo) {
                    screenshotDiv.style.width = (window.innerWidth - screenInfo.videoSize.width - screenshot.getElement().clientWidth - 20) + 'px';
                }
                screenshotClient.getScreenshot();

                // const [url, name] = player.createScreenshot(client.getDeviceName());

                // // 创建一个新的<a>元素并设置其href为截图的URL
                // const imageLink = document.createElement('a');
                // imageLink.href = url;
                // imageLink.download = name; // 下载属性设置为截图的名称

                // // 创建一个新的img元素用于显示截图
                // const image = document.createElement('img');
                // image.src = url;
                // image.alt = name;

                // // 将图片追加到 imageLink 中
                // imageLink.appendChild(image);

                // // 创建一个新的 button 元素用于删除当前图片
                // const deleteButton = document.createElement('button');
                // deleteButton.textContent = 'Delete Image';
                // deleteButton.addEventListener('click', () => {
                //     // 找到当前点击按钮所在的索引
                //     const index = deleteButtons.indexOf(deleteButton);
                //     if (index !== -1) {
                //         // 从数组中删除对应的图片 URL 和按钮
                //         currentImageURLs.splice(index, 1);
                //         deleteButtons.splice(index, 1);

                //         // 重新渲染 screenshotDiv
                //         renderScreenshots(screenshotDiv, currentImageURLs, deleteButtons);
                //     }
                // });

                // // 将图片链接追加到 screenshotDiv 中
                // screenshotDiv.appendChild(imageLink);

                // // 将删除按钮追加到 screenshotDiv 中，并将其存储到 deleteButtons 数组中
                // screenshotDiv.appendChild(deleteButton);
                // deleteButtons.push(deleteButton);

                // // 保存当前图片的 URL，以便稍后删除图片时使用
                // currentImageURLs.push(url);

                // // 重新渲染 screenshotDiv
                // renderScreenshots(screenshotDiv, currentImageURLs, deleteButtons);
            });
            elements.push(screenshot);
        }
        
        const keyboard = new ToolBoxCheckbox(
            'Capture keyboard',
            SvgImage.Icon.KEYBOARD,
            `capture_keyboard_${udid}_${playerName}`,
        );
        keyboard.addEventListener('click', (_, el) => {
            const element = el.getElement();
            client.setHandleKeyboardEvents(element.checked);
        });
        elements.push(keyboard);

        if (moreBox) {
            const displayId = player.getVideoSettings().displayId;
            const id = `show_more_${udid}_${playerName}_${displayId}`;
            const more = new ToolBoxCheckbox('More', SvgImage.Icon.MORE, id);
            more.addEventListener('click', (_, el) => {
                const element = el.getElement();
                moreBox.style.display = element.checked ? 'block' : 'none';
            });
            elements.unshift(more);
        }
        return new GoogToolBox(elements);
    }
}
