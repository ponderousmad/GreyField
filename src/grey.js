var GREY = (function () {
    "use strict";

    function Space() {
        this.maximize = false;
        this.updateInDraw = true;

        this.batch = new BLIT.Batch("images/");
        this.image = this.batch.load("normalspace.png");
        this.batch.commit();
    }

    Space.prototype.update = function (now, elapsed, keyboard, pointer) {
    };

    Space.prototype.draw = function (context, width, height) {
        context.clearRect(0, 0, width, height);
        if (this.batch.loaded) {
            BLIT.draw(context, this.image, 0, 0, BLIT.ALIGN.TopLeft);
        }
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