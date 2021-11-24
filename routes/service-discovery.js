const { Router } = require('express');
const { Issuer } = require('openid-client');
const { authEnabled, authOidcEndpoint } = require('../lib/auth');
const { asyncMiddleware } = require('../lib/util');

const router = Router();

// ref: https://www.terraform.io/docs/internals/remote-service-discovery.html
router.get('/.well-known/terraform.json', asyncMiddleware(async (req, res) => {
  const body = {
    'modules.v1': '/v1/modules/',
    'providers.v1': '/v1/providers/',
  }

  if (authEnabled()) {
    const issuer = await Issuer.discover(authOidcEndpoint());

    body['login.v1'] = {
      'client': process.env.COGNITO_CLIENT_ID,
      'grant_types': ['authz_code'],
      'authz': issuer.metadata.authorization_endpoint,
      'token': issuer.metadata.token_endpoint,
      'ports': [10000, 10010],
    }
  }

  res.json(body);
}));

module.exports = router;
