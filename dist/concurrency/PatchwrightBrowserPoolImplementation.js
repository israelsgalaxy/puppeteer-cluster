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
            var _a, _b;
            const contextOptions = ((_a = this.contextOptions) === null || _a === void 0 ? void 0 : _a.proxyGenerator) === undefined ? this.contextOptions : Object.assign(Object.assign({}, this.contextOptions), { proxy: (_b = this.contextOptions) === null || _b === void 0 ? void 0 : _b.proxyGenerator() });
            const page = yield this.browser.newPage(this.contextOptions);
            return {
                page,
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUGF0Y2h3cmlnaHRCcm93c2VyUG9vbEltcGxlbWVudGF0aW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL2NvbmN1cnJlbmN5L1BhdGNod3JpZ2h0QnJvd3NlclBvb2xJbXBsZW1lbnRhdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7OztBQUFBLDJDQUE4RDtBQUU5RCwyRUFBbUg7QUFFbkgsa0NBQXlEO0FBQ3pELE1BQU0sS0FBSyxHQUFHLElBQUEscUJBQWMsRUFBQyxtQkFBbUIsQ0FBQyxDQUFDO0FBRWxELE1BQU0sZUFBZSxHQUFHLElBQUksQ0FBQztBQUU3QixNQUFxQixvQ0FBcUMsU0FBUSxtQ0FBeUI7SUFTdkYsWUFBWSxhQUE0QixFQUFFLGNBQTRDO1FBQ2xGLEtBQUssQ0FBQyxhQUFhLEVBQUUsY0FBYyxDQUFDLENBQUM7UUFSL0IsWUFBTyxHQUFtQixJQUFJLENBQUM7UUFFakMsY0FBUyxHQUFZLEtBQUssQ0FBQztRQUMzQixvQkFBZSxHQUFZLEtBQUssQ0FBQztRQUNqQyxrQkFBYSxHQUFXLENBQUMsQ0FBQztRQUMxQiw4QkFBeUIsR0FBbUIsRUFBRSxDQUFDO0lBSXZELENBQUM7SUFFYSxNQUFNOztZQUNoQixJQUFJLElBQUksQ0FBQyxhQUFhLEtBQUssQ0FBQyxJQUFJLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQztnQkFDN0MseUVBQXlFO2dCQUN6RSxNQUFNLElBQUksT0FBTyxDQUFPLE9BQU8sQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLHlCQUF5QixDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO2dCQUNqRixPQUFPO1lBQ1gsQ0FBQztZQUVELElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDO1lBQ3RCLEtBQUssQ0FBQyxrQ0FBa0MsQ0FBQyxDQUFDO1lBRTFDLElBQUksQ0FBQztnQkFDRCxvRUFBb0U7Z0JBQ3BFLE1BQU0sSUFBQSxxQkFBYyxFQUFDLGVBQWUs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