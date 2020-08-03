MSU Tool
--------
Simple tool to wrap commands for ffmpeg, msu1conv (convert a stack of tgas to MSU
video) and wav2msu (convert a wav file to MSU audio), so as to simplify preparing
assets for MSU-1 enabled SNES projects.

## Requirements

You must have gcc (or any other compiler, so long as you set the `CC`
environment variable appropriately), and ffmpeg installed and available
from your PATH.

## Usage

```bash
npx media2msu -i my_video.mp4 -o my_video
```

`my_video.mp4` will be converted to `my_video-#.msu` and `my_video-#.pcm` (where
the `#` is the stream number for the video/audio stream).

Because there's usually only one audio or video stream, you can also use:

```bash
npx media2msu -i my_music.wav -ao my_audio.pcm
npx media2msu -i my_music.mp4 -ao my_video.pcm -vo my_video.msu
```
