var GREY = (function () {

    function Space() {
        this.maximize = false;
        this.updateInDraw = true;
    }

    Space.prototype.update = function (now, elapsed, keyboard, pointer) {
    };

    Space.prototype.draw = function (context, width, height) {
        context.clearRect(0, 0, width, height);
    };

    function start() {
        MAIN.start(document.getElementById("canvas2D"), new Space());

        if (MAIN.runTestSuites() === 0) {
            console.log("All Tests Passed!");
        }
    }

    return {
        start: start
    };
}());