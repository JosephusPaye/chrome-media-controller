# Chrome Media Controller

An extension and CLI tool that enables you to control media playback in Chrome from the command-line.

This project is part of [#CreateWeekly](https://twitter.com/JosephusPaye/status/1214853295023411200), my attempt to create something new publicly every week in 2020.

## Features

- List current media playback sessions in Chrome
- Play, pause, seek backward, seek forward, seek to a specific time, skip to previous track, skip to next track, skip ad, and stop media sessions
- Dump the list of current media sessions in JSON format for programmatic use

With the above, you can do things like setup global hotkeys to control media playback on various sites in Chrome.

## Installation

- Run `npm install -g chrome-media-controller` to install the CLI
- Download a zip of the latest version of the extension from [the releases page](https://github.com/JosephusPaye/chrome-media-controller/releases)
- Extract the zip to a location of your choosing
- Open Chrome and navigate to `chrome://extensions/`
- Enable developer mode using the toggle at the top right of the page
- Click "**Load unpacked**" and select the extracted zip folder of the extension
- The extension will be installed and enabled on YouTube and YouTube Music by default. You can enable other sites using the instructions below.
- Copy the exension ID, go to a command line, and run `cmc extension [ID]`, replacing `[ID]` with the ID of the extension

## Enabling playback sites

To keep the number of permissions the extension requires at a minimum, it only has access to [YouTube](https://www.youtube.com) and [YouTube Music](https://music.youtube.com) (the two sites I use personally) by default. You can enable access to other sites as follows:

- Go to the site that plays the media you want to control, e.g. <https://open.spotify.com>
- Right-click the extension icon in the browser toolbar and check "**Enable Chrome Media Controller on this domain**"
- You will be prompted to allow access to the site. Click "**Allow**" and then click "**OK**" to reload the page and apply the extension. See [this screenshot](./enable-on-site.jpg) for reference.
- You can disable the extension's access to the site at anytime by right-clicking the icon in the browser toolbar and unchecking "**Enable Chrome Media Controller on this domain**"

## CLI usage

After installing the extension and enabling the site you want to control, you can use the CLI to list and control media playback in Chrome.

Run `cmc --help` for usage information:

```
Usage
  $ cmc <command> [options]

Available Commands
  ls           List current media sessions
  pause        Pause a media session
  play         Play a media session
  next         Skip to the next track in a media session
  prev         Skip to the previous track in a media session
  seek         Seek a media session to a given time
  seekb        Seek a media session backward by a given time
  seekf        Seek a media session forward by a given time
  skipad       Skip the ad in a media session
  stop         Stop a media session
  json         Dump the list of current media sessions in JSON format
  extension    Allow a Chrome extension to connect to the native host

For more info, run any command with the `--help` flag
  $ cmc ls --help
  $ cmc pause --help

Options
  -v, --version    Displays current version
  -h, --help       Displays this message
```

## How it works

Thanks to the [Media Session API](https://developer.mozilla.org/en-US/docs/Web/API/Media_Session_API), webpages can provide rich metadata and playback state to the browser to customize OS-level media notifications. They can also provide action handlers that the browser can trigger to control playback when hardware or software media keys are pressed by the user.

This API is exposed as `navigator.mediaSession`. Using a [proxy](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy), Chrome Media Controller intercepts access to this object before it gets to the browser, and extracts playback state, metadata, and action handlers.

The extracted information is communicated from the extension to a [native messaging host](https://developer.chrome.com/extensions/nativeMessaging), which makes it available to the CLI using [named pipes](https://github.com/JosephusPaye/pipe-emitter) for two-way communication.

## What's next

- Add native host installer and uninstaller for Linux and macOS
- Design an icon, publish to the Chrome Web Store
- Add Firefox compatibility
- Add additional commands: toggle, pauseall, etc
- Infer target session by defaulting to the last session interacted with, to allow running commands without specifying a session
- Add short descriptive names as aliases for session IDs (or fuzzy search of origin + title + album + author?)

## Licence

[MIT](LICENCE)
