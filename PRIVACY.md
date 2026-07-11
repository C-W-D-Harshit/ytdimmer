# Privacy

YT Dimmer analyzes downscaled video frames locally inside the active webpage.
It does not transmit video frames, page content, browsing history, settings, or
usage information to the developer or any third party.

## Stored data

The extension stores only:

- protection preferences and per-site pause choices in browser sync storage;
- the number of protection activations for the current local day in browser
  local storage.

The activity count contains no URLs, video titles, timestamps, or frame data.
It can be removed by clearing extension data or uninstalling the extension.

## Permissions

- `storage` saves settings and the local daily count.
- `activeTab` lets the popup show and control the current site's protection
  status after the user opens the extension.
- Site access is needed for the content script to find and soften HTML videos.

## Network access

The extension makes no application network requests. Links to the source
repository open only when selected by the user.

## Important limitation

YT Dimmer is a viewing-comfort utility, not a medical device. It cannot
guarantee that every flash will be detected or made safe.
