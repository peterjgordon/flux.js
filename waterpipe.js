/*
 *  waterpipe.js - v1.0
 *  jQuery plugin. Smoky backgrounds generator
 *  http://www.dragdropsite.com
 *
 *  Made by dragdropsite.com
 *
 *  Under MIT License
 *
 *  Credits: rectangleworld.com
 */

;(function ( $, window, document, undefined ) {
    var pluginName = "waterpipe",
        defaults = {
            // Smoke
            displayRatio: 1,
            gradientStart: '#000000',
            gradientEnd: '#222222',
            smokeOpacity: 0.1,
            numCircles: 1,
            radius: 'auto',
            minRadFactor: 0,
            iterations: 8,
            drawsPerFrame: 10,
            lineWidth: 2,
            speed: 15,
            fadeSpeed: 50,
            // Interaction
            mousePower: 20,
            replayPower: 50,
            // Background
            bgColorInner: "#ffffff",
            bgColorOuter: "#666666",
            disableBg: true
        };

    var TWO_PI = 2*Math.PI;
    var timer, fadeTimer;
    var inst;
    function Smoke (element, options) {
        this.element = element;
        this.$element = $(element);
        inst = this;
        this.settings = $.extend({}, defaults, options);
        this._defaults = defaults;
        this._name = pluginName;
        this.init();
    }

    Smoke.prototype = {
        init: function () {
            this.initSettings();
            this.initCanvas();
            this.initEvents();
            this.generate();
        },
        initSettings: function () {
            // preload area, offscreen to left and right
            this.basePreloadSize = 250;
            this.preloadSize = this.basePreloadSize * this.settings.displayRatio;

            this.canvasWidth = this.element.offsetWidth * this.settings.displayRatio + this.basePreloadSize;
            this.canvasHeight = this.element.offsetHeight * this.settings.displayRatio;

            if(this.settings.radius==='auto') this.settings.radius = this.canvasHeight/5;
        },
        initCanvas: function () {
            if(!this.displayCanvas) {
                this.displayCanvas = this.$element.find('canvas')[0];
                this.bufferCanvas = document.createElement("canvas");
                this.fadeCanvas = document.createElement("canvas");
                this.backgroundCanvas = document.createElement("canvas");
            }

            this.displayCanvas.width = this.canvasWidth;
            this.displayCanvas.height = this.canvasHeight;
            this.displayCanvas.style.transformOrigin = "0 0"; // scale from top left
            var scaleToFit = Math.min(window.innerWidth/(this.canvasWidth-this.basePreloadSize), window.innerHeight/this.canvasHeight);
            this.displayCanvas.style.transform = "scale(" + scaleToFit + ")"; // css transforms are faster as they use the GPU
            this.bufferCanvas.width = this.canvasWidth;
            this.bufferCanvas.height = this.canvasHeight;
            this.fadeCanvas.width = this.canvasWidth;
            this.fadeCanvas.height = this.canvasHeight;
            this.backgroundCanvas.width = this.canvasWidth;
            this.backgroundCanvas.height = this.canvasHeight;

            this.context = this.displayCanvas.getContext("2d");
            this.bufferContext = this.bufferCanvas.getContext("2d");
            this.fadeContext = this.fadeCanvas.getContext("2d");
            this.backgroundContext = this.backgroundCanvas.getContext("2d", { alpha: false });
        },
        initEvents: function() {
            // These should really be partly moved to the builder_scripts.js file
            // as they reference elements on the example page
            $("#wavybg-wrapper").unbind();
            $(window).unbind("keyup");

            // track mouse pos
            $("#wavybg-wrapper").on('mousedown touchstart', function(event) {
                var pos = event.type == 'touchstart' ? event.originalEvent.touches[0] : event;

                $("#path").val('');
                inst.drawing = true;
                inst.path = [];
                inst.replayLastPointIndex = null;
                inst.path.push({x: Math.round(pos.clientX * inst.settings.displayRatio), y: Math.round(pos.clientY * inst.settings.displayRatio)});
            });
            $("#wavybg-wrapper").on('mousemove touchmove', function(event) {
                var pos = event.type == 'touchmove' ? event.originalEvent.touches[0] : event;
                if(inst.drawing) {
                    inst.path.push({x: Math.round(pos.clientX * inst.settings.displayRatio), y: Math.round(pos.clientY * inst.settings.displayRatio)});
                }
                if(inst.settings.mousePower == 0) return;

                inst.mousePos = {x: pos.clientX * inst.settings.displayRatio, y: pos.clientY * inst.settings.displayRatio};
            });
            $("#wavybg-wrapper").on('mouseup touchend touchcancel', function(event) {
                if(inst.drawing) {
                    if(event.type == 'mouseup') {
                        // Mouse has a final position in mouseup, touchend doesn't
                        inst.path.push({x: Math.round(event.clientX * inst.settings.displayRatio), y: Math.round(event.clientY * inst.settings.displayRatio)});
                    }
                    if(inst.path.length < 5) inst.path = null;
                    inst.drawing = false;
                    console.log("Path: ", inst.path);
                }
            });

            // toggle movement with spacebar
            $(window).on('keyup', function(event) {
                if(event.key == " ") inst.toggleMovement();
            });
        },
        generate: function () {
            console.log(this.settings);

            this.drawCount = 0;
            this.scrollOffset = -this.preloadSize*2;
            this.cleanCanvas(this.bufferContext);
            this.fillBackground();
            
            this.setCircles();

            // reset mouse pos
            this.mousePos = {x: $(document).width(), y: $(document).height()/2};

            // reset path drawing
            $("#path").val('');
            this.drawing = false;
            this.path = null;
            this.replayLastPointIndex = null;

            // start movement
            this.toggleMovement(true);
        },
        cleanCanvas: function(context) {
            context.setTransform(1,0,0,1,0,0);
            context.clearRect(0,0,this.canvasWidth,this.canvasHeight);
        },
        fillBackground: function () {
            var outerRad = Math.sqrt(this.canvasWidth*this.canvasWidth + this.canvasHeight*this.canvasHeight)/2;
            this.niceGradient = new SmokeNiceBG(this.canvasWidth*0.75,this.canvasHeight/2*0.75,0,this.canvasWidth/2,this.canvasHeight/4,outerRad);

            var hex = this.settings.bgColorInner.replace('#','');

            var r0 = parseInt(hex.substring(0,2), 16),
                g0 = parseInt(hex.substring(2,4), 16),
                b0 = parseInt(hex.substring(4,6), 16);

            hex = this.settings.bgColorOuter.replace('#','');
            var r1 = parseInt(hex.substring(0,2), 16),
                g1 = parseInt(hex.substring(2,4), 16),
                b1 = parseInt(hex.substring(4,6), 16);

            this.niceGradient.addColorStop(0,r0,g0,b0);
            this.niceGradient.addColorStop(1,r1,g1,b1);
            this.niceGradient.fillRect(this.backgroundContext,0,0,this.canvasWidth,this.canvasHeight);
        },
        setCircles: function () {
            var i;
            var r,g,b,a;
            var maxR, minR;
            var grad;
            
            this.circles = [];
            
            for (i = 0; i < this.settings.numCircles; i++) {
                maxR = this.settings.radius*this.settings.displayRatio+Math.random();
                minR = this.settings.minRadFactor*maxR;
                
                //define gradient
                grad = this.bufferContext.createRadialGradient(0,0,minR,0,0,maxR);
                var gradientStart = this.hexToRGBA(this.settings.gradientStart, this.settings.smokeOpacity),
                    gradientEnd = this.hexToRGBA(this.settings.gradientEnd, this.settings.smokeOpacity);

                grad.addColorStop(1,gradientStart);
                grad.addColorStop(0,gradientEnd);
                
                var newCircle = {
                    centerX: -maxR + this.preloadSize*2,
                    centerY: this.canvasHeight/2-50,
                    maxRad : maxR,
                    minRad : minR,
                    color: grad, //can set a gradient or solid color here.
                    //fillColor: "rgba(0,0,0,1)",
                    param : 0,
                    changeSpeed : 1/250,
                    phase : Math.PI, //the phase to use for a single fractal curve.
                    globalPhase: Math.PI //the curve as a whole will rise and fall by a sinusoid.
                };
                this.circles.push(newCircle);
                newCircle.pointList1 = this.setLinePoints(this.settings.iterations);
                newCircle.pointList2 = this.setLinePoints(this.settings.iterations);
            }
        },
        toggleMovement: function(force) {
            // 'force' will force enable/disable timer and is optional
            var hadNoTimer = this.timer == null;
            if(this.timer) {
                window.cancelAnimationFrame(this.timer);
                this.timer = null;
            }
            if(force || (hadNoTimer && force !== false)) {
                this.timer = window.requestAnimationFrame(() => {inst.onTimer()});
            }
        },
        fadeOverTime: function() {
            inst.fadeAmount = 100;

            if (fadeTimer != null) {
                clearInterval(fadeTimer);
            }
            fadeTimer = setInterval(function() {
                if (inst.fadeAmount > 0) inst.fadeAmount--;
            }, inst.settings.fadeSpeed);
        },
        onTimer: function () {
            var i,j;
            var c;
            var rad;
            var point1,point2;
            var x0,y0;
            var cosParam;
            
            var xSqueeze = 0.75; //cheap 3D effect by shortening in x direction.
            
            var yOffset;
            
            //draw circles
            for (j = 0; j < this.settings.drawsPerFrame; j++) {
                
                this.drawCount++;
                if (this.replayLastPointIndex == null) {
                    // CONTINUOUS SCROLLING
                    // (disabled in replay mode)
                    if (this.scrollOffset > -this.preloadSize*2) this.scrollOffset -= this.settings.mousePower * this.settings.displayRatio / 50;
                    
                    if (this.circles[0].centerX + this.preloadSize > this.canvasWidth) {
                        this.bufferContext.globalCompositeOperation = "copy";
                        this.bufferContext.setTransform(1,0,0,1,0,0);
                        this.bufferContext.drawImage(this.bufferCanvas, -this.preloadSize, 0);
                        this.bufferContext.globalCompositeOperation = "source-over";
                        this.scrollOffset = -this.preloadSize;

                        for (i = 0; i < this.settings.numCircles; i++) {
                            c = this.circles[i];
                            c.centerX = this.canvasWidth - this.preloadSize*2;
                        }
                    }
                }

                for (i = 0; i < this.settings.numCircles; i++) {
                    c = this.circles[i];
                    c.param += c.changeSpeed;
                    if (c.param >= 1) {
                        c.param = 0;
                        
                        c.pointList1 = c.pointList2;
                        c.pointList2 = this.setLinePoints(this.settings.iterations);
                    }
                    cosParam = 0.5-0.5*Math.cos(Math.PI*c.param);
                    
                    this.bufferContext.strokeStyle = c.color;
                    this.bufferContext.lineWidth = this.settings.lineWidth;
                    //context.fillStyle = c.fillColor;
                    this.bufferContext.beginPath();
                    point1 = c.pointList1.first;
                    point2 = c.pointList2.first;
                    
                    //slowly rotate
                    c.phase += 0.002;
                    
                    theta = c.phase;
                    rad = c.minRad + (point1.y + cosParam*(point2.y-point1.y))*(c.maxRad - c.minRad);
                    
                    // MOVE CENTERS
                    // REPLAY MODE
                    if (this.path != null && !this.drawing) {
                        if (this.replayLastPointIndex == null) {
                            this.fadeOverTime();
                            this.cleanCanvas(this.fadeContext);
                            this.cleanCanvas(this.bufferContext);
                            this.replayLastPointIndex = 0;
                            c.centerX = this.path[0].x;
                            c.centerY = this.path[0].y;
                            this.scrollOffset = 0;
                        }
                        replayLastPoint = this.path[this.replayLastPointIndex];
                        currentX = Math.round(c.centerX + this.scrollOffset);
                        currentY = Math.round(c.centerY);
                        if(currentX == replayLastPoint.x && currentY == replayLastPoint.y) {
                            // start moving to next point
                            this.replayLastPointIndex++;
                            if(this.replayLastPointIndex >= this.path.length) {
                                this.replayLastPointIndex = 0;
                                // fade out the smoke path which has just finished
                                this.fadeOverTime();
                                this.cleanCanvas(this.fadeContext);
                                this.fadeContext.drawImage(this.bufferCanvas, this.scrollOffset, 0);
                                this.cleanCanvas(this.bufferContext);
                            }
                        } else {
                            // at high replay power sometimes an increment would be too big a step to reach the target
                            if(this.areClose(currentX, replayLastPoint.x)) c.centerX = replayLastPoint.x - this.scrollOffset;
                            if(this.areClose(currentY, replayLastPoint.y)) c.centerY = replayLastPoint.y;

                            // X
                            if(replayLastPoint.x > currentX) c.centerX += inst.settings.replayPower * this.settings.displayRatio / 100;
                            else if(replayLastPoint.x < currentX) c.centerX -= inst.settings.replayPower * this.settings.displayRatio / 100;

                            // Y
                            if(currentY < replayLastPoint.y) c.centerY += inst.settings.replayPower * this.settings.displayRatio / 100;
                            else if(currentY > replayLastPoint.y) c.centerY -= inst.settings.replayPower * this.settings.displayRatio / 100;
                        }
                    } else {
                        // X
                        if (this.mousePos.x >= c.centerX - this.preloadSize*2) c.centerX += this.settings.mousePower * this.settings.displayRatio / 50;
                        else c.centerX -= this.settings.mousePower * this.settings.displayRatio / 50;

                        // Y
                        if (this.mousePos.y >= c.centerY) c.centerY += this.settings.mousePower * this.settings.displayRatio / 50;
                        else c.centerY -= this.settings.mousePower * this.settings.displayRatio / 50;
                    }
                    yOffset = 40*Math.sin(c.globalPhase + this.drawCount/1000*TWO_PI);
                    
                    //we are drawing in new position by applying a transform. We are doing this so the gradient will move with the drawing.
                    this.bufferContext.setTransform(xSqueeze,0,0,1,c.centerX,c.centerY+yOffset);
                    
                    //Drawing the curve involves stepping through a linked list of points defined by a fractal subdivision process.
                    //It is like drawing a circle, except with varying radius.
                    x0 = xSqueeze*rad*Math.cos(theta);
                    y0 = rad*Math.sin(theta);
                    this.bufferContext.lineTo(x0, y0);
                    while (point1.next != null) {
                        point1 = point1.next;
                        point2 = point2.next;
                        theta = TWO_PI*(point1.x + cosParam*(point2.x-point1.x)) + c.phase;
                        rad = c.minRad + (point1.y + cosParam*(point2.y-point1.y))*(c.maxRad - c.minRad);
                        x0 = xSqueeze*rad*Math.cos(theta);
                        y0 = rad*Math.sin(theta);
                        this.bufferContext.lineTo(x0, y0);
                    }
                    this.bufferContext.closePath();
                    this.bufferContext.stroke();
                    //context.fill();
                }
            }
            if(this.settings.disableBg) this.cleanCanvas(this.context);
            else this.context.drawImage(this.backgroundCanvas, 0, 0);
            if(this.replayLastPointIndex != null) {
                this.context.globalAlpha = this.fadeAmount/100;
                this.context.drawImage(this.fadeCanvas, 0, 0);
                this.context.globalAlpha = 1;
            }
            this.context.drawImage(this.bufferCanvas, this.scrollOffset, 0);
            if(this.timer) this.timer = window.requestAnimationFrame(() => {inst.onTimer()});
        },
        areClose: function(p1, p2) {
            //checks if 2 points are as close as they can get at the current replay power and display ratio
            return Math.abs(p1 - p2) < this.settings.replayPower * this.settings.displayRatio / 100;
        },
        setLinePoints: function (iterations) {
            var pointList = {};
            pointList.first = {x:0, y:1};
            var lastPoint = {x:1, y:1};
            var minY = 1;
            var maxY = 1;
            var point;
            var nextPoint;
            var dx, newX, newY;
            var ratio;
            
            var minRatio = 0.5;
                    
            pointList.first.next = lastPoint;
            for (var i = 0; i < iterations; i++) {
                point = pointList.first;
                while (point.next != null) {
                    nextPoint = point.next;
                    
                    dx = nextPoint.x - point.x;
                    newX = 0.5*(point.x + nextPoint.x);
                    newY = 0.5*(point.y + nextPoint.y);
                    newY += dx*(Math.random()*2 - 1);
                    
                    var newPoint = {x:newX, y:newY};
                    
                    //min, max
                    if (newY < minY) {
                        minY = newY;
                    }
                    else if (newY > maxY) {
                        maxY = newY;
                    }
                    
                    //put between points
                    newPoint.next = nextPoint;
                    point.next = newPoint;
                    
                    point = nextPoint;
                }
            }
            
            //normalize to values between 0 and 1
            if (maxY != minY) {
                var normalizeRate = 1/(maxY - minY);
                point = pointList.first;
                while (point != null) {
                    point.y = normalizeRate*(point.y - minY);
                    point = point.next;
                }
            }
            //unlikely that max = min, but could happen if using zero iterations. In this case, set all points equal to 1.
            else {
                point = pointList.first;
                while (point != null) {
                    point.y = 1;
                    point = point.next;
                }
            }
            
            return pointList;       
        },
        setOption: function (optionName, optionValue) {
            if(!isNaN(optionValue)) optionValue = parseFloat(optionValue);

            // special cases
            switch(optionName) {
                case 'smokeOpacity':
                    optionValue /= 100;
                    break;
                case 'radius':
                    optionValue = optionValue / 100 * (window.innerHeight/5);
                    break;
                case 'displayRatio':
                    optionValue /= 10;
                    break;
            }

            this.settings[optionName] = optionValue;
        },
        setOptions: function (options) {
            for(var option in options) {
                if(!options.hasOwnProperty(option)) continue;

                this.setOption(option, options[option]);
            }
        },
        hexToRGBA: function (hex, opacity) {
            hex = hex.replace('#','');
            r = parseInt(hex.substring(0,2), 16);
            g = parseInt(hex.substring(2,4), 16);
            b = parseInt(hex.substring(4,6), 16);

            result = 'rgba('+r+','+g+','+b+','+opacity+')';
            return result;
        },
        download: function(){
            // open new window
            var imageWindow = window.open("", "fractalLineImage", "");
            imageWindow.document.write("<title>Export Image</title>");
            imageWindow.document.write("<img id='exportImage' alt='' style='position:absolute;left:0;top:0'/>");
            imageWindow.document.close();

            // export
            var dataURL = this.displayCanvas.toDataURL("image/png");
            var exportImage = imageWindow.document.getElementById("exportImage");
            exportImage.src = dataURL;
        },
        toggleCapture: function(enable) {
            if (enable) {
                // recording stream
                inst.stream = inst.displayCanvas.captureStream(30);
                console.log("Stream started: ", inst.stream);
                // media recorder
                inst.mediaRecorder = new MediaRecorder(inst.stream, {mimeType: 'video/webm', videoBitsPerSecond : 5000000});
                inst.mediaRecorder.ondataavailable = inst.captureDataAvailable;
                inst.mediaRecorder.onstop = inst.captureStopped;
                // start recording
                inst.recordedChunks = [];
                inst.mediaRecorder.start();
            } else {
                inst.mediaRecorder.stop();
                inst.stream.getTracks().forEach(track => track.stop());
            }
        },
        captureDataAvailable: function(event) {
            console.log(event.data);
            if(event.data.size > 0) {
                inst.recordedChunks.push(event.data);
            }
        },
        captureStopped: function(event) {
            console.log(inst.recordedChunks.length);
            var blob = new Blob(inst.recordedChunks, {type: 'video/webm'});
            var url = window.URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = 'Waterpipe-' + Math.round(new Date().getTime()/1000) + '.webm';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        },
        getCirclePoint: function(centerX, centerY, radius, angle, invert) {
            if(invert) {
                angle = 360 - angle;
                angle += 180;
            }
            var x = Math.round(centerX + radius * Math.cos(angle * Math.PI/180));
            var y = Math.round(centerY + radius * Math.sin(angle * Math.PI/180));
            return {x, y}
        },
        setPath: function(shape) {
            inst.replayLastPointIndex = null;
            inst.drawing = false;
            inst.path = [];
            switch(shape.toLowerCase()) {
                case "circle":
                    var centerX = (this.canvasWidth - this.preloadSize)/2;
                    var centerY = this.canvasHeight/2;
                    var radius = Math.min(centerX, centerY) - this.settings.radius*this.settings.displayRatio - 50;
                    for(var i=0; i<360; i+=1) {
                        inst.path.push(inst.getCirclePoint(centerX, centerY, radius, i));
                    }
                    break;
                case "figure eight":
                    var screenCenterX = (this.canvasWidth + this.scrollOffset)/2;
                    var screenCenterY = this.canvasHeight/2 - 50;
                    var radius = Math.min(screenCenterX, screenCenterY) - this.settings.radius - 50;
                    var leftCenterX = screenCenterX - radius;
                    var rightCenterX = screenCenterX + radius;
                    for(var i=0; i<360; i+=1) {
                        inst.path.push(inst.getCirclePoint(leftCenterX, screenCenterY, radius, i));
                    }
                    for(var i=0; i<360; i+=1) {
                        inst.path.push(inst.getCirclePoint(rightCenterX, screenCenterY, radius, i, true));
                    }
                    break;
                case "square":
                    inst.path = [
                        {x: Math.round(inst.settings.radius), y: Math.round(inst.settings.radius + 50)},
                        {x: Math.round(inst.canvasWidth + inst.scrollOffset - inst.settings.radius), y: Math.round(inst.settings.radius + 50)},
                        {x: Math.round(inst.canvasWidth + inst.scrollOffset - inst.settings.radius), y: Math.round(inst.canvasHeight - inst.settings.radius - 50)},
                        {x: Math.round(inst.settings.radius), y: Math.round(inst.canvasHeight - inst.settings.radius - 50)}
                    ];
                    break;
                default:
                    inst.path = null;
                    return;
            }
        }
    };

    function SmokeNiceBG(_x0,_y0,_rad0,_x1,_y1,_rad1) {
        this.x0 = _x0;
        this.y0 = _y0;
        this.x1 = _x1;
        this.y1 = _y1;
        this.rad0 = _rad0;
        this.rad1 = _rad1;
        this.colorStops = [];
    }

    SmokeNiceBG.prototype.addColorStop = function(ratio,r,g,b) {
        if ((ratio < 0) || (ratio > 1)) {
            return;
        }
        var n;
        var newStop = {ratio:ratio, r:r, g:g, b:b};
        if ((ratio >= 0) && (ratio <= 1)) {
            if (this.colorStops.length == 0) {
                this.colorStops.push(newStop);
            }
            else {
                var i = 0;
                var found = false;
                var len = this.colorStops.length;
                //search for proper place to put stop in order.
                while ((!found) && (i<len)) {
                    found = (ratio <= this.colorStops[i].ratio);
                    if (!found) {
                        i++;
                    }
                }
                //add stop - remove next one if duplicate ratio
                if (!found) {
                    //place at end
                    this.colorStops.push(newStop);
                }
                else {
                    if (ratio == this.colorStops[i].ratio) {
                        //replace
                        this.colorStops.splice(i, 1, newStop);
                    }
                    else {
                        this.colorStops.splice(i, 0, newStop);
                    }
                }
            }
        }
    }

        
    SmokeNiceBG.prototype.fillRect = function(ctx, rectX0, rectY0, rectW, rectH) {
        
        if (this.colorStops.length == 0) {
            return;
        }
        
        var image = ctx.getImageData(rectX0, rectY0, rectW, rectH);
        var pixelData = image.data;
        var len = pixelData.length;
        var oldpixel, newpixel, nearestValue;
        var quantError;
        var x;
        var y;
        
        var vx = this.x1 - this.x0;
        var vy = this.y1 - this.y0;
        var vMagSquareRecip = 1/(vx*vx+vy*vy);
        var ratio;
        
        var r,g,b;
        var r0,g0,b0,r1,g1,b1;
        var ratio0,ratio1;
        var f;
        var stopNumber;
        var found;
        var q;
        
        var rBuffer = [];
        var gBuffer = [];
        var bBuffer = [];
        var aBuffer = [];
        
        var a,b,c,discrim;
        var dx,dy;
        
        var xDiff = this.x1 - this.x0;
        var yDiff = this.y1 - this.y0;
        var rDiff = this.rad1 - this.rad0;
        a = rDiff*rDiff - xDiff*xDiff - yDiff*yDiff;
        var rConst1 = 2*this.rad0*(this.rad1-this.rad0);
        var r0Square = this.rad0*this.rad0;

        //first complete color stops with 0 and 1 ratios if not already present
        if (this.colorStops[0].ratio != 0) {
            var newStop = { ratio:0,
                            r: this.colorStops[0].r,
                            g: this.colorStops[0].g,
                            b: this.colorStops[0].b}
            this.colorStops.splice(0,0,newStop);
        }
        if (this.colorStops[this.colorStops.length-1].ratio != 1) {
            var newStop = { ratio:1,
                            r: this.colorStops[this.colorStops.length-1].r,
                            g: this.colorStops[this.colorStops.length-1].g,
                            b: this.colorStops[this.colorStops.length-1].b}
            this.colorStops.push(newStop);
        }

        //create float valued gradient
        for (i = 0; i<len/4; i++) {
            
            x = rectX0 + (i % rectW);
            y = rectY0 + Math.floor(i/rectW);
            
            dx = x - this.x0;
            dy = y - this.y0;
            b = rConst1 + 2*(dx*xDiff + dy*yDiff);
            c = r0Square - dx*dx - dy*dy;
            discrim = b*b-4*a*c;
            
            if (discrim >= 0) {
                ratio = (-b + Math.sqrt(discrim))/(2*a);
            
                if (ratio < 0) {
                    ratio = 0;
                }
                else if (ratio > 1) {
                    ratio = 1;
                }
                
                //find out what two stops this is between
                if (ratio == 1) {
                    stopNumber = this.colorStops.length-1;
                }
                else {
                    stopNumber = 0;
                    found = false;
                    while (!found) {
                        found = (ratio < this.colorStops[stopNumber].ratio);
                        if (!found) {
                            stopNumber++;
                        }
                    }
                }
                
                //calculate color.
                r0 = this.colorStops[stopNumber-1].r;
                g0 = this.colorStops[stopNumber-1].g;
                b0 = this.colorStops[stopNumber-1].b;
                r1 = this.colorStops[stopNumber].r;
                g1 = this.colorStops[stopNumber].g;
                b1 = this.colorStops[stopNumber].b;
                ratio0 = this.colorStops[stopNumber-1].ratio;
                ratio1 = this.colorStops[stopNumber].ratio;
                    
                f = (ratio-ratio0)/(ratio1-ratio0);
                r = r0 + (r1 - r0)*f;
                g = g0 + (g1 - g0)*f;
                b = b0 + (b1 - b0)*f;
            }
            
            else {
                r = r0;
                g = g0;
                b = b0;
            }
            
            //set color as float values in buffer arrays
            rBuffer.push(r);
            gBuffer.push(g);
            bBuffer.push(b);
        }
        
        //While converting floats to integer valued color values, apply Floyd-Steinberg dither.
        for (i = 0; i<len/4; i++) {
            nearestValue = ~~(rBuffer[i]);
            quantError =rBuffer[i] - nearestValue;
            rBuffer[i+1] += 7/16*quantError;
            rBuffer[i-1+rectW] += 3/16*quantError;
            rBuffer[i + rectW] += 5/16*quantError;
            rBuffer[i+1 + rectW] += 1/16*quantError;
            
            nearestValue = ~~(gBuffer[i]);
            quantError =gBuffer[i] - nearestValue;
            gBuffer[i+1] += 7/16*quantError;
            gBuffer[i-1+rectW] += 3/16*quantError;
            gBuffer[i + rectW] += 5/16*quantError;
            gBuffer[i+1 + rectW] += 1/16*quantError;
            
            nearestValue = ~~(bBuffer[i]);
            quantError =bBuffer[i] - nearestValue;
            bBuffer[i+1] += 7/16*quantError;
            bBuffer[i-1+rectW] += 3/16*quantError;
            bBuffer[i + rectW] += 5/16*quantError;
            bBuffer[i+1 + rectW] += 1/16*quantError;
        }
            
        //copy to pixel data
        for (i=0; i<len; i += 4) {
            q = i/4;
            pixelData[i] = ~~rBuffer[q];
            pixelData[i+1] = ~~gBuffer[q];
            pixelData[i+2] = ~~bBuffer[q];
            pixelData[i+3] = 255;       
        }
        
        ctx.putImageData(image,rectX0,rectY0);
        
    }

    // A really lightweight plugin wrapper around the constructor,
    // preventing against multiple instantiations
    $.fn[ pluginName ] = function ( options ) {
        this.each(function() {
            if ( !$.data( this, pluginName ) ) {
                $.data( this, pluginName, new Smoke( this, options ) );
            }
        });

        // chain jQuery functions
        return this;
    };

})( jQuery, window, document );