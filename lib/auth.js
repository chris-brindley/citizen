const CognitoAuthenticator = require('cognito-express')
const fs = require('fs').promises
const os = require('os')
const path = require('path')

const logger = require('./logger')

let cognito
const authEnabled = () => ['COGNITO_CLIENT_ID', 'COGNITO_USER_POOL'].every(x => !!process.env[x])
if (authEnabled()) {
  cognito = new CognitoAuthenticator({
    region: process.env.COGNITO_REGION || 'us-east-1',
    cognitoUserPoolId: process.env.COGNITO_USER_POOL,
    tokenUse: 'access',
  });
}

module.exports = {
  authEnabled,
  authOidcEndpoint: () => authEnabled() ? cognito.iss : '',
  authMiddleware: (req, res, next) => {
    if (!authEnabled()) return next();

    const auth = req.header('authorization');
    if (!auth) {
      logger.error('No Authorization header present')
      return res.status(401).send('Authorization missing');
    }

    const parts = auth.split(/\s+/)
    if (parts[0].toLowerCase() !== 'bearer') {
      logger.error('Not bearer authorization')
      return res.status(401).send('Invalid authorization');
    }
    if (parts.length !== 2) {
      logger.error('Invalid bearer authorization header')
      return res.status(401).send('Invalid authorization');
    }

    const token = parts[1]

    cognito.validate(token, (err, response) => {
      if (err) {
        logger.error(err);
        return res.status(401).send(err);
      }

      req.auth = { user: response }
      next()
    })
  },
  getTokenForHost: async (host) => {
    const credFile = path.join(os.homedir(), '.terraform.d', 'credentials.tfrc.json');
    const buffer = await fs.readFile(credFile);
    const creds = JSON.parse(buffer.toString('utf-8'));

    const url = new URL(host)

    if (creds.credentials && creds.credentials[url.host]) {
      return creds.credentials[url.host].token
    }
  },
}
