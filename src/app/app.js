/* global window, document, console, TweenLite */

(function () {
    'use strict';

    var isMac = navigator.platform.toUpperCase().indexOf('MAC') !== -1;
    var iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    var isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);

    var useImages = false;

    var fps, totalFrames, duration;

    var currentTime = 0.0;
    var pageOffset = 0.0;
    var currentMarker = 0.0;
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

    var body = document.querySelector('body');
    var page = document.querySelector('.page');
    var overview = document.querySelector('.section-overview');
    var preloadPercent = document.querySelector('.preload .percent');
    var track = document.querySelector('.track');
    var steps = document.querySelector('.steps');
    var playerTime = document.querySelector('.player-time');
    var markerTime = document.querySelector('.marker-time');
    var scrolltos = Array.prototype.slice.call(document.querySelectorAll('[scroll-to]'));
    var markers = Array.prototype.slice.call(document.querySelectorAll('[data-marker]')).map(function (node, index) {
        function onDown(e) {
            var skip = Math.abs(scrolling.index - index) > 1;
            setIndex(index, skip);
            if (skip) {
                var second = 1 / target.player.duration;
                scrolling.pow = scrolling.end - second;
            }
            e.preventDefault();
            e.stopImmediatePropagation();
            return false;
        }

        function onMouseDown(e) {
            node.removeEventListener('touchstart', onTouchDown);
            return onDown(e);
        }

        function onTouchDown(e) {
            node.removeEventListener('mousedown', onMouseDown);
            return onDown(e);
        }
        node.addEventListener('mousedown', onMouseDown);
        node.addEventListener('touchstart', onTouchDown);
        return parseFloat(node.getAttribute('data-marker'));
    });
    // console.log('markers', markers);

    var disc = {
        source: window.options.disc,
        video: document.querySelector('.overview-disc .video'),
        pictures: document.querySelector('.overview-disc .pictures'),
        captionItems: Array.prototype.slice.call(document.querySelectorAll('.overview-disc .captions-item')),
        images: [],
    };
    var rim = {
        source: window.options.rim,
        video: document.querySelector('.overview-rim .video'),
        pictures: document.querySelector('.overview-rim .pictures'),
        captionItems: Array.prototype.slice.call(document.querySelectorAll('.overview-rim .captions-item')),
        images: [],
    };
    fps = window.options.fps;
    totalFrames = window.options.frames;
    duration = totalFrames / fps;
    var target = null;

    var scrollbar = InitScrollbar();
    var isLoading = false,
        isLoaded = false,
        isSwitching = false;

    function StartLoading() {
        body.addClass('loading');
        isLoading = true;
        if (useImages) {
            body.addClass('use-pictures');
            disc.player = disc.pictures;
            disc.player.currentTime = 0.0;
            disc.player.duration = duration;
            disc.player.play = disc.player.pause = function () {};
            disc.player.setTime = function () {
                var i = Math.max(1, Math.min(totalFrames, Math.round(disc.player.currentTime * fps)));
                if (disc.player.index !== i) {
                    disc.player.index = i;
                    // console.log(i, disc.pictures[i]);
                    disc.player.src = disc.images[i];
                }
            };
            rim.player = rim.pictures;
            rim.player.currentTime = 0.0;
            rim.player.duration = duration;
            rim.player.play = rim.player.pause = function () {};
            rim.player.setTime = function () {
                var i = Math.max(1, Math.min(totalFrames, Math.round(rim.player.currentTime * fps)));
                if (rim.player.index !== i) {
                    rim.player.index = i;
                    // console.log(i, rim.pictures[i]);
                    rim.player.src = rim.images[i];
                }
            };
            PreloadImages();
        } else {
            body.addClass('use-video');
            disc.player = disc.video;
            disc.player.setTime = function () {};
            rim.player = rim.video;
            rim.player.setTime = function () {};
            PreloadVideo();
        }
    }

    function addSteps() {
        for (var i = 0; i < markers.length; i++) {
            var marker = markers[i];
            var html = '<div class="step" style="top:' + (marker / duration * 100).toFixed(3) + '%"></div>';
            steps.innerHTML += html;
            // console.log(steps, html);
        }
    }

    function setProgress(loaded, total) {
        var progress = loaded / total;
        var percent = parseInt(progress * 100);
        if (preloadPercent) {
            preloadPercent.setAttribute('style', 'width:' + percent + '%;');
            // console.log(percent);
        }
    }

    function PreloadImages() {
        // solo 1 video
        var total = totalFrames;
        var loaded = 0;
        var frame = 0;
        var requests = [];

        function onCheckNextImage() {
            while (requests.length < concurrent && frame < total) {
                requests.push(true);
                onLoadNextImage(++frame);
            }
        }

        function onLoadNextImage(frame) {
            var req = new XMLHttpRequest();
            req.open('GET', target.source.jpg.split('{0}').join(frame), true);
            req.responseType = 'blob';
            req.onload = function () {
                if (this.status === 200) {
                    var blob = this.response;
                    var image = URL.createObjectURL(blob); // IE10+
                    images[frame] = image;
                    loaded++;
                    requests.shift();
                    setProgress(loaded, total);
                    if (loaded === total) {
                        target.player.setTime();
                        Init();
                    } else {
                        onCheckNextImage();
                    }
                }
            };
            req.onerror = function (e) {
                console.log('preload.error', e);
            };
            req.send();
        }
        onCheckNextImage();
    }

    function InitVideo() {
        var promise = target.video.play();
        if (promise !== undefined) {
            promise.then(function () {
                Init();
            }).catch(function (e) {
                console.log('video.error', e, target.video.error);
            });
        } else {
            Init();
        }
    }

    function PreloadVideoTarget(target, callback) {
        var req = new XMLHttpRequest();
        req.open('GET', (isChrome && !isMac) ? target.source.webm : target.source.mp4, true);
        req.responseType = 'blob';
        req.onprogress = function (e) {
            setProgress(e.loaded, e.total);
        };
        req.onload = function () {
            if (this.status === 200) {
                var videoBlob = this.response;
                var source = URL.createObjectURL(videoBlob); // IE10+
                target.video.addEventListener('progress', function (e) {
                    // console.log('video.progress', e, target.video.duration);
                }, false);
                target.video.addEventListener('error', function (e) {
                    console.log('video.error', e, target.video.error);
                });
                target.video.autoplay = true;
                target.video.mute = true;
                target.video.src = source;
                if (callback) {
                    callback();
                }
            }
        };
        req.onerror = function (e) {
            console.log('preload.error', e);
        };
        req.send();
    }

    function PreloadVideo() {
        PreloadVideoTarget(disc, function () {
            PreloadVideoTarget(rim, function () {
                InitVideo();
            });
        });
        return;
        /*
        console.log('PreloadVideo', target);
        var req = new XMLHttpRequest();
        req.open('GET', (isChrome && !isMac) ? target.source.webm : target.source.mp4, true);
        req.responseType = 'blob';
        req.onprogress = function (e) {
            setProgress(e.loaded, e.total);
        };
        req.onload = function () {
            if (this.status === 200) {
                var videoBlob = this.response;
                var source = URL.createObjectURL(videoBlob); // IE10+
                target.video.addEventListener('progress', function (e) {
                    console.log('video.progress', e, target.video.duration);
                }, false);
                target.video.addEventListener('error', function (e) {
                    console.log('video.error', e, target.video.error);
                });
                target.video.autoplay = true;
                target.video.mute = true;
                target.video.src = source;
                InitVideo();
            }
        };
        req.onerror = function (e) {
            console.log('preload.error', e);
        };
        req.send();
        */
    }

    function Init() {
        isLoading = false;
        isLoaded = true;
        body.removeClass('loading');
        body.addClass('loaded');
        body.addClass('submenu');

        scrolling.pow = scrolling.end = 0;
        speed = 0.0;
        mouseDownY = null;

        target.video.pause();

        if (steps) {
            addSteps();
        }

        addMouseEvents();
        addTouchEvents();

        window.onscroll = onScroll;
        // setInterval(onLoop, 1000.0 / fps);
        window.requestAnimationFrame(animate);

        console.log(target.video.duration);
        setIndex(1);
    }

    function elastic(pow) {
        var accelamount = 0.05; //How fast the video will try to catch up with the target position. 1 = instantaneous, 0 = do nothing.
        var bounceamount = 0.7; //value from 0 to 1 for how much backlash back and forth you want in the easing. 0 = no bounce whatsoever, 1 = lots and lots of bounce
        speed += (scrolling.end - pow) * accelamount;
        speed = Math.max(-1, Math.min(1, speed));
        pow = (pow + speed) * (bounceamount) + (scrolling.end * (1 - bounceamount));
        return pow;
    }

    function setCaptionItems(direction) {
        target.captionItems.filter(function (caption, index) {
            var distance = markers[index] - scrolling.pow * target.player.duration;
            if (Math.abs(distance) > 2) {
                caption.setAttribute('class', 'captions-item');
            } else if (direction > 0) {
                caption.setAttribute('class', 'captions-item ' + (distance > -0.1 ? 'entering' : 'exiting'));
            } else if (direction < 0) {
                caption.setAttribute('class', 'captions-item ' + (distance < 0.1 ? 'entering' : 'exiting'));
            }
        });
    }

    function onLoop(target) {
        if (target.player.duration) {
            if (mouseMove) {
                target.player.pause();
                scrolling.pow = scrolling.end;
                target.player.currentTime = scrolling.pow * target.player.duration;
                target.player.setTime();
            } else {
                if (scrolling.end !== scrolling.pow) {
                    if (!target.player.paused) {
                        target.player.pause();
                    }
                    var diff = scrolling.end - scrolling.pow;
                    var step = 1.0 / fps;
                    if (Math.abs(diff * target.player.duration) < step) {
                        scrolling.pow = scrolling.end;
                    } else {
                        var direction = diff ? diff / Math.abs(diff) : 0;
                        scrolling.pow += (step * direction) / target.player.duration;
                    }
                    var currentTime = Math.round(scrolling.pow * target.player.duration / step) * step + 0.00001;
                    target.player.currentTime = currentTime;
                    target.player.setTime();
                }
            }
            setTop(playerTime, scrolling.pow);
            setMarkers(scrolling.pow);
            setCaptionItems(scrolling.direction);
        }
    }

    var currentIndex = -1;

    function setMarkers(pow) {
        var markerIndex = 0;
        markers.filter(function (marker, i) {
            if (marker <= pow * target.player.duration) {
                markerIndex = i;
            }
        });
        if (currentIndex !== markerIndex) {
            currentIndex = markerIndex;
            Array.prototype.slice.call(document.querySelectorAll('[data-marker]')).filter(function (node, i) {
                if (i === currentIndex) {
                    node.addClass('active');
                } else {
                    node.removeClass('active');
                }
            });
        }
    }

    function setTop(node, pow) {
        if (node && target.player.duration) {
            var i = 0,
                fpow = 0,
                tpow = 0;
            markers.filter(function (marker, index) {
                if (marker <= pow * target.player.duration) {
                    i = index;
                }
            });
            fpow = markers[i] / target.player.duration;
            tpow = i < markers.length - 1 ? markers[i + 1] / target.player.duration : fpow;
            var step = 60;
            pow = fpow !== tpow ? ((pow - fpow) / (tpow - fpow)) : 0;
            var top = step / 2 + step * i + pow * step;
            node.setAttribute('style', 'top:' + (top - 10) + 'px;');
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
            onLoop(disc);
            onLoop(rim);
        }
        // request another frame
        requestAnimationFrame(animate);
    }

    function onTrack(e) {
        if (!isSwitching) {
            e.preventDefault();
            e.stopImmediatePropagation();
            if (e.target.getAttribute('class') === 'step') {
                var nodes = Array.prototype.slice.call(e.target.parentNode.children);
                var index = nodes.indexOf(e.target);
                setIndex(index);
            }
            return false;
        }
    }

    function getY(e) {
        var y = 0.0;
        if (e.touches) {
            y = e.touches[0].pageY;
        } else {
            y = e.clientY;
        }
        return Math.max(0, Math.min(window.innerHeight, y));
    }

    function shouldLockScroll(direction) {
        var flag = false;
        if ((scrolling.pow < 1.0 && direction === 1) || ((!scrollbar || scrollbar.offset.y < 10) && direction === -1)) {
            flag = true;
        }
        // console.log('shouldLockScroll', scrolling.pow, direction);
        return flag;
    }

    var mouseMove = false,
        previousY,
        scrubStart = 0.0;

    function onDown(e) {
        if (scrollbar.offset.y < 10) {
            // console.log('scrub.onDown');
            var y = getY(e);
            previousY = null;
            mouseDownY = y;
            scrubStart = scrolling.end || 0;
        }
    }

    function onMove(e) {
        if (isSwitching) {
            previousY = null;
            mouseDownY = null;
            return;
        }
        if (mouseDownY) {
            var y = getY(e);
            // console.log('onMove', y);
            previousY = y;
            if (Math.abs(mouseDownY - y) > 1) {
                var min = 0,
                    max = 1,
                    pow = (mouseDownY - y) / (window.innerHeight * 3);
                scrolling.end = Math.max(0, Math.min(1, scrubStart + pow));
                // console.log('onMove', scrubStart, pow);
                mouseMove = true;
                setScroll();
            }
            var direction = y - mouseDownY > 0 ? -1 : 1;
            if (shouldLockScroll(direction)) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                return false;
            }
        }
    }

    function onUp(e) {
        if (mouseMove) {
            var y = previousY;
            // console.log('onUp', y);
            var diff = (mouseDownY - y);
            // console.log(y, mouseDownY, diff);
            if (diff) {
                var direction = diff / Math.abs(diff);
                var time = scrolling.end * target.player.duration;
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
        mouseMove = false;
        mouseDownY = null;
    }

    function onWheel(e) {
        var wheelDirection = e.deltaY / Math.abs(e.deltaY);
        setNearestDirection(wheelDirection);
        setScroll();
        if (shouldLockScroll(wheelDirection)) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            // console.log('onWheel', e);
            return false;
        }
    }

    function onScroll() {
        setTop(markerTime, scrolling.end);
    }

    function setIndex(index, skip) {
        if (index !== scrolling.index) {
            var direction = (index - scrolling.index) / Math.abs(index - scrolling.index);
            var previousMarker = markers[scrolling.index];
            var nextMarker = markers[index];
            var currentTime = scrolling.pow * target.player.duration;
            if (skip || currentTime >= Math.min(previousMarker, nextMarker) && currentTime <= Math.max(previousMarker, nextMarker)) {
                scrolling.index = index;
                scrolling.endTime = markers[scrolling.index];
                scrolling.direction = direction;
                scrolling.end = scrolling.endTime / target.player.duration;
                setTop(markerTime, scrolling.end);
            }
            // console.log('setIndex', index);
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
        /*
        var overviewHeight = overview.offsetHeight;
        // var contentHeight = content.offsetHeight;
        var min = 0,
            max = overviewHeight, // (contentHeight - overviewHeight),
            top = scrolling.end * max;
        window.scrollTo(0, Math.max(min, Math.min(max, top)));
        */
    }

    function getNearestMarker(time) {
        var marker = markers.reduce(function (prev, curr) {
            return (Math.abs(curr - time) < Math.abs(prev - time) ? curr : prev);
        });
        return marker;
    }

    function getMarker(forward) {
        var marker = null;
        if (Math.abs(currentMarker - target.player.currentTime) < 1.0) {
            markers.filter(function (item) {
                if (marker === null && (item > currentMarker || !forward)) {
                    marker = item;
                }
            });
        } else {
            marker = currentMarker;
        }
        // console.log(currentMarker, target.player.currentTime);
        return marker;
    }

    var eventOptions = window.PointerEvent ? {
        passive: false,
        capture: true,
    } : undefined;

    function onMouseDown(e) {
        removeTouchEvents();
        onDown(e);
    }

    function onTouchDown(e) {
        removeMouseEvents();
        onDown(e);
    }

    function addMouseEvents() {
        if (track) {
            track.addEventListener('mousedown', onTrack, eventOptions);
        }
        overview.addEventListener('mousedown', onMouseDown, eventOptions);
        overview.addEventListener('mousemove', onMove, eventOptions);
        overview.addEventListener('wheel', onWheel);
        window.addEventListener('mouseup', onUp, eventOptions);
    }

    function removeMouseEvents() {
        if (track) {
            track.removeEventListener('mousedown', onTrack);
        }
        overview.removeEventListener('mousedown', onMouseDown);
        overview.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
    }

    function addTouchEvents() {
        if (track) {
            track.addEventListener('touchstart', onTrack, eventOptions);
        }
        overview.addEventListener('touchstart', onTouchDown, eventOptions);
        overview.addEventListener('touchmove', onMove, eventOptions);
        overview.addEventListener('touchend', onUp, eventOptions);
    }

    function removeTouchEvents() {
        if (track) {
            track.removeEventListener('touchstart', onTrack);
        }
        overview.removeEventListener('touchstart', onTouchDown);
        overview.removeEventListener('touchmove', onMove);
        overview.removeEventListener('touchend', onUp);
    }

    var scrollbarPaused = false;

    function InitScrollbar() {
        Scrollbar.use(window.OverscrollPlugin);
        var scrollbar = Scrollbar.init(page, {
            plugins: {
                overscroll: {},
            },
        });

        function onChange(e) {
            // console.log('scrollbar.onChange', e.offset.y, e.limit.y, native.offsetHeight);
            var object = {
                offset: e.offset,
                limit: e.limit,
                container: {
                    width: page.offsetWidth,
                    height: page.offsetHeight,
                }
            };
            // console.log('Scrollbar.onChange', object);
            if (!isLoaded) {
                if (e.offset.y > 0) {
                    body.addClass('submenu');
                } else {
                    body.removeClass('submenu');
                }
            }
            var activeNode = scrolltos.filter(function (node, index) {
                var href = node.getAttribute('href');
                var target = document.querySelector(href);
                node.removeClass('active');
                if (target) {
                    var top = target.offsetTop - e.offset.y;
                    node.top = top;
                    /*
                    if (top < window.innerHeight) {
                        node.addClass('active');
                    } else {
                        node.removeClass('active');
                    }
                    */
                    return true;
                } else {
                    return false;
                }
            }).reduce(function (a, b) {
                if (Math.abs(b.top) < Math.abs(a.top) && b.top < 80) {
                    return b;
                } else {
                    return a;
                }
            });
            if (activeNode) {
                activeNode.addClass('active');
            }
        }
        scrollbar.addListener(onChange);
        scrollbar.onScrollbarShouldScrollTo = function (options) {
            // console.log('Scrollbar.onScrollbarShouldScrollTo', options);
            if (document.querySelector(options.selector) === page) {
                scrollbar.scrollTo(options.x || 0, options.y || 0, 500);
            }
        };
        return scrollbar;
    }

    function InitSvg() {
        var svgs = Array.prototype.slice.call(document.querySelectorAll('img.svg'));
        svgs = svgs.map(function (node) {
            var classes = node.getAttribute('class');
            var src = node.getAttribute('src');
            var req = new XMLHttpRequest();
            req.open('GET', src, true);
            req.responseType = 'text';
            req.onload = function () {
                if (this.status === 200) {
                    // Get the SVG tag, ignore the rest
                    var parentNode = node.parentNode;
                    parentNode.innerHTML = this.responseText;
                    var svg = parentNode.querySelector('svg');
                    // console.log(svg);
                    svg.setAttribute('class', classes);
                    // Remove any invalid XML tags as per http://validator.w3.org
                    svg.setAttribute('xmlns:a', null);
                    // Replace image with new SVG
                    // $img.replaceWith($svg);
                }
            };
            req.onerror = function (e) {
                console.log('svg.error', e);
            };
            req.send();
        });
    }

    function InitLoading() {
        var loading = document.querySelector('.switch-loading');
        if (loading) {
            var letters = loading.innerHTML;
            loading.innerHTML = '<span>' + letters.split('').join('</span><span>') + '</span>';
        }
    }

    function InitScrollTo() {
        scrolltos.filter(function (node, index) {
            node.addEventListener('click', function (e) {
                //
                var toggle = document.querySelector('.btn-toggle');
                toggle.active = false;
                body.removeClass('submenu-active');
                toggle.removeClass('active');
                //                
                var href = node.getAttribute('href');
                var target = document.querySelector(href);
                if (target) {
                    var top = target.offsetTop;
                    scrollbar.scrollTo(0, top, 600, {
                        callback: function () {
                            // console.log('ScrollTo.complete', top);
                        },
                        // easing: easing.easeOutBack,
                    });
                }
                e.preventDefault();
                e.stopImmediatePropagation();
                return false;
            });
        });
    }

    function InitSwitch() {
        var switcher = document.querySelector('.overview-switch');
        var slider = document.querySelector('.switch-slider');
        var discOverview = document.querySelector('.overview-disc');
        var rimOverview = document.querySelector('.overview-rim');
        var discCover = discOverview.querySelector('.cover');
        var rimCover = rimOverview.querySelector('.cover');
        var width = slider.offsetWidth;

        var pow = {
                x: 0,
                y: 0
            },
            start = {
                x: 0,
                y: 0
            },
            direction = 0,
            down, move;

        var x2 = 50;

        function getPolygons(v) {
            v = (v / 2) + 0.5;
            v = Math.min(1, Math.max(0, v));
            var x1 = v * 100;
            if (Math.abs(x1 - x2) < 0.1) {
                x2 = x1;
            } else {
                x2 += (x1 - x2) / 20;
            }
            return {
                rim: 'polygon(' + x1 + '% 0, 100% 0, 100% 100%, ' + x2 + '% 100%)',
                disc: 'polygon(0 0, ' + x1 + 0.01 + '% 0, ' + x2 + 0.01 + '% 100%, 0 100%)'
            };
        }

        function onUpdate() {
            slider.setAttribute('style', 'transform: translateX(' + (pow.x * width / 2) + 'px)');
            // if (!isLoaded) {
            var polygons = getPolygons(pow.x);
            discOverview.setAttribute('style', 'shape-inside: ' + polygons.disc + '; clip-path: ' + polygons.disc + '; -webkit-clip-path: ' + polygons.disc + ';');
            rimOverview.setAttribute('style', 'shape-inside: ' + polygons.rim + '; clip-path: ' + polygons.rim + '; -webkit-clip-path: ' + polygons.rim + ';');
            var s1 = 1.1 - (pow.x + 1) / 2 * 0.1;
            var s2 = 1 + (pow.x + 1) / 2 * 0.1;
            var b1 = 20 * (pow.x < 0 ? Math.abs(pow.x) : 0) + 'px';
            var b2 = 20 * (pow.x > 0 ? Math.abs(pow.x) : 0) + 'px';
            discCover.setAttribute('style', 'transform: scale(' + s1 + '); filter: blur(' + b1 + ');');
            rimCover.setAttribute('style', 'transform: scale(' + s2 + '); filter: blur(' + b2 + ');');
            // }
        }

        function animate() {
            onUpdate();
            requestAnimationFrame(animate);
        }
        animate();
        window.addEventListener('mousemove', onMove);

        function onDown(e) {
            if (!isLoading) {
                isSwitching = true;
                start.x = pow.x;
                start.y = pow.y;
                down = getMouse(e);
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                return false;
            }
        }

        function onMove(e) {
            if (down) {
                move = getMouse(e);
                var end = start.x + (move.x - down.x) / (width / 2);
                end = Math.max(-1, Math.min(1, end));
                direction = end > pow.x ? 1 : -1;
                pow.x = end;
                onUpdate();
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                return false;
            }
        }

        var positions = [-1, 0, 1];

        function onUp(e) {
            if (move) {
                move = null;
                down = null;
                var end = positions.reduce(function (a, b) {
                    if (Math.abs(a - pow.x) < Math.abs(b - pow.x)) {
                        return a;
                    } else {
                        return b;
                    }
                });
                var shouldLoad = false;
                if (end !== 0 && positions.length === 3) {
                    positions = [-1, 1];
                    shouldLoad = true;
                }
                if (positions.length == 2) {
                    target = end === -1 ? rim : disc;
                }
                direction = end > pow.x ? 1 : -1;
                TweenLite.to(pow, 1, {
                    x: end,
                    ease: Elastic.easeOut,
                    onUpdate: onUpdate,
                    onComplete: function () {
                        if (shouldLoad) {
                            StartLoading();
                        }
                    },
                });
            }
            isSwitching = false;
            removeListeners();
        }

        function onResize() {
            width = slider.offsetWidth;
            onUpdate();
        }

        function onMouseDown(e) {
            onDown(e);
            addMouseListeners();
        }

        function onTouchDown(e) {
            onDown(e);
            addTouchListeners();
        }

        function addMouseListeners() {
            window.addEventListener('mousemove', onMove);
            window.addEventListener('mouseup', onUp);
        }

        function addTouchListeners() {
            window.addEventListener('touchmove', onMove);
            window.addEventListener('touchend', onUp);
        }

        function removeListeners() {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
            window.removeEventListener('touchmove', onMove);
            window.removeEventListener('touchend', onUp);
        }

        switcher.addEventListener('mousedown', onMouseDown);
        switcher.addEventListener('touchstart', onTouchDown);
        window.addEventListener('resize', onResize);

        var tapped = false;
        var buttons = Array.prototype.slice.call(document.querySelectorAll('.btn-overview'));
        buttons.filter(function (btn, index) {
            var previousTarget = null;

            function onOver(e) {
                if (!isLoading && !isLoaded && !tapped) {
                    previousTarget = target;
                    target = index === 1 ? disc : rim;
                    direction = index === 1 ? 1 : -1;
                    TweenLite.to(pow, 1, {
                        x: direction * 0.2,
                        ease: Elastic.easeOut,
                        onUpdate: onUpdate,
                        onComplete: function () {},
                    });
                }
            }

            function onOut(e) {
                if (!isLoading && !isLoaded && !tapped) {
                    target = previousTarget;
                    direction = 0;
                    TweenLite.to(pow, 1, {
                        x: direction,
                        ease: Elastic.easeOut,
                        onUpdate: onUpdate,
                        onComplete: function () {},
                    });
                }
            }

            function onDown(e) {
                if (!isLoading) {
                    tapped = true;
                    direction = index === 1 ? 1 : -1;
                    target = index === 1 ? disc : rim;
                    previousTarget = target;
                    positions = [-1, 1];
                    TweenLite.to(pow, 1, {
                        x: direction,
                        ease: Elastic.easeOut,
                        onUpdate: onUpdate,
                        onComplete: function () {
                            if (!isLoaded) {
                                StartLoading();
                            }
                        },
                    });
                }
                e.preventDefault();
                e.stopImmediatePropagation();
                return false;
            }

            function onMouseDown(e) {
                btn.removeEventListener('touchstart', onTouchDown);
                return onDown(e);
            }

            function onTouchDown(e) {
                btn.removeEventListener('mousedown', onMouseDown);
                return onDown(e);
            }
            btn.addEventListener('mouseover', onOver);
            btn.addEventListener('mouseout', onOut);
            btn.addEventListener('mousedown', onMouseDown);
            btn.addEventListener('touchstart', onTouchDown);
        });
    }

    function InitSwiper() {
        var swiper = new Swiper('.swiper-container', {
            direction: 'horizontal',
            loop: false,
            pagination: {
                el: '.swiper-pagination',
            },
            navigation: {
                nextEl: '.swiper-button-next',
                prevEl: '.swiper-button-prev',
            },
        });
        swiper.on('slideChange', function (e) {
            // console.log('slide changed', swiper.activeIndex);
            var buttons = Array.prototype.slice.call(document.querySelectorAll('.btn-spec'));
            buttons.filter(function (button, index) {
                if (index === swiper.activeIndex) {
                    button.addClass('active');
                } else {
                    button.removeClass('active');
                }
            });
        });
        var buttons = Array.prototype.slice.call(document.querySelectorAll('.btn-spec'));
        buttons.filter(function (button, index) {
            function onClick() {
                swiper.slideTo(index);
            }
            button.addEventListener('click', onClick);
        });
    }

    function InitMenu() {
        var toggle = document.querySelector('.btn-toggle');

        function onDown(e) {
            toggle.active = !toggle.active;
            if (toggle.active) {
                body.addClass('submenu-active');
                toggle.addClass('active');
            } else {
                body.removeClass('submenu-active');
                toggle.removeClass('active');
            }
            e.preventDefault();
            e.stopImmediatePropagation();
            return false;
        }

        function onMouseDown(e) {
            toggle.removeEventListener('touchstart', onTouchDown);
            return onDown(e);
        }

        function onTouchDown(e) {
            toggle.removeEventListener('mousedown', onMouseDown);
            return onDown(e);
        }
        toggle.addEventListener('mousedown', onMouseDown);
        toggle.addEventListener('touchstart', onTouchDown);
    }

    InitSvg();
    InitLoading();
    InitScrollTo();
    InitSwitch();
    InitSwiper();
    InitMenu();

    /*
    function OverviewLogo() {
        var logo = document.querySelector('.overview-logo');

        var mouse = {
            x: 0,
            y: 0
        };

        function onMove(e) {
            mouse.x = (e.clientX / window.innerWidth) - 0.5;
            mouse.y = (e.clientY / window.innerHeight) - 0.5;
        }

        function animate() {
            logo.setAttribute('style', 'transform: rotateX(' + mouse.y * 4 + 'deg) rotateY(' + mouse.x * 20 + 'deg);');
            requestAnimationFrame(animate);
        }
        animate();
        window.addEventListener('mousemove', onMove);
    }
    OverviewLogo();
    */

}());