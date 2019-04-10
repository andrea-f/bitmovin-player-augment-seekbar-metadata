


# Modify bitmovin player to handle metadata during playback in 5 steps.

The goal of this tutorial is to modify the Bitmovin player seek bar adding extra, seekable highlighted events in the content, using JS/CSS and HTML. 
There are 5 steps to follow:

1. Encode the video in DASH and HLS, create a JSON object to hold the extra metadata.

2. Load the input data and the player with config information.

3. Listen to the `Ready` event and add markers on the seek bar.

4. Listen to `TimeChanged` events and display a label with extra information if its near or on the highlighted event in the content.

5. Fire mouseover event when the label is displayed to show the control bar with the highlighted event.

The **demo** of the tutorial is at: https://s3.amazonaws.com/test-videos-samples/index.html

## Step 1
Encode the MP4 video in DASH and HLS containers, create a JSON object to hold the extra metadata.

Separate video and audio tracks to create input files for packager:

`ffmpeg -i LAZIO3roma0.mp4 -vcodec libx264 LAZIO3roma0_video.mp4 -s 1920x1080 -r 24 -g 72`

`ffmpeg -i LAZIO3roma0.mp4 -map 0:2 -c copy LAZIO3roma0_audio.mp4`


Create HLS manifest, using FFMPEG:

```
ffmpeg -i LAZIO3roma0.mp4 -profile:v baseline -level 3.0 -s 1920x1080 -start_number 0 -hls_time 10 -hls_list_size 0 -f hls index.m3u8
```


Create DASH manifest, using Shaka Packager:

```
./packager \
  in=LAZIO3roma0_audio.mp4,stream=audio,init_segment=audio.mp4 \
  in=LAZIO3roma0_video.mp4,stream=video,init_segment=video.mp4 \
  --mpd_output manifest.mpd \
```

**Or encode with Bitmovin!** Follow the interactive step-by-step encoding process here: https://bitmovin.com/dashboard/encoding/create/vod

Once the video has been encoded and packaged, serve the content locally from `localhost` or upload the content on S3 (make sure to set CORS accordingly to accept all headers otherwise for audio and video files it will result in a CORS error).
In permissions, set CORS configuration for bucket:

```
<?xml version="1.0" encoding="UTF-8"?>
<CORSConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
<CORSRule>
    <AllowedOrigin>*</AllowedOrigin>
    <AllowedMethod>GET</AllowedMethod>
    <AllowedMethod>HEAD</AllowedMethod>
    <MaxAgeSeconds>3000</MaxAgeSeconds>
    <AllowedHeader>*</AllowedHeader>
</CORSRule>
</CORSConfiguration>
```


## Step 2
Load the input data and the player with config information.

Create the input config. Define an object, in `data.json` containing  the extra metadata information and the content references, for example:

```
{
    "title": "Lazio - Roma 3-0", 
    "manifest": {
        "dash": "http://localhost:5001/derby/dash/manifest.mpd",
        "hls": "http://localhost:5001/derby/hls/index.m3u8"
    },
    "items": [
        {
            "text": "CURVA NORD (LAZIO)",
            "play_event": 16.0,
            "minute": 1
        },
        [...]
    ]
}
```

The values in the items key hold play events in seconds and will be used to create the markers on the seek bar.

In a separate file, `bitmovin_credentials.json`, place the Bitmovin API License and Analytics key credentials:

```
{
    "license_key": "<BITMOVIN API LICENSE KEY>",
    "analytics_key": "<BITMOVIN ANALYTICS API KEY>"
}
```

Reference Bitmovin player UI CSS classes (https://bitmovin.com/docs/player/articles/player-ui-css-class-reference) to handle interacting with the players' UI and adding highlighted timeline events:

```
var CSS_CLASSES = {
    MARKERS: '.bmpui-seekbar-markers',
    MARKER: 'bmpui-seekbar-marker',
    SEEKBAR_LABEL: '.bmpui-ui-seekbar-label',
    SEEKBAR_LABEL_TITLE: '.bmpui-seekbar-label-title',
    SEEKBAR_LABEL_TIME: '.bmpui-seekbar-label-time',
    CONTROLBAR: '.bmpui-ui-controlbar',
    HIDDEN: 'bmpui-hidden'
};
```

Call the main method `loadBitmovinPlayerWithConfig` with the loaded input data and Bitmovin credentials, after DOM loaded event:

```
document.addEventListener("DOMContentLoaded", function (event) {
    loadData(jsonData).then( data => {
        loadData(bitmovinCredentials).then( credentials => {
            data.bitmovin_credentials = credentials;
            loadBitmovinPlayerWithConfig(data);
        })
        [...]
```

Define the players' config and method variables:

```
var 
    [...]
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
    [...]
```

Check the browser type and select either DASH or HLS manifest:

```
if (browser === BROWSER.SAFARI) {
    media.hls = data.manifest.hls;
} else {
    media.dash = data.manifest.dash;
}
```

Instantiate the Bitmovin player with the Analytics module and load the media file:

```
var playerContainer = document.getElementById('player');
    bitmovin.player.Player.addModule(bitmovin.analytics.PlayerModule);
    player = new bitmovin.player.Player(playerContainer, config);
    player.load(media);
```

## Step 3 
Listen to `Ready` event and add markers on the seek bar.
Documentation with all Bitmovin player events: https://bitmovin.com/docs/player/api-reference/web/web-sdk-api-reference-v8#/player/web/8/docs/enums/core_events.playerevent.html

Listen to `Ready` event, fired when player and media have loaded. Attach an event handler on the event:

```
player.on(bitmovin.player.PlayerEvent.Ready, function () {
    addMarkers(data.play_events, player.getDuration());
});
```

Define markers by cycling through the play events in the `items` key in the input.
Set marker position in percentage of where the play event is with respect to the content duration:

```
function addMarkers (playEvents, contentDuration) {
    for (var i = 0; i < playEvents.length; i++) {
        var markerPosition = (playEvents[i] * 100) / contentDuration;
        addSeekbarMarkerUI(markerPosition);
    }
}
```

Add the created markers to the seek bar. Update the UI visually by getting the reference to the seek bar markers `div` identified by class `bmpui-seekbar-markers`.
Then create a new `span` element, this will be the marker and append it to the seek bar markers element:

```
function addSeekbarMarkerUI (position) {
    var 
        seekbarMarker = document.createElement('span'),
        seekbarMarkers = document.querySelector(CSS_CLASSES.MARKERS);
    seekbarMarker.className = CSS_CLASSES.MARKER;
    seekbarMarker.style.left = position + '%';
    seekbarMarker.style.borderRightColor = 'red';
    seekbarMarkers.appendChild(seekbarMarker);
}
```


## Step 4
Display a label with extra information if the current playback time is near or on the highlighted event in the content.

Listen to `TimeChanged` events and get the current playback time:

```
player.on(bitmovin.player.PlayerEvent.TimeChanged, function (event) {
    var 
        currentTime = event.time,
        labelTimeRange = 5; // in seconds
	[…]
```

Create highlighted events in seconds by looping through the `items`' `play_event` key in the input. Then, handle whether to display a label in a specific time range. Check if the current time is within `labelTimeRange` seconds either before or after the highlighted events' time.
If the current time is within the marker range, update the seek bar and pop up the control bar to show the label with the extra metadata information:

```
for (var i = 0; i < data.items.length; i++) {
    var playEvent = data.items[i].play_event;
    if (Math.abs(currentTime - playEvent) < labelTimeRange) {
        var
            seekBarLabelPosition = (playEvent * 100) / player.getDuration(),
            seekBarLabelConfig = {
                playEvent: data.items[i].minute,
                labelPosition: seekBarLabelPosition,
                text: data.items[i].text
            };
        showingLabel = true;
        updateSeekbarUI(seekBarLabelConfig);
        break;
    } else {
    [...]
});
```


Get the player UI elements and update the seek bar to show the label with the extra metadata information:

```
var
    seekbarLabel = document.querySelector(CSS_CLASSES.SEEKBAR_LABEL),
    seekbarLabelTitle = document.querySelector(CSS_CLASSES.SEEKBAR_LABEL_TITLE),
    seekbarLabelTime = document.querySelector(CSS_CLASSES.SEEKBAR_LABEL_TIME),
    seekbarControlBar = document.querySelector(CSS_CLASSES.CONTROLBAR);
```
If `seekbarLabelConfig` is defined, the seek bar UI is updated with a label:

```
var
    text = seekbarLabelConfig.text,
    seekbarLabelPosition = seekbarLabelConfig.labelPosition,
    playEvent = seekbarLabelConfig.playEvent,
    […]
seekbarLabel.style.left = seekbarLabelPosition + "%";
seekbarLabel.classList.remove(CSS_CLASSES.HIDDEN);
seekbarLabelTitle.innerHTML = text;
seekbarLabelTime.innerHTML = playEvent + "'";
```
If `seekbarLabelConfig` is not defined, the label is hidden and the text cleared:

```
seekbarLabel.className += ' ' + CSS_CLASSES.HIDDEN;
seekbarLabelTitle.innerHTML = '';
```

## Step 5
Fire mouseover event to pop up the control bar when the label is displayed with the extra information. The control bar will fade out after 5 seconds of inactivity. The events available are: https://developer.mozilla.org/en-US/docs/Web/Events

Create a new event in `updateSeekbarUI`:

```
var event = new Event('mouseenter', {
    bubbles: true,
    cancelable: true
});
```
Dispatch the event from `updateSeekbarUI` while the label is displayed: 

```
seekbarControlBar.dispatchEvent(event);
```


# Demo and code
See the code in action at: https://s3.amazonaws.com/test-videos-samples/index.html, the video used is from Lazio - Roma 3 - 0 last March.

The full code is available here: https://github.com/andrea-f/bitmovin-player-augment-seekbar-metadata

