import type {NextConfig} from 'next';
const config:NextConfig={output:'export',images:{unoptimized:true},transpilePackages:['@compa/domain','@compa/client','@compa/world3d'],reactStrictMode:true};
export default config;
