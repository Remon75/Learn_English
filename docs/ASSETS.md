# Assets, Media and the Content Pipeline

Every asset shipped with Sparkle English is **generated from code in this
repository**. There is no stock photography, no icon font, no third-party
audio sample, no proprietary font and no binary art blob in the repository.
That means:

- the entire app can be rebuilt from source on an air-gapped machine,
- there are no third-party asset licences to honour or attribute,
- every asset is deterministic — the same script produces the same bytes,
- and replacing an asset is a file drop, not a code change.

```bash
npm run assets          # both generators
npm run assets:media    # audio + illustrations
npm run assets:icons    # PWA icons + favicon
```

---

## 1. What is in the box

| Asset | Count | Format | Generator |
|---|---|---|---|
| Lesson audio | **54** | WAV, 22.05 kHz, 16-bit mono | `scripts/generate-media.mjs` |
| Illustrations | **63** | SVG, 200×200 | `scripts/generate-media.mjs` |
| PWA icons | **3** | PNG, 192 px / 512 px / 512 px maskable | `scripts/generate-icons.mjs` |
| Favicon | **1** | SVG | `scripts/generate-icons.mjs` |

Total size: ~1.7 MiB for the whole media library (54 audio files at 1.7 MiB,
63 SVG illustrations at 17 KiB, icons at 8 KiB).

### 1.1 Audio inventory

| Group | Files |
|---|---|
| Greetings and family | `hello`, `goodbye`, `mum`, `dad`, `sister`, `brother` |
| Colours | `red`, `blue`, `green`, `yellow` |
| Animals | `cat`, `dog`, `word-cat`, `word-dog`, `word-fish`, `word-sun`, `animal-moo`, `family-animals` |
| Objects and places | `word-cup`, `word-bed`, `word-door`, `word-lamp`, `sun` |
| Pronouns and sentences | `pronoun-she`, `pronoun-we`, `sentence-dog-runs` |
| Story | `story-lost-duck` (2.4 s) |
| Alphabet | `letter-a` … `letter-z` (26 files) |
| Lesson announcement | `lesson-l1-u1-s1` |

### 1.2 Illustration inventory

| Group | Files |
|---|---|
| Colour balls | `ball-red`, `ball-blue`, `ball-green`, `ball-yellow` |
| Shapes | `shape-circle`, `shape-square`, `shape-triangle` |
| People and animals | `mum`, `dad`, `sister`, `brother`, `cat`, `dog`, `pig`, `duck`, `cow`, `hen`, `bird`, `bat` |
| Everyday objects | `cup`, `bed`, `door`, `lamp`, `apple`, `carrot`, `bus`, `sun`, `box` |
| Rooms | `room-kitchen`, `room-bathroom`, `room-garden` |
| Moods | `mood-happy`, `mood-sad`, `mood-angry` |
| Body and gesture | `hand`, `foot`, `wave` |
| Letters | `letter-a` … `letter-z` (26 files, stroked vector glyphs) |

---

## 2. The placeholder audio, stated plainly

**The generated audio is not speech.** It is a short, pleasant two-tone chime
per word, synthesised with a sine oscillator and a light vibrato. Each word
maps to a distinct pitch so that `listen` activities are *playable* — a child
can hear the difference between "cat" and "dog" — but they are not
meaningful narration.

This is a deliberate, documented placeholder. It exists so the entire product
can be built, tested and shipped **before** any voice assets exist, and so
that the audio pipeline can be validated end to end. Replacing it with real
narration is a file drop (§5) — no code change.

| Property | Value |
|---|---|
| Sample rate | 22,050 Hz |
| Bit depth | 16-bit |
| Channels | mono |
| Duration | 0.7 s for words, 1.2 s for the lesson announcement, 2.4 s for the story |
| Envelope | 12 ms attack, 125 ms release, to avoid clicks |

---

## 3. Logical paths and content negotiation

The curriculum never references a file extension. It references a **logical
path**:

```ts
audio('/media/audio/hello', 'Hello', 1.2, 'Hello')
image('/media/img/cat', 'A cat')
```

The API resolves the logical path to whatever format actually exists on
disk, using the `Accept` header:

| Kind | Preference order | Content types |
|---|---|---|
| Audio | `mp3` → `ogg` → `opus` → `wav` → `m4a` | `audio/mpeg`, `audio/ogg`, `audio/opus`, `audio/wav`, `audio/mp4` |
| Image | `svg` → `webp` → `png` → `jpg` → `jpeg` | `image/svg+xml`, `image/webp`, `image/png`, `image/jpeg` |

The API rewrites every media reference to a **concrete, extension-bearing URL**
before sending it to the client (`mediaUrl()` in `apps/api/src/routes/media.ts`).
This matters for audio: a browser's decoder picks a codec from the response,
and a URL without an extension leaves some decoders guessing.

**Consequence:** if you ship `hello.ogg` alongside `hello.wav`, the server
picks `ogg` for a client that accepts it and `wav` for one that does not. No
curriculum edit is required.

Media is served with `Cache-Control: public, max-age=31536000, immutable`,
because a logical id always maps to the same content.

---

## 4. Replacing an asset

### 4.1 Replace one file, same format

Drop the file in with the same name:

```bash
# a human recording of "hello", encoded as 16-bit mono WAV
cp ~/recordings/hello.wav apps/web/public/media/audio/hello.wav
```

Restart the API (it reads from disk on each request) and hard-reload the
client. Done.

### 4.2 Replace one file, different format

Add the new file and remove the old one:

```bash
ffmpeg -i ~/recordings/hello.wav -c:a libopus -b:a 48k apps/web/public/media/audio/hello.ogg
rm apps/web/public/media/audio/hello.wav
```

The API now serves `hello.ogg` to clients that accept Opus and `hello.wav`
to those that do not.

### 4.3 Replace a whole vocabulary with real narration

1. Record or generate one file per logical id (see §6 for local TTS).
2. Encode to Opus (best size/quality for speech) and keep a WAV fallback.
3. Place them in `apps/web/public/media/audio/`.
4. Update the `durationSec` on the `MediaRef` in
   `packages/shared/src/curriculum.ts` so the progress bar is honest.

The curriculum's `transcript` field is already populated for most prompts;
it is shown in the caregiver report.

### 4.4 Replacing the illustrations

SVG files are addressed the same way. Hand-authored art should follow the
same conventions:

- 200×200 `viewBox`, so it scales to any touch target,
- no embedded fonts (text becomes paths),
- no external references (`<image href="…">` would break the CSP),
- flat fills with a high-contrast palette,
- a distinct **silhouette** — the shape must be identifiable at 64 px, in
  greyscale, and to a child who cannot yet read.

---

## 5. Adding a new activity's media

1. Add the file:
   `apps/web/public/media/audio/my-new-word.wav`
2. Reference it logically in the curriculum:

   ```ts
   activity({
     id: 'a-new-listen',
     kind: 'listen',
     prompt: 'Listen',
     stimulus: audio('/media/audio/my-new-word', 'My new word', 1.0, 'My new word'),
     expected: 'my-new-word',
     stars: 1,
     skills: ['listening', 'vocabulary'],
   })
   ```

3. Rebuild the shared package if the API must see it:
   `npm run build --workspace @sparkle/shared`
4. Run `npm run assets` if you also want the generator to keep producing the
   placeholder — otherwise the generator will overwrite your file. **If you
   replace a generated file, remove its entry from `scripts/generate-media.mjs`
   in the same commit**, otherwise the next `npm run assets` silently reverts
   your work.

---

## 6. Producing real narration locally (no cloud, no cost)

### 6.1 Piper (MIT, fully offline neural TTS)

```bash
# Install Piper from its release page (no package manager needed)
wget https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_linux_x86_64.tar.gz
tar xzf piper_linux_x86_64.tar.gz

# Download a voice (one file, ~60 MB)
wget https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx
wget https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx.json

echo "Hello, world!" | ./piper/piper \
  --model en_US-amy-medium.onnx \
  --output_file hello.wav
```

Everything runs on your machine. No prompt text ever leaves it.

### 6.2 FFmpeg encoding

```bash
# Opus, the best size/quality ratio for speech
ffmpeg -i hello.wav -c:a libopus -b:a 48k -ar 24000 -ac 1 hello.ogg

# MP3 fallback for very old devices
ffmpeg -i hello.wav -c:a libmp3lame -b:a 64k -ar 24000 -ac 1 hello.mp3
```

Ship both: the API negotiates and every client gets something it can play.

### 6.3 Human narration

For a production deployment, recorded human speech is better than synthetic
speech for young learners, and it is the single highest-impact change in
Phase 2. A practical workflow:

1. A script lists every logical id and the exact line to say
   (`scripts/generate-media.mjs` holds the mapping).
2. Record in a quiet room with a consistent distance from the microphone.
3. Normalise loudness, trim silence, encode to Opus + MP3.
4. Drop the files into `apps/web/public/media/audio/`.

---

## 7. Iconography and the PWA icons

`scripts/generate-icons.mjs` writes real PNGs using a minimal, dependency-free
PNG encoder built on `node:zlib` (a CRC-32 implementation, a chunk writer and
a zlib-deflated IDAT stream). No image library is installed.

| File | Size | Purpose |
|---|---|---|
| `icons/icon-192.png` | 192×192 | Android / PWA manifest, 1× |
| `icons/icon-512.png` | 512×512 | PWA manifest, install splash |
| `icons/icon-512-maskable.png` | 512×512 | Maskable variant with safe-zone padding |
| `favicon.svg` | 64×64 viewBox | Browser tab icon |

The artwork is a four-point **spark** on an amber field. Replace it by
editing the drawing routine in the script, or by dropping in your own PNGs —
the manifest and the HTML reference the file names, not the bytes.

---

## 8. Offline caching of media

| Layer | Strategy | Effect |
|---|---|---|
| App shell | Precache — 16 entries, ~434 KiB | The app opens with no network at all. |
| Lesson media | Cache-first, 90-day expiry | A played lesson replays instantly offline. |
| PixiJS chunk | **Excluded** from precache, dynamically imported | A slow connection never waits for a particle engine. |

The precache manifest is deliberately small. Pre-caching all 117 media files
would make the first install large for no benefit — the media is fetched
lazily, on demand, and cached as it is heard.

---

## 9. Vector animation

The project ships two animation runtimes, both MIT:

| Runtime | Licence | Used for | Authoring |
|---|---|---|---|
| **Lottie-web** | MIT | Mascot beats and story sequences | Synfig Studio (GPL-3.0) exports Lottie JSON |
| **Rive runtime** (`@rive-app/canvas`) | MIT | Optional state-machine character | The Rive *editor* is proprietary and **not required** |

The default authoring path is **Synfig → Lottie**, because it is fully FOSS.
Rive is a drop-in alternative if you already use it; the runtime is MIT and
the editor is only a convenience.

---

## 10. Licence position

| Asset | Licence | Why |
|---|---|---|
| Generated audio | MIT | Synthesised by a script in this repository |
| Generated illustrations | MIT | Drawn by a script in this repository |
| Generated icons | MIT | Drawn by a script in this repository |
| Any asset you add | Your choice | Keep it MIT / Apache-2.0 / BSD / CC0 / CC-BY-SA, and record it in `docs/LICENSES.md` |

If you contribute art under CC-BY-SA, the share-alike obligation applies to
that artwork. The full dependency audit is in `docs/LICENSES.md`.

---

## 11. Regenerating everything from scratch

```bash
rm -rf apps/web/public/media apps/web/public/icons
npm run assets
```

The result is byte-identical to what is committed. If it is not, something
else wrote into those directories — check `git status` before committing.
