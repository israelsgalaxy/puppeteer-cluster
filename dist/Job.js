"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const url_1 = require("url");
class Job {
    constructor(data, taskFunction, executeCallbacks) {
        this.lastError = null;
        this.tries = 0;
        this.data = data;
        this.taskFunction = taskFunction;
        this.executeCallbacks = executeCallbacks;
    }
    getUrl() {
        if (!this.data) {
            return undefined;
        }
        return this.data.url;
    }
    getDomain() {
        const urlStr = this.getUrl();
        if (urlStr) {
            try {
                const url = new url_1.URL(urlStr);
                return url.hostname || undefined;
            }
            catch (e) {
                return undefined;
            }
        }
        return undefined;
    }
    addError(error) {
        this.tries += 1;
        this.lastError = error;
    }
}
exports.default = Job;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiSm9iLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL0pvYi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUNBLDZCQUEwQjtBQWMxQixNQUFxQixHQUFHO0lBU3BCLFlBQ0ksSUFBYyxFQUNkLFlBQXVDLEVBQ3ZDLGdCQUFtQztRQU4vQixjQUFTLEdBQWlCLElBQUksQ0FBQztRQUNoQyxVQUFLLEdBQVcsQ0FBQyxDQUFDO1FBT3JCLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDO1FBQ2pCLElBQUksQ0FBQyxZQUFZLEdBQUcsWUFBWSxDQUFDO1FBQ2pDLElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxnQkFBZ0IsQ0FBQztJQUM3QyxDQUFDO0lBRU0sTUFBTTtRQUNULElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDYixPQUFPLFNBQVMsQ0FBQztRQUNyQixDQUFDO1FBQ0QsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQztJQUN6QixDQUFDO0lBRU0sU0FBUztRQUNaLE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztRQUM3QixJQUFJLE1BQU0sRUFBRSxDQUFDO1lBQ1QsSUFBSSxDQUFDO2dCQUNELE1BQU0sR0FBRyxHQUFHLElBQUksU0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDO2dCQUM1QixPQUFPLEdBQUcsQ0FBQyxRQUFRLElBQUksU0FBUyxDQUFDO1lBQ3JDLENBQUM7WUFBQyxPQUFPLENBQU0sRUFBRSxDQUFDO2dCQUNkLE9BQU8sU0FBUyxDQUFDO1lBQ3JCLENBQUM7UUFDTCxDQUFDO1FBQ0QsT0FBTyxTQUFTLENBQUM7SUFDckIsQ0FBQztJQUVNLFFBQVEsQ0FBQyxLQUFZO1FBQ3hCLElBQUksQ0FBQyxLQUFLLElBQUksQ0FBQyxDQUFDO1FBQ2hCLElBQUksQ0FBQyxTQUFTLEdBQUcsS0FBSyxDQUFDO0lBQzNCLENBQUM7Q0FFSjtBQTVDRCxzQkE0Q0MifQ==