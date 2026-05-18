import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

let ffmpeg: FFmpeg | null = null;

export async function getFFmpeg() {
  if (ffmpeg) return ffmpeg;

  ffmpeg = new FFmpeg();
  
  // Load ffmpeg with custom core URL to avoid CORS issues and ensure compatibility
  const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
  });

  return ffmpeg;
}

export async function getFileDuration(file: File): Promise<number> {
  const ffmpeg = await getFFmpeg();
  const extension = file.name.split(".").pop()?.toLowerCase() || "mov";
  const inputName = `temp_input.${extension}`;
  
  await ffmpeg.writeFile(inputName, await fetchFile(file));
  
  // We use ffprobe-like behavior by running ffmpeg with no output
  // and parsing the duration from the logs. 
  // However, for simplicity in this environment, we'll just return a large number
  // or use a different approach. Actually, we can just try to extract until it fails.
  // But let's try to get it properly.
  let duration = 0;
  const durationRegex = /Duration: (\d+):(\d+):(\d+.\d+)/;
  
  const logHandler = ({ message }: { message: string }) => {
    const match = message.match(durationRegex);
    if (match) {
      const hours = parseFloat(match[1]);
      const minutes = parseFloat(match[2]);
      const seconds = parseFloat(match[3]);
      duration = hours * 3600 + minutes * 60 + seconds;
    }
  };

  ffmpeg.on("log", logHandler);
  await ffmpeg.exec(["-i", inputName]);
  ffmpeg.off("log", logHandler);
  
  return duration;
}

export async function extractAudioSegment(file: File, startTime: number, duration: number): Promise<Blob | null> {
  const ffmpeg = await getFFmpeg();
  const extension = file.name.split(".").pop()?.toLowerCase() || "mov";
  const inputName = "input_source." + extension;
  const outputName = "output_segment.mp3";

  // Write the file only if it doesn't exist to save memory
  // But since we want to be safe, we'll write it once and keep it
  // until the entire process is done.
  try {
    // Check if file exists in FS
    await ffmpeg.readFile(inputName);
  } catch (e) {
    await ffmpeg.writeFile(inputName, await fetchFile(file));
  }

  console.log(`Extracting audio: ${startTime}s to ${startTime + duration}s`);

  // Extract audio directly from the source at the given offset
  const result = await ffmpeg.exec([
    "-ss", startTime.toString(),
    "-i", inputName,
    "-t", duration.toString(),
    "-vn",
    "-acodec", "libmp3lame",
    "-ab", "128k",
    "-ar", "44100",
    outputName
  ]);

  if (result !== 0) {
    return null;
  }

  const data = await ffmpeg.readFile(outputName);
  
  // Cleanup the output file from FS to free memory
  await ffmpeg.deleteFile(outputName);

  if (data && data.length > 500) {
    return new Blob([data], { type: "audio/mpeg" });
  }
  
  return null;
}

export async function cleanupFFmpeg(file: File) {
  const ffmpeg = await getFFmpeg();
  const extension = file.name.split(".").pop()?.toLowerCase() || "mov";
  const inputName = "input_source." + extension;
  try {
    await ffmpeg.deleteFile(inputName);
  } catch (e) {
    // Ignore if already deleted
  }
}
