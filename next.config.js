/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // eslint-config-next v16 + ESLint v9 produces a circular-JSON error with
    // the legacy .eslintrc format. Run `next lint` separately for linting.
    ignoreDuringBuilds: true,
  },
  webpack: (config) => {
    // On Windows, webpack's module cache is case-sensitive but NTFS is not.
    // The Next.js SWC loader resolves its own directory in lowercase while user
    // code uses the real casing, creating two React instances that break
    // useContext. Aliasing 'react$' ($ = exact-match, not prefix) to the
    // canonical file returned by require.resolve() collapses them to one entry.
    config.resolve.alias['react$'] = require.resolve('react');
    config.resolve.alias['react-dom$'] = require.resolve('react-dom');
    return config;
  },
};

module.exports = nextConfig;
