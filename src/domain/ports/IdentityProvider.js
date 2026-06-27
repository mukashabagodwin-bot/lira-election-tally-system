class IdentityProvider {
  async authenticate() { throw new Error('Not implemented'); }
  async verifyFederatedToken() { throw new Error('Not implemented'); }
  async issueApiToken() { throw new Error('Not implemented'); }
}

module.exports = IdentityProvider;
