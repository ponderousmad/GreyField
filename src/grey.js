var GREY = (function () {
    "use strict";

    function SpaceView() {
        this.maximize = false;
        this.updateInDraw = true;

        var self = this;

        this.batch = new BLIT.Batch("images/", function () {
            self.processLevels();
        });
        this.image = this.batch.load("normalspace.png");
        this.batch.commit();

        this.space = null;
    }

    SpaceView.prototype.processLevels = function () {
        var space =  new FIELD.Space(this.image.width, this.image.height);
        IMPROC.processImage(this.image, 0, 0, this.image.width, this.image.height, function (x, y, r, g, b, a) {
            this.space.setPotential(x, y, r / IMPROC.BYTE_MAX);
        });
        this.space = space;
    }

    SpaceView.prototype.update = function (now, elapsed, keyboard, pointer) {
        if (this.space) {
            this.space.update()
        }
    };

    SpaceView.prototype.draw = function (context, width, height) {
        context.clearRect(0, 0, width, height);
        if (this.batch.loaded) {
            BLIT.draw(context, this.image, 0, 0, BLIT.ALIGN.TopLeft);
        }
    };

    function start() {
        MAIN.start(document.getElementById("canvas2D"), new SpaceView());

        if (MAIN.runTestSuites() === 0) {
            console.log("All Tests Passed!");
        }
    }

    return {
        start: start
    };
}());