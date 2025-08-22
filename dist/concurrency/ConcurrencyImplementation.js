"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
;
/**
 * ABSTRACT CLASS Needs to be implemented to manage one or more browsers via puppeteer instances
 *
 * The ConcurrencyImplementation creates WorkerInstances. Workers create JobInstances:
 * One WorkerInstance per maxWorkers, one JobInstance per job
 */
class ConcurrencyImplementation {
    constructor(launchOptions, contextOptions) {
        this.launchOptions = launchOptions;
        this.contextOptions = contextOptions;
    }
}
exports.default = ConcurrencyImplementation;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQ29uY3VycmVuY3lJbXBsZW1lbnRhdGlvbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9jb25jdXJyZW5jeS9Db25jdXJyZW5jeUltcGxlbWVudGF0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBTUMsQ0FBQztBQU1GOzs7OztHQUtHO0FBQ0gsTUFBOEIseUJBQXlCO0lBb0JuRCxZQUFZLGFBQTRCLEVBQUUsY0FBNEM7UUFDbEYsSUFBSSxDQUFDLGFBQWEsR0FBRyxhQUFhLENBQUM7UUFDbkMsSUFBSSxDQUFDLGNBQWMsR0FBRyxjQUFjLENBQUM7SUFDekMsQ0FBQztDQUNKO0FBeEJELDRDQXdCQyJ9