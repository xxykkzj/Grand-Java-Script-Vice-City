# Music for the Blue Pelican Lounge

The lounge (old town, the blue ring in front of Tidewater Records) plays **recorded** jazz and country tracks
from this folder. Nothing here is baked into `dist/index.html`: the game fetches `manifest.json` and the audio
files next to it when it is served over http(s) (GitHub Pages, or any local web server). Opened from `file://`,
or with an empty list, the lounge keeps the game's own synthesised music and shows a small note.

The folder ships **empty on purpose**. No music has been downloaded or included.

## Licences that are allowed

Only add a track if you can point to its licence, and only under one of these:

| Licence | OK? | What you must do |
| --- | --- | --- |
| Public domain (including the Public Domain Mark) | yes | Record the source URL. Check the *recording* is public domain, not just the composition: an old song in a new recording is usually not free. |
| CC0 1.0 | yes | Record the source URL. |
| CC BY (any version) | yes | Credit the artist exactly as they ask; the credit appears on the in-game now-playing card and in the main README. |
| CC BY-SA, CC BY-NC, CC BY-ND, "royalty free", "free for personal use", YouTube rips, anything unclear | **no** | Leave it out. The game skips entries whose `licence` is not public domain, CC0 or CC BY. |

Good places to look: the Free Music Archive and the Internet Archive (filter by licence), Musopen (public-domain
recordings) and ccMixter (check each track's licence; many are CC BY-NC, which is not allowed here).

## Adding a track

1. Put the file in this folder. Use `.mp3` (plays everywhere) or `.ogg`/`.m4a`; keep it reasonably small
   (128-192 kbps is plenty in a bar). Use a plain file name: `low-tide-shuffle.mp3`.
2. Add an entry to `tracks` in `manifest.json`:

   ```json
   {
     "file": "low-tide-shuffle.mp3",
     "title": "Low Tide Shuffle",
     "artist": "Some Artist",
     "licence": "CC BY 4.0",
     "source": "https://example.org/the-page-you-downloaded-it-from",
     "genre": "jazz"
   }
   ```

   `file` is relative to this folder. `licence` must start with `Public domain`, `CC0` or `CC BY` (the game
   checks). `genre` is free text (jazz, country, swing, bluegrass, blues...).
3. Run `npm run build`: it also rewrites the **Music credits** section of the main README from this manifest.
4. Serve the repo (for example `python3 -m http.server` in the repo root, then open
   `http://localhost:8000/dist/index.html`), walk into the lounge and check the now-playing card.
   `E` at the jukebox or the stage skips to the next track.
