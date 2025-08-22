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
const util_1 = require("./util");
const util_2 = require("util");
const debug = (0, util_1.debugGenerator)('Worker');
const WORKER_INSTANCE_TRIES = 10;
class Worker {
    constructor({ cluster, args, id, workerInstance }) {
        this.busy = false;
        this.activeTarget = null;
        this.cluster = cluster;
        this.args = args;
        this.id = id;
        this.workerInstance = workerInstance;
        debug(`Starting #${this.id}`);
    }
    handle(task, job, timeout) {
        return __awaiter(this, void 0, void 0, function* () {
            this.activeTarget = job;
            let jobInstance = null;
            let page = null;
            let tries = 0;
            while (jobInstance === null) {
                try {
                    jobInstance = yield this.workerInstance.jobInstance();
                    page = jobInstance.resources.page;
                }
                catch (err) {
                    debug(`Error getting worker page (try: ${tries}), message: ${err.message}`);
                    yield this.workerInstance.repair();
                    tries += 1;
                    if (tries >= WORKER_INSTANCE_TRIES) {
                        throw new Error('Unable to get worker page');
                    }
                }
            }
            // We can be sure that page is set now, otherwise an exception would've been thrown
            page = page; // this is just for TypeScript
            let errorState = null;
            page.on('crash', (err) => {
                errorState = new Error('Page crash.');
                (0, util_1.log)(`Error (page crash) crawling ${(0, util_2.inspect)(job.data)}`);
            });
            debug(`Executing task on worker #${this.id} with data: ${(0, util_2.inspect)(job.data)}`);
            let result;
            try {
                result = yield (0, util_1.timeoutExecute)(timeout, task({ page, data: job.data, worker: { id: this.id, proxy: jobInstance.resources.proxy } }));
            }
            catch (err) {
                errorState = err;
                (0, util_1.log)(`Error crawling ${(0, util_2.inspect)(job.data)} // message: ${err.message}`);
            }
            debug(`Finished executing task on worker #${this.id}`);
            try {
                yield jobInstance.close();
            }
            catch (e) {
                debug(`Error closing worker instance for ${(0, util_2.inspect)(job.data)}: ${e.message}`);
                yield this.workerInstance.repair();
            }
            this.activeTarget = null;
            if (errorState) {
                return {
                    type: 'error',
                    error: errorState || new Error('asf'),
                };
            }
            return {
                data: result,
                type: 'success',
            };
        });
    }
    close() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.workerInstance.close();
            }
            catch (err) {
                debug(`Unable to close worker instance. Error message: ${err.message}`);
            }
            debug(`Closed #${this.id}`);
        });
    }
}
exports.default = Worker;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiV29ya2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL1dvcmtlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7OztBQUlBLGlDQUE2RDtBQUM3RCwrQkFBK0I7QUFHL0IsTUFBTSxLQUFLLEdBQUcsSUFBQSxxQkFBYyxFQUFDLFFBQVEsQ0FBQyxDQUFDO0FBU3ZDLE1BQU0scUJBQXFCLEdBQUcsRUFBRSxDQUFDO0FBY2pDLE1BQXFCLE1BQU07SUFVdkIsWUFBbUIsRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLEVBQUUsRUFBRSxjQUFjLEVBQWlCO1FBSnZFLFNBQUksR0FBWSxLQUFLLENBQUM7UUFFdEIsaUJBQVksR0FBMkIsSUFBSSxDQUFDO1FBR3hDLElBQUksQ0FBQyxPQUFPLEdBQUcsT0FBTyxDQUFDO1FBQ3ZCLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDO1FBQ2pCLElBQUksQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDO1FBQ2IsSUFBSSxDQUFDLGNBQWMsR0FBRyxjQUFjLENBQUM7UUFFckMsS0FBSyxDQUFDLGFBQWEsSUFBSSxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUM7SUFDbEMsQ0FBQztJQUVZLE1BQU0sQ0FBQyxJQUE4QixFQUFFLEdBQW9CLEVBQUUsT0FBZTs7WUFDckYsSUFBSSxDQUFDLFlBQVksR0FBRyxHQUFHLENBQUM7WUFFeEIsSUFBSSxXQUFXLEdBQXVCLElBQUksQ0FBQztZQUMzQyxJQUFJLElBQUksR0FBZ0IsSUFBSSxDQUFDO1lBRTdCLElBQUksS0FBSyxHQUFHLENBQUMsQ0FBQztZQUVkLE9BQU8sV0FBVyxLQUFLLElBQUksRUFBRSxDQUFDO2dCQUMxQixJQUFJLENBQUM7b0JBQ0QsV0FBVyxHQUFHLE1BQU0sSUFBSSxDQUFDLGNBQWMsQ0FBQyxXQUFXLEVBQUUsQ0FBQztvQkFDdEQsSUFBSSxHQUFHLFdBQVcsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDO2dCQUN0QyxDQUFDO2dC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