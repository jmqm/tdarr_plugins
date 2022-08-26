/* eslint-disable no-await-in-loop */

// npm dependencies.
const dependencies = [
    '@cospired/i18n-iso-languages'
];

const details = () => ({
    id: 'Tdarr_Plugin_jmqm_jmqmRenameAudioTracks',
    Stage: 'Pre-processing',
    Name: 'jmqm - Rename audio tracks',
    Type: 'Audio',
    Operation: 'Transcode',
    Description: 'Rename audio tracks with the language and channel layout.' +
        'e.g. Japanese, 2 channels = Japanese [2.0 Stereo]' +
        'e.g. English, 6 channels = English [5.1 Surround]',
    Version: '1.0',
    Tags: 'pre-processing,ffmpeg,audio only,configurable',
    Inputs: [
        {
            name: variables.format,
            type: 'string',
            defaultValue: `${variables.language} [${variables.channelLayout} ${variables.audioType}]`,
            inputUI: {
                type: 'text',
            },
            tooltip: `
            Rename audio tracks using a custom format.\\n

            Variables to use:\\n
            ${variables.language} - e.g. English, Japanese\\n
            ${variables.channelLayout} - e.g. 2.0, 5.1\\n
            ${variables.audioType} - e.g. Stereo, Surround\\n

            Example:\\n
            ${variables.language} [${variables.channelLayout} ${variables.audioType}]
            `,
        },
    ],
});


const plugin = (file, librarySettings, inputs, otherArguments) => {
    const response = {
        processFile: false,
        container: `.${file.container}`,
        handBrakeMode: false,
        FFmpegMode: true,
        reQueueAfter: true,
        infoLog: ''
    };

    global.inputs = inputs;

    if (getFormat() === undefined) {
        response.infoLog += `❌ Input '${variables.format}' is undefined.\n`;
        response.processFile = false;
        return response;
    }

    if (file.fileMedium !== 'video') {
        response.infoLog += '❌ File is not video.\n';
        response.processFile = false;
        return response;
    };

    const languages = require('@cospired/i18n-iso-languages');
    let ffmpegCommandInsert = '';
    let audioId = 0;
    let renameTracks = false;

    for (let i = 0; i < file.ffProbeData.streams.length; i++) {
        const stream = file.ffProbeData.streams[i];
        if (stream.codec_type.toLowerCase() !== 'audio') continue;

        const language = languages.getName(stream.tags.language, 'en');
        const channelLayout = getChannelLayout(stream.channel_layout);
        const audioType = getAudioType(stream.channels);

        if (language === undefined || language === 'undefined') {
            response.infoLog += `❗ Audio track id ${audioId}'s language is undefined.`;
            continue;
        }

        const currentTitle = stream.tags.title;
        const newTitle = generateTitle(language, channelLayout, audioType);

        if (currentTitle !== undefined && newTitle !== currentTitle) {
            ffmpegCommandInsert += generateFfmpegCommand(audioId, newTitle);
            response.infoLog += `👷 Renaming track from '${currentTitle}' to '${newTitle}'.`;
            renameTracks = true;
        }

        audioId++;
    }

    if (renameTracks) {
        response.preset = `, -map 0 -c:v copy -c:a copy ${ffmpegCommandInsert} -c:s copy -strict -2 -max_muxing_queue_size 9999 `;
    } else {
        response.infoLog += '👍 File requires no work, or no further work.\n';
    }

    response.processFile = renameTracks;
    return response;
};


const global = {
    inputs: '',
    response: { }
};

const variables = {
    format: 'format', // This is hardcoded elsewhere as well.
    language: '$language',
    channelLayout: '$channelLayout',
    audioType: '$audioType'
};


const getChannelLayout = (channelLayoutRaw) => {
    var channelLayout = channelLayoutRaw.toLowerCase();

    channelLayout = channelLayout
        .replace('stereo', '2.0')
        .replace('(side)', '');

    return channelLayout;
}

const getAudioType = (channelCount) => {
    return audioType = channelCount >= 4 ? 'Surround' : 'Stereo';
};

const getFormat = () => {
    return global.inputs.format;
};

const generateTitle = (language, channelLayout, audioType) => {
    const format = getFormat();

    return format
        .replace(variables.language, language)
        .replace(variables.channelLayout, channelLayout)
        .replace(variables.audioType, audioType);
};

const generateFfmpegCommand = (audioId, title) => {
    return `-metadata:s:a:${audioId} "title=${title}" `;
};


module.exports.dependencies = dependencies;
module.exports.details = details;
module.exports.plugin = plugin;

// This file was originally Tdarr_Plugin_MC93_Migz5ConvertAudio.
