"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const patchright_1 = require("patchright");
const ConcurrencyImplementation_1 = require("./ConcurrencyImplementation");
const util_1 = require("../util");
const debug = (0, util_1.debugGenerator)('SingleBrowserImpl');
const BROWSER_TIMEOUT = 5000;
class PatchwrightBrowserPoolImplementation extends ConcurrencyImplementation_1.default {
    constructor(launchOptions, contextOptions) {
        super(launchOptions, contextOptions);
        this.browser = null;
        this.repairing = false;
        this.repairRequested = false;
        this.openInstances = 0;
        this.waitingForRepairResolvers = [];
    }
    repair() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.openInstances !== 0 || this.repairing) {
                // already repairing or there are still pages open? wait for start/finish
                yield new Promise(resolve => this.waitingForRepairResolvers.push(resolve));
                return;
            }
            this.repairing = true;
            debug('Starting repair of browser pool.');
            try {
                // will probably fail, but just in case the repair was not necessary
                yield (0, util_1.timeoutExecute)(BROWSER_TIMEOUT, this.browser.close());
            }
            catch (e) {
                debug('Unable to close browser pool.');
            }
            try {
                this.browser = yield patchright_1.chromium.launch(this.launchOptions);
            }
            catch (err) {
                throw new Error('Unable to restart browser pool.');
            }
            this.repairRequested = false;
            this.repairing = false;
            this.waitingForRepairResolvers.forEach(resolve => resolve());
            this.waitingForRepairResolvers = [];
        });
    }
    init() {
        return __awaiter(this, void 0, void 0, function* () {
            this.browser = yield patchright_1.chromium.launch(this.launchOptions);
        });
    }
    close() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.browser.close();
        });
    }
    createResources() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            let page = undefined;
            let proxy = undefined;
            // const userAgent = new UserAgent([{deviceCategory: "desktop", vendor: "Google Inc."}]);        
            // const newUserAgentString = userAgent.data.userAgent.replace(new RegExp(`\\([^)]+\\)`), "(X11; Linux x86_64)");
            const options = {
                // screen: {
                //     width: userAgent.data.screenWidth,
                //     height: userAgent.data.screenHeight
                // },
                // userAgent: newUserAgentString,
                viewport: {
                    // width: userAgent.data.viewportWidth,
                    // height: userAgent.data.viewportHeight
                    width: Math.floor(1024 + Math.random() * 100),
                    height: Math.floor(768 + Math.random() * 100)
                },
                proxy: undefined,
                proxyGenerator: undefined
            };
            if (this.contextOptions) {
                Object.assign(options, this.contextOptions);
                if (((_a = this.contextOptions) === null || _a === void 0 ? void 0 : _a.proxyGenerator) !== undefined) {
                    options.proxy = this.contextOptions.proxyGenerator();
                    delete options.proxyGenerator;
                }
                page = yield this.browser.newPage(options);
                proxy = options.proxy;
            }
            else {
                page = yield this.browser.newPage(options);
            }
            return {
                page,
                proxy
            };
        });
    }
    freeResources(resources) {
        return __awaiter(this, void 0, void 0, function* () {
            yield resources.page.close();
        });
    }
    workerInstance() {
        return __awaiter(this, void 0, void 0, function* () {
            let resources;
            let closed = false;
            return {
                jobInstance: () => __awaiter(this, void 0, void 0, function* () {
                    if (this.repairRequested) {
                        yield this.repair();
                    }
                    yield (0, util_1.timeoutExecute)(BROWSER_TIMEOUT, (() => __awaiter(this, void 0, void 0, function* () {
                        resources = yield this.createResources();
                        resources.page.once("close", page => closed = true);
                    }))());
                    this.openInstances += 1;
                    return {
                        resources,
                        close: () => __awaiter(this, void 0, void 0, function* () {
                            this.openInstances -= 1; // decrement first in case of error
                            if (!closed)
                                yield (0, util_1.timeoutExecute)(BROWSER_TIMEOUT, this.freeResources(resources));
                            if (this.repairRequested) {
                                yield this.repair();
                            }
                        }),
                    };
                }),
                close: () => __awaiter(this, void 0, void 0, function* () {
                    debug('Close requested for worker in browser pool.');
                    if (!closed)
                        yield resources.page.close();
                }),
                repair: () => __awaiter(this, void 0, void 0, function* () {
                    debug('Repair requested from worker in browser pool.');
                    this.repairRequested = true;
                    yield this.repair();
                }),
            };
        });
    }
}
exports.default = PatchwrightBrowserPoolImplementation;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUGF0Y2h3cmlnaHRCcm93c2VyUG9vbEltcGxlbWVudGF0aW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL2NvbmN1cnJlbmN5L1BhdGNod3JpZ2h0QnJvd3NlclBvb2xJbXBsZW1lbnRhdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7OztBQUFBLDJDQUE4RDtBQUc5RCwyRUFBMEg7QUFFMUgsa0NBQXlEO0FBQ3pELE1BQU0sS0FBSyxHQUFHLElBQUEscUJBQWMsRUFBQyxtQkFBbUIsQ0FBQyxDQUFDO0FBRWxELE1BQU0sZUFBZSxHQUFHLElBQUksQ0FBQztBQUU3QixNQUFxQixvQ0FBcUMsU0FBUSxtQ0FBeUI7SUFTdkYsWUFBWSxhQUE0QixFQUFFLGNBQTRDO1FBQ2xGLEtBQUssQ0FBQyxhQUFhLEVBQUUsY0FBYyxDQUFDLENBQUM7UUFSL0IsWUFBTyxHQUFtQixJQUFJLENBQUM7UUFFakMsY0FBUyxHQUFZLEtBQUssQ0FBQztRQUMzQixvQkFBZSxHQUFZLEtBQUssQ0FBQztRQUNqQyxrQkFBYSxHQUFXLENBQUMsQ0FBQztRQUMxQiw4QkFBeUIsR0FBbUIsRUFBRSxDQUFDO0lBSXZELENBQUM7SUFFYSxNQUFNOztZQUNoQixJQUFJLElBQUksQ0FBQyxhQUFhLEtBQUssQ0FBQyxJQUFJLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQztnQkFDN0MseUVBQXlFO2dCQUN6RSxNQUFNLElBQUksT0FBTyxDQUFPLE9BQU8sQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLHlCQUF5QixDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO2dCQUNqRixPQUFPO1lBQ1gsQ0FBQztZQUVELElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDO1lBQ3RCLEtBQUssQ0FBQyxrQ0FBa0MsQ0FBQyxDQUFDO1lBRTFDLElBQUksQ0FBQztnQkFDRCxvRUFBb0U7Z0JBQ3BFLE1BQU0sSUFBQSxxQkFBYyxFQUFDLGVBQWUs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