const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const debug = require('debug')('citizen:server');

const s3 = new S3Client({});

const S3_BUCKET = process.env.CITIZEN_AWS_S3_BUCKET;
if (process.env.CITIZEN_STORAGE === 's3' && !S3_BUCKET) {
  throw new Error('S3 storage requires CITIZEN_AWS_S3_BUCKET. Additionally, ensure that either '
    + 'AWS_PROFILE or AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are set. '
    + 'If running on AWS EC2 or ECS, IAM Roles may be used.');
}

const save = (res) => async (path, tarball) => {
  debug(`save the ${res} into ${path}.`);

  if (!path) { throw new Error('path is required.'); }
  if (!tarball) { throw new Error('tarball is required.'); }

  const params = {
    Bucket: S3_BUCKET,
    Key: `${res}s/${path}`,
    Body: tarball,
  };
  const result = await s3.send(new PutObjectCommand(params));
  return !!result.ETag;
}

const has = (res) => async (path) => {
  const params = {
    Bucket: S3_BUCKET,
    Key: `${res}s/${path}`,
  };

  try {
    const module = await s3.send(new GetObjectCommand(params));
    if (module.Body) {
      debug(`the ${res} already exist: ${path}.`);
      return true;
    }
  } catch (err) {
    if (err.name === 'NoSuchKey') {
      debug(`the ${res} doesn't exist: ${path}.`);
      return false;
    }

    throw err;
  }

  debug(`the ${res} doesn't exist: ${path}.`);
  return false;
}

const get = (res) => async (path) => {
  debug(`get the ${res}: ${path}.`);
  const params = {
    Bucket: S3_BUCKET,
    Key: `${res}s/${path}`,
  };
  const file = await s3.send(new GetObjectCommand(params));
  return await new Promise((resolve, reject) => {
    const chunks = [];
    file.Body.on('data', (chunk) => chunks.push(chunk));
    file.Body.on('error', reject);
    file.Body.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

module.exports = {
  type: () => 's3',
  saveModule: save('module'),
  hasModule: has('module'),
  getModule: get('module'),
  saveProvider: save('provider'),
  hasProvider: has('provider'),
  getProvider: get('provider'),
};
