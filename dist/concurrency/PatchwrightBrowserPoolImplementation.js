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
const browser_pool_1 = require("@crawlee/browser-pool");
const patchright_1 = require("patchright");
const ConcurrencyImplementation_1 = require("./ConcurrencyImplementation");
const util_1 = require("../util");
const debug = (0, util_1.debugGenerator)('SingleBrowserImpl');
const BROWSER_TIMEOUT = 5000;
class PatchwrightBrowserPoolImplementation extends ConcurrencyImplementation_1.default {
    constructor() {
        super(...arguments);
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
                yield (0, util_1.timeoutExecute)(BROWSER_TIMEOUT, this.browser.destroy());
            }
            catch (e) {
                debug('Unable to close browser pool.');
            }
            try {
                this.browser = new browser_pool_1.BrowserPool({
                    browserPlugins: [PatchwrightBrowserPoolImplementation.plugin],
                });
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
            this.browser = new browser_pool_1.BrowserPool({
                browserPlugins: [PatchwrightBrowserPoolImplementation.plugin],
            });
        });
    }
    close() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.browser.destroy();
        });
    }
    createResources() {
        return __awaiter(this, void 0, void 0, function* () {
            const page = yield this.browser.newPage();
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
// @ts-ignore
PatchwrightBrowserPoolImplementation.plugin = new browser_pool_1.PlaywrightPlugin(patchright_1.chromium, {
    useIncognitoPages: true,
    launchOptions: {
        headless: true,
        channel: "chrome"
    }
});
exports.default = PatchwrightBrowserPoolImplementation;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUGF0Y2h3cmlnaHRCcm93c2VyUG9vbEltcGxlbWVudGF0aW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL2NvbmN1cnJlbmN5L1BhdGNod3JpZ2h0QnJvd3NlclBvb2xJbXBsZW1lbnRhdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7OztBQUFBLHdEQUFzRTtBQUN0RSwyQ0FBc0M7QUFFdEMsMkVBQXNGO0FBRXRGLGtDQUF5RDtBQUN6RCxNQUFNLEtBQUssR0FBRyxJQUFBLHFCQUFjLEVBQUMsbUJBQW1CLENBQUMsQ0FBQztBQUVsRCxNQUFNLGVBQWUsR0FBRyxJQUFJLENBQUM7QUFFN0IsTUFBcUIsb0NBQXFDLFNBQVEsbUNBQXlCO0lBQTNGOztRQUVjLFlBQU8sR0FBdUIsSUFBSSxDQUFDO1FBVXJDLGNBQVMsR0FBWSxLQUFLLENBQUM7UUFDM0Isb0JBQWUsR0FBWSxLQUFLLENBQUM7UUFDakMsa0JBQWEsR0FBVyxDQUFDLENBQUM7UUFDMUIsOEJBQXlCLEdBQW1CLEVBQUUsQ0FBQztJQWlHM0QsQ0FBQztJQS9GaUIsTUFBTTs7WUFDaEIsSUFBSSxJQUFJLENBQUMsYUFBYSxLQUFLLENBQUMsSUFBSSxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7Z0JBQzdDLHlFQUF5RTtnQkFDekUsTUFBTSxJQUFJLE9BQU8sQ0FBTyxPQUFPLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztnQkFDakYsT0FBTztZQUNYLENBQUM7WUFFRCxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQztZQUN0QixLQUFLLENBQUMsa0NBQWtDLENBQUMsQ0FBQztZQUUxQyxJQUFJLENBQUM7Z0JBQ0Qsb0VBQW9FO2dCQUNwRSxNQUFNLElBQUEscUJBQWMsRUFBQyxlQUFlLEVBQWdCLElBQUksQ0FBQyxPQUFRLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQztZ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