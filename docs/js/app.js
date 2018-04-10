/* global window, document, console  */

(function () {
    'use strict';

    Element.prototype.hasClass = function (name) {
        return new RegExp("(?:^|\\s+)" + name + "(?:\\s+|$)").test(this.className);
    };

    Element.prototype.addClass = function (name) {
        if (!this.hasClass(name)) {
            this.className = this.className ? (this.className + ' ' + name) : name;
        }
    };

    Element.prototype.removeClass = function (name) {
        if (this.hasClass(name)) {
            this.className = this.className.split(name).join('').replace(/\s\s+/g, ' '); // .replace(new RegExp('(?:^|\\s+)' + name + '(?:\\s+|$)', 'g'), '');
        }
    };

    Element.prototype.isDescendant = function (target) {
        function isDescendant(node, target) {
            if (node === target) {
                return true;
            } else if (node.parentNode) {
                return isDescendant(node.parentNode, target);
            } else {
                return false;
            }
        }
        return isDescendant(this, target);
    };

    window.getMouse = function (e) {
        var y = 0.0;
        if (e.touches) {
            y = e.touches[0].pageY;
        } else {
            y = e.clientY;
        }
        var x = 0.0;
        if (e.touches) {
            x = e.touches[0].pageX;
        } else {
            x = e.clientX;
        }
        var mouse = {
            x: x,
            y: y
        };
        // console.log('getMouse', mouse);
        return mouse;
    };

}());
/* global window, document, console, TweenLite */

(function () {
    'use strict';

    var iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    var formMultiple = document.querySelector('.form-group-multiple');

    function onMultiple() {
        formMultiple.addClass('active');
    }

    function onDown(e) {
        if (!e.target.isDescendant(formMultiple)) {
            formMultiple.removeClass('active');
        }
    }
    formMultiple.addEventListener('mousedown', onMultiple);
    formMultiple.addEventListener('touchstart', onMultiple);
    window.addEventListener('mousedown', onDown);
    window.addEventListener('touchstart', onDown);

    var navContainer = document.querySelector('.nav-container');
    Scrollbar.use(window.OverscrollPlugin);
    Scrollbar.init(navContainer, {
        plugins: {
            overscroll: {},
        },
    });

    var options = Array.prototype.slice.call(document.querySelectorAll('.nav-multiple li'));

    function setValue() {
        var brands = options.filter(function (item) {
            return item.active;
        }).map(function (item) {
            return item.querySelector('span').innerHTML;
        });
        var input = document.querySelector('input[name="Brands"]');
        input.value = brands.length > 0 ? brands.join(', ') : null;
        console.log('setValue', brands, input.value);
        // console.log('setValue', input.value, input);
    }

    options.filter(function (option, index) {
        function onToggle(e) {
            option.active = !option.active;
            if (option.active) {
                option.addClass('active');
            } else {
                option.removeClass('active');
            }
            setValue();
        }

        function onMouseToggle(e) {
            option.removeEventListener('touchstart', onTouchToggle);
            onToggle(e);
        }

        function onTouchToggle(e) {
            option.removeEventListener('mousedown', onMouseToggle);
            onToggle(e);
        }
        option.addEventListener('mousedown', onMouseToggle);
        option.addEventListener('touchstart', onTouchToggle);
    });

}());
/* global window, document, console, TweenLite */

(function () {
    'use strict';

    var isTouch = false;
    var isAndroid = navigator.userAgent.toLowerCase().indexOf("android") > -1;
    var isMac = navigator.platform.toLowerCase().indexOf('mac') !== -1;
    var iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    var isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
    var isFirefox = /Firefox/.test(navigator.userAgent);
    var isClippable = detectClippath();

    var useImages = isAndroid;

    var fps, totalFrames, duration;

    var currentTime = 0.0;
    var pageOffset = 0.0;
    var currentMarker = 0.0;
    var concurrent = 15;

    var speed, mouseDownY;
    var scrolling = {
        pow: 0,
        end: 0,
        previous: 0,
        direction: 0,
        diff: 0,
        index: 0,
    };

    var eventOptions = window.PointerEvent ? {
        passive: false,
        capture: false,
    } : undefined;

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
                scrolling.pow = scrolling.end - 1;
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
            isTouch = true;
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
    var codecs = {
        webm: 'video/webm; codecs="vp8"',
        mp4: 'video/mp4; codecs="avc1.4d001e"',
    }
    fps = window.options.fps;
    totalFrames = window.options.frames;
    duration = totalFrames / fps;
    if (useImages) {
        fps = 10;
        totalFrames = 502;
    }
    var targetItem = null;

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
        var total = totalFrames * 2;
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
            var num = frame,
                framenum = frame;
            var imageTarget = disc;
            if (framenum > totalFrames) {
                imageTarget = rim;
                framenum = framenum - totalFrames;
                num = framenum;
            }
            if (framenum < 10) {
                num = '00' + framenum;
            } else if (framenum < 100) {
                num = '0' + framenum;
            }
            req.open('GET', imageTarget.source.jpg.split('{0}').join(num), true);
            req.responseType = 'blob';
            req.onload = function () {
                if (this.status === 200) {
                    var blob = this.response;
                    var image = URL.createObjectURL(blob); // IE10+
                    imageTarget.images[framenum] = image;
                    loaded++;
                    requests.shift();
                    setProgress(loaded, total);
                    if (loaded === total) {
                        targetItem.player.setTime();
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
        if (isAndroid) {
            Init();
        } else {
            var promise = targetItem.video.play();
            if (promise !== undefined) {
                promise.then(function () {
                    Init();
                }).catch(function (e) {
                    console.log('video.error', e, targetItem.video.error);
                });
            } else {
                Init();
            }
        }
    }

    function getMediaSource(data, target, type, supported) {
        console.log('getMediaSource', supported, type);
        var source = null;
        if (supported) {
            target.mediaSource = new MediaSource();
            target.mediaSource.addEventListener('sourceopen', function () {
                console.log('mediaSource.sourceopen');
                target.sourceBuffer = target.mediaSource.addSourceBuffer(codecs[type]);
                target.sourceBuffer.addEventListener('updateend', function () {
                    console.log('sourceBuffer.updateend');
                }, false);
                console.log('sourceBuffer.updating', target.sourceBuffer.updating);
                var array = new Uint8Array(data);
                if (!target.sourceBuffer.updating) {
                    target.sourceBuffer.appendBuffer(array);
                    console.log('sourceBuffer.appendBuffer');
                }
            }, false);
            source = URL.createObjectURL(target.mediaSource);
        } else {
            source = URL.createObjectURL(data);
        }
        return source;
    }

    function PreloadVideoTarget(target, callback) {
        var type = (isChrome || isFirefox) && !isMac ? 'webm' : 'mp4';
        var supported = 'MediaSource' in window;
        if (supported) {
            if (MediaSource.isTypeSupported(codecs.webm) && type !== 'webm') {
                type = 'webm';
            } else if (MediaSource.isTypeSupported(codecs.mp4) && type !== 'mp4') {
                type = 'mp4';
            }
        }

        function doSource(source) {
            /*
            target.video.addEventListener('progress', function (e) {
                // console.log('video.progress', e, target.video.duration);
            }, false);
            */
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
        var req = new XMLHttpRequest();
        req.open('GET', type === 'webm' ? target.source.webm : target.source.mp4, true);
        req.responseType = supported ? 'arraybuffer' : 'blob';
        req.onprogress = function (e) {
            setProgress(e.loaded, e.total);
        };
        req.onload = function () {
            if (this.status === 200) {
                // var source = URL.createObjectURL(this.response); // IE10+
                var source = getMediaSource(this.response, target, type, supported);
                doSource(source);
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
        rim.video.pause();
        disc.video.pause();
        if (steps) {
            addSteps();
        }
        setIndex(1);
        onDidScroll(getOffsetY());
    }

    function setCaptionItems(direction) {
        targetItem.captionItems.filter(function (caption, index) {
            var distance = markers[index] - scrolling.pow;
            if (Math.abs(distance) > 2) {
                caption.setAttribute('class', 'captions-item');
            } else if (direction > 0) {
                // console.log(distance, index);
                caption.setAttribute('class', 'captions-item ' + (distance > -0.1 ? 'entering' : 'exiting'));
            } else if (direction < 0) {
                // console.log(distance, index);
                caption.setAttribute('class', 'captions-item ' + (distance < 0.1 ? 'entering' : 'exiting'));
            }
        });
    }

    function onPause(target) {
        if (target.player && target.player.duration && !target.player.paused) {
            target.player.pause();
        }
    }

    function onLoop(target) {
        if (target.player && target.player.duration) {
            if (mouseMove) {
                onPause(target);
                scrolling.pow = scrolling.end;
                target.player.currentTime = scrolling.pow;
                target.player.setTime();
            } else {
                if (scrolling.end !== scrolling.pow) {
                    onPause(target);
                    var diff = scrolling.end - scrolling.pow;
                    var step = 1.0 / fps;
                    if (Math.abs(diff) < step) {
                        scrolling.pow = scrolling.end;
                    } else {
                        var direction = diff ? diff / Math.abs(diff) : 0;
                        scrolling.pow += step * direction;
                    }
                    var currentTime = Math.round(scrolling.pow / step) * step + 0.00001;
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
            if (marker <= pow) {
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
        if (node && targetItem.player.duration) {
            var i = 0,
                fpow = 0,
                tpow = 0;
            markers.filter(function (marker, index) {
                if (marker <= pow) {
                    i = index;
                }
            });
            fpow = markers[i];
            tpow = i < markers.length - 1 ? markers[i + 1] : fpow;
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
        now = timeapi.now();
        elapsed = now - then;
        if (elapsed > fpsInterval) {
            then = now - (elapsed % fpsInterval);
            if (targetItem) {
                // onLoop(targetItem);
                // onPause(targetItem === disc ? rim : disc);
                onLoop(disc);
                onLoop(rim);
            }
            if (iOS || isAndroid) {
                overview.setAttribute('style', 'width: ' + (window.innerWidth) + 'px; height: ' + (window.innerHeight - 57) + 'px;');
            }
        }
        requestAnimationFrame(animate);
    }

    function onTrack(e) {
        if (isLoaded && !isSwitching) {
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

    function getOffsetY() {
        if (scrollbar) {
            return scrollbar.offset.y;
        } else {
            return window.pageYOffset;
        }
    }

    function shouldLockScroll(direction) {
        var offsetY = getOffsetY();
        var flag = (scrolling.pow < targetItem.player.duration && direction === 1) || (offsetY < 10 && direction === -1);
        if (flag) {
            body.addClass('locked');
        } else {
            body.removeClass('locked');
        }
        // console.log('shouldLockScroll', offsetY, direction);
        return flag;
    }

    var mouseMove = false,
        previousY,
        scrubStart = 0.0;

    function onDown(e) {
        if (getOffsetY() < 10) {
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
            var direction = 0;
            if (isLoaded) {
                var y = getY(e);
                // console.log('onMove', y);
                previousY = y;
                if (Math.abs(mouseDownY - y) > 1) {
                    var min = 0,
                        max = 1,
                        pow = (mouseDownY - y) / (window.innerHeight * 3) * targetItem.player.duration;
                    scrolling.end = Math.max(0, Math.min(targetItem.player.duration, scrubStart + pow));
                    // console.log('onMove', scrubStart, pow);
                    mouseMove = true;
                }
                direction = y - mouseDownY > 0 ? -1 : 1;
            }
            if (!isLoaded || shouldLockScroll(direction)) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                return false;
            }
        }
    }

    function onUp(e) {
        if (mouseMove && isLoaded) {
            var y = previousY;
            // console.log('onUp', y);
            var diff = (mouseDownY - y);
            // console.log(y, mouseDownY, diff);
            if (diff) {
                var direction = diff / Math.abs(diff);
                var time = scrolling.end;
                markers.filter(function (item, index) {
                    if (time > item && time < markers[index + 1]) {
                        scrolling.index = index + (direction > 0 ? 0 : 1);
                        // console.log('scrolling.index', scrolling.index);
                    }
                });
                setNearestDirection(direction);
            }
        }
        mouseMove = false;
        mouseDownY = null;
    }

    function onWheel(e) {
        var wheelDirection = e.deltaY / Math.abs(e.deltaY);
        if (isLoaded) {
            setNearestDirection(wheelDirection);
        }
        if (!isLoaded || shouldLockScroll(wheelDirection)) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            // console.log('onWheel', e);
            return false;
        }
    }

    function setIndex(index, skip) {
        if (index !== scrolling.index) {
            var direction = (index - scrolling.index) / Math.abs(index - scrolling.index);
            var previousMarker = markers[scrolling.index];
            var nextMarker = markers[index];
            var currentTime = scrolling.pow;
            if (skip || currentTime >= Math.min(previousMarker, nextMarker) && currentTime <= Math.max(previousMarker, nextMarker)) {
                scrolling.index = index;
                scrolling.direction = direction;
                scrolling.end = markers[scrolling.index];
                setTop(markerTime, scrolling.end);
            }
            // console.log('setIndex', previousMarker, nextMarker, currentTime);
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

    function getNearestMarker(time) {
        var marker = markers.reduce(function (prev, curr) {
            return (Math.abs(curr - time) < Math.abs(prev - time) ? curr : prev);
        });
        return marker;
    }

    function getMarker(forward) {
        var marker = null;
        if (Math.abs(currentMarker - targetItem.player.currentTime) < 1.0) {
            markers.filter(function (item) {
                if (marker === null && (item > currentMarker || !forward)) {
                    marker = item;
                }
            });
        } else {
            marker = currentMarker;
        }
        // console.log(currentMarker, targetItem.player.currentTime);
        return marker;
    }

    function onMouseDown(e) {
        removeTouchEvents();
        onDown(e);
    }

    function onTouchDown(e) {
        isTouch = true;
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

    function onDidScroll(top) {
        if (isLoaded) {
            var activeNode = scrolltos.filter(function (node, index) {
                var href = node.getAttribute('href');
                var target = document.querySelector(href);
                node.removeClass('active');
                if (target && target.style.display !== 'none') {
                    var y = target.offsetTop - top;
                    node.top = y;
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
    }

    function onScroll(e) {
        onDidScroll(getOffsetY());
    }

    function detectClippath() {
        var test = {
            props: ['clip-path', '-webkit-clip-path', 'shape-inside'],
            value: 'polygon(50% 0%, 0% 100%, 100% 100%)'
        };
        if ('CSS' in window && 'supports' in window.CSS) {
            for (var i = 0; i < test.props.length; i++) {
                if (window.CSS.supports(test.props[i], test.value)) {
                    return true;
                }
            }
            return false;
        }
    }

    function InitScrollbar() {
        var enabled = !iOS && !isAndroid;

        function onChange(e) {
            var object = {
                offset: e.offset,
                limit: e.limit,
                container: {
                    width: page.offsetWidth,
                    height: page.offsetHeight,
                }
            };
            onDidScroll(getOffsetY());
        }
        if (enabled) {
            Scrollbar.use(window.OverscrollPlugin);
            var scrollbar = Scrollbar.init(page, {
                plugins: {
                    overscroll: {},
                },
            });

            scrollbar.addListener(onChange);
            return scrollbar;
        } else {
            window.onscroll = onScroll;
            return false;
        }
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

    function InitSwitcher() {
        var overview = document.querySelector('.section-overview');
        var switcher = document.querySelector('.overview-switch');
        var slider = document.querySelector('.switch-slider');
        var discOverview = document.querySelector('.overview-disc');
        var rimOverview = document.querySelector('.overview-rim');
        var discCover = discOverview.querySelector('.cover');
        var rimCover = rimOverview.querySelector('.cover');
        var discCoverImg = discCover.querySelector('img');
        var rimCoverImg = rimCover.querySelector('img');
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
            if (isTouch || !isClippable) {
                var v = (pow.x / 2) + 0.5;
                v = Math.min(1, Math.max(0, v));
                discOverview.setAttribute('style', 'opacity:' + v + ';');
                rimOverview.setAttribute('style', 'opacity:' + (1 - v) + ';');
            } else {
                var polygons = getPolygons(pow.x);
                discOverview.setAttribute('style', 'shape-inside: ' + polygons.disc + '; clip-path: ' + polygons.disc + '; -webkit-clip-path: ' + polygons.disc + ';');
                rimOverview.setAttribute('style', 'shape-inside: ' + polygons.rim + '; clip-path: ' + polygons.rim + '; -webkit-clip-path: ' + polygons.rim + ';');
                var s1 = 1.1 - (pow.x + 1) / 2 * 0.1;
                var s2 = 1 + (pow.x + 1) / 2 * 0.1;
                var b1 = 20 * (pow.x < 0 ? Math.abs(pow.x) : 0) + 'px';
                var b2 = 20 * (pow.x > 0 ? Math.abs(pow.x) : 0) + 'px';
                var o1 = (pow.x < 0 ? Math.abs(pow.x) : 1);
                var o2 = (pow.x > 0 ? Math.abs(pow.x) : 1);
                // discCover.setAttribute('style', 'transform: scale(' + s1 + '); filter: blur(' + b1 + ');');
                // rimCover.setAttribute('style', 'transform: scale(' + s2 + '); filter: blur(' + b2 + ');');
                // discCover.setAttribute('style', 'transform: scale(' + s1 + '); opacity: ' + o1 + ';');
                // rimCover.setAttribute('style', 'transform: scale(' + s2 + '); opacity: ' + o2 + ';');
                discCover.setAttribute('style', 'transform: scale(' + s1 + ');');
                rimCover.setAttribute('style', 'transform: scale(' + s2 + ');');
            }
        }

        function animate() {
            onUpdate();
            requestAnimationFrame(animate);
        }

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
                    targetItem = end === -1 ? rim : disc;
                }
                direction = end > pow.x ? 1 : -1;
                TweenLite.to(pow, 0.5, {
                    x: end,
                    ease: Power2.easeOut, // Elastic.easeOut,
                    onUpdate: onUpdate,
                    onComplete: function () {
                        if (shouldLoad) {
                            StartLoading();
                        }
                        isSwitching = false;
                    },
                });
            } else {
                isSwitching = false;
            }
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
            isTouch = true;
            onDown(e);
            addTouchListeners();
        }

        function addMouseListeners() {
            overview.addEventListener('mousemove', onMove, eventOptions);
            window.addEventListener('mouseup', onUp, eventOptions);
        }

        function addTouchListeners() {
            overview.addEventListener('touchmove', onMove, eventOptions);
            window.addEventListener('touchend', onUp, eventOptions);
        }

        function removeListeners() {
            overview.removeEventListener('mousemove', onMove);
            overview.removeEventListener('touchmove', onMove);
            window.removeEventListener('mouseup', onUp);
            window.removeEventListener('touchend', onUp);
        }

        var previousTarget = null;
        var previousDirection = 0;
        var tapped = false;
        var buttons = Array.prototype.slice.call(document.querySelectorAll('.btn-overview'));
        buttons.filter(function (btn, index) {
            function onDown(e) {
                if (!isLoading) {
                    tapped = true;
                    direction = index === 1 ? 1 : -1;
                    targetItem = index === 1 ? disc : rim;
                    previousTarget = targetItem;
                    positions = [-1, 1];
                    TweenLite.to(pow, 0.5, {
                        x: direction,
                        ease: Power2.easeOut, // Elastic.easeOut,
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
                isTouch = true;
                btn.removeEventListener('mousedown', onMouseDown);
                return onDown(e);
            }
            btn.addEventListener('mousedown', onMouseDown, eventOptions);
            btn.addEventListener('touchstart', onTouchDown, eventOptions);
        });

        function onHovering(e) {
            if (!isSwitching) {
                if (!isLoading && !isLoaded && !tapped) {
                    var left = buttons[0].getBoundingClientRect();
                    var right = buttons[1].getBoundingClientRect();
                    var direction = 0;
                    if (e.clientX > right.left) {
                        direction = 1;
                    } else if (e.clientX < left.right) {
                        direction = -1;
                    }
                    if (previousDirection !== direction) {
                        previousDirection = direction;
                        previousTarget = targetItem;
                        targetItem = direction === 1 ? disc : rim;
                        TweenLite.to(pow, 0.5, {
                            x: direction * 0.2,
                            ease: Power2.easeOut, // Elastic.easeOut,
                            onUpdate: onUpdate,
                            onComplete: function () {},
                        });
                    }
                } else {
                    overview.removeEventListener('mousemove', onHovering);
                }
            }
            // console.log('onHovering', previousDirection);
        }

        function onHoveringDown(e) {
            if (!isSwitching && !isLoading && !isLoaded && !tapped && previousDirection !== 0) {
                tapped = true;
                direction = previousDirection;
                targetItem = previousDirection === 1 ? disc : rim;
                previousTarget = targetItem;
                positions = [-1, 1];
                TweenLite.to(pow, 0.5, {
                    x: direction,
                    ease: Power2.easeOut, // Elastic.easeOut,
                    onUpdate: onUpdate,
                    onComplete: function () {
                        if (!isLoaded) {
                            previousDirection = 0;
                            StartLoading();
                        }
                    },
                });
            }
            overview.removeEventListener('touchstart', onHoveringTouchDown);
            overview.removeEventListener('mousedown', onHoveringMouseDown);
        }

        function onHoveringMouseDown(e) {
            overview.removeEventListener('touchstart', onHoveringTouchDown);
            return onHoveringDown(e);
        }

        function onHoveringTouchDown(e) {
            isTouch = true;
            overview.removeEventListener('mousedown', onHoveringMouseDown);
            return onHoveringDown(e);
        }

        animate();
        switcher.addEventListener('mousedown', onMouseDown, eventOptions);
        switcher.addEventListener('touchstart', onTouchDown, eventOptions);
        overview.addEventListener('mousemove', onMove);
        overview.addEventListener('mousemove', onHovering);
        overview.addEventListener('mousedown', onHoveringMouseDown);
        overview.addEventListener('touchstart', onHoveringTouchDown);
        window.addEventListener('resize', onResize);
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
            isTouch = true;
            toggle.removeEventListener('mousedown', onMouseDown);
            return onDown(e);
        }
        toggle.addEventListener('mousedown', onMouseDown);
        toggle.addEventListener('touchstart', onTouchDown);
    }

    function InitHandlers() {
        function onTestTouch(e) {
            isTouch = true;
            window.removeEventListener('touchstart', onTestTouch);
        }
        window.addEventListener('touchstart', onTestTouch);
        window.requestAnimationFrame(animate);
        addMouseEvents();
        addTouchEvents();
    }

    InitSvg();
    InitLoading();
    InitScrollTo();
    InitSwitcher();
    InitSwiper();
    InitMenu();
    InitHandlers();

}());