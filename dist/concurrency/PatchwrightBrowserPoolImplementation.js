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
                this.init();
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
            try {
                yield this.browser.close();
            }
            catch (err) {
                debug(`Error: Unable to close browser, message: ${err.message}`);
            }
        });
    }
    createResources() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            let page = undefined;
            let proxy = undefined;
            const options = {
                viewport: {
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
            try {
                yield resources.page.close();
            }
            catch (err) {
                debug(`Error: Unable to close browser context, message: ${err.message}`);
            }
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
                        yield (0, util_1.timeoutExecute)(BROWSER_TIMEOUT, this.freeResources(resources));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUGF0Y2h3cmlnaHRCcm93c2VyUG9vbEltcGxlbWVudGF0aW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL2NvbmN1cnJlbmN5L1BhdGNod3JpZ2h0QnJvd3NlclBvb2xJbXBsZW1lbnRhdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7OztBQUFBLDJDQUE4RDtBQUU5RCwyRUFBMEg7QUFFMUgsa0NBQXlEO0FBQ3pELE1BQU0sS0FBSyxHQUFHLElBQUEscUJBQWMsRUFBQyxtQkFBbUIsQ0FBQyxDQUFDO0FBRWxELE1BQU0sZUFBZSxHQUFHLElBQUksQ0FBQztBQUU3QixNQUFxQixvQ0FBcUMsU0FBUSxtQ0FBeUI7SUFTdkYsWUFBWSxhQUE0QixFQUFFLGNBQTRDO1FBQ2xGLEtBQUssQ0FBQyxhQUFhLEVBQUUsY0FBYyxDQUFDLENBQUM7UUFSL0IsWUFBTyxHQUFtQixJQUFJLENBQUM7UUFFakMsY0FBUyxHQUFZLEtBQUssQ0FBQztRQUMzQixvQkFBZSxHQUFZLEtBQUssQ0FBQztRQUNqQyxrQkFBYSxHQUFXLENBQUMsQ0FBQztRQUMxQiw4QkFBeUIsR0FBbUIsRUFBRSxDQUFDO0lBSXZELENBQUM7SUFFYSxNQUFNOztZQUNoQixJQUFJLElBQUksQ0FBQyxhQUFhLEtBQUssQ0FBQyxJQUFJLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQztnQkFDN0MseUVBQXlFO2dCQUN6RSxNQUFNLElBQUksT0FBTyxDQUFPLE9BQU8sQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLHlCQUF5QixDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO2dCQUNqRixPQUFPO1lBQ1gsQ0FBQztZQUVELElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDO1lBQ3RCLEtBQUssQ0FBQyxrQ0FBa0MsQ0FBQyxDQUFDO1lBRTFDLElBQUksQ0FBQztnQkFDRCxvRUFBb0U7Z0JBQ3BFLE1BQU0sSUFBQSxxQkFBYyxFQUFDLGVBQWUs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