const { execSync } = require('child_process');
const request = require('sync-request');
const appveyorBuild = process.env.APPVEYOR_BUILD_NUMBER || '';
const travisBuild = process.env.TRAVIS_BUILD_NUMBER || '';
const commit = process.env.TRAVIS_COMMIT || '';
const travisPr = process.env.TRAVIS_PULL_REQUEST || 'false';
const travisTag = process.env.TRAVIS_TAG || '';

// ignore local builds
if (!appveyorBuild && !travisBuild) {
  console.info('Attempting to find closest Git tag');
  let version = 'local';
  try {
    execSync('git fetch');
    const commit = execSync('git rev-parse HEAD')
      .toString()
      .trim();
    const tag = execSync(`git describe --tags ${commit} --abbrev=0`)
      .toString()
      .trim();

    if (tag) {
      version = tag.substr(1) + '-' + commit.substring(0, 7);
    }
  } catch (err) {
    console.error(err);
  }

  console.info(`Local build, using version "${version}"`);
  module.exports = version;
  return;
}

// use release tag if given
if (travisTag) {
  const version = travisTag.match(/^v?([0-9\.]+)$/)[1];
  console.info('Using Travis tag version', travisTag, version);
  module.exports = version;
  return;
}

// Fetch latest GH release tag version
var res = request('GET', 'https://api.github.com/repos/excaliburjs/Excalibur/releases/latest', {
  headers: {
    'User-Agent': 'excaliburjs/0.1'
  }
});

const statusCode = res.statusCode;

if (statusCode !== 200) {
  throw Error('Fatal error fetching GH release version, status: ' + statusCode);
}

const tag_name = JSON.parse(res.getBody()).tag_name;
const version = tag_name.match(/^v?([0-9\.]+)$/)[1]; // strip v prefix

// Nuget doesn't yet support the + suffix in versions
const appveyVersion = version + '.' + appveyorBuild + '-alpha';
const travisVersion = version + '-alpha.' + travisBuild + '+' + commit.substring(0, 7);

if (appveyorBuild) {
  console.info('Using Appveyor build as version', appveyVersion);
  module.exports = appveyVersion;
} else {
  console.info('Using Travis build as version', travisVersion);
  module.exports = travisVersion;
}
