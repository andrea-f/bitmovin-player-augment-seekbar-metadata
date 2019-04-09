/**
 * Extending the Bitmovin player UI seek bar with extra information on the video at specific times.
 */


// Input data to populate seek bar and configure player
var 
    jsonData = 'data.json',
    bitmovinCredentials = 'bitmovin_credentials.json';


// Available codec
var CODEC = {
    H264: 'H264'
};


// Define browser types
var BROWSER = {
    CHROME: 'Chrome',
    FIREFOX: 'Firefox',
    SAFARI: 'Version',
    EDGE: 'Edge',
    IE: 'Trident',
};


// Bitmovin CSS UI classes
// Docs at https://bitmovin.com/docs/player/articles/player-ui-css-class-reference
var CSS_CLASSES = {
    MARKERS: '.bmpui-seekbar-markers',
    MARKER: 'bmpui-seekbar-marker',
    SEEKBAR_LABEL: '.bmpui-ui-seekbar-label',
    SEEKBAR_LABEL_TITLE: '.bmpui-seekbar-label-title',
    SEEKBAR_LABEL_TIME: '.bmpui-seekbar-label-time',
    CONTROLBAR: '.bmpui-ui-controlbar',
    HIDDEN: 'bmpui-hidden'
};


// Make player instance global
var player = null;


/**
 * @description Sets up Bitmovin player configuration with extended seek bar.
 * @param {Object} data 
 */
function loadBitmovinPlayerWithConfig (data) {
    var 
        browserInfo = getBrowser(),
        browser = browserInfo.browser,
        version = browserInfo.version,
        // Bitmovin player config
        config = {
            key: data.bitmovin_credentials.license_key,
            analytics: {
                key: data.bitmovin_credentials.analytics_key,
                videoId: data.title
            },
            playback: {
                muted: true,
                preload: true
            }
        },
        media = {},
        selectedCodec = CODEC.H264; // Defaults to h264

    // Detect current browser and set media data.
    if (browser === BROWSER.SAFARI) {
        // Use HLS
        media.hls = data.manifest.hls;
        // Replace Version string with Safari.
        browser = 'Safari';
    } else {
        media.dash = data.manifest.dash;
    }

    // Create the Bitmovin module and instantiate it
    var playerContainer = document.getElementById('player');
    bitmovin.player.Player.addModule(bitmovin.analytics.PlayerModule);
    player = new bitmovin.player.Player(playerContainer, config);

    // Load media in the Bitmovin player 
    player.load(media);

    // Player events docs: 
    // https://bitmovin.com/docs/player/api-reference/web/web-sdk-api-reference-v8#/player/web/8/docs/enums/core_events.playerevent.html

    // When player and media have loaded, add markers on the seek bar
    player.on(bitmovin.player.PlayerEvent.Ready, function () {
        addMarkers(data.items, player.getDuration());
    });

    // Hold label state
    var showingLabel = false;
    // As playback occurs, check if the current time is in range of a label.
    player.on(bitmovin.player.PlayerEvent.TimeChanged, function (event) {
        var 
            currentTime = event.time,
            labelTimeRange = 5; // in seconds
        for (var i = 0; i < data.items.length; i++) {
            var playEvent = data.items[i].play_event;
            // If the current time is within `labelTimeRange` of a seekable event
            // show the label and update the UI before and after the play event.
            if (Math.abs(currentTime - playEvent) < labelTimeRange) {
                var
                    seekBarLabelPosition = (playEvent * 100) / player.getDuration(),
                    seekBarLabelConfig = {
                        playEvent: data.items[i].minute,
                        labelPosition: seekBarLabelPosition,
                        text: data.items[i].text
                    };
                showingLabel = true;
                // Update the seek bar ui for the whole time the play event is displayed
                // So hover event keeps firing and seek bar is shown to the user
                updateSeekbarUI(seekBarLabelConfig);
                break;
            } else {
                if (showingLabel === true) {
                    updateSeekbarUI();
                    showingLabel = false; 
                }
            }
        }
    });
    // Update the browser and media UI
    updateUI(browser + ', v' + version, selectedCodec, (media.dash !== undefined) ? media.dash : media.hls, data.title);
};


/**
 * @description Returns the current user browser and version
 */
function getBrowser () {
    var
        userAgent = navigator.userAgent,
        detectedBrowserVersion = -1,
        detectedBrowser;
    for (key in BROWSER) {
        if (userAgent.indexOf(BROWSER[key]) != -1) {
            detectedBrowser = BROWSER[key];
            try {
                // Only retrieve the first 2 version numbers if it exists from the user agent string.
                detectedBrowserVersion = parseInt(userAgent.substr(userAgent.indexOf(detectedBrowser + '/') + detectedBrowser.length + 1, 2).replace('.', ''));
            } catch (err) {
                console.log("Browser version not detected", err);
            }
            break;
        }
    }
    return {
        browser: detectedBrowser,
        version: detectedBrowserVersion
    };
}


/**
 * @description Return the JSON data with the video information.
 * @param {String} url 
 */
function loadData (url) {
    return new Promise(function (resolve, reject) {
        var xhr = new XMLHttpRequest();
        xhr.overrideMimeType("application/json");
        xhr.open('GET', url, true);
        xhr.onreadystatechange = function () {
            if (xhr.readyState == 4 && xhr.status == 200) {
                resolve(JSON.parse(xhr.responseText));
            } else if (xhr.status >= 400) {
                reject({error: "Couldn't fetch " + url + " error status: " + xhr.status});
            }
        };
        xhr.send(null);
    })
}


/**
 * @description Adds all play events from input data as seekbar markers.
 * @param {Array} items 
 * @param {Float} contentDuration 
 */
function addMarkers (items, contentDuration) {
    for (var i = 0; i < items.length; i++) {
        var markerPosition = (items[i].play_event * 100) / contentDuration;
        addSeekbarMarkerUI(markerPosition);
    }
}


/**
 * @description Adds the marker at a specific position in the seekbar UI.
 * @param {Number} position 
 */
function addSeekbarMarkerUI (position) {
    var 
        seekbarMarker = document.createElement('span'),
        seekbarMarkers = document.querySelector(CSS_CLASSES.MARKERS);
    seekbarMarker.className = CSS_CLASSES.MARKER;
    seekbarMarker.style.left = position + '%';
    seekbarMarker.style.borderRightColor = 'red';
    seekbarMarkers.appendChild(seekbarMarker);
}


/**
 * @description Updates player seek bar and seek bar label UI.
 * @param {Object} seekBarLabelConfig
 */
function updateSeekbarUI (seekbarLabelConfig) {
    // Get reference to the players' seek bar UI elements
    var
        seekbarLabel = document.querySelector(CSS_CLASSES.SEEKBAR_LABEL),
        seekbarLabelTitle = document.querySelector(CSS_CLASSES.SEEKBAR_LABEL_TITLE),
        seekbarLabelTime = document.querySelector(CSS_CLASSES.SEEKBAR_LABEL_TIME),
        seekbarControlBar = document.querySelector(CSS_CLASSES.CONTROLBAR);

    if (seekbarLabelConfig === undefined) {
        // Hide the seek bar label and empty the text in the title
        if (seekbarLabel.className.indexOf(CSS_CLASSES.HIDDEN) === -1) {
            seekbarLabel.className += ' ' + CSS_CLASSES.HIDDEN;
            seekbarLabelTitle.innerHTML = '';
        }
    } else {
        var
            text = seekbarLabelConfig.text,
            seekbarLabelPosition = seekbarLabelConfig.labelPosition,
            playEvent = seekbarLabelConfig.playEvent,
            // Create a new hover event, used to open the control bar
            // Usable events: https://developer.mozilla.org/en-US/docs/Web/Events
            event = new Event('mouseenter', {
                bubbles: true,
                cancelable: true
            });
        // Show the seek bar label and set the text in the title
        seekbarLabel.style.left = seekbarLabelPosition + "%";
        seekbarLabel.classList.remove(CSS_CLASSES.HIDDEN);
        seekbarLabelTitle.innerHTML = text;
        seekbarLabelTime.innerHTML = playEvent + "'";
        // Show the controls if they are hiding
        seekbarControlBar.dispatchEvent(event);
    }
}


/**
 * @description Updates UI elements after information have been retrieved.
 * @param {String} browser 
 * @param {String} codec 
 * @param {String} media 
 * @param {String} title
 */
function updateUI (browser, codec, media, title) {
    document.getElementById('codec').innerHTML = codec;
    document.getElementById('browser').innerHTML = browser;
    document.getElementById('media').innerHTML = media;
    document.getElementById('title').innerHTML = title;
}


// Run when DOM is ready
document.addEventListener("DOMContentLoaded", function (event) {
    // Load the input data
    loadData(jsonData).then( data => {
        // Then the players' config credentials
        loadData(bitmovinCredentials).then( credentials => {
            data.bitmovin_credentials = credentials;
            // Then the player with the extended metadata in the seek bar
            loadBitmovinPlayerWithConfig(data);
        }).catch(err => {
            console.log('ERROR:', err.error)
        })
    }).catch( err => {
        console.log('ERROR:', err.error)
    })
});