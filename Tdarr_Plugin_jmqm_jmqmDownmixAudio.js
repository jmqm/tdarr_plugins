/* eslint-disable no-await-in-loop */

// npm dependencies.
const dependencies = [
  '@cospired/i18n-iso-languages'
];

const details = () => ({
  id: 'Tdarr_Plugin_jmqm_jmqmDownmixAudio',
  Stage: 'Pre-processing',
  Name: 'jmqm - Downmix audio tracks',
  Type: 'Audio',
  Operation: 'Transcode',
  Description: 'Downmixes audio tracks from 8 channels (7.1) to 2 channels (2.0). ' +
    'Downmixed tracks will use Opus. ' +
    'Example: 7.1 is using AAC; when creating 5.1, it will encoded with Opus. ' +
    '5.1 is using Opus; when creating 2.0, it will use Opus.',
  Version: '1.0',
  Tags: 'pre-processing,ffmpeg,audio only'
});

const generateFfmpegCommand = (streamId, audioId, codec, channelCount, title) =>
  `-map 0:${streamId} -c:a:${audioId} ${codec} -ac ${channelCount} -metadata:s:a:${audioId} "title=${title}" `;

// eslint-disable-next-line no-unused-vars
const plugin = (file, librarySettings, inputs, otherArguments) => {
  const response = {
    processFile: false,
    container: `.${file.container}`,
    handBrakeMode: false,
    FFmpegMode: true,
    reQueueAfter: true,
    infoLog: ''
  };

  // If the file is video, exit plugin.
  if (file.fileMedium !== 'video') {
    response.infoLog += '❌ File is not video.\n';
    response.processFile = false;
    return response;
  };

  // Set up required variables.
  const languages = require('@cospired/i18n-iso-languages');
  let ffmpegCommandInsert = '';
  let audioId = 0;
  let has2Channel = false;
  let has6Channel = false;
  let has8Channel = false;
  let convert = false;

  // Check audio track channels, flip 'has#Channel' variables.
  for (let i = 0; i < file.ffProbeData.streams.length; i++) {
    const stream = file.ffProbeData.streams[i];

    try {
      if (stream.codec_type.toLowerCase() === 'audio') {
        const channelCount = stream.channels;

        if (channelCount === 2 || channelCount === 3) {
          has2Channel = true;
        }

        if (channelCount === 6) {
          has6Channel = true;
        }

        if (channelCount === 8) {
          has8Channel = true;
        }
      }
    } catch (error) {
      // error
    }
  }

  // Downmix tracks.
  for (let i = 0; i < file.ffProbeData.streams.length; i++) {
    const stream = file.ffProbeData.streams[i];

    if (stream.codec_type.toLowerCase() === 'audio') {
      try {
        // Get channel count and parse language.
        const channelCount = stream.channels;
        const language = languages.getName(stream.tags.language, 'en');

        // 8 channel to 6.
        if (has8Channel && channelCount === 8 && !has6Channel) {
          ffmpegCommandInsert += generateFfmpegCommand(i, audioId, 'libopus', 6, `${language} [5.1 Surround]`)
          response.infoLog += `👷 Creating ${language} 6 channel track from 8 channel track...\n`;
          convert = true;
        }

        // 6 channel to 2.
        if (has6Channel && channelCount === 6 && !has2Channel) {
          ffmpegCommandInsert += generateFfmpegCommand(i, audioId, 'libopus', 2, `${language} [2.0 Stereo]`)
          response.infoLog += `👷 Creating ${language} 2 channel track from 6 channel track...\n`;
          convert = true;
        }
      } catch (error) {
        // error
      }

      audioId += 1;
    }
  }

  // Convert file if convert variable is set to true.
  response.processFile = convert;

  if (convert) {
    response.preset = `, -map 0 -c:v copy -c:a copy ${ffmpegCommandInsert} -c:s copy -strict -2 -max_muxing_queue_size 9999 `;
  } else {
    response.infoLog += '👍 File requires no work, or no further work.\n';
  }

  return response;
};

module.exports.dependencies = dependencies;
module.exports.details = details;
module.exports.plugin = plugin;

// This file was originally Tdarr_Plugin_MC93_Migz5ConvertAudio.
