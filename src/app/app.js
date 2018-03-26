/* global window, document, console  */

(function () {
    'use strict';

    var usePicture = false;
    var pictureUrl = 'img/campagnolo/campagnolo_{0}.jpg';
    var videoUrlWebm = 'img/campagnolo.webm';
    var videoUrlMp4 = 'img/campagnolo2.mp4';
    var videoUrlCheck = 'img/Chrome_ImF.webm';
    var videoUrl = videoUrlMp4;
    var fps = 25.0;
    var totalFrames = 498;
    var duration = totalFrames / fps;
    var currentTime = 0.0;
    var pageOffset = 0.0;
    var currentMarker = 0.0;
    var markers = [0, 2.14, 5.22, 9.16, 12.13, 16.08, duration];
    var pictures = [];
    var concurrent = 15;

    var speed, mouseDownY;
    var scrolling = {
        pow: 0,
        end: 0,
        endTime: 0,
        previous: 0,
        direction: 0,
        diff: 0,
        index: 0,
    };

    // select video element
    var container = document.querySelector('.container');
    var content = document.querySelector('.content');
    var preload = document.querySelector('.preload');
    var video = document.querySelector('.video');
    var picture = document.querySelector('.picture');
    var track = document.querySelector('.track');
    var steps = document.querySelector('.steps');
    var time = document.querySelector('.circle-time');
    var scroll = document.querySelector('.circle-scroll');
    var player = video;

    if (usePicture) {
        container.setAttribute('class', 'container container-picture loading');
        player = picture;
        player.currentTime = 0.0;
        player.duration = duration;
        player.play = player.pause = function () {};
        player.setTime = function () {
            var i = Math.max(1, Math.min(totalFrames, Math.round(player.currentTime * fps)));
            if (player.index !== i) {
                player.index = i;
                // console.log(i, pictures[i]);
                player.src = pictures[i];
            }
        };
        PreloadPictures();
    } else {
        container.setAttribute('class', 'container container-video loading');
        player = video;
        player.setTime = function () {};
        PreloadVideo();
    }

    function addSteps() {
        for (var i = 0; i < markers.length; i++) {
            var marker = markers[i];
            var html = '<div class="step" style="top:' + (marker / duration * 100).toFixed(3) + '%"></div>';
            steps.innerHTML += html;
            // console.log(steps, html);
        }
    }
    addSteps();

    function setProgress(loaded, total) {
        var progress = loaded / total;
        var percent = parseInt(progress * 100);
        preload.innerHTML = percent;
        // console.log(percent);
    }

    function PreloadPictures() {
        var total = totalFrames;
        var loaded = 0;
        var frame = 0;
        var requests = [];

        function onCheckNextPicture() {
            while (requests.length < concurrent && frame < total) {
                requests.push(true);
                onLoadNextPicture(++frame);
            }
        }

        function onLoadNextPicture(frame) {
            var req = new XMLHttpRequest();
            req.open('GET', pictureUrl.split('{0}').join(frame), true);
            req.responseType = 'blob';
            req.onload = function () {
                if (this.status === 200) {
                    var blob = this.response;
                    var image = URL.createObjectURL(blob); // IE10+
                    pictures[frame] = image;
                    loaded++;
                    requests.shift();
                    setProgress(loaded, total);
                    if (loaded === total) {
                        player.setTime();
                        Init();
                    } else {
                        onCheckNextPicture();
                    }
                }
            };
            req.onerror = function (e) {
                console.log('preload.error', e);
            };
            req.send();
        }
        onCheckNextPicture();
    }

    function PreloadVideo() {
        var req = new XMLHttpRequest();
        req.open('GET', videoUrl, true);
        req.responseType = 'blob';
        req.onprogress = function (e) {
            setProgress(e.loaded, e.total);
        };
        req.onload = function () {
            if (this.status === 200) {
                var videoBlob = this.response;
                var source = URL.createObjectURL(videoBlob); // IE10+
                video.src = source;
                Init();
            }
        };
        req.onerror = function (e) {
            console.log('preload.error', e);
        };
        req.send();
    }

    function Init() {
        if (usePicture) {
            container.setAttribute('class', 'container container-picture');
        } else {
            container.setAttribute('class', 'container container-video');
        }
        scrolling.pow = scrolling.end = 0;
        speed = 0.0;
        mouseDownY = null;

        video.pause();

        addMouseEvents();
        addTouchEvents();

        window.onscroll = onScroll;
        // setInterval(onLoop, 1000.0 / fps);
        window.requestAnimationFrame(animate);
    }

    function elastic(pow) {
        var accelamount = 0.05; //How fast the video will try to catch up with the target position. 1 = instantaneous, 0 = do nothing.
        var bounceamount = 0.7; //value from 0 to 1 for how much backlash back and forth you want in the easing. 0 = no bounce whatsoever, 1 = lots and lots of bounce
        speed += (scrolling.end - pow) * accelamount;
        speed = Math.max(-1, Math.min(1, speed));
        pow = (pow + speed) * (bounceamount) + (scrolling.end * (1 - bounceamount));
        return pow;
    }

    function onLoop() {
        if (player.duration) {
            if (mouseDownY) {
                scrolling.pow = scrolling.end;
                player.pause();
                player.currentTime = scrolling.pow * player.duration;
                player.setTime();
            } else {
                if (scrolling.end !== scrolling.pow) {
                    /*
                    if (timeDirection > 0 && player.paused) {
                        player.play();
                    } else if (timeDirection < 0 && !player.paused) {
                        player.pause();
                    }
                    */
                    if (!player.paused) {
                        player.pause();
                    }
                    var diff = scrolling.end - scrolling.pow;
                    var step = 1.0 / fps;
                    if (Math.abs(diff * player.duration) < step) {
                        scrolling.pow = scrolling.end;
                    } else {
                        var direction = diff ? diff / Math.abs(diff) : 0;
                        scrolling.pow += (step * direction) / player.duration;
                    }
                    var currentTime = Math.round(scrolling.pow * player.duration / step) * step + 0.00001;
                    player.currentTime = currentTime;
                    player.setTime();
                }
            }
            var containerHeight = container.offsetHeight;
            var contentHeight = content.offsetHeight;
            time.setAttribute('style', 'top:' + (15 + ((player.currentTime / player.duration) * (containerHeight - 30))) + 'px;');
        }
    }

    var timeapi = window.peformance ? performance : Date;
    var fpsInterval = 1000 / fps,
        now = 0,
        then = 0,
        elapsed = 0;

    function animate() {
        // calc elapsed time since last loop
        now = timeapi.now();
        elapsed = now - then;
        // if enough time has elapsed, draw the next frame

        if (elapsed > fpsInterval) {

            // Get ready for next frame by setting then=now, but also adjust for your
            // specified fpsInterval not being a multiple of RAF's interval (16.7ms)
            then = now - (elapsed % fpsInterval);

            // Put your drawing code here
            onLoop();
        }
        // request another frame
        requestAnimationFrame(animate);
    }

    function onTrack(e) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (e.target.getAttribute('class') === 'step') {
            var nodes = Array.prototype.slice.call(e.target.parentNode.children);
            var index = nodes.indexOf(e.target);
            setIndex(index);
        }
        return false;
    }

    var scrubStart = 0.0;

    function onDown(e) {
        mouseDownY = e.clientY;
        scrubStart = scrolling.end || 0;
        console.log('onDown', mouseDownY, scrubStart);
    }

    function onMove(e) {
        if (mouseDownY) {
            if (Math.abs(mouseDownY - e.clientY) > 1) {
                var min = 0,
                    max = 1,
                    pow = (mouseDownY - e.clientY) / (window.innerHeight * 3);
                scrolling.end = Math.max(0, Math.min(1, scrubStart + pow));
                // console.log('onMove', scrubStart, pow);
                setScroll();
            }
        }
    }

    function onUp(e) {
        if (mouseDownY) {
            var diff = (mouseDownY - e.clientY);
            console.log(e.clientY, mouseDownY, diff);
            if (diff) {
                mouseDownY = null;
                var direction = diff / Math.abs(diff);

                var time = scrolling.end * player.duration;
                markers.filter(function (item, index) {
                    if (time > item && time < markers[index + 1]) {
                        scrolling.index = index + (direction > 0 ? 0 : 1);
                        // console.log('scrolling.index', scrolling.index);
                    }
                });

                setNearestDirection(direction);
                setScroll();
            }
        }
    }

    function onWheel(e) {
        var wheelDirection = e.deltaY / Math.abs(e.deltaY);
        setNearestDirection(wheelDirection);
        setScroll();
    }

    function onScroll() {
        /*
        updateTime();
        if (!mouseDownY) {
            var time = getNearestMarker(scrolling.end * player.duration);
            scrolling.end = time / player.duration;
        }
        */
        var containerHeight = container.offsetHeight;
        scroll.setAttribute('style', 'top : ' + (15 + (scrolling.end * (containerHeight - 30))) + 'px;');


        // this.current = window.scrollY
        /*
        this.options.last = Object(d.a)(this.options.last, this.options.current, this.options.ease), 
        this.options.last = Math.floor(100 * this.options.last) / 100;
            var t = +((this.options.current - this.options.last) / this.wh);
            c.a.set(this.el, {
                y: -this.options.last,
                skewY: 10 * t
            }), this.rAF = requestAnimationFrame(this.run)
        */
    }

    function setIndex(index) {
        // console.log('setIndex', index);
        if (index !== scrolling.index) {
            var direction = (index - scrolling.index) / Math.abs(index - scrolling.index);
            var previousMarker = markers[scrolling.index];
            var nextMarker = markers[index];
            var currentTime = scrolling.pow * player.duration;
            if (currentTime >= Math.min(previousMarker, nextMarker) && currentTime <= Math.max(previousMarker, nextMarker)) {
                scrolling.index = index;
                scrolling.endTime = markers[scrolling.index];
                scrolling.direction = direction;
                scrolling.end = scrolling.endTime / player.duration;
                // console.log('setNearestDirection', index, previousMarker, nextMarker, currentTime);
                var containerHeight = container.offsetHeight;
                scroll.setAttribute('style', 'top : ' + (15 + (scrolling.end * (containerHeight - 30))) + 'px;');
                $('.slick').slick('slickGoTo', index);
            }
        }
    }

    function setNearestDirection(direction) {
        var index = scrolling.index;
        if (direction === 1) {
            index = Math.min(markers.length - 1, scrolling.index + 1);
        } else {
            index = Math.max(0, scrolling.index - 1);
        }
        setIndex(index);
    }

    function setScroll() {
        var containerHeight = container.offsetHeight;
        var contentHeight = content.offsetHeight;
        var min = 0,
            max = (contentHeight - containerHeight),
            top = scrolling.end * max;
        window.scrollTo(0, Math.max(min, Math.min(max, top)));
    }

    /*
    function updateTime() {
        var containerHeight = container.offsetHeight;
        var contentHeight = content.offsetHeight;
        var min = 0,
            max = player.duration,
            end = window.pageYOffset / (contentHeight - containerHeight);
        scrolling.end = Math.max(min, Math.min(max, end));
        scrolling.diff = scrolling.end - scrolling.previous;
        scrolling.direction = scrolling.diff / Math.abs(scrolling.diff);
        scrolling.previous = scrolling.end;
        scroll.setAttribute('style', 'top : ' + (15 + (scrolling.end * (containerHeight - 30))) + 'px;');
    }
    */

    function getNearestMarker(time) {
        var marker = markers.reduce(function (prev, curr) {
            return (Math.abs(curr - time) < Math.abs(prev - time) ? curr : prev);
        });
        return marker;
    }

    function getMarker(forward) {
        var marker = null;
        if (Math.abs(currentMarker - player.currentTime) < 1.0) {
            markers.filter(function (item) {
                if (marker === null && (item > currentMarker || !forward)) {
                    marker = item;
                }
            });
        } else {
            marker = currentMarker;
        }
        console.log(currentMarker, player.currentTime);
        return marker;
    }

    /*
    var isPlaying = video.currentTime > 0 && !video.paused && !video.ended 
        && video.readyState > 2;

    if (!isPlaying) {
      video.play();
    }

    */

    function onMouseDown(e) {
        removeTouchEvents();
        onDown(e);
    }

    function onTouchDown(e) {
        removeMouseEvents();
        onDown(e);
    }

    function addMouseEvents() {
        track.addEventListener('mousedown', onTrack);
        window.addEventListener('mousedown', onMouseDown);
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        window.addEventListener('mouseleave', onUp);
        window.addEventListener('wheel', onWheel);
    }

    function removeMouseEvents() {
        track.removeEventListener('mousedown', onTrack);
        window.removeEventListener('mousedown', onMouseDown);
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        window.removeEventListener('mouseleave', onUp);
        window.removeEventListener('wheel', onWheel);
        console.log('removeMouseEvents');
    }

    function addTouchEvents() {
        track.addEventListener('touchstart', onTrack);
        window.addEventListener('touchstart', onTouchDown);
        window.addEventListener('touchmove', onMove);
        window.addEventListener('touchend', onUp);
    }

    function removeTouchEvents() {
        track.removeEventListener('touchstart', onTrack);
        window.removeEventListener('touchstart', onTouchDown);
        window.removeEventListener('touchmove', onMove);
        window.removeEventListener('touchend', onUp);
        console.log('removeTouchEvents');
    }

    $(document).ready(function () {
        var slick = $('.slick').slick({
            infinite: false,
            slidesToShow: 1,
            slidesToScroll: 1,
            vertical: true,
            arrows: false,
            dots: false,
            swipe: false,
            swipeToSlide: false,
            verticalSwiping: false,
        });
    });

}());

/*
function() {
    function t(e) {
        s()(this, t), this.createBound(), this.content = e.querySelector(".js-scroll-content"), this.el = this.content.querySelector(".js-scroll-section"), this.rAF = void 0, this.options = {
            current: 0,
            last: 0,
            ease: this.el.dataset.ease || .15
        }, this.wh = window.innerHeight, this.setHeight()
    }
    return o()(t, [{
        key: "init",
        value: function() {
            this.addEvents(), this.preload()
        }
    }, {
        key: "createBound",
        value: function() {
            var t = this;
            ["setHeight", "scroll", "run"].forEach(function(e) {
                return t[e] = t[e].bind(t)
            })
        }
    }, {
        key: "setHeight",
        value: function() {
            var t = this.content.getBoundingClientRect().height;
            c.a.set(document.body, {
                height: t
            })
        }
    }, {
        key: "preload",
        value: function() {
            var t = this;
            u()(this.content, function(e) {
                t.setHeight()
            })
        }
    }, {
        key: "scroll",
        value: function() {
            this.options.current = window.scrollY
        }
    }, {
        key: "run",
        value: function() {
            this.options.last = Object(d.a)(this.options.last, this.options.current, this.options.ease), this.options.last = Math.floor(100 * this.options.last) / 100;
            var t = +((this.options.current - this.options.last) / this.wh);
            c.a.set(this.el, {
                y: -this.options.last,
                skewY: 10 * t
            }), this.rAF = requestAnimationFrame(this.run)
        }
    }, {
        key: "on",
        value: function() {
            (!(arguments.length > 0 && void 0 !== arguments[0]) || arguments[0]) && this.requestAnimationFrame()
        }
    }, {
        key: "off",
        value: function() {
            (!(arguments.length > 0 && void 0 !== arguments[0]) || arguments[0]) && this.cancelAnimationFrame()
        }
    }, {
        key: "requestAnimationFrame",
        value: function(t) {
            function e() {
                return t.apply(this, arguments)
            }
            return e.toString = function() {
                return t.toString()
            }, e
        }(function() {
            this.rAF = requestAnimationFrame(this.run)
        })
    }, {
        key: "cancelAnimationFrame",
        value: function(t) {
            function e() {
                return t.apply(this, arguments)
            }
            return e.toString = function() {
                return t.toString()
            }, e
        }(function() {
            cancelAnimationFrame(this.rAF)
        })
    }, {
        key: "destroy",
        value: function() {
            c.a.set(document.body, {
                height: "auto"
            }), this.el = void 0, this.removeEvents()
        }
    }, {
        key: "addEvents",
        value: function() {
            this.on(), window.addEventListener("resize", this.setHeight, !1), window.addEventListener("scroll", this.scroll, !1)
        }
    }, {
        key: "removeEvents",
        value: function() {
            this.off(), window.removeEventListener("resize", this.setHeight, !1), window.removeEventListener("scroll", this.scroll, !1)
        }
    }])
*/