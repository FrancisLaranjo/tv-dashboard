# tv-dashboard

An ambient home screen for a 2018 Samsung TV (Tizen 4): rotating landscape photos, a clock, weather for Figueira da Foz, app tiles and TV input tiles. The text on screen is in European Portuguese.

## How it updates

The app installed on the TV is a small shell (`index.html`, `shell.js`) plus a bundled copy of the UI. The shell fetches the UI (`ui/`) from this repository at the newest commit on `main`, stores it, and reloads when the screen is idle. Pushing to `main` therefore updates the TV within about 10 minutes, or as soon as the dashboard comes back to the front.

A downloaded UI that fails to start is discarded, and the bundled copy runs instead.

Reinstalling is only needed when `config.xml`, `shell.js`, `index.html`, `icon.png` or `service/` change.

## Files

- `ui/body.html`, `ui/style.css` and `ui/app.js` hold the dashboard itself, and are what the TV downloads.
- `shell.js` loads the UI and checks for updates.
- `service/service.js` reopens the dashboard when the TV starts or wakes from standby.
- `config.xml` is the Tizen widget manifest.

The UI targets the Tizen 4 web engine (Chromium 56), so it uses no CSS grid, no flex `gap` and no syntax newer than ES2017.

## Credits

Photos are from Unsplash, served by [picsum.photos](https://picsum.photos). Weather comes from [Open-Meteo](https://open-meteo.com).
