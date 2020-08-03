const { execSync: exec } = require('child_process');
const {
  renameSync: rename,
  readdirSync: readdir,
  unlinkSync: rm,
  statSync: stat,
  mkdirSync: mkdir,
  rmdirSync: rmdir,
} = require('fs');
const { resolve } = require('path');


const usage = (msg = undefined) => {
  const code = msg ? -1 : 0;
  if (msg) console.warn(msg);
  console.log(`
Usage: ${process.argv[1]} -i {inputMedia} [-o {outputBasename}]
  If called with a video, will convert that video to a .msu and .pcm file
  If called with an audio file, will convert it to .pcm
`.trim());
  process.exit(code);
};
const exists = path => {
  try {
    stat(path);
    return true;
  } catch (e) {
    return false;
  }
};

const compile = (src) => {
  console.log(`--- Compiling ${src}`);
  const source = resolve(__dirname, `csrc/${src}.c`);
  const target = resolve(__dirname, `bin/${src}`);
  const cc = process.env.CC || 'gcc';
  exec(`${cc} -o "${target}" "${source}"`);
  if (!exists(target) && !exists(`${target}.exe`)) {
    console.error(`Couldn't compile ${src}; please make sure gcc is in your system path.`);
    process.exit(-1);
  }
};

const getCmd = cmd => {
  const nix = resolve(__dirname, `bin/${cmd}`);
  const win = resolve(__dirname, `bin\\${cmd}.exe`);
  if (!exists(nix) && !exists(win)) compile(cmd);
  return exists(nix) ? nix : win;
}

const wav2msu = (input, output) => {
  const cmd = `${getCmd('wav2msu')} -o "${output}" "${input}"`;
  console.log(`--- Running ${cmd}`);
  exec(cmd);
};

const msu1conv = (dir, out) => {
  const here = process.cwd();
  process.chdir(dir);
  const cmd = getCmd('msu1conv');
  console.log(`--- Running ${cmd}`);
  exec(cmd);
  process.chdir(here);
  rename(`${dir}/out.msu`, out);
};


const getOptions = (args) => {
  const options = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg[0] === '-') { switch(arg) {
      case '-i':
      case '--input':
        options.input = args[++i];
        break;
      case '-o':
      case '--output':
        options.output = args[++i];
        break;
      case '-ao':
      case '--audio-out':
        options.audioOut = args[++i];
        break;
      case '-vo':
      case '--video-out':
        options.videoOut = args[++i];
        break;
      default:
        usage(`Bad argument: ${arg}`);
    } } else {
      usage(`Bad argument: ${arg}`);
    }
  }
  if (options.input && !options.output) {
    options.output = options.input.replace(/\.[^\.]+$/, '');
  }
  if (!options.input || !options.output) {
    usage(`An input and output are required`);
  }
  return options;
};

const ENC = { encoding: 'utf-8' };

const getStreams = (file) => {
  const cmd = `ffprobe -v quiet "${input}" -print_format json -show_format -show_streams`;
  console.log(`--- Getting info on ${file}: ${cmd}`);
  const { streams } = JSON.parse(exec(cmd, ENC));
  const video = streams.filter(stream => stream.codec_type === 'video');
  const audio = streams.filter(stream => stream.codec_type === 'audio');
  return { video, audio };
};

const processVideo = (file, stream, { output, videoOut }) => {
  const ar = stream.width / stream.height;
  const tar = 224 / 144;
  let width, height, pw, ph;
  if (ar > tar) {
    width = 224; height = Math.round(stream.height * 224 / stream.width); pw = 0; ph = 144 - height;
  } else {
    height = 144; width = Math.round(stream.width * 144 / stream.height); pw = 224 - width; ph = 0;
  }
  const cmd = `ffmpeg -i "${file}" -y -vcodec targa -vf "scale=${width}:${height},pad=224:144" -f image2 "${output}/%08d.tga"`;
  console.log(`--- Extracting video: ${cmd}`);
  exec(cmd, ENC);
  msu1conv(output, videoOut || `${output}-${stream.index}.msu`);
  readdir(output, ENC).filter(file => file.endsWith('.tga')).forEach(file => rm(`${output}/${file}`));
};

const processAudio = (file, stream, { output, audioOut }) => {
  const cmd = `ffmpeg -i "${file}" -y -ar 44100 -sample_fmt s16 -f wav -bitexact "${output}/${output}.wav"`;
  console.log(`--- Extracting audio: ${cmd}`);
  exec(cmd, ENC);
  wav2msu(`${output}/${output}.wav`, audioOut || `${output}-${stream.index}.pcm`);
  rm(`${output}/${output}.wav`);
};
const opts = getOptions(process.argv.slice(2));
const { input, output, audioOut, videoOut } = opts;

mkdir(resolve(output), { recursive: true });

const { video, audio } = getStreams(input);
if (audioOut && audio.length !== 1) {
  usage(`-ao / --audio-out only works when there's only one audio stream in the input file. Use -o / --output instead.`);
}
if (videoOut && video.length !== 1) {
  usage(`-vo / --video-out only works when there's only one video stream in the input file.  Use -o / --output instead.`);
}
video.forEach(stream => processVideo(input, stream, opts));
audio.forEach(stream => processAudio(input, stream, opts));
rmdir(resolve(output));
