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
class PlaywightBrowserPoolImplementation extends ConcurrencyImplementation_1.default {
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
                    browserPlugins: [PlaywightBrowserPoolImplementation.plugin],
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
                browserPlugins: [PlaywightBrowserPoolImplementation.plugin],
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
            return {
                jobInstance: () => __awaiter(this, void 0, void 0, function* () {
                    if (this.repairRequested) {
                        yield this.repair();
                    }
                    yield (0, util_1.timeoutExecute)(BROWSER_TIMEOUT, (() => __awaiter(this, void 0, void 0, function* () {
                        resources = yield this.createResources();
                    }))());
                    this.openInstances += 1;
                    return {
                        resources,
                        close: () => __awaiter(this, void 0, void 0, function* () {
                            this.openInstances -= 1; // decrement first in case of error
                            yield (0, util_1.timeoutExecute)(BROWSER_TIMEOUT, this.freeResources(resources));
                            if (this.repairRequested) {
                                yield this.repair();
                            }
                        }),
                    };
                }),
                close: () => __awaiter(this, void 0, void 0, function* () {
                    debug('Close requested for worker in browser pool.');
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
PlaywightBrowserPoolImplementation.plugin = new browser_pool_1.PlaywrightPlugin(patchright_1.chromium, {
    useIncognitoPages: true,
    launchOptions: {
        headless: true,
        channel: "chrome"
    }
});
exports.default = PlaywightBrowserPoolImplementation;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUGxheXdpZ2h0QnJvd3NlclBvb2xJbXBsZW1lbnRhdGlvbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9jb25jdXJyZW5jeS9QbGF5d2lnaHRCcm93c2VyUG9vbEltcGxlbWVudGF0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7O0FBQUEsd0RBQXNFO0FBQ3RFLDJDQUFzQztBQUV0QywyRUFBc0Y7QUFFdEYsa0NBQXlEO0FBQ3pELE1BQU0sS0FBSyxHQUFHLElBQUEscUJBQWMsRUFBQyxtQkFBbUIsQ0FBQyxDQUFDO0FBRWxELE1BQU0sZUFBZSxHQUFHLElBQUksQ0FBQztBQUU3QixNQUFxQixrQ0FBbUMsU0FBUSxtQ0FBeUI7SUFBekY7O1FBRWMsWUFBTyxHQUF1QixJQUFJLENBQUM7UUFVckMsY0FBUyxHQUFZLEtBQUssQ0FBQztRQUMzQixvQkFBZSxHQUFZLEtBQUssQ0FBQztRQUNqQyxrQkFBYSxHQUFXLENBQUMsQ0FBQztRQUMxQiw4QkFBeUIsR0FBbUIsRUFBRSxDQUFDO0lBNkYzRCxDQUFDO0lBM0ZpQixNQUFNOztZQUNoQixJQUFJLElBQUksQ0FBQyxhQUFhLEtBQUssQ0FBQyxJQUFJLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQztnQkFDN0MseUVBQXlFO2dCQUN6RSxNQUFNLElBQUksT0FBTyxDQUFPLE9BQU8sQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLHlCQUF5QixDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO2dCQUNqRixPQUFPO1lBQ1gsQ0FBQztZQUVELElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDO1lBQ3RCLEtBQUssQ0FBQyxrQ0FBa0MsQ0FBQyxDQUFDO1lBRTFDLElBQUksQ0FBQztnQkFDRCxvRUFBb0U7Z0JBQ3BFLE1BQU0sSUFBQSxxQkFBYyxFQUFDLGVBQWUsRUFBZ0IsSUFBSSxDQUFDLE9BQVEsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDO1lBQ2pG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