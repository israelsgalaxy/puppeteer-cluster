import { BrowserPool, PlaywrightPlugin } from '@crawlee/browser-pool';
import { chromium } from 'patchright';

import ConcurrencyImplementation, { ResourceData } from './ConcurrencyImplementation';

import { debugGenerator, timeoutExecute } from '../util';
const debug = debugGenerator('SingleBrowserImpl');

const BROWSER_TIMEOUT = 5000;

export default class PatchwrightBrowserPoolImplementation extends ConcurrencyImplementation {

    protected browser: BrowserPool | null = null;
    // @ts-ignore
    private static plugin = new PlaywrightPlugin(chromium, {
        useIncognitoPages: true,
        launchOptions: {
            headless: true,
            channel: "chrome"
        }
    });

    private repairing: boolean = false;
    private repairRequested: boolean = false;
    private openInstances: number = 0;
    private waitingForRepairResolvers: (() => void)[] = [];

    private async repair() {
        if (this.openInstances !== 0 || this.repairing) {
            // already repairing or there are still pages open? wait for start/finish
            await new Promise<void>(resolve => this.waitingForRepairResolvers.push(resolve));
            return;
        }

        this.repairing = true;
        debug('Starting repair of browser pool.');

        try {
            // will probably fail, but just in case the repair was not necessary
            await timeoutExecute(BROWSER_TIMEOUT, (<BrowserPool>this.browser).destroy());
        } catch (e) {
            debug('Unable to close browser pool.');
        }

        try {
            this.browser = new BrowserPool({
                browserPlugins: [PatchwrightBrowserPoolImplementation.plugin],
            });
        } catch (err) {
            throw new Error('Unable to restart browser pool.');
        }
        this.repairRequested = false;
        this.repairing = false;
        this.waitingForRepairResolvers.forEach(resolve => resolve());
        this.waitingForRepairResolvers = [];
    }

    public async init() {
        this.browser = new BrowserPool({
            browserPlugins: [PatchwrightBrowserPoolImplementation.plugin],
        });
    }

    public async close() {
        await (<BrowserPool>this.browser).destroy();
    }

    protected async createResources(): Promise<ResourceData> {
        const page = await (<BrowserPool>this.browser).newPage();
        return {
            page,
        };
    }

    protected async freeResources(resources: ResourceData): Promise<void> {
        await resources.page.close();
    }

    public async workerInstance() {
        let resources: ResourceData;
        let closed = false;

        return {
            jobInstance: async () => {
                if (this.repairRequested) {
                    await this.repair();
                }

                await timeoutExecute(BROWSER_TIMEOUT, (async () => {
                    resources = await this.createResources();
                    resources.page.once("close", page => closed = true);
                })());
                this.openInstances += 1;

                return {
                    resources,

                    close: async () => {
                        this.openInstances -= 1; // decrement first in case of error
                        if (!closed)
                            await timeoutExecute(BROWSER_TIMEOUT, this.freeResources(resources));

                        if (this.repairRequested) {
                            await this.repair();
                        }
                    },
                };
            },

            close: async () => {
                debug('Close requested for worker in browser pool.');
                if (!closed)
                    await resources.page.close();
            },

            repair: async () => {
                debug('Repair requested from worker in browser pool.');
                this.repairRequested = true;
                await this.repair();
            },
        };
    }
}
