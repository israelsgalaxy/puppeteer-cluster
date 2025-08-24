import { chromium, Browser, LaunchOptions } from 'patchright';
import UserAgent = require('user-agents');
import UserAgentParser = require("useragent");

import ConcurrencyImplementation, { ResourceData, CustomBroswerContextOptions, Proxy } from './ConcurrencyImplementation';

import { debugGenerator, timeoutExecute } from '../util';
const debug = debugGenerator('SingleBrowserImpl');

const BROWSER_TIMEOUT = 5000;

export default class PatchwrightBrowserPoolImplementation extends ConcurrencyImplementation {

    protected browser: Browser | null = null;

    private repairing: boolean = false;
    private repairRequested: boolean = false;
    private openInstances: number = 0;
    private waitingForRepairResolvers: (() => void)[] = [];
    private userAgentGenerator = new UserAgent([{deviceCategory: "desktop", platform: "Linux"}, (data) => {
        const parsedUa = UserAgentParser.parse(data.userAgent);
        return parsedUa.family === "Chromium" && Number.parseInt(parsedUa.major) >= 124;
    }]);

    constructor(launchOptions: LaunchOptions, contextOptions?: CustomBroswerContextOptions) {
        super(launchOptions, contextOptions);
    }

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
            await timeoutExecute(BROWSER_TIMEOUT, (<Browser>this.browser).close());
        } catch (e) {
            debug('Unable to close browser pool.');
        }

        try {
            this.browser = await chromium.launch(this.launchOptions);
        } catch (err) {
            throw new Error('Unable to restart browser pool.');
        }
        this.repairRequested = false;
        this.repairing = false;
        this.waitingForRepairResolvers.forEach(resolve => resolve());
        this.waitingForRepairResolvers = [];
    }

    public async init() {
        this.browser = await chromium.launch(this.launchOptions);
    }

    public async close() {
        await (<Browser>this.browser).close();
    }

    protected async createResources(): Promise<ResourceData> {
        let page = undefined;
        let proxy = undefined;
        const userAgent = this.userAgentGenerator.random();
        const options: {
            screen: { width: number; height: number };
            userAgent: string;
            viewport: { width: number; height: number };
            proxy?: Proxy;
            proxyGenerator?: () => Proxy;
        } = {
            screen: {
                width: userAgent.data.screenWidth,
                height: userAgent.data.screenHeight
            },
            userAgent: userAgent.data.userAgent,
            viewport: {
                width: userAgent.data.viewportWidth,
                height: userAgent.data.viewportHeight
            },
            proxy: undefined,
            proxyGenerator: undefined
        };

        if (this.contextOptions) {
            Object.assign(options, this.contextOptions);

            if (this.contextOptions?.proxyGenerator !== undefined) {
                options.proxy = this.contextOptions.proxyGenerator();
                delete options.proxyGenerator;
            }

            page = await (<Browser>this.browser).newPage(options);
            proxy = options.proxy;
        } else {
            page = await (<Browser>this.browser).newPage(options);
        }
        
        return {
            page,
            proxy
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
